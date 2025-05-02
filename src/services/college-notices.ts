'use server';

import type { ObjectId } from 'mongodb'; // Import ObjectId type if needed for clarity
import { MongoClient, Db, WithId, Document } from 'mongodb'; // Import necessary types

/**
 * Represents a college notice with various content types.
 */
export interface CollegeNotice {
  _id: string; // Unique identifier from the database (converted to string)
  title: string;
  content: string; // Content, primarily for text notices (might be empty for file notices)
  imageUrl: string; // URL for PDF, image, or video files (from upload)
  priority: number; // Notice priority
  createdBy: string; // Identifier of the creator
  date: string; // ISO date string
  originalFileName: string; // Original name of the uploaded file
  __v?: number; // Version key, optional
  contentType: 'text' | 'pdf' | 'image' | 'video'; // Explicitly determined content type
}


// ** MongoDB Setup **
const uri = process.env.MONGODB_URI || "mongodb+srv://ionode:ionode@ionode.qgqbadm.mongodb.net/Notices?retryWrites=true&w=majority&appName=ionode"; // Use default connection string if not set
const dbName = process.env.MONGODB_DB || "Notices"; // Use default DB name if not set

async function connectToDatabase(): Promise<Db> {
  if (!uri) {
    console.error('[connectToDatabase] FATAL ERROR: MONGODB_URI environment variable is not set.');
    throw new Error('Database configuration error: MONGODB_URI is missing.');
  }
   if (!dbName) {
     console.error('[connectToDatabase] FATAL ERROR: MONGODB_DB is not defined in .env or default string');
    throw new Error('Database configuration error: MONGODB_DB is missing.');
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("[connectToDatabase] Connected successfully to MongoDB for getCollegeNotices.");
    const db = client.db(dbName);
    // Store client on Db object for later closing
     Object.defineProperty(db, '_client', { value: client, writable: false, enumerable: false, configurable: true });
    return db;
  } catch (error) {
    console.error("[connectToDatabase] Failed to connect to MongoDB", error);
    await client.close(); // Close client if connection failed
    throw error; // Rethrow to indicate failure
  }
}

async function closeDatabaseConnection(db: Db) {
    const client = (db as any)._client;
    if (client && typeof client.close === 'function') {
       try {
           await client.close();
           console.log("[closeDatabaseConnection] MongoDB connection closed successfully for getCollegeNotices.");
       } catch (closeError) {
            console.error("[closeDatabaseConnection] Error closing MongoDB connection:", closeError);
       }
    } else {
        // console.warn("[closeDatabaseConnection] No active MongoDB client found on Db object to close.");
    }
}


/**
 * Asynchronously retrieves college notices from the MongoDB database.
 * Determines contentType based on the value saved in the DB.
 * Sorts notices by priority (ascending) and then by date (descending).
 * @returns A promise that resolves to an array of CollegeNotice objects.
 */
// Use no-store cache to always get fresh data
export async function getCollegeNotices(): Promise<CollegeNotice[]> {
  console.log('[getCollegeNotices] Attempting to fetch notices...');
  let db: Db | null = null;
  try {
    db = await connectToDatabase();
    const collection = db.collection('notices');

    // Fetch notices sorted by priority then date directly from the database
    // Use WithId<Document> for better type safety with raw MongoDB documents
    const noticesFromDb: WithId<Document>[] = await collection.find({})
                                        .sort({ priority: 1, date: -1 }) // Sort by priority asc, date desc
                                        .toArray();

    console.log(`[getCollegeNotices] Fetched ${noticesFromDb.length} raw documents from DB.`);
     if (noticesFromDb.length > 0) {
        // Log the first few raw documents for inspection
        console.log('[getCollegeNotices] Raw documents sample (first 3):', JSON.stringify(noticesFromDb.slice(0, 3), null, 2));
     }

    const validatedNotices: CollegeNotice[] = noticesFromDb.map((item) => {
       console.log(`[getCollegeNotices] Processing document with _id: ${item._id}`); // Log which doc is being processed

       // --- Date Validation ---
       let isoDate: string;
       try {
            // Check if item.date exists and is a valid Date object or string
            if (!item.date) throw new Error('Date field is missing');
            const dateValue = item.date instanceof Date ? item.date : new Date(item.date);
            if (isNaN(dateValue.getTime())) throw new Error('Invalid date value');
            isoDate = dateValue.toISOString();
       } catch (e: any) {
            console.warn(`[getCollegeNotices] Invalid or missing date for notice _id: ${item._id}, title: "${item.title || 'N/A'}". Error: ${e.message}. Defaulting to current date.`);
            isoDate = new Date().toISOString(); // Default to now if invalid/missing
       }

       // --- Content Type Determination ---
       const validTypes = ['text', 'pdf', 'image', 'video'];
       let determinedContentType: 'text' | 'pdf' | 'image' | 'video' = 'text'; // Default

       // 1. Use the contentType field stored in the database as the primary source
       if (item.contentType && validTypes.includes(item.contentType)) {
           determinedContentType = item.contentType;
           console.log(`[getCollegeNotices] Using DB contentType: '${determinedContentType}' for _id: ${item._id}`);
       }
       // 2. Fallback logic (should ideally not be needed if `addNotice` saves contentType correctly)
       else {
            console.warn(`[getCollegeNotices] DB contentType missing or invalid for _id: ${item._id}. Inferring based on content/URL.`);
            if (item.imageUrl && typeof item.imageUrl === 'string') {
                const url = item.imageUrl.toLowerCase();
                 // Basic extension check - might need refinement for complex URLs
                 const extension = url.split('.').pop()?.split('?')[0]?.split('#')[0]; // Get extension, handle query/fragment
                 console.log(`[getCollegeNotices] Inferring from URL: ${item.imageUrl}, extension: ${extension}`);
                 if (extension === 'pdf') {
                     determinedContentType = 'pdf';
                 } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension ?? '')) {
                     determinedContentType = 'image';
                 } else if (['mp4', 'webm', 'mov', 'ogg', 'mkv', 'avi'].includes(extension ?? '')) {
                     determinedContentType = 'video';
                 } else if (item.content && typeof item.content === 'string' && item.content.trim()) {
                    // If URL exists but type unknown, check if content also exists
                    determinedContentType = 'text';
                    console.log(`[getCollegeNotices] Unknown URL extension, but content exists. Setting type to 'text'.`);
                 } else {
                    // Fallback if URL exists but type unknown and no content
                     determinedContentType = 'text'; // Or perhaps 'unknown'? Revisit this case.
                     console.log(`[getCollegeNotices] Unknown URL extension, no content. Defaulting type to 'text'.`);
                 }
            } else if (item.content && typeof item.content === 'string' && item.content.trim()) {
                 console.log(`[getCollegeNotices] No imageUrl, but content exists. Setting type to 'text'.`);
                determinedContentType = 'text';
            } else {
                 console.log(`[getCollegeNotices] No imageUrl and no content. Defaulting type to 'text'.`);
                 determinedContentType = 'text'; // Default if neither URL nor content provide clues
            }
       }
       console.log(`[getCollegeNotices] Final determined contentType: '${determinedContentType}' for _id: ${item._id}`);
       // --- End Content Type Determination ---

       // --- Field Assignment and Validation ---
       const noticeObj: CollegeNotice = {
         // Ensure _id is always a string
         _id: item._id ? item._id.toString() : `generated_${Math.random()}`,
         title: typeof item.title === 'string' ? item.title : 'Untitled Notice',
         // Assign content only if it's a text notice, ensure it's a string
         content: determinedContentType === 'text' && typeof item.content === 'string' ? item.content : '',
         // Assign imageUrl only if it's NOT text, ensure it's a string and valid relative path (starts with /)
         // Ensure URL is correctly formed for public access
         imageUrl: determinedContentType !== 'text' && typeof item.imageUrl === 'string' && item.imageUrl.startsWith('/uploads/') ? item.imageUrl : '',
         // Validate priority, default to 3 if invalid
         priority: typeof item.priority === 'number' && item.priority >= 1 && item.priority <= 5 ? item.priority : 3,
         createdBy: typeof item.createdBy === 'string' ? item.createdBy : 'Unknown',
         date: isoDate,
         // Assign originalFileName only if it's NOT text, ensure it's a string
         originalFileName: determinedContentType !== 'text' && typeof item.originalFileName === 'string' ? item.originalFileName : '',
         __v: typeof item.__v === 'number' ? item.__v : undefined,
         contentType: determinedContentType,
       };

       // --- Post-Assignment Warnings ---
       if (noticeObj.contentType !== 'text' && !noticeObj.imageUrl) {
           console.warn(`[getCollegeNotices] Notice _id: ${noticeObj._id} is type '${noticeObj.contentType}' but lacks a valid imageUrl. Original DB value: '${item.imageUrl}'`);
       }
       if (noticeObj.contentType === 'text' && !noticeObj.content.trim()) {
           // This might be acceptable if title is enough, but good to note.
           // console.warn(`[getCollegeNotices] Notice _id: ${noticeObj._id} is type 'text' but has empty content.`);
       }

        console.log(`[getCollegeNotices] Processed document _id: ${noticeObj._id} into:`, noticeObj);
       return noticeObj;

    }); // End map

    console.log(`[getCollegeNotices] Successfully processed ${validatedNotices.length} notices.`);
    // The database query already sorts, no need to sort again here unless needed for complex logic later.
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
 * Fetches high-priority text notices (priority 1).
 * @returns A promise that resolves to an array of strings (bulletin items).
 */
export async function getBulletinAnnouncements(): Promise<string[]> {
  console.log('[getBulletinAnnouncements] Fetching high-priority text notices...');
  let db: Db | null = null;
  try {
    db = await connectToDatabase();
    const collection = db.collection('notices');

    // Fetch top 5 text notices with priority 1, sorted by date descending
    const highPriorityTextNotices = await collection.find({ contentType: 'text', priority: 1 })
                                                    .sort({ date: -1 })
                                                    .limit(5)
                                                    .toArray();
    console.log(`[getBulletinAnnouncements] Found ${highPriorityTextNotices.length} high-priority text notices.`);

    // Format notices for the bulletin
    const bulletinItems = highPriorityTextNotices.map(n =>
        // Combine title and a snippet of content if available
        n.title + (n.content ? `: ${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}` : '')
    );


    if (bulletinItems.length > 0) {
      console.log('[getBulletinAnnouncements] Returning fetched bulletin items.');
      return bulletinItems;
    } else {
      // Fallback if no high-priority text notices found
      console.log("[getBulletinAnnouncements] No high-priority text notices found, using static fallback data.");
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
     console.log("[getBulletinAnnouncements] Fetch failed, using static fallback bulletin data.");
     return [
       'Welcome to the College Notifier App!',
       'Check back often for important updates.',
       'Have a great semester!',
       'Admissions Open for 2025 Session.',
       'Scholarship Application Deadline Approaching.',
       'Upcoming Holiday: College Closed on Monday.'
     ];
  } finally {
     if (db) {
       await closeDatabaseConnection(db);
     }
  }
}
