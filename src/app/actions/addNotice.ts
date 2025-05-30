'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { MongoClient, Db } from 'mongodb';

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
  // Expect imageUrl (relative path) for non-text types, optional because it's handled separately after upload
  imageUrl: z.string().optional().nullable(),
  // Store original file name from the upload step
  originalFileName: z.string().optional().nullable(),
}).refine(data => {
    // Text notices can have just a title, content is optional unless it's the only thing.
    if (data.noticeType === 'text') {
        return true; // Allow text notices with just a title
    }
    // Require imageUrl if type is not text
    if (data.noticeType !== 'text') {
        // Use !! to check for truthiness (non-empty string)
        return !!data.imageUrl;
    }
    return true;
}, {
    // Updated message to reflect that content is not strictly required for text notices if title exists.
    // File URL is still required for non-text notices.
    message: "A file URL is required for PDF, image, or video notices.",
    // Point error primarily to imageUrl for non-text types
    path: ["imageUrl"],
});

// ** MongoDB Setup **
// Read the URI from environment variables - this will pick up .env.local locally
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "Notices"; // Use default DB name if not set

if (!uri) {
   console.error('[FATAL ERROR][addNotice] MONGODB_URI environment variable is not set. Check .env or .env.local');
   throw new Error('Database configuration error: MONGODB_URI is missing.');
}
if (!dbName) {
    console.error('[FATAL ERROR][addNotice] MONGODB_DB environment variable is not set or empty.');
   throw new Error('Database configuration error: MONGODB_DB is missing or invalid.');
}


async function connectToDatabase(): Promise<Db> {
  // URI is already validated above
  const client = new MongoClient(uri);
  try {
    await client.connect();
    // console.log("[connectToDatabase][addNotice] Connected successfully to MongoDB."); // Reduced logging frequency
    const db = client.db(dbName);
    // Store client instance on the Db object to close it later using a non-enumerable property
     Object.defineProperty(db, '_client', { value: client, writable: false, enumerable: false, configurable: true });
    return db;
  } catch (error) {
    console.error("[connectToDatabase][addNotice] Failed to connect to MongoDB", error); // Log connection errors
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
            // console.log("[closeDatabaseConnection][addNotice] MongoDB connection closed successfully."); // Reduced logging frequency
        } catch (closeError) {
            console.error("[closeDatabaseConnection][addNotice] Error closing MongoDB connection:", closeError); // Log closing errors
        }
    } else {
        // console.warn("[closeDatabaseConnection][addNotice] No active MongoDB client found on Db object to close.");
    }
}

// The server action now takes the final data, including the uploaded file's URL
export async function addNotice(
    rawData: unknown // Accept raw data first for validation
): Promise<{ success: boolean; error?: string; details?: any }> { // Add details for debugging
  console.log('[addNotice] Received raw data:', JSON.stringify(rawData)); // Log raw input (stringify for better structure)
  let db: Db | null = null;
  try {
     // Validate the incoming raw data using the Zod schema
    const validatedData = formDataSchema.safeParse(rawData);

    if (!validatedData.success) {
      // Log detailed validation errors
      const validationErrors = validatedData.error.format();
      console.error("[addNotice] Validation failed:", JSON.stringify(validationErrors, null, 2));
      // Construct a user-friendly error message from Zod errors
      const errorMessages = validatedData.error.errors.map(e => `${e.path.join('.') || 'notice'}: ${e.message}`).join('; ');
      // Return validation errors for better client-side feedback
      return { success: false, error: `Invalid notice data. ${errorMessages}`, details: validationErrors };
    }

    // Destructure the validated data
    const { title, noticeType, priority, content, imageUrl, originalFileName } = validatedData.data;
     console.log('[addNotice] Data validated successfully:', validatedData.data);

    // Construct the new notice object for the database
    // Ensure `contentType` is explicitly saved based on `noticeType`
    const newNotice = {
      title,
      // Store content ONLY if it's a text notice AND it's not empty
      content: noticeType === 'text' && content ? content : '',
      // Store imageUrl ONLY if it's NOT a text notice and valid
      imageUrl: noticeType !== 'text' && typeof imageUrl === 'string' ? imageUrl : '',
      priority,
      createdBy: 'admin_interface', // Placeholder user, replace with actual user info if available
      date: new Date(), // Use current server date
      // Store originalFileName ONLY if it's NOT a text notice and valid
      originalFileName: noticeType !== 'text' && typeof originalFileName === 'string' ? originalFileName : '',
      contentType: noticeType, // Explicitly save the notice type
    };

    // Double-check required fields based on type *before* DB insert
    if (noticeType !== 'text' && !newNotice.imageUrl) {
        const missingUrlError = `Internal Error: Notice type '${noticeType}' requires an imageUrl, but it was missing or invalid after validation.`;
        console.error("[addNotice]", missingUrlError, "Original rawData:", rawData, "Validated data:", validatedData.data);
        return { success: false, error: missingUrlError };
    }
     if (noticeType === 'text' && !newNotice.title && !newNotice.content) {
         const emptyTextError = `Internal Error: Text notice must have a title or content.`;
         console.error("[addNotice]", emptyTextError, "Original rawData:", rawData, "Validated data:", validatedData.data);
         return { success: false, error: emptyTextError };
     }


    console.log('[addNotice] Attempting to insert new notice into DB:', newNotice);

    // ** MongoDB Integration **
    db = await connectToDatabase(); // Connect to the database
    const collection = db.collection('notices'); // Get the 'notices' collection

    // Insert the new notice document into the collection
    const result = await collection.insertOne(newNotice);

    // Check if the insertion was acknowledged by MongoDB
    if (!result.acknowledged || !result.insertedId) {
      console.error('[addNotice] Failed to insert notice into MongoDB. Result:', result);
      // Provide more context about the failure if possible
      return { success: false, error: 'Failed to save notice to the database. Acknowledgment failed.', details: result };
    }

    console.log('[addNotice] Notice added successfully to MongoDB with id:', result.insertedId);

    // Revalidate the cache for the homepage to show the new notice immediately
    revalidatePath('/');
    console.log('[addNotice] Revalidated path /');

    // Return success
    return { success: true };

  } catch (error: any) {
    // Catch any unexpected errors during the process
    console.error('[addNotice] Unhandled Error in addNotice server action:', error); // Log the full error
    let errorMessage = 'An unexpected error occurred while adding the notice.';
    let errorDetails = null; // Variable to hold extra details

    // Provide more specific error messages based on error type
     if (error instanceof z.ZodError) { // Should be caught by safeParse, but good fallback
       errorMessage = `Validation Error: ${error.errors.map(e => e.message).join(', ')}`;
       errorDetails = error.format();
     } else if (error.message?.includes('Database configuration error')) {
        errorMessage = error.message; // Use the specific config error
    } else if (error.name === 'MongoNetworkError' || error.message?.includes('connect')) {
        errorMessage = 'Could not connect to the database. Please check network or connection string.';
        errorDetails = { name: error.name, message: error.message };
    } else if (error.name && error.name.startsWith('Mongo')) { // Catch other potential Mongo errors
        errorMessage = `Database Error: ${error.name} - ${error.message}`;
        errorDetails = { name: error.name, message: error.message, code: error.code, details: error }; // Include more Mongo error details
    } else if (error instanceof Error) {
         errorMessage = `Server Action Error: ${error.message}`;
         errorDetails = { name: error.name, message: error.message, stack: error.stack }; // Include stack trace for general errors
    } else {
        // Handle non-Error objects being thrown
        errorMessage = 'An unknown error occurred.';
        errorDetails = error; // Log the unknown error object
    }

    // Return detailed error information
    return { success: false, error: errorMessage, details: errorDetails };
  } finally {
      // Ensure the database connection is always closed
      if (db) {
         await closeDatabaseConnection(db);
      }
  }
}
