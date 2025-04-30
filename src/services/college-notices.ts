'use server';

import type { ObjectId } from 'mongodb'; // Import ObjectId type if needed for clarity
import { MongoClient, Db } from 'mongodb';

/**
 * Represents a college notice with various content types.
 * Matches the provided API data structure.
 */
export interface CollegeNotice {
  _id: string; // Unique identifier from the database (converted to string)
  title: string;
  content?: string; // Content, primarily for text notices
  imageUrl?: string; // URL for PDF, image, or video files
  priority: number; // Notice priority
  createdBy: string; // Identifier of the creator
  date: string; // ISO date string
  __v?: number; // Version key, optional
  // Derived property, not directly from API but essential for filtering/rendering
  contentType: 'text' | 'pdf' | 'image' | 'video';
}


// ** MongoDB Setup **
// Use environment variables, provide defaults ONLY for local development if necessary,
// but prefer direct environment variable setting.
const uri = process.env.MONGODB_URI; // No default here for security best practice
const dbName = process.env.MONGODB_DB || "Notices"; // Default DB name if not set

async function connectToDatabase(): Promise<Db> {
  if (!uri) {
    // More informative error for missing URI
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
    // Store client instance on the Db object to close it later
    (db as any)._client = client;
    return db;
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
     // Ensure client is closed even if connection fails mid-way
    await client.close();
    throw error; // Re-throw error to be caught by calling function
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
 *
 * @returns A promise that resolves to an array of CollegeNotice objects.
 */
export async function getCollegeNotices(): Promise<CollegeNotice[]> {
  let db: Db | null = null; // Keep track of the Db object to close connection
  try {
    db = await connectToDatabase();
    const collection = db.collection('notices'); // Use your actual collection name

    // Fetch all notices from the database
    const noticesFromDb = await collection.find({}).toArray();
    console.log("Fetched notices from DB:", noticesFromDb.length); // Log fetched count

    // Validate and map the data to the CollegeNotice interface
    const validatedNotices: CollegeNotice[] = noticesFromDb.map((item: any) => {
      let contentType: 'text' | 'pdf' | 'image' | 'video' = 'text'; // Default assumption

      // Robust check for imageUrl
      const imageUrl = item.imageUrl && typeof item.imageUrl === 'string' ? item.imageUrl.trim().toLowerCase() : '';

      if (imageUrl) {
         // More reliable extension checking
         if (imageUrl.endsWith('.pdf')) {
            contentType = 'pdf';
         } else if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(imageUrl)) { // Case-insensitive image check
            contentType = 'image';
         } else if (/\.(mp4|webm|mov|avi|mkv)$/i.test(imageUrl)) { // Case-insensitive video check
            contentType = 'video';
         } else {
             // If URL exists but isn't recognized, check for content
             if (item.content && typeof item.content === 'string' && item.content.trim()) {
                 contentType = 'text';
             } else {
                 // If URL isn't file and no content, maybe default to 'text' or log warning?
                 // For now, stick to 'text' based on title
                 contentType = 'text';
                 console.warn(`Notice "${item.title}" has unrecognized imageUrl and no content. Defaulting to 'text'. URL: ${item.imageUrl}`);
             }
         }
      } else if (item.content && typeof item.content === 'string' && item.content.trim()) {
        // If no valid imageUrl, but content exists, it's definitely text
        contentType = 'text';
      } else {
        // If neither valid imageUrl nor content exists, default to text (using title only)
        contentType = 'text';
         console.warn(`Notice "${item.title}" has no imageUrl or content. Defaulting to 'text'.`);
      }

      // console.log(`Item: ${item.title}, ImageUrl: ${item.imageUrl}, Content: ${item.content}, Detected Type: ${contentType}`);

      // Ensure date is a valid ISO string, default to now if invalid/missing
       let isoDate: string;
       try {
           isoDate = item.date instanceof Date ? item.date.toISOString() : new Date(item.date).toISOString();
           // Check if the parsed date is valid
           if (isNaN(new Date(isoDate).getTime())) {
               throw new Error('Invalid date');
           }
       } catch (e) {
           console.warn(`Invalid or missing date for notice "${item.title}". Defaulting to current date.`);
           isoDate = new Date().toISOString();
       }


      return {
        _id: item._id ? item._id.toString() : `generated_${Math.random()}`, // Handle missing _id?
        title: item.title || 'Untitled Notice', // Ensure title exists
        content: item.content || '', // Ensure content is at least an empty string
        // Use the original (non-lowercase) URL if it exists, otherwise empty string
        imageUrl: item.imageUrl && typeof item.imageUrl === 'string' ? item.imageUrl.trim() : '',
        priority: typeof item.priority === 'number' ? item.priority : 3, // Default priority
        createdBy: item.createdBy || 'Unknown', // Default creator
        date: isoDate, // Use validated/defaulted ISO date string
        __v: item.__v, // Include version key if present
        contentType: contentType, // Set the derived content type
      };
    }).filter(notice => notice !== null); // Filter out any potential nulls if validation were stricter

    // Sort notices primarily by priority (ascending, lower number is higher priority)
    // and secondarily by date (descending, newest first)
    validatedNotices.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority; // Lower priority number first
      }
      // If priorities are the same, sort by date descending (newest first)
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    console.log("Validated and sorted notices:", validatedNotices.length); // Log processed count
    return validatedNotices;

  } catch (error) {
    console.error('Failed to fetch or process college notices:', error);
    return []; // Return empty array on error
  } finally {
    if (db) {
      await closeDatabaseConnection(db); // Ensure the client connection is closed via the Db object
    }
  }
}


/**
 * Asynchronously retrieves important bulletin announcements.
 * In a real app, this would likely fetch from an API or database.
 *
 * @returns A promise that resolves to an array of strings representing bulletin announcements.
 */
export async function getBulletinAnnouncements(): Promise<string[]> {
  // TODO: Implement this by calling an API or fetching from a database if needed.
  // Using static data for now.
  // Consider fetching high-priority notices (e.g., priority 1) for the bulletin
  await new Promise(resolve => setTimeout(resolve, 50)); // Simulate async fetch
  return [
    'Welcome to the College Notifier App!',
    'Check back often for important updates.',
    'Have a great semester!',
    'Admissions Open for 2025 Session.',
    'Scholarship Application Deadline Approaching.',
    'Upcoming Holiday: College Closed on Monday.'
  ];
}
