'use server';

import type { ObjectId } from 'mongodb'; // Import ObjectId type if needed for clarity
import { MongoClient, Db } from 'mongodb';

/**
 * Represents a college notice with various content types.
 */
export interface CollegeNotice {
  _id: string; // Unique identifier from the database (converted to string)
  title: string;
  content?: string; // Content, primarily for text notices (might be empty for file notices)
  imageUrl?: string; // URL for PDF, image, or video files (from upload)
  priority: number; // Notice priority
  createdBy: string; // Identifier of the creator
  date: string; // ISO date string
  originalFileName?: string; // Original name of the uploaded file
  __v?: number; // Version key, optional
  contentType: 'text' | 'pdf' | 'image' | 'video'; // Explicitly determined content type
}


// ** MongoDB Setup **
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "Notices"; // Use default if not set

async function connectToDatabase(): Promise<Db> {
  if (!uri) {
    console.error('FATAL ERROR: MONGODB_URI environment variable is not set.');
    throw new Error('Database configuration error: MONGODB_URI is missing.');
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB for getCollegeNotices");
    const db = client.db(dbName);
    // Store client on Db object for later closing
    (db as any)._client = client;
    return db;
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    await client.close(); // Close client if connection failed
    throw error; // Rethrow to indicate failure
  }
}

async function closeDatabaseConnection(db: Db) {
    const client = (db as any)._client;
    if (client) {
        await client.close();
        console.log("MongoDB connection closed for getCollegeNotices.");
    }
}


/**
 * Asynchronously retrieves college notices from the MongoDB database.
 * Determines contentType based on imageUrl extension or presence of content.
 * @returns A promise that resolves to an array of CollegeNotice objects.
 */
export async function getCollegeNotices(): Promise<CollegeNotice[]> {
  let db: Db | null = null;
  try {
    db = await connectToDatabase();
    const collection = db.collection('notices');

    // Fetch notices sorted by priority then date directly from the database
    const noticesFromDb = await collection.find({})
                                        .sort({ priority: 1, date: -1 }) // Sort by priority asc, date desc
                                        .toArray();
    console.log("Fetched notices from DB:", noticesFromDb.length);

    const validatedNotices: CollegeNotice[] = noticesFromDb.map((item: any) => {
      // Validate date
      let isoDate: string;
      try {
           isoDate = item.date instanceof Date ? item.date.toISOString() : new Date(item.date).toISOString();
           if (isNaN(new Date(isoDate).getTime())) throw new Error('Invalid date'); // Check if date is valid
      } catch (e) {
           console.warn(`Invalid or missing date for notice "${item.title}". Defaulting to current date.`);
           isoDate = new Date().toISOString(); // Default to now if invalid
      }

      // Determine contentType - prioritize imageUrl for file types
      let determinedContentType: 'text' | 'pdf' | 'image' | 'video' = 'text'; // Default to text
      if (item.imageUrl) {
          const url = item.imageUrl.toLowerCase();
          if (url.endsWith('.pdf')) {
              determinedContentType = 'pdf';
          } else if (url.match(/\.(jpeg|jpg|png|gif|webp|svg)$/)) {
              determinedContentType = 'image';
          } else if (url.match(/\.(mp4|webm|mov|ogg)$/)) { // Added common video types
              determinedContentType = 'video';
          }
      }
      // Fallback to text if no matching imageUrl and content exists
      // Or if the item explicitly has contentType 'text' saved (from form)
      else if ( (item.content && typeof item.content === 'string' && item.content.trim()) || item.contentType === 'text') {
          determinedContentType = 'text';
      }

      // Use the explicitly saved contentType from the DB if it exists and is valid, overriding inference if needed
      const validTypes = ['text', 'pdf', 'image', 'video'];
      const dbContentType = item.contentType && validTypes.includes(item.contentType) ? item.contentType : determinedContentType;

      // If it's supposed to be a file type but imageUrl is missing, log a warning, but keep the intended type for filtering
      if (dbContentType !== 'text' && !item.imageUrl) {
          console.warn(`Notice "${item.title}" is type '${dbContentType}' but lacks an imageUrl.`);
      }
      // Log if text type lacks content
      if (dbContentType === 'text' && !(item.content && typeof item.content === 'string' && item.content.trim())) {
          console.warn(`Notice "${item.title}" is type 'text' but lacks content.`);
      }

      console.log(`Notice: ${item.title}, DB Type: ${item.contentType}, Final Type: ${dbContentType}, URL: ${item.imageUrl}`);

      return {
        _id: item._id ? item._id.toString() : `generated_${Math.random()}`,
        title: item.title || 'Untitled Notice',
        // Store content only if it's explicitly a text notice (based on final type)
        content: dbContentType === 'text' ? (item.content || '') : '',
        imageUrl: item.imageUrl || '', // Keep imageUrl even if type is text (might be a link)
        priority: typeof item.priority === 'number' ? item.priority : 3,
        createdBy: item.createdBy || 'Unknown',
        date: isoDate,
        originalFileName: item.originalFileName || '',
        __v: item.__v,
        contentType: dbContentType, // Use the final determined/validated content type
      };
    }).filter((notice): notice is CollegeNotice => notice !== null); // Filter out any potential nulls if mapping failed

    // Sorting is now handled by the database query, but double-check if needed.
    // The DB sort should be sufficient.

    console.log("Validated notices:", validatedNotices.length);
    return validatedNotices;

  } catch (error) {
    console.error('Failed to fetch or process college notices:', error);
    return []; // Return empty array on error
  } finally {
    if (db) {
      await closeDatabaseConnection(db);
    }
  }
}

/**
 * Asynchronously retrieves important bulletin announcements.
 * Placeholder - Fetches high-priority notices or static data.
 * @returns A promise that resolves to an array of strings.
 */
export async function getBulletinAnnouncements(): Promise<string[]> {
  try {
    const notices = await getCollegeNotices(); // Re-use fetching logic
    const highPriority = notices
      .filter(n => n.priority === 1) // Filter for highest priority
      .slice(0, 5) // Limit the number of announcements
      .map(n => n.title); // Use the title as the announcement

    if (highPriority.length > 0) {
      return highPriority;
    }
  } catch (error) {
    console.error("Failed to fetch notices for bulletin:", error);
    // Fall through to static data if fetch fails
  }

  // Fallback static data
  console.log("Using static bulletin data.");
  return [
    'Welcome to the College Notifier App!',
    'Check back often for important updates.',
    'Have a great semester!',
    'Admissions Open for 2025 Session.',
    'Scholarship Application Deadline Approaching.',
    'Upcoming Holiday: College Closed on Monday.'
  ];
}
