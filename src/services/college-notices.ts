'use server';

import type { ObjectId } from 'mongodb'; // Import ObjectId type if needed for clarity
import { MongoClient, Db } from 'mongodb';

/**
 * Represents a college notice with various content types.
 */
export interface CollegeNotice {
  _id: string; // Unique identifier from the database (converted to string)
  title: string;
  content?: string; // Content, primarily for text notices
  imageUrl?: string; // URL for PDF, image, or video files (from upload)
  priority: number; // Notice priority
  createdBy: string; // Identifier of the creator
  date: string; // ISO date string
  originalFileName?: string; // Original name of the uploaded file
  __v?: number; // Version key, optional
  // Content type stored directly in the database based on form submission
  contentType: 'text' | 'pdf' | 'image' | 'video';
}


// ** MongoDB Setup **
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "Notices";

async function connectToDatabase(): Promise<Db> {
  if (!uri) {
    console.error('FATAL ERROR: MONGODB_URI environment variable is not set.');
    throw new Error('Database configuration error: MONGODB_URI is missing.');
  }
  if (!dbName) {
      console.error('FATAL ERROR: MONGODB_DB environment variable is not set.');
      throw new Error('Database configuration error: MONGODB_DB is missing.');
  }


  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB for getCollegeNotices");
    const db = client.db(dbName);
    (db as any)._client = client;
    return db;
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    await client.close();
    throw error;
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
 * Uses the 'contentType' stored in the database.
 * @returns A promise that resolves to an array of CollegeNotice objects.
 */
export async function getCollegeNotices(): Promise<CollegeNotice[]> {
  let db: Db | null = null;
  try {
    db = await connectToDatabase();
    const collection = db.collection('notices');

    // Fetch notices sorted by priority then date from the database itself
    const noticesFromDb = await collection.find({})
                                        .sort({ priority: 1, date: -1 })
                                        .toArray();
    console.log("Fetched notices from DB:", noticesFromDb.length);

    const validatedNotices: CollegeNotice[] = noticesFromDb.map((item: any) => {
      // Directly use the contentType stored in the database if it's valid, otherwise default to 'text'
      const validTypes = ['text', 'pdf', 'image', 'video'];
      const dbContentType = item.contentType && validTypes.includes(item.contentType) ? item.contentType : 'text';

      // If it's supposed to be a file type but imageUrl is missing, treat as text (or log warning)
      if (dbContentType !== 'text' && !item.imageUrl) {
          console.warn(`Notice "${item.title}" is type '${dbContentType}' but lacks an imageUrl. Treating as text.`);
          // Potentially set dbContentType = 'text'; here if you prefer
      }
      // If it's text type but content is missing, log warning
      if (dbContentType === 'text' && !(item.content && typeof item.content === 'string' && item.content.trim())) {
          console.warn(`Notice "${item.title}" is type 'text' but lacks content.`);
      }


      console.log(`Notice: ${item.title}, DB ContentType: ${item.contentType}, Validated Type: ${dbContentType}`);


      let isoDate: string;
      try {
           isoDate = item.date instanceof Date ? item.date.toISOString() : new Date(item.date).toISOString();
           if (isNaN(new Date(isoDate).getTime())) throw new Error('Invalid date');
      } catch (e) {
           console.warn(`Invalid or missing date for notice "${item.title}". Defaulting to current date.`);
           isoDate = new Date().toISOString();
      }


      return {
        _id: item._id ? item._id.toString() : `generated_${Math.random()}`,
        title: item.title || 'Untitled Notice',
        content: item.content || '',
        imageUrl: item.imageUrl || '', // Use the potentially empty string
        priority: typeof item.priority === 'number' ? item.priority : 3,
        createdBy: item.createdBy || 'Unknown',
        date: isoDate,
        originalFileName: item.originalFileName || '',
        __v: item.__v,
        contentType: dbContentType, // Use the validated content type
      };
    }).filter((notice): notice is CollegeNotice => notice !== null);


    // Sorting is now handled by the database query, but you could re-sort here if needed
    // validatedNotices.sort((a, b) => {
    //   if (a.priority !== b.priority) {
    //     return a.priority - b.priority;
    //   }
    //   return new Date(b.date).getTime() - new Date(a.date).getTime();
    // });

    console.log("Validated notices:", validatedNotices.length);
    return validatedNotices;

  } catch (error) {
    console.error('Failed to fetch or process college notices:', error);
    return [];
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
    // Example: Fetch top priority notices to use as announcements
    const notices = await getCollegeNotices();
    const highPriority = notices
      .filter(n => n.priority === 1) // Filter for highest priority
      .slice(0, 5) // Limit the number of announcements
      .map(n => n.title); // Use the title as the announcement

    if (highPriority.length > 0) {
      return highPriority;
    }
  } catch (error) {
    console.error("Failed to fetch notices for bulletin:", error);
  }

  // Fallback static data if fetching fails or no high-priority notices
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
