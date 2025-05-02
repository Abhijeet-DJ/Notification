
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { MongoClient, Db } from 'mongodb';

// --- Placeholder for actual file upload service removed ---

// Define validation schema expecting imageUrl for file-based types
const formDataSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  noticeType: z.enum(['text', 'pdf', 'image', 'video']),
  priority: z.coerce // Use coerce for better handling of number conversion
    .number({ invalid_type_error: "Priority must be a number" })
    .min(1, "Priority must be at least 1")
    .max(5, "Priority must be at most 5")
    .default(3), // Default priority
  // Allow content to be explicitly undefined or an empty string, required for 'text'
  content: z.string().optional().nullable().transform(val => val ?? ''), // Ensure it's always a string
  // Expect imageUrl for non-text types, optional because it's handled separately after upload
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
        // Use !! to check for truthiness (non-empty string)
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
    // More critical error logging for configuration issues
    console.error('[connectToDatabase] FATAL ERROR: MONGODB_URI is not defined in .env or default string');
    throw new Error('Database configuration error: MONGODB_URI is missing.');
  }
  if (!dbName) {
     console.error('[connectToDatabase] FATAL ERROR: MONGODB_DB is not defined in .env or default string');
    throw new Error('Database configuration error: MONGODB_DB is missing.');
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("[connectToDatabase] Connected successfully to MongoDB for addNotice.");
    const db = client.db(dbName);
    // Store client instance on the Db object to close it later using a non-enumerable property
     Object.defineProperty(db, '_client', { value: client, writable: false, enumerable: false, configurable: true });
    return db;
  } catch (error) {
    console.error("[connectToDatabase] Failed to connect to MongoDB", error);
    await client.close(); // Ensure client is closed if connection failed
    throw error; // Re-throw the error to be caught by the caller
  }
}

async function closeDatabaseConnection(db: Db) {
    // Access the client stored on the Db object
    const client = (db as any)._client;
    if (client && typeof client.close === 'function') {
        try {
            await client.close();
            console.log("[closeDatabaseConnection] MongoDB connection closed successfully for addNotice.");
        } catch (closeError) {
            console.error("[closeDatabaseConnection] Error closing MongoDB connection:", closeError);
        }
    } else {
        // console.warn("[closeDatabaseConnection] No active MongoDB client found on Db object to close.");
    }
}

// The server action now takes the final data, including the uploaded file's URL
export async function addNotice(
    rawData: unknown // Accept raw data first for validation
): Promise<{ success: boolean; error?: string }> {
  console.log('[addNotice] Received raw data:', rawData); // Log raw input
  let db: Db | null = null;
  try {
     // Validate the incoming raw data using the Zod schema
    const validatedData = formDataSchema.safeParse(rawData);

    if (!validatedData.success) {
      // Log detailed validation errors
      console.error("[addNotice] Validation failed:", validatedData.error.format());
      // Construct a user-friendly error message from Zod errors
      const errorMessages = validatedData.error.errors.map(e => `${e.path.join('.') || 'notice'}: ${e.message}`).join('; ');
      return { success: false, error: `Invalid notice data. ${errorMessages}` };
    }

    // Destructure the validated data
    const { title, noticeType, priority, content, imageUrl, originalFileName } = validatedData.data;
     console.log('[addNotice] Data validated successfully:', validatedData.data);

    // Construct the new notice object for the database
    // Ensure `contentType` is explicitly saved based on `noticeType`
    const newNotice = {
      title,
      // Store content ONLY if it's a text notice
      content: noticeType === 'text' ? content : '',
      // Store imageUrl ONLY if it's NOT a text notice
      imageUrl: noticeType !== 'text' ? (imageUrl || '') : '', // Ensure it's a string or empty string
      priority,
      createdBy: 'admin_interface', // Placeholder user, replace with actual user info if available
      date: new Date(), // Use current server date
      // Store originalFileName ONLY if it's NOT a text notice
      originalFileName: noticeType !== 'text' ? (originalFileName || '') : '', // Ensure it's a string or empty string
      contentType: noticeType, // Explicitly save the notice type
    };

    console.log('[addNotice] Attempting to insert new notice into DB:', newNotice);

    // ** MongoDB Integration **
    db = await connectToDatabase(); // Connect to the database
    const collection = db.collection('notices'); // Get the 'notices' collection

    // Insert the new notice document into the collection
    const result = await collection.insertOne(newNotice);

    // Check if the insertion was acknowledged by MongoDB
    if (!result.acknowledged || !result.insertedId) {
      console.error('[addNotice] Failed to insert notice into MongoDB. Result:', result);
      return { success: false, error: 'Failed to save notice to the database.' };
    }

    console.log('[addNotice] Notice added successfully to MongoDB with id:', result.insertedId);

    // Revalidate the cache for the homepage to show the new notice immediately
    revalidatePath('/');
    console.log('[addNotice] Revalidated path /');

    // Return success
    return { success: true };

  } catch (error: any) {
    // Catch any unexpected errors during the process
    console.error('[addNotice] Error in addNotice server action:', error);
    let errorMessage = 'An unexpected error occurred while adding the notice.';

    // Provide more specific error messages based on error type
     if (error instanceof z.ZodError) { // Should be caught by safeParse, but good fallback
       errorMessage = `Validation Error: ${error.errors.map(e => e.message).join(', ')}`;
     } else if (error.message?.includes('Database configuration error')) {
        errorMessage = error.message; // Use the specific config error
    } else if (error.name === 'MongoNetworkError' || error.message?.includes('connect')) {
        errorMessage = 'Could not connect to the database. Please check network or connection string.';
    }
    // Add more specific MongoDB error checks if needed (e.g., MongoWriteConcernError)

    return { success: false, error: errorMessage };
  } finally {
      // Ensure the database connection is always closed
      if (db) {
         await closeDatabaseConnection(db);
      }
  }
}
