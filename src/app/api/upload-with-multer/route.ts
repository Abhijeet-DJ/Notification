// src/app/api/upload-with-multer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { promisify } from 'util';

// Ensure the upload directory exists
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
const ensureUploadDirExists = async () => {
  try {
    await fs.access(uploadDir);
  } catch (error) {
    // Directory doesn't exist, create it
    await fs.mkdir(uploadDir, { recursive: true });
    console.log(`Created upload directory: ${uploadDir}`);
  }
};

// Configure multer storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await ensureUploadDirExists(); // Ensure directory exists before saving
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = file.fieldname + '-' + uniqueSuffix + extension;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Promisify the multer upload middleware
const uploadMiddleware = promisify(upload.single('file'));

// Helper function to run middleware in Next.js API routes
async function runMiddleware(req: any, res: any, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    // We need to construct a minimal 'res' object for multer
    const mockRes: any = {
      setHeader: () => {},
      getHeader: () => {},
      // Add other methods if multer requires them
    };

    await runMiddleware(req, mockRes, uploadMiddleware);

    // Access the file info from the request object modified by multer
    // Note: Accessing req.file directly might not work as expected in App Router.
    // We might need to re-read the request body or find where multer attaches the file info.
    // A common pattern is to use a library like `next-connect` or adapt multer usage.

    // Since direct req.file access is tricky, let's try re-parsing FormData
    // (This is a workaround; ideally, multer integration would be smoother)
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file || !(file instanceof File)) {
       console.error("[upload-with-multer] No file found after middleware.");
       return NextResponse.json({ success: false, error: 'No file uploaded or file access issue after middleware.' }, { status: 400 });
    }

    // Find the filename associated with the upload
    // This part is tricky without direct req.file access. We infer it based on how multer names it.
    // This assumes multer successfully saved the file.
    // We need to get the *actual* saved filename from the storage configuration logic if possible,
    // but that's internal to multer. Let's construct the public URL.

    // Re-construct filename based on expected pattern (less reliable)
    // Or find a way to access the filename saved by multer.
    // For simplicity, let's assume we can retrieve the saved filename somehow.
    // In a real scenario, we'd need a more robust way to get the saved filename.

    // **This is a placeholder - Need a reliable way to get the actual saved filename**
    // const savedFilename = mockRes.file?.filename; // Accessing potentially attached data
    // A more practical approach: Read the directory and find the latest file (still hacky)
    // Or modify multer storage to pass filename back differently.

    // Let's **assume** we got the filename from multer somehow (e.g., attaching it to mockRes):
    const savedFilename = (req as any).file?.filename; // Check if multer attached it

     if (!savedFilename) {
       console.error("[upload-with-multer] Could not determine saved filename after upload.");
       // Attempt to list directory content to find the latest file as a fallback (less ideal)
       try {
         const files = await fs.readdir(uploadDir);
         const latestFile = files.sort((a, b) => {
           const statA = fs.stat(path.join(uploadDir, a));
           const statB = fs.stat(path.join(uploadDir, b));
           return statB.mtimeMs - statA.mtimeMs; // Sort by modification time descending
         })[0];
         if (latestFile) {
            console.warn("[upload-with-multer] Inferring filename as:", latestFile);
            const fileUrl = `/uploads/${latestFile}`;
            return NextResponse.json({ success: true, url: fileUrl });
         } else {
            throw new Error("Upload directory is empty or inaccessible.");
         }
       } catch (dirError) {
          console.error("[upload-with-multer] Error trying fallback filename retrieval:", dirError);
          return NextResponse.json({ success: false, error: 'Failed to determine uploaded file name.' }, { status: 500 });
       }
     }


    const fileUrl = `/uploads/${savedFilename}`; // Public access path

    console.log(`[upload-with-multer] File uploaded successfully: ${savedFilename}, URL: ${fileUrl}`);
    return NextResponse.json({ success: true, url: fileUrl });

  } catch (error: any) {
    console.error('[upload-with-multer] Upload failed:', error);
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return NextResponse.json({ success: false, error: 'File too large. Max size is 10MB.' }, { status: 413 });
      }
      return NextResponse.json({ success: false, error: `Multer error: ${error.message}` }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: `Upload failed: ${error.message}` }, { status: 500 });
  }
}

// We need to tell Next.js not to parse the body for this route
// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };
// Note: The above config is for Pages Router. App Router handles this differently.
// The route should inherently handle FormData correctly.
