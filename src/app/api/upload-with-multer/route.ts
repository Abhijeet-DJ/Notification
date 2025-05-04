
// src/app/api/upload-with-multer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { Writable } from 'stream';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs'; // Import createWriteStream for Node.js streams

// Ensure the upload directory exists within the 'public' folder
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
const ensureUploadDirExists = async () => {
  console.log(`[ensureUploadDirExists] Checking/Creating directory: ${uploadDir}`);
  try {
    // Check if directory exists and has write permissions
    await fs.access(uploadDir, fs.constants.W_OK);
    console.log(`[ensureUploadDirExists] Upload directory exists and is writable: ${uploadDir}`);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // Directory doesn't exist, create it
      console.log(`[ensureUploadDirExists] Directory not found, attempting creation...`);
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        console.log(`[ensureUploadDirExists] Created upload directory: ${uploadDir}`);
        // Verify write permissions after creation (though mkdir usually handles this)
        await fs.access(uploadDir, fs.constants.W_OK);
        console.log(`[ensureUploadDirExists] Verified write permissions for created directory: ${uploadDir}`);
      } catch (mkdirError: any) { // Catch specific mkdir or access error
        console.error(`[ensureUploadDirExists] Failed to create or verify upload directory: ${uploadDir}`, mkdirError);
        throw new Error(`Server configuration error: Could not create or access upload directory at ${uploadDir}. Check permissions. Details: ${mkdirError.message}`);
      }
    } else if (error.code === 'EACCES') {
        // Directory exists but no write permissions
        console.error(`[ensureUploadDirExists] Permission denied for upload directory: ${uploadDir}`, error);
        throw new Error(`Server configuration error: Write permission denied for upload directory at ${uploadDir}. Check permissions. Details: ${error.message}`);
    } else {
      // Other error accessing directory
      console.error(`[ensureUploadDirExists] Error accessing upload directory: ${uploadDir}`, error);
      throw new Error(`Server configuration error: Could not access upload directory at ${uploadDir}. Check permissions. Details: ${error.message}`);
    }
  }
};

// Define file size limit (45MB)
const MAX_FILE_SIZE = 45 * 1024 * 1024; // 45 MB

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
       // Update error message to reflect 45MB limit
       return NextResponse.json({ success: false, error: `File too large. Max size is ${MAX_FILE_SIZE / (1024*1024)}MB.` }, { status: 413 }); // 413 Payload Too Large
    }


    // 5. Generate a unique filename (similar to multer's default behavior)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.name);
    // Sanitize filename slightly (replace spaces, etc.) - more robust sanitization might be needed
    const baseName = path.basename(file.name, extension).replace(/[^a-zA-Z0-9_.-]/g, '_'); // Allow dots and hyphens
    const filename = `${baseName}-${uniqueSuffix}${extension}`;
    const filepath = path.join(uploadDir, filename); // Correct: Save inside public/uploads

    console.log(`[upload-api] Attempting to save file: ${filename} to ${filepath}`);

    // 6. Save the file to the filesystem using streams for efficiency
    let writableStream: Writable | null = null;
    try {
      // Convert the File stream to a Node.js readable stream if available
      const readableStream = file.stream(); // This is a ReadableStream (Web API)

      if (!readableStream) {
        throw new Error('Could not get readable stream from file.');
      }

      // Create a Node.js writable stream to the destination file
      writableStream = createWriteStream(filepath); // Use Node.js createWriteStream

      // Pipe the data from the web stream to the Node.js stream
      console.log('[upload-api] Starting file stream pipeline...');

       // Important: Use pipeline from 'stream/promises' for async handling
       // Ensure the web stream is correctly adapted if needed (often works directly)
       // We need to cast the ReadableStream<Uint8Array> to NodeJS.ReadableStream
       // A simple cast `as any` might work in many environments, but explicit conversion is safer if needed.
       // For now, let's assume the environments are compatible enough.
      await pipeline(readableStream as unknown as NodeJS.ReadableStream, writableStream);

      console.log(`[upload-api] File stream pipeline finished for: ${filename}`);

      // **Add verification step**
      try {
          await fs.access(filepath, fs.constants.R_OK); // Check if file exists and is readable
          console.log(`[upload-api] File verification successful: ${filepath} exists and is readable.`);
      } catch (verifyError: any) {
          console.error(`[upload-api] File verification failed after saving: ${filepath}`, verifyError);
          // Optionally, attempt cleanup or throw a specific error
          throw new Error(`File saved but verification failed: ${verifyError.message}`);
      }

    } catch (saveError: any) {
      console.error(`[upload-api] Error saving or verifying file ${filename}:`, saveError);
      // Attempt to clean up partially written file if save fails
      try {
        // Ensure stream is closed before unlinking
        if (writableStream && !writableStream.closed) {
          await new Promise<void>((resolve, reject) => {
            writableStream!.end(() => resolve());
            writableStream!.on('error', reject); // Handle potential error during end
          });
        }
        await fs.unlink(filepath);
        console.log(`[upload-api] Cleaned up partially written file: ${filename}`);
      } catch (cleanupError) {
        // Log cleanup error but don't mask the original save error
        console.error(`[upload-api] Error cleaning up file ${filename} after save failure:`, cleanupError);
      }
       // Return a more specific error
      return NextResponse.json({ success: false, error: `Failed to save or verify uploaded file. Server error during write/verification. Details: ${saveError.message}` }, { status: 500 });
    }

    // 7. Construct the public URL - Must be relative to the public folder root
    const fileUrl = `/uploads/${filename}`; // Correct: Public access path relative to the 'public' directory

    console.log(`[upload-api] File uploaded and verified successfully. URL: ${fileUrl}, Original Filename: ${file.name}`);
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
    if (error.message?.includes('Could not create') || error.message?.includes('Could not access') || error.message?.includes('permission denied')) {
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
