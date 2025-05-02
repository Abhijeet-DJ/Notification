
'use client';

import * as React from 'react';
import { useState, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { addNotice } from '@/app/actions/addNotice'; // Server Action
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress"; // Import Progress component

// Helper to check file size (Update to 45MB)
const MAX_FILE_SIZE = 45 * 1024 * 1024; // 45 MB
const MAX_FILE_SIZE_MB = MAX_FILE_SIZE / (1024 * 1024); // Calculate MB for messages
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const ACCEPTED_PDF_TYPES = ["application/pdf"];
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-msvideo", "video/x-matroska"];

// Updated schema for the form itself (before upload)
// 'file' is now optional in the base schema but required conditionally by refine
const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  noticeType: z.enum(['text', 'pdf', 'image', 'video']),
  // Content is required only for text notices
  content: z.string().optional().nullable().transform(val => val ?? ''), // Ensure content is always string or empty string
  // File input is handled separately, but we need a field for validation trigger
  file: z.instanceof(typeof window !== 'undefined' ? FileList : Object).optional(),
  priority: z.coerce // Use coerce to handle string from input type="number"
    .number({ invalid_type_error: "Priority must be a number" })
    .min(1, "Priority must be at least 1")
    .max(5, "Priority must be at most 5")
    .default(3),
}).refine(data => {
    // Require content if type is text
    if (data.noticeType === 'text') {
        return !!data.content?.trim(); // Content needs to be non-empty for text notices
    }
    // Require file if type is not text (this refine checks if FileList exists and has a file)
    if (data.noticeType !== 'text') {
        return !!data.file?.[0];
    }
    return true;
}, {
    message: "Content is required for text notices, and a file upload is required for PDF, image, or video notices.",
    path: ["content", "file"], // Point to both fields
}).refine(data => {
    // Validate file properties if a file exists in the FileList
    if (data.noticeType !== 'text' && data.file?.[0]) {
        const file = data.file[0];
        console.log('[Schema Refine] Validating file:', file.name, file.size, file.type); // Debug log for file validation
        // Check size
        if (file.size > MAX_FILE_SIZE) {
           console.error(`[Schema Refine] File too large: ${file.size}`);
           // Update error message to reflect 45MB limit
           form.setError("file", { message: `Max file size is ${MAX_FILE_SIZE_MB}MB. Yours is ${(file.size / (1024*1024)).toFixed(2)}MB` });
           return false;
        }
        // Check type based on noticeType
        const fileType = file.type;
        if (data.noticeType === 'image' && !ACCEPTED_IMAGE_TYPES.includes(fileType)) {
            console.error(`[Schema Refine] Invalid image type: ${fileType}`);
            form.setError("file", { message: `Invalid file type. Expected one of: ${ACCEPTED_IMAGE_TYPES.join(', ')}` });
            return false;
        }
        if (data.noticeType === 'pdf' && !ACCEPTED_PDF_TYPES.includes(fileType)) {
            console.error(`[Schema Refine] Invalid PDF type: ${fileType}`);
            form.setError("file", { message: `Invalid file type. Expected: ${ACCEPTED_PDF_TYPES.join(', ')}` });
            return false;
        }
        if (data.noticeType === 'video' && !ACCEPTED_VIDEO_TYPES.includes(fileType)) {
             console.error(`[Schema Refine] Invalid video type: ${fileType}`);
             form.setError("file", { message: `Invalid file type. Expected one of: ${ACCEPTED_VIDEO_TYPES.join(', ')}` });
            return false;
        }
         console.log('[Schema Refine] File validation passed.'); // Log success
    }
    return true; // Pass if text notice or file validation passes or no file yet
}, {
    // This message might not be shown if specific errors are set using setError
    message: "Invalid file size or type.",
    path: ["file"],
});

type NoticeFormData = z.infer<typeof formSchema>;

// Global form instance reference for refine function
let form: any;

export default function AddNoticeForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for the file input

  // Assign the form instance globally (needed for refine function's setError)
  form = useForm<NoticeFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      noticeType: 'text',
      content: '',
      priority: 3,
      file: undefined,
    },
     mode: "onChange", // Validate on change to catch file issues early
  });

  const noticeType = form.watch('noticeType');

  // Function to handle file upload
  const handleFileUpload = async (file: File): Promise<{ url: string; originalFilename: string } | null> => {
      console.log('[handleFileUpload] Starting upload for file:', file.name); // Log start of upload
      setIsUploading(true);
      setUploadProgress(0);
      const formData = new FormData();
      formData.append('file', file);

      try {
          const xhr = new XMLHttpRequest();

          // Track progress
          xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                  const percentComplete = Math.round((event.loaded / event.total) * 100);
                  setUploadProgress(percentComplete);
              }
          };

          // Handle completion
          return await new Promise((resolve, reject) => {
             xhr.onload = () => {
                 setIsUploading(false);
                 console.log('[handleFileUpload] Upload finished. Status:', xhr.status, 'Response:', xhr.responseText); // Log completion details
                 if (xhr.status >= 200 && xhr.status < 300) {
                     try {
                         const response = JSON.parse(xhr.responseText);
                         if (response.success && response.url) {
                             console.log("[handleFileUpload] Upload successful:", response);
                             resolve({ url: response.url, originalFilename: response.originalFilename || file.name });
                         } else {
                             console.error("[handleFileUpload] Upload API reported failure:", response.error);
                             reject(new Error(response.error || 'Upload failed: Server error reported by API'));
                         }
                     } catch (e) {
                        console.error("[handleFileUpload] Failed to parse upload response:", xhr.responseText, e);
                        reject(new Error('Upload failed: Invalid server response format'));
                     }
                 } else {
                     console.error("[handleFileUpload] Upload failed with status:", xhr.status, xhr.statusText);
                      try {
                         // Try to parse error message from server response
                         const response = JSON.parse(xhr.responseText);
                         reject(new Error(`Upload failed: ${response.error || xhr.statusText || `Server error (status ${xhr.status})`}`));
                       } catch (e) {
                         reject(new Error(`Upload failed: ${xhr.statusText || `Server error (status ${xhr.status})`}`));
                       }
                 }
             };

             // Handle errors
             xhr.onerror = () => {
                 setIsUploading(false);
                 console.error("[handleFileUpload] Upload failed: Network error or CORS issue.");
                 reject(new Error('Upload failed: Network error or Cross-Origin restriction'));
             };

             // Start the request
             console.log('[handleFileUpload] Sending POST request to /api/upload-with-multer');
             xhr.open('POST', '/api/upload-with-multer', true); // Use the correct endpoint
             xhr.send(formData);
          });

      } catch (error: any) {
          setIsUploading(false);
          console.error('[handleFileUpload] File upload error:', error);
          toast({
              title: "Upload Failed",
              description: error.message || "Could not upload the file.",
              variant: "destructive",
          });
          return null;
      }
  };

  async function onSubmit(values: NoticeFormData) {
    setIsLoading(true);
    console.log('[onSubmit] Form values submitting:', values);

    let imageUrl: string | undefined | null = undefined;
    let originalFileName: string | undefined | null = undefined;

    // Handle file upload if necessary
    if (values.noticeType !== 'text' && values.file?.[0]) {
        const fileToUpload = values.file[0];
        console.log('[onSubmit] Attempting to upload file:', fileToUpload.name);
        const uploadResult = await handleFileUpload(fileToUpload);

        if (!uploadResult) {
            // Error occurred during upload, toast shown in handleFileUpload
            console.error('[onSubmit] File upload failed, stopping submission.');
            setIsLoading(false);
            return; // Stop submission
        }
        imageUrl = uploadResult.url;
        originalFileName = uploadResult.originalFilename; // Use filename from upload result
         console.log('[onSubmit] File upload successful. URL:', imageUrl, 'Original Filename:', originalFileName);
    } else if (values.noticeType !== 'text') {
        console.warn('[onSubmit] Notice type requires a file, but no file was provided or found.');
        // Consider adding a toast message here if this is an unexpected state
        // toast({ title: "Missing File", description: `A file is required for ${values.noticeType} notices.`, variant: "destructive" });
        // setIsLoading(false); // Maybe stop submission if file is strictly required but missing
        // return;
    }

    // Prepare data for the server action
    // Ensure content is explicitly set for text, and empty for others if not provided
    const noticeDataForAction = {
      title: values.title,
      noticeType: values.noticeType,
      priority: values.priority,
      content: values.noticeType === 'text' ? (values.content || '') : '', // Send content only for text, ensure it's a string
      imageUrl: imageUrl, // Send the URL obtained from upload (or null/undefined)
      originalFileName: originalFileName, // Send the original filename
    };

    try {
      console.log('[onSubmit] Sending data to server action addNotice:', noticeDataForAction);
      // Call the server action with the final notice data (including URL)
      const result = await addNotice(noticeDataForAction);

      if (result.success) {
        console.log('[onSubmit] Server action addNotice successful.');
        toast({
          title: "Notice Added",
          description: "The new notice has been successfully added.",
        });
        form.reset(); // Reset form fields
        setSelectedFileName(null); // Clear selected file name display
        if (fileInputRef.current) { // Clear the actual file input
            fileInputRef.current.value = '';
        }
        setUploadProgress(0); // Reset progress bar
      } else {
         console.error('[onSubmit] Server action addNotice failed:', result.error);
        toast({
          title: "Error Adding Notice",
          description: result.error || "Failed to add notice. Please check the details.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('[onSubmit] Error submitting notice to action:', error);
      toast({
        title: "Submission Error",
        description: error.message || "An unexpected error occurred while saving the notice.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsUploading(false); // Ensure uploading state is reset
    }
  }

   // Log form errors for debugging
   React.useEffect(() => {
     const subscription = form.watch((value, { name, type }) => {
       // console.log("Form value changed:", name, value); // Optional: log all changes
       const errors = form.formState.errors;
       if (errors && Object.keys(errors).length > 0) {
          console.warn("[AddNoticeForm] Current Form validation errors:", errors);
       }
     });
     return () => subscription.unsubscribe();
   }, [form.watch, form.formState.errors]);


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Enter notice title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="noticeType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notice Type</FormLabel>
              <Select onValueChange={(value) => {
                 console.log(`[Notice Type Change] Selected type: ${value}`); // Log type change
                field.onChange(value);
                // Reset dependent fields when type changes
                form.resetField('file', { defaultValue: undefined });
                form.resetField('content', { defaultValue: '' });
                setSelectedFileName(null);
                 if (fileInputRef.current) {
                    fileInputRef.current.value = ''; // Clear file input visually
                 }
                 // Re-validate relevant fields after type change
                  console.log('[Notice Type Change] Triggering validation for content and file.');
                 form.trigger(['content', 'file']);
              }} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select notice type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {noticeType === 'text' ? (
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Content</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter notice content"
                    className="min-h-[100px]"
                    {...field}
                    value={field.value ?? ''} // Handle potential null/undefined value
                  />
                </FormControl>
                 <FormDescription>
                   Required for text notices.
                 </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
           // Field for File input (only UI part, upload handled in onSubmit)
          <FormField
            control={form.control}
            name="file" // Bind to the 'file' field in the schema for validation trigger
            render={({ field: { onChange, onBlur, name, ref } }) => ( // Use RHF's onChange
              <FormItem>
                <FormLabel>
                   Upload {noticeType === 'pdf' ? 'PDF' : noticeType === 'image' ? 'Image' : 'Video'}
                </FormLabel>
                <FormControl>
                   <Input
                     type="file"
                     accept={
                       noticeType === 'pdf' ? ACCEPTED_PDF_TYPES.join(',') :
                       noticeType === 'image' ? ACCEPTED_IMAGE_TYPES.join(',') :
                       noticeType === 'video' ? ACCEPTED_VIDEO_TYPES.join(',') : ''
                     }
                     ref={fileInputRef} // Use the ref here
                     name={name}
                     onBlur={onBlur}
                     onChange={(e) => {
                         const files = e.target.files;
                         console.log('[File Input Change] Files selected:', files); // Log file selection
                         onChange(files); // Update RHF's state with FileList
                         if (files && files[0]) {
                           setSelectedFileName(files[0].name);
                           // Manually trigger validation for the file field after selection
                           console.log('[File Input Change] Triggering file validation.');
                           form.trigger("file");
                         } else {
                           setSelectedFileName(null);
                           // If no file is selected, trigger validation too
                           console.log('[File Input Change] No file selected, triggering file validation.');
                           form.trigger("file");
                         }
                      }}
                      disabled={isUploading || isLoading} // Disable while uploading/submitting
                   />
                </FormControl>
                 <FormDescription>
                   {/* Update form description to reflect 45MB limit */}
                   {selectedFileName ? `Selected file: ${selectedFileName}` : `Upload the ${noticeType} file. Max size: ${MAX_FILE_SIZE_MB}MB.`}
                 </FormDescription>
                 {/* Display upload progress */}
                 {isUploading && (
                   <div className="mt-2">
                     <Progress value={uploadProgress} className="w-full" />
                     <p className="text-sm text-muted-foreground mt-1">{uploadProgress}% uploaded</p>
                   </div>
                 )}
                <FormMessage /> {/* Display validation errors */}
              </FormItem>
            )}
          />
        )}


         <FormField
           control={form.control}
           name="priority"
           render={({ field }) => (
             <FormItem>
               <FormLabel>Priority (1-5, 1 is highest)</FormLabel>
               <FormControl>
                 <Input type="number" min="1" max="5" placeholder="3" {...field}
                  // Ensure value is handled correctly for number input
                  value={field.value ?? ''}
                  // Use onChange to handle potential empty string and convert to number
                  onChange={e => {
                      const value = e.target.value;
                      // Allow empty input or convert to number for RHF state
                      field.onChange(value === '' ? undefined : Number(value));
                  }}
                 />
               </FormControl>
               <FormDescription>Lower number means higher priority.</FormDescription>
               <FormMessage />
             </FormItem>
           )}
         />

        <Button type="submit" disabled={isLoading || isUploading} className="w-full sm:w-auto">
          {isLoading ? 'Saving Notice...' : isUploading ? 'Uploading...' : 'Add Notice'}
        </Button>
      </form>
    </Form>
  );
}

