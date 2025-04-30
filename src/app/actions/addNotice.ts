'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { MongoClient } from 'mongodb';

// Define the expected schema for the form data coming from the client
const formDataSchema = z.object({
  title: z.string(),
  noticeType: z.enum(['text', 'pdf', 'image', 'video']),
  priority: z.string().transform(Number),
  content: z.string().optional(),
  imageUrl: z.string().optional(), // URL from file upload (placeholder for now)
  fileName: z.string().optional(), // Original file name
});

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

export async function addNotice(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate and parse form data
    const rawData = Object.fromEntries(formData.entries());
    const validatedData = formDataSchema.safeParse(rawData);

    if (!validatedData.success) {
      console.error("Validation errors:", validatedData.error.errors);
      return { success: false, error: 'Invalid form data.' };
    }

    const { title, noticeType, priority, content, imageUrl } = validatedData.data;

    // Construct the new notice object
    const newNotice = {
      title,
      content: noticeType === 'text' ? content : '', // Only store content for text notices
      imageUrl: noticeType !== 'text' ? (imageUrl || '') : '', // Store URL for non-text notices
      priority,
      createdBy: 'admin_interface', // Placeholder user
      date: new Date().toISOString(),
      contentType: noticeType
    };

    console.log('Adding new notice:', newNotice);

    // ** MongoDB Integration **
    try {
      const db = await connectToDatabase();
      const collection = db.collection('notices'); // Replace 'notices' with your collection name
      const result = await collection.insertOne(newNotice);

      if (!result.acknowledged) {
        console.error('Failed to insert notice into MongoDB');
        return { success: false, error: 'Failed to save notice to the database.' };
      }

      console.log('Notice added to MongoDB with id:', result.insertedId);

    } catch (dbError) {
      console.error('Database error:', dbError);
      return { success: false, error: 'An unexpected error occurred while accessing the database.' };
    }

    revalidatePath('/'); // Clear the cache for the home page

    return { success: true };

  } catch (error) {
    console.error('Error in addNotice server action:', error);
    return { success: false, error: 'An unexpected error occurred while adding the notice.' };
  }
}
