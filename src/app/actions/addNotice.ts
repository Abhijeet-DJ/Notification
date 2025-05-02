'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { MongoClient, Db } from 'mongodb';

// --- Placeholder for actual file upload service removed ---

// Define validation schema expecting imageUrl for file-based types
const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  noticeType: z.enum(['text', 'pdf', 'image', 'video']),
  priority: z.string().transform(Number).refine(val => val >= 1 && val <= 5, {
      message: "Priority must be between 1 and 5",
  }).default("3"),
  // Allow content to be explicitly undefined or an empty string, required for 'text'
  content: z.string().optional().nullable().transform(val => val ?? ''),
  // Expect imageUrl for non-text types, optional because it's handled separately
  imageUrl: z.string().url({ message: "Invalid URL format for image/PDF/video" }).optional().nullable(),
  // Store original file name from the upload step
  originalFileName: z.string().optional().nullable(),
}).refine(data => {
    // Require content if type is text
    if (data.noticeType === 'text') {
        return data.content.trim().length > 0;
    }
    // Require imageUrl if type is not text
    if (data.noticeType !== 'text') {
        return !!data.imageUrl;
    }
    return true;
}, {
    message: "Content is required for text notices, and a file URL is required for PDF, image, or video notices.",
    // Point error to relevant fields depending on the type
    path: ["content", "imageUrl"],
});

// ** MongoDB Setup **
const uri = process.env.MONGODB_URI || "mongodb+srv://ionode:ionode@ionode.qgqbadm.mongodb.net/Notices?retryWrites=true&w=majority&appName=ionode"; // Use default connection string if not set
const dbName = process.env.MONGODB_DB || "Notices"; // Use default DB name if not set

async function connectToDatabase(): Promise<Db> {
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in .env or default string');
  }
  if (!dbName) {
    throw new Error('MONGODB_DB is not defined in .env or default string');
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB for addNotice");
    const db = client.db(dbName);
    (db as any)._client = client; // Store client instance on the Db object to close it later
    return db;
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    await client.close(); // Close client if connection failed
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

// The server action now takes the final data, including the uploaded file's URL
export async function addNotice(
    noticeData: z.infer<typeof formSchema>
): Promise<{ success: boolean; error?: string }> {
  let db: Db | null = null;
  try {
     // Data is already validated and contains imageUrl if needed
    const validatedData = formSchema.safeParse(noticeData);

    if (!validatedData.success) {
      console.error("[addNotice] Validation errors:", validatedData.error.format());
      const errorMessages = validatedData.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, error: `Invalid notice data. ${errorMessages}` };
    }

    const { title, noticeType, priority, content, imageUrl, originalFileName } = validatedData.data;

    // Construct the new notice object for the database
    const newNotice = {
      title,
      content: noticeType === 'text' ? content : '',
      imageUrl: noticeType !== 'text' ? imageUrl : '', // Use the passed imageUrl
      priority,
      createdBy: 'admin_interface', // Placeholder user
      date: new Date(),
      originalFileName: noticeType !== 'text' ? (originalFileName || '') : '',
      contentType: noticeType, // Set content type from form
    };

    console.log('[addNotice] Attempting to add new notice to DB:', newNotice);

    // ** MongoDB Integration **
    db = await connectToDatabase();
    const collection = db.collection('notices');

    const result = await collection.insertOne(newNotice);

    if (!result.acknowledged || !result.insertedId) {
      console.error('[addNotice] Failed to insert notice into MongoDB');
      return { success: false, error: 'Failed to save notice to the database.' };
    }

    console.log('[addNotice] Notice added to MongoDB with id:', result.insertedId);

    revalidatePath('/'); // Clear the cache for the home page

    return { success: true };

  } catch (error: any) {
    console.error('[addNotice] Error in addNotice server action:', error);
    let errorMessage = 'An unexpected error occurred while adding the notice.';
     if (error instanceof z.ZodError) {
       errorMessage = `Validation Error: ${error.errors.map(e => e.message).join(', ')}`;
     } else if (error.message?.includes('MONGODB_URI')) {
        errorMessage = 'Database connection failed. Please check configuration.';
    } else if (error.name === 'MongoNetworkError') {
        errorMessage = 'Could not connect to the database.';
    }
    return { success: false, error: errorMessage };
  } finally {
      if (db) {
         await closeDatabaseConnection(db);
      }
  }
}
