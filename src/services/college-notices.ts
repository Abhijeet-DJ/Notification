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
    console.log("[getCollegeNotices] Connected to MongoDB");
    const db = client.db(dbName);
    // Store client on Db object for later closing
    (db as any)._client = client;
    return db;
  } catch (error) {
    console.error("[getCollegeNotices] Failed to connect to MongoDB", error);
    await client.close(); // Close client if connection failed
    throw error; // Rethrow to indicate failure
  }
}

async function closeDatabaseConnection(db: Db) {
    const client = (db as any)._client;
    if (client) {
        await client.close();
        console.log("[getCollegeNotices] MongoDB connection closed.");
    }
}


/**
 * Asynchronously retrieves college notices from the MongoDB database.
 * Determines contentType based on the value saved in the DB.
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
    console.log("[getCollegeNotices] Fetched notices from DB:", noticesFromDb.length);

    const validatedNotices: CollegeNotice[] = noticesFromDb.map((item: any) => {
       // Validate date
       let isoDate: string;
       try {
            isoDate = item.date instanceof Date ? item.date.toISOString() : new Date(item.date).toISOString();
            if (isNaN(new Date(isoDate).getTime())) throw new Error('Invalid date'); // Check if date is valid
       } catch (e) {
            console.warn(`[getCollegeNotices] Invalid or missing date for notice "${item.title}". Defaulting to current date.`);
            isoDate = new Date().toISOString(); // Default to now if invalid
       }

       // --- Content Type Determination ---
       const validTypes = ['text', 'pdf', 'image', 'video'];
       let determinedContentType: 'text' | 'pdf' | 'image' | 'video' = 'text'; // Default

       // 1. Use the contentType field stored in the database as the primary source
       if (item.contentType && validTypes.includes(item.contentType)) {
           determinedContentType = item.contentType;
           console.log(`[DEBUG][getCollegeNotices] Using DB contentType: ${determinedContentType} for "${item.title}"`);
       }
       // 2. Fallback logic (should ideally not be needed if `addNotice` saves contentType correctly)
       else {
            console.warn(`[getCollegeNotices] DB contentType missing or invalid for "${item.title}". Inferring based on content/URL.`);
            if (item.imageUrl) {
                const url = item.imageUrl.toLowerCase();
                 const extension = url.split('.').pop()?.split('?')[0]; // Get extension, remove query params
                 if (extension === 'pdf') {
                     determinedContentType = 'pdf';
                 } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension ?? '')) {
                     determinedContentType = 'image';
                 } else if (['mp4', 'webm', 'mov', 'ogg', 'mkv', 'avi'].includes(extension ?? '')) {
                     determinedContentType = 'video';
                 } else if (item.content && typeof item.content === 'string' && item.content.trim()) {
                    determinedContentType = 'text'; // If URL doesn't match, but content exists
                 } else {
                    determinedContentType = 'text'; // Ultimate fallback if URL exists but type unknown
                 }
            } else if (item.content && typeof item.content === 'string' && item.content.trim()) {
                determinedContentType = 'text';
            }
       }
       // --- End Content Type Determination ---

       // Log if file type lacks URL or text type lacks content (optional warnings)
       if (determinedContentType !== 'text' && !item.imageUrl) {
           console.warn(`[getCollegeNotices] Notice "${item.title}" is type '${determinedContentType}' but lacks an imageUrl.`);
       }
       if (determinedContentType === 'text' && !(item.content && typeof item.content === 'string' && item.content.trim())) {
          // console.warn(`[getCollegeNotices] Notice "${item.title}" is type 'text' but lacks content.`);
       }

       const noticeObj: CollegeNotice = {
         _id: item._id ? item._id.toString() : `generated_${Math.random()}`,
         title: item.title || 'Untitled Notice',
         // Use content only if it's text type, otherwise empty string
         content: determinedContentType === 'text' ? (item.content || '') : '',
         // Use imageUrl only if it's NOT text type, otherwise empty string
         imageUrl: determinedContentType !== 'text' ? (item.imageUrl || '') : '',
         priority: typeof item.priority === 'number' ? item.priority : 3,
         createdBy: item.createdBy || 'Unknown',
         date: isoDate,
         // Use originalFileName only if it's NOT text type
         originalFileName: determinedContentType !== 'text' ? (item.originalFileName || '') : '',
         __v: item.__v,
         contentType: determinedContentType, // Use the determined type
       };
       return noticeObj;

    }).filter((notice): notice is CollegeNotice => notice !== null);

    console.log("[getCollegeNotices] Validated notices count:", validatedNotices.length);
    // The database query already sorts, no need to sort again here.
    return validatedNotices;

  } catch (error) {
    console.error('[getCollegeNotices] Failed to fetch or process college notices:', error);
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
  let notices: CollegeNotice[] = [];
  try {
    // Use a separate fetch or filter existing notices based on requirements
    const db = await connectToDatabase();
    const collection = db.collection('notices');
    const highPriorityTextNotices = await collection.find({ contentType: 'text', priority: 1 })
                                                    .sort({ date: -1 })
                                                    .limit(5)
                                                    .toArray();
    await closeDatabaseConnection(db);

    const bulletinItems = highPriorityTextNotices.map(n =>
        n.title + (n.content ? `: ${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}` : '')
    );


    if (bulletinItems.length > 0) {
      return bulletinItems;
    } else {
      // Fallback if no high-priority text notices found
      console.log("[getBulletinAnnouncements] No high-priority text notices, using static data.");
       return [
         'Welcome to the College Notifier App!',
         'Check back often for important updates.',
         'Have a great semester!',
         'Admissions Open for 2025 Session.',
         'Scholarship Application Deadline Approaching.',
         'Upcoming Holiday: College Closed on Monday.'
       ];
    }

  } catch (error) {
    console.error("[getBulletinAnnouncements] Failed to fetch notices for bulletin:", error);
     // Fallback static data if fetch fails
     console.log("[getBulletinAnnouncements] Fetch failed, using static bulletin data.");
     return [
       'Welcome to the College Notifier App!',
       'Check back often for important updates.',
       'Have a great semester!',
       'Admissions Open for 2025 Session.',
       'Scholarship Application Deadline Approaching.',
       'Upcoming Holiday: College Closed on Monday.'
     ];
  }
}
