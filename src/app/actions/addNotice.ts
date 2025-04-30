'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { MongoClient, Db } from 'mongodb';

// Define the expected schema for the form data coming from the client
const formDataSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  noticeType: z.enum(['text', 'pdf', 'image', 'video']),
  priority: z.string().transform(Number).refine(val => val >= 1 && val <= 5, {
      message: "Priority must be between 1 and 5",
  }).default("3"),
  content: z.string().optional(),
  imageUrl: z.string().optional(), // URL from form (can be empty)
  fileName: z.string().optional(), // Original file name (useful for context, not directly saved unless needed)
});

// ** MongoDB Setup **
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

async function connectToDatabase(): Promise<Db> {
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in .env');
  }
  if (!dbName) {
    throw new Error('MONGODB_DB is not defined in .env');
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB for addNotice");
    // Return the Db instance directly
    const db = client.db(dbName);
     // Store client instance on the Db object to close it later
    (db as any)._client = client;
    return db;
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    // Close client if connection failed during db selection
    await client.close();
    throw error;
  }
}

async function closeDatabaseConnection(db: Db) {
    const client = (db as any)._client;
    if (client) {
        await client.close();
        console.log("MongoDB connection closed for addNotice.");
    }
}

export async function addNotice(formData: FormData): Promise<{ success: boolean; error?: string }> {
  let db: Db | null = null;
  try {
    // Validate and parse form data
    const rawData = Object.fromEntries(formData.entries());
    const validatedData = formDataSchema.safeParse(rawData);

    if (!validatedData.success) {
      console.error("Validation errors:", validatedData.error.format());
      // Construct a user-friendly error message from validation errors
       const errorMessages = validatedData.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, error: `Invalid form data. ${errorMessages}` };
    }

    const { title, noticeType, priority, content, imageUrl } = validatedData.data;

    // Construct the new notice object
    const newNotice = {
      title,
      // Store content only if it's a text notice
      content: noticeType === 'text' ? (content || '') : '',
      // Store imageUrl if it's provided AND it's not a text notice
      imageUrl: noticeType !== 'text' ? (imageUrl || '') : '',
      priority,
      createdBy: 'admin_interface', // Placeholder user or get from session if auth exists
      date: new Date(), // Use Date object for MongoDB
      // Store the original noticeType, getCollegeNotices will derive contentType based on imageUrl/content later
      // Adding a field like 'originalType' might be useful for debugging if needed.
      // contentType: noticeType, // We derive this in getCollegeNotices now
    };

    console.log('Attempting to add new notice:', newNotice);

    // ** MongoDB Integration **
    db = await connectToDatabase();
    const collection = db.collection('notices'); // Ensure 'notices' is your collection name

    const result = await collection.insertOne(newNotice);

    if (!result.acknowledged || !result.insertedId) {
      console.error('Failed to insert notice into MongoDB');
      return { success: false, error: 'Failed to save notice to the database.' };
    }

    console.log('Notice added to MongoDB with id:', result.insertedId);

    revalidatePath('/'); // Clear the cache for the home page to refetch data

    return { success: true };

  } catch (error: any) {
    console.error('Error in addNotice server action:', error);
    let errorMessage = 'An unexpected error occurred while adding the notice.';
    if (error.message.includes('MONGODB_URI')) {
        errorMessage = 'Database connection failed. Please check configuration.';
    } else if (error.name === 'MongoNetworkError') {
        errorMessage = 'Could not connect to the database.';
    }
    // Add more specific error handling if needed
    return { success: false, error: errorMessage };
  } finally {
      if (db) {
         await closeDatabaseConnection(db);
      }
  }
}
