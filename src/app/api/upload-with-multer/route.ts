
// src/app/api/upload-with-multer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { Writable } from 'stream';
import { pipeline } from 'stream/promises';

// Ensure the upload directory exists
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
const ensureUploadDirExists = async () => {
  try {
    await fs.access(uploadDir);
    console.log(`Upload directory already exists: ${uploadDir}`);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // Directory doesn't exist, create it
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        console.log(`Created upload directory: ${uploadDir}`);
      } catch (mkdirError) {
        console.error(`Failed to create upload directory: ${uploadDir}`, mkdirError);
        throw new Error(`Server configuration error: Could not create upload directory. ${mkdirError}`); // Throw specific error
      }
    } else {
      // Other error accessing directory (e.g., permissions)
      console.error(`Error accessing upload directory: ${uploadDir}`, error);
      throw new Error(`Server configuration error: Could not access upload directory. ${error.message}`);
    }
  }
};

// Define file size limit (e.g., 10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    // 1. Ensure upload directory exists before processing request
    await ensureUploadDirExists();

    // 2. Get FormData from the request
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    // 3. Validate file presence and type
    if (!file) {
      console.error("[upload-with-multer] No file found in FormData.");
      return NextResponse.json({ success: false, error: 'No file uploaded.' }, { status: 400 });
    }

    if (!(file instanceof File)) {
      console.error("[upload-with-multer] Invalid file type in FormData.");
      return NextResponse.json({ success: false, error: 'Invalid file data.' }, { status: 400 });
    }

    // 4. Validate file size
    if (file.size > MAX_FILE_SIZE) {
       console.error(`[upload-with-multer] File too large: ${file.size} bytes`);
       return NextResponse.json({ success: false, error: `File too large. Max size is ${MAX_FILE_SIZE / (1024*1024)}MB.` }, { status: 413 }); // 413 Payload Too Large
    }


    // 5. Generate a unique filename (similar to multer's default behavior)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.name);
    const filename = `file-${uniqueSuffix}${extension}`; // Simplified fieldname
    const filepath = path.join(uploadDir, filename);

    console.log(`[upload-with-multer] Attempting to save file: ${filename} to ${filepath}`);

    // 6. Save the file to the filesystem using streams for efficiency
    try {
      // Convert the File stream to a Node.js readable stream
      const readableStream = file.stream();

      // Create a Node.js writable stream to the destination file
      const writableStream = fs.createWriteStream(filepath);

      // Pipe the data from the readable stream to the writable stream
      await pipeline(readableStream as any, writableStream); // Use pipeline for robust stream handling

      console.log(`[upload-with-multer] File saved successfully: ${filename}`);
    } catch (saveError: any) {
      console.error(`[upload-with-multer] Error saving file ${filename}:`, saveError);
      // Attempt to clean up partially written file if save fails
      try {
        await fs.unlink(filepath);
        console.log(`[upload-with-multer] Cleaned up partially written file: ${filename}`);
      } catch (cleanupError) {
        console.error(`[upload-with-multer] Error cleaning up file ${filename}:`, cleanupError);
      }
      return NextResponse.json({ success: false, error: `Failed to save uploaded file. ${saveError.message}` }, { status: 500 });
    }

    // 7. Construct the public URL
    const fileUrl = `/uploads/${filename}`; // Public access path relative to the 'public' directory

    console.log(`[upload-with-multer] File uploaded successfully. URL: ${fileUrl}`);
    return NextResponse.json({ success: true, url: fileUrl, originalFilename: file.name }); // Return original name too

  } catch (error: any) {
    // Catch any unexpected errors during the process
    console.error('[upload-with-multer] Unexpected error during POST:', error);
    // Check for specific error types if needed, otherwise return a generic 500
     let errorMessage = `Upload failed: ${error.message}`;
     if (error.message?.includes('Could not create upload directory')) {
         errorMessage = 'Server setup error: Cannot create storage directory.';
     } else if (error.message?.includes('Could not access upload directory')) {
         errorMessage = 'Server setup error: Cannot access storage directory.';
     }

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
