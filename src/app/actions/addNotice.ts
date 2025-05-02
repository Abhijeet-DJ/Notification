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
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
      return `https://picsum.photos/seed/${encodeURIComponent(file.name)}/400/300`; // Placeholder image URL
  } else if (extension === 'pdf') {
      // You might need a specific PDF viewer or a way to serve static files
      // For demo, maybe link to a generic dummy PDF online
      return `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf`; // Placeholder PDF
  } else if (['mp4', 'webm', 'mov'].includes(extension)) {
       // Need a video hosting solution or serve static files
       // Placeholder video - might not work depending on browser support/codecs
       return `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`; // Placeholder video
  }
  // Fallback placeholder if type is unknown
  return `/uploads/placeholder-${encodeURIComponent(file.name)}`;
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
  content: z.string().optional(),
  // Expect 'file' object from FormData
  file: z.instanceof(File, { message: "File upload is required." })
         .refine(file => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
         .optional(),
  fileName: z.string().optional(), // Original file name from form
}).refine(data => {
    // Require content if type is text
    if (data.noticeType === 'text') {
        return !!data.content?.trim();
    }
    // Require file if type is not text
    if (data.noticeType !== 'text') {
        return !!data.file;
    }
    return true;
}, {
    message: "Content is required for text notices, and a file upload is required for PDF, image, or video notices.",
    path: ["content", "file"],
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
    // Parse form data - Note: files need special handling if not using a library
    const rawData = Object.fromEntries(formData.entries());

    // Separate file from other data for validation
    const file = formData.get('file') as File | null;
    const otherData = { ...rawData };
    delete otherData.file; // Remove file entry for standard Zod parsing

     // Manually add the file back for schema validation if it exists
    const dataToValidate = {
      ...otherData,
      ...(file && file.size > 0 && { file: file }) // Add file object only if it's a valid file
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

    // Handle file upload if it's not a text notice
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


    // Construct the new notice object
    const newNotice = {
      title,
      content: noticeType === 'text' ? (content || '') : '', // Only store content for text
      imageUrl: uploadedFileUrl, // Store the URL obtained from upload/placeholder
      priority,
      createdBy: 'admin_interface', // Placeholder user
      date: new Date(),
      originalFileName: noticeType !== 'text' ? (fileName || validatedFile?.name || '') : '', // Store original file name
      // contentType is now derived in getCollegeNotices based on imageUrl
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
     } else if (error.message.includes('MONGODB_URI')) {
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