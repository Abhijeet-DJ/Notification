
// src/app/api/upload-with-multer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { Writable } from 'stream';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs'; // Import createWriteStream for Node.js streams

// Ensure the upload directory exists
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
const ensureUploadDirExists = async () => {
  console.log(`[ensureUploadDirExists] Checking/Creating directory: ${uploadDir}`);
  try {
    await fs.access(uploadDir);
    console.log(`[ensureUploadDirExists] Upload directory already exists: ${uploadDir}`);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // Directory doesn't exist, create it
      console.log(`[ensureUploadDirExists] Directory not found, attempting creation...`);
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        console.log(`[ensureUploadDirExists] Created upload directory: ${uploadDir}`);
      } catch (mkdirError: any) { // Catch specific mkdir error
        console.error(`[ensureUploadDirExists] Failed to create upload directory: ${uploadDir}`, mkdirError);
        // Provide more context in the error message
        throw new Error(`Server configuration error: Could not create upload directory at ${uploadDir}. Check permissions. Details: ${mkdirError.message}`);
      }
    } else {
      // Other error accessing directory (e.g., permissions)
      console.error(`[ensureUploadDirExists] Error accessing upload directory: ${uploadDir}`, error);
      throw new Error(`Server configuration error: Could not access upload directory at ${uploadDir}. Check permissions. Details: ${error.message}`);
    }
  }
};

// Define file size limit (e.g., 10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  console.log('[upload-api] Received POST request.');
  try {
    // 1. Ensure upload directory exists before processing request
    await ensureUploadDirExists(); // This will now throw a more specific error if it fails

    // 2. Get FormData from the request
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    // 3. Validate file presence and type
    if (!file) {
      console.error("[upload-api] No file found in FormData.");
      return NextResponse.json({ success: false, error: 'No file uploaded.' }, { status: 400 });
    }

    if (!(file instanceof File)) {
      console.error("[upload-api] Invalid file type in FormData. Expected a File object.");
      return NextResponse.json({ success: false, error: 'Invalid file data.' }, { status: 400 });
    }
    console.log(`[upload-api] Received file: ${file.name}, Size: ${file.size} bytes, Type: ${file.type}`);


    // 4. Validate file size
    if (file.size > MAX_FILE_SIZE) {
       console.error(`[upload-api] File too large: ${file.size} bytes. Max allowed: ${MAX_FILE_SIZE} bytes`);
       return NextResponse.json({ success: false, error: `File too large. Max size is ${MAX_FILE_SIZE / (1024*1024)}MB.` }, { status: 413 }); // 413 Payload Too Large
    }


    // 5. Generate a unique filename (similar to multer's default behavior)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.name);
    // Sanitize filename slightly (replace spaces, etc.) - more robust sanitization might be needed
    const baseName = path.basename(file.name, extension).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${baseName}-${uniqueSuffix}${extension}`;
    const filepath = path.join(uploadDir, filename);

    console.log(`[upload-api] Attempting to save file: ${filename} to ${filepath}`);

    // 6. Save the file to the filesystem using streams for efficiency
    try {
      // Convert the File stream to a Node.js readable stream if available
      const readableStream = file.stream(); // This is a ReadableStream (Web API)

      if (!readableStream) {
        throw new Error('Could not get readable stream from file.');
      }

      // Create a Node.js writable stream to the destination file
      const writableStream = createWriteStream(filepath); // Use Node.js createWriteStream

      // Pipe the data from the web stream to the Node.js stream
      console.log('[upload-api] Starting file stream pipeline...');

       // Important: Use pipeline from 'stream/promises' for async handling
       // Ensure the web stream is correctly adapted if needed (often works directly)
      await pipeline(readableStream as any, writableStream); // Cast readableStream if necessary, potential type mismatch

      console.log(`[upload-api] File saved successfully via pipeline: ${filename}`);
    } catch (saveError: any) {
      console.error(`[upload-api] Error saving file ${filename} during pipeline:`, saveError);
      // Attempt to clean up partially written file if save fails
      try {
        await fs.unlink(filepath);
        console.log(`[upload-api] Cleaned up partially written file: ${filename}`);
      } catch (cleanupError) {
        // Log cleanup error but don't mask the original save error
        console.error(`[upload-api] Error cleaning up file ${filename} after save failure:`, cleanupError);
      }
       // Return a more specific error
      return NextResponse.json({ success: false, error: `Failed to save uploaded file. Server error during write. Details: ${saveError.message}` }, { status: 500 });
    }

    // 7. Construct the public URL
    const fileUrl = `/uploads/${filename}`; // Public access path relative to the 'public' directory

    console.log(`[upload-api] File uploaded successfully. URL: ${fileUrl}, Original Filename: ${file.name}`);
    // Return original name too, useful for the action saving to DB
    return NextResponse.json({ success: true, url: fileUrl, originalFilename: file.name });

  } catch (error: any) {
    // Catch any unexpected errors during the process
    console.error('[upload-api] Unexpected error during POST handler:', error);
    // Log the full error object for more details if it's not a standard Error
    if (!(error instanceof Error)) {
       console.error('[upload-api] Full Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }

    let errorMessage = `Upload failed due to an unexpected server error.`;
    let statusCode = 500;

    // Check for specific configuration errors thrown earlier
    if (error.message?.includes('Could not create upload directory')) {
         errorMessage = error.message; // Use the detailed message from ensureUploadDirExists
         statusCode = 500; // Configuration error
     } else if (error.message?.includes('Could not access upload directory')) {
         errorMessage = error.message; // Use the detailed message from ensureUploadDirExists
         statusCode = 500; // Configuration error
     } else if (error.code === 'ENOENT') { // General file system error
        errorMessage = `Server error: A required file or directory was not found during upload process. Details: ${error.message}`;
        statusCode = 500;
     } else if (error instanceof Error) { // Use message from standard errors
        errorMessage = error.message;
     }
     // Add more specific error checks if needed based on logs

    return NextResponse.json({ success: false, error: errorMessage }, { status: statusCode });
  }
}

// Add a GET handler for testing or simple checks if needed (optional)
// export async function GET(req: NextRequest) {
//   return NextResponse.json({ message: 'Upload API is active. Use POST to upload files.' });
// }

