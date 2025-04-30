'use server';

import type { ObjectId } from 'mongodb'; // Import ObjectId type if needed for clarity

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

import { MongoClient } from 'mongodb';

// ** MongoDB Setup **
const uri = process.env.MONGODB_URI || "mongodb+srv://ionode:ionode@ionode.qgqbadm.mongodb.net/Notices?retryWrites=true&w=majority&appName=ionode";
const dbName = process.env.MONGODB_DB || "Notices"; // Default DB name if not set in env

async function connectToDatabase() {
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in .env');
  }
  if (!dbName) {
    throw new Error('MONGODB_DB is not defined in .env');
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    return client.db(dbName);
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    throw error; // Re-throw error to be caught by calling function
  }
}

/**
 * Asynchronously retrieves college notices from the MongoDB database.
 *
 * @returns A promise that resolves to an array of CollegeNotice objects.
 */
export async function getCollegeNotices(): Promise<CollegeNotice[]> {
  let client: MongoClient | null = null; // Keep track of the client to close it
  try {
    const db = await connectToDatabase();
    client = (db as any).client; // Get the client instance from the db object
    const collection = db.collection('notices'); // Use your actual collection name

    // Fetch all notices from the database
    const noticesFromDb = await collection.find({}).toArray();
    console.log("Fetched notices from DB:", noticesFromDb.length); // Log fetched count

    // Validate and map the data to the CollegeNotice interface
    const validatedNotices: CollegeNotice[] = noticesFromDb.map((item: any) => {
      let contentType: 'text' | 'pdf' | 'image' | 'video' = 'text'; // Default assumption

      if (item.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.trim() !== '') {
        const url = item.imageUrl.toLowerCase().trim();
        // Check for file extensions first
        if (url.endsWith('.pdf')) {
          contentType = 'pdf';
        } else if (url.match(/\.(jpeg|jpg|gif|png|webp)$/)) {
          contentType = 'image';
        } else if (url.match(/\.(mp4|mov|avi|webm)$/)) {
          contentType = 'video';
        } else {
           // If imageUrl exists but is not a recognized file type, treat as text for now
           // or potentially add a 'link' type later if needed.
           // But if content also exists, 'text' is a better fit.
           if (item.content && typeof item.content === 'string' && item.content.trim() !== '') {
             contentType = 'text';
           } else {
             // Fallback if imageUrl is present but not a file, and no content
             contentType = 'text'; // Or consider 'link' or handle differently
           }
        }
      } else if (item.content && typeof item.content === 'string' && item.content.trim() !== '') {
         // If no valid imageUrl, but content exists, it's definitely text
        contentType = 'text';
      } else {
        // If neither valid imageUrl nor content exists, default to text (using title only)
        contentType = 'text';
      }

      // console.log(`Item: ${item.title}, ImageUrl: ${item.imageUrl}, Content: ${item.content}, Detected Type: ${contentType}`); // Debugging log

      return {
        _id: item._id.toString(), // Convert ObjectId to string
        title: item.title || 'Untitled Notice', // Ensure title exists
        content: item.content || '', // Ensure content is at least an empty string
        imageUrl: item.imageUrl || '', // Ensure imageUrl is at least an empty string
        priority: typeof item.priority === 'number' ? item.priority : 3, // Default priority if missing or invalid
        createdBy: item.createdBy || 'Unknown', // Default creator
        date: item.date instanceof Date ? item.date.toISOString() : new Date().toISOString(), // Ensure date is ISO string
        __v: item.__v,
        contentType: contentType, // Set the derived content type
      };
    }); // Filter out any potential nulls if validation were stricter

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
    if (client) {
      await client.close(); // Ensure the client connection is closed
      console.log("MongoDB connection closed.");
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
