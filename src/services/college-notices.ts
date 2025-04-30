'use server';

/**
 * Represents a college notice with various content types.
 * Matches the provided API data structure.
 */
export interface CollegeNotice {
  _id: string; // Unique identifier from the database
  title: string;
  content?: string; // Optional content, primarily for text notices
  imageUrl?: string; // URL for PDF, image, or video files
  priority: number; // Notice priority
  createdBy: string; // Identifier of the creator
  date: string; // ISO date string
  __v?: number; // Version key, optional
  // Derived property, not directly from API but useful for filtering
  contentType: 'text' | 'pdf' | 'image' | 'video';
}

import { MongoClient } from 'mongodb';

// ** MongoDB Setup **
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

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
    throw error;
  }
}

/**
 * Asynchronously retrieves college notices from the MongoDB database.
 *
 * @returns A promise that resolves to an array of CollegeNotice objects.
 */
export async function getCollegeNotices(): Promise<CollegeNotice[]> {
  try {
    const db = await connectToDatabase();
    const collection = db.collection('notices'); // Replace 'notices' with your collection name

    // Fetch all notices from the database and convert them to an array
    const notices = await collection.find({}).toArray();

    // Validate and map the data to the CollegeNotice interface
    const validatedNotices: CollegeNotice[] = notices.map((item: any) => {
      let contentType: 'text' | 'pdf' | 'image' | 'video' = 'text'; // Default to text

      if (item.imageUrl) {
        const url = item.imageUrl.toLowerCase();
        if (url.endsWith('.pdf')) {
          contentType = 'pdf';
        } else if (url.match(/\.(jpeg|jpg|gif|png|webp)$/)) {
          contentType = 'image';
        } else if (url.match(/\.(mp4|mov|avi|webm)$/)) {
          contentType = 'video';
        }
        // If imageUrl exists but doesn't match known file types, keep as 'text'
        // or handle as a generic link if needed.
      } else if (!item.content) {
         // If no imageUrl and no content, maybe default or handle differently
         // For now, keep as 'text' assuming title is always present.
      }


      return {
        _id: item._id.toString(), // Convert ObjectId to string
        title: item.title,
        content: item.content || '', // Ensure content is at least an empty string
        imageUrl: item.imageUrl || '', // Ensure imageUrl is at least an empty string
        priority: item.priority || 3, // Default priority if missing
        createdBy: item.createdBy,
        date: item.date,
        __v: item.__v,
        contentType: contentType, // Set the derived content type
      };
    }).filter((notice: CollegeNotice | null): notice is CollegeNotice => notice !== null); // Filter out any potential nulls if validation fails

    // Sort notices primarily by priority (ascending, lower number is higher priority)
    // and secondarily by date (descending, newest first)
    validatedNotices.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return validatedNotices;
  } catch (error) {
    console.error('Failed to fetch or process college notices:', error);
    return []; // Return empty array
  }
}

/**
 * Asynchronously retrieves important bulletin announcements.
 * In a real app, this would likely fetch from an API.
 *
 * @returns A promise that resolves to an array of strings representing bulletin announcements.
 */
export async function getBulletinAnnouncements(): Promise<string[]> {
  // TODO: Implement this by calling an API or fetching from a database.
  return [
    'Welcome to the College Notifier App!',
    'Check back often for important updates.',
    'Have a great semester!',
    'Admissions Open for 2025 Session.',
    'Scholarship Application Deadline Approaching.',
    'Upcoming Holiday: College Closed on Monday.'
  ];
}
