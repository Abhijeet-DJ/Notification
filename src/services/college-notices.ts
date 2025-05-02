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
const uri = process.env.MONGODB_URI || "mongodb+srv://ionode:ionode@ionode.qgqbadm.mongodb.net/Notices?retryWrites=true&w=majority&appName=ionode"; // Use default connection string if not set
const dbName = process.env.MONGODB_DB || "Notices"; // Use default DB name if not set

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
    console.log("[DEBUG] Raw data from DB:", noticesFromDb); // Added Debug Log

    const validatedNotices: CollegeNotice[] = noticesFromDb.map((item: any) => {
      console.log("[DEBUG] Processing raw DB item:", item); // Added Debug Log

      // Validate date
      let isoDate: string;
      try {
           isoDate = item.date instanceof Date ? item.date.toISOString() : new Date(item.date).toISOString();
           if (isNaN(new Date(isoDate).getTime())) throw new Error('Invalid date'); // Check if date is valid
      } catch (e) {
           console.warn(`Invalid or missing date for notice "${item.title}". Defaulting to current date.`);
           isoDate = new Date().toISOString(); // Default to now if invalid
      }

      // --- Content Type Determination Logic ---
      const validTypes = ['text', 'pdf', 'image', 'video'];
      let determinedContentType: 'text' | 'pdf' | 'image' | 'video' = 'text'; // Default to text

      // 1. Prioritize the contentType saved in the database if it's valid
      if (item.contentType && validTypes.includes(item.contentType)) {
          determinedContentType = item.contentType;
      }
      // 2. If DB contentType is missing or invalid, infer from imageUrl
      else if (item.imageUrl) {
          const url = item.imageUrl.toLowerCase();
          if (url.endsWith('.pdf')) {
              determinedContentType = 'pdf';
          } else if (url.match(/\.(jpeg|jpg|png|gif|webp|svg)$/)) {
              determinedContentType = 'image';
          } else if (url.match(/\.(mp4|webm|mov|ogg)$/)) { // Added common video types
              determinedContentType = 'video';
          } else if (item.content && typeof item.content === 'string' && item.content.trim()) {
            // Fallback to text if URL doesn't match and content exists
            determinedContentType = 'text';
          }
      }
      // 3. If no imageUrl, and content exists, it's text
      else if (item.content && typeof item.content === 'string' && item.content.trim()) {
          determinedContentType = 'text';
      }
      // 4. Final fallback (should be rare if data is saved correctly)
      else {
          determinedContentType = 'text'; // Default if nothing else matches
      }
      // --- End Content Type Determination ---

       // --- Debugging Log ---
       if (determinedContentType === 'image') {
           console.log(`[DEBUG] Image Notice Processed: Title="${item.title}", DB Type=${item.contentType}, Inferred Type=${determinedContentType}, URL=${item.imageUrl}`);
       }
       // --- End Debugging Log ---


      // Logging for debugging
      console.log(`Notice: "${item.title}", DB Type: ${item.contentType}, Inferred Type: ${determinedContentType}, URL: ${item.imageUrl}, Content Exists: ${!!item.content}`);

      // If it's supposed to be a file type but imageUrl is missing, log a warning
      if (determinedContentType !== 'text' && !item.imageUrl) {
          console.warn(`Notice "${item.title}" is type '${determinedContentType}' but lacks an imageUrl.`);
      }
      // Log if text type lacks content but isn't supposed to be a file type
      if (determinedContentType === 'text' && !(item.content && typeof item.content === 'string' && item.content.trim())) {
          console.warn(`Notice "${item.title}" is type 'text' but lacks content.`);
      }

      const noticeObj = {
        _id: item._id ? item._id.toString() : `generated_${Math.random()}`,
        title: item.title || 'Untitled Notice',
        // Store content only if it's explicitly a text notice (based on FINAL determined type)
        content: determinedContentType === 'text' ? (item.content || '') : '',
        // Store the imageUrl regardless, but it's primarily used for file types
        imageUrl: item.imageUrl || '',
        priority: typeof item.priority === 'number' ? item.priority : 3,
        createdBy: item.createdBy || 'Unknown',
        date: isoDate,
        originalFileName: item.originalFileName || '',
        __v: item.__v,
        contentType: determinedContentType, // Use the final determined/validated content type
      };
      console.log("[DEBUG] Mapped notice object:", noticeObj); // Added Debug Log
      return noticeObj;

    }).filter((notice): notice is CollegeNotice => notice !== null); // Filter out any potential nulls if mapping failed

    // No need to sort again here, database sort is efficient
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
 * Fetches high-priority text notices.
 * @returns A promise that resolves to an array of strings.
 */
export async function getBulletinAnnouncements(): Promise<string[]> {
  try {
    const notices = await getCollegeNotices(); // Re-use fetching logic
    const highPriority = notices
      .filter(n => n.contentType === 'text' && n.priority === 1) // Filter for highest priority TEXT notices
      .slice(0, 5) // Limit the number of announcements
      .map(n => n.title + (n.content ? `: ${n.content.substring(0, 100)}...` : '')); // Use title and maybe some content

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
