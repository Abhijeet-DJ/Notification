'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { MongoClient, Db } from 'mongodb';

// --- Placeholder for actual file upload service ---
// In a real app, you would import and use a service to upload the file
// to a storage solution (like Firebase Storage, AWS S3, Cloudinary, etc.)
// and get back the public URL.
async function uploadFileAndGetUrl(file: File): Promise<string> {
  console.log(`Simulating upload for file: ${file.name}, size: ${file.size}`);
  // In a real scenario:
  // 1. Connect to your storage service.
  // 2. Upload the file buffer (await file.arrayBuffer()).
  // 3. Get the public URL returned by the storage service.
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
  // For now, return a placeholder URL based on the file type - THIS IS NOT FUNCTIONAL for viewing
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
      // Use picsum for placeholder images
      return `https://picsum.photos/seed/${encodeURIComponent(file.name)}/400/300`;
  } else if (extension === 'pdf') {
      // Using a dummy PDF link for placeholder
      return `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf`;
  } else if (['mp4', 'webm', 'mov', 'ogg'].includes(extension)) {
       // Using a placeholder video link
       return `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`;
  }
  // Fallback placeholder if type is unknown or not supported for direct viewing
  return `/uploads/placeholder-${encodeURIComponent(file.name)}`; // Represents a path, not a direct viewable URL
}
// --- End Placeholder ---


// Update Zod schema to expect 'file' when noticeType is not 'text'
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const ACCEPTED_PDF_TYPES = ["application/pdf"];
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-msvideo", "video/x-matroska"];


const formDataSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  noticeType: z.enum(['text', 'pdf', 'image', 'video']),
  priority: z.string().transform(Number).refine(val => val >= 1 && val <= 5, {
      message: "Priority must be between 1 and 5",
  }).default("3"),
  // Allow content to be explicitly undefined or an empty string
  content: z.string().optional().nullable().transform(val => val ?? ''), // Transform null/undefined to empty string
  // Expect 'file' object from FormData which should be a single File instance
  file: z.instanceof(File, { message: "File upload is required." })
         .refine(file => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
         .optional(),
  fileName: z.string().optional(), // Original file name from form
}).refine(data => {
    // Require content (non-empty string) if type is text
    if (data.noticeType === 'text') {
        return data.content.trim().length > 0; // Check if the string is not just whitespace
    }
    // Require file if type is not text
    if (data.noticeType !== 'text') {
        return !!data.file; // Check if the File object exists
    }
    return true;
}, {
    message: "Content is required for text notices, and a file upload is required for PDF, image, or video notices.",
    path: ["content", "file"], // Point error to relevant fields
}).refine(data => {
    // Validate file type based on noticeType only if file exists
    if (data.file) {
        const fileType = data.file.type;
        if (data.noticeType === 'image' && !ACCEPTED_IMAGE_TYPES.includes(fileType)) {
            return false;
        }
        if (data.noticeType === 'pdf' && !ACCEPTED_PDF_TYPES.includes(fileType)) {
            return false;
        }
        if (data.noticeType === 'video' && !ACCEPTED_VIDEO_TYPES.includes(fileType)) {
             return false;
        }
    }
    return true;
}, {
    message: "Invalid file type selected for the chosen notice type.",
    path: ["file"],
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

export async function addNotice(formData: FormData): Promise<{ success: boolean; error?: string }> {
  let db: Db | null = null;
  try {
    // Extract data from FormData
    const rawData = {
        title: formData.get('title') as string,
        noticeType: formData.get('noticeType') as 'text' | 'pdf' | 'image' | 'video',
        priority: formData.get('priority') as string,
        // Explicitly get content, which might be null if not sent from form
        content: formData.get('content') as string | null,
        file: formData.get('file') as File | null, // Get the file object
        fileName: formData.get('fileName') as string | undefined,
    };

    // Prepare data for validation, ensuring file is only included if it's a valid File object
    // Pass content directly (Zod schema will handle transformation)
    const dataToValidate = {
      ...rawData,
      file: rawData.file && rawData.file instanceof File && rawData.file.size > 0 ? rawData.file : undefined,
    };

    console.log("Data being validated:", dataToValidate);

    const validatedData = formDataSchema.safeParse(dataToValidate);

    if (!validatedData.success) {
      console.error("Validation errors:", validatedData.error.format());
      const errorMessages = validatedData.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, error: `Invalid form data. ${errorMessages}` };
    }

    const { title, noticeType, priority, content, file: validatedFile, fileName } = validatedData.data;

    let uploadedFileUrl = '';

    // Handle file upload if it's not a text notice and a file was validated
    if (noticeType !== 'text' && validatedFile) {
        try {
            uploadedFileUrl = await uploadFileAndGetUrl(validatedFile); // Use the placeholder
            console.log(`File ${validatedFile.name} uploaded, URL: ${uploadedFileUrl}`);
        } catch (uploadError: any) {
             console.error("File upload failed:", uploadError);
             return { success: false, error: `Failed to upload file: ${uploadError.message}` };
        }
    } else if (noticeType !== 'text' && !validatedFile) {
         // This should be caught by Zod, but double-check
         return { success: false, error: 'File is required for non-text notices.' };
    }

    // Construct the new notice object for the database
    const newNotice = {
      title,
      // Store content only if it's explicitly a text notice
      // content is already transformed to '' if null/undefined by Zod
      content: noticeType === 'text' ? content : '',
      // Store the URL obtained from upload/placeholder if it's not a text notice
      imageUrl: noticeType !== 'text' ? uploadedFileUrl : '',
      priority, // Store the numeric priority
      createdBy: 'admin_interface', // Placeholder user
      date: new Date(),
      // Store original file name only for file-based notices
      originalFileName: noticeType !== 'text' ? (fileName || validatedFile?.name || '') : '',
      // Explicitly store the intended content type based on the form selection
      contentType: noticeType, // <--- Ensure this is set directly from the form's noticeType
    };

    console.log('Attempting to add new notice to DB:', newNotice);

    // ** MongoDB Integration **
    db = await connectToDatabase();
    const collection = db.collection('notices');

    const result = await collection.insertOne(newNotice);

    if (!result.acknowledged || !result.insertedId) {
      console.error('Failed to insert notice into MongoDB');
      return { success: false, error: 'Failed to save notice to the database.' };
    }

    console.log('Notice added to MongoDB with id:', result.insertedId);

    revalidatePath('/'); // Clear the cache for the home page

    return { success: true };

  } catch (error: any) {
    console.error('Error in addNotice server action:', error);
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
