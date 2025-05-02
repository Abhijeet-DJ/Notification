'use client';

import * as React from 'react'; // Import React
import { useState } from 'react';
import { useForm } from 'react-hook-form';
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

// Helper to check file size (e.g., max 10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const ACCEPTED_PDF_TYPES = ["application/pdf"];
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-msvideo", "video/x-matroska"];

// Updated schema for file uploads matching the backend action
const noticeSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  noticeType: z.enum(['text', 'pdf', 'image', 'video']),
  // Make content optional in the frontend schema as well
  content: z.string().optional(),
  // Use 'file' field for file input. Expect a FileList from the input.
  file: z.instanceof(typeof window !== 'undefined' ? FileList : Object)
    .refine(
      (files) => !files || files.length === 0 || files?.[0]?.size <= MAX_FILE_SIZE, // Allow empty FileList for text notices
      `Max file size is 10MB.`
    )
    .optional(), // Optional overall, but required conditionally
  priority: z.coerce // Use coerce to handle string from input type="number"
    .number({ invalid_type_error: "Priority must be a number" })
    .min(1, "Priority must be at least 1")
    .max(5, "Priority must be at most 5")
    .default(3),
}).refine(data => {
    // Require content if type is text
    if (data.noticeType === 'text') {
        // Content must exist and not be empty spaces
        return !!data.content?.trim();
    }
    // Require file if type is not text
    if (data.noticeType !== 'text') {
        // File must exist in the FileList
        return !!data.file?.[0];
    }
    // Should not happen if logic above is correct, but return true for text notices without file
    return true;
}, {
    message: "Content is required for text notices, and a file upload is required for PDF, image, or video notices.",
    path: ["content", "file"],
}).refine(data => {
    // Validate file type based on noticeType
    if (data.file?.[0]) { // Check if file exists before accessing type
      const fileType = data.file[0].type;
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
    return true; // Pass if text notice or file type matches or no file provided yet
}, {
    message: "Invalid file type selected for the chosen notice type.",
    path: ["file"],
});


type NoticeFormData = z.infer<typeof noticeSchema>;

export default function AddNoticeForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<NoticeFormData>({
    resolver: zodResolver(noticeSchema),
    defaultValues: {
      title: '',
      noticeType: 'text',
      content: '', // Default content to empty string
      priority: 3,
      file: undefined,
    },
  });

  const noticeType = form.watch('noticeType');
  const fileRef = form.register("file"); // Register file input

  async function onSubmit(values: NoticeFormData) {
    setIsLoading(true);
    console.log('Form values submitting:', values);

    const formData = new FormData();
    formData.append('title', values.title);
    formData.append('noticeType', values.noticeType);
    formData.append('priority', String(values.priority)); // Send priority as string

    // Send content only if it's a text notice and has a value
    if (values.noticeType === 'text' && values.content) {
      formData.append('content', values.content);
    } else if (values.noticeType !== 'text' && values.file?.[0]) {
        // Append the file itself from the FileList
        formData.append('file', values.file[0]);
        formData.append('fileName', values.file[0].name); // Send original filename
    } else if (values.noticeType === 'text' && !values.content?.trim()) {
        // This case should be caught by Zod validation, but added as a fallback
        toast({
            title: "Missing Content",
            description: `Please enter content for the text notice.`,
            variant: "destructive",
        });
        setIsLoading(false);
        return; // Stop submission
    } else if (values.noticeType !== 'text' && !values.file?.[0]) {
       // This case should be caught by Zod validation, but added as a fallback
        toast({
            title: "Missing File",
            description: `Please upload a file for the ${values.noticeType} notice.`,
            variant: "destructive",
        });
        setIsLoading(false);
        return; // Stop submission
    }
    // If it's not a text notice, 'content' field is implicitly not sent or handled by backend as empty

    try {
      console.log('Sending FormData to server action:', Object.fromEntries(formData.entries()));
      // Call the server action
      const result = await addNotice(formData);

      if (result.success) {
        toast({
          title: "Notice Added",
          description: "The new notice has been successfully added.",
        });
        form.reset(); // Reset form after successful submission
      } else {
        toast({
          title: "Error Adding Notice",
          description: result.error || "Failed to add notice. Please check the details.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: "Submission Error",
        description: "An unexpected error occurred while submitting the form.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

   // Log form errors for debugging
   React.useEffect(() => {
     if (form.formState.errors && Object.keys(form.formState.errors).length > 0) {
       console.log("Form validation errors:", form.formState.errors);
     }
   }, [form.formState.errors]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6"> {/* Increased spacing */}
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
                field.onChange(value);
                // Reset other fields when type changes
                form.setValue('file', undefined); // Clear file input
                form.setValue('content', ''); // Clear content
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
                    className="min-h-[100px]" // Slightly larger text area
                    {...field}
                    // Ensure value is handled correctly, default to empty string
                    value={field.value ?? ''}
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
           // Field for File input for PDF, Image, Video
          <FormField
            control={form.control}
            name="file"
            render={({ field }) => ( // Removed unnecessary destructuring
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
                     {...fileRef} // Use the registered ref here
                   />
                </FormControl>
                 <FormDescription>
                   Upload the {noticeType} file. Max size: 10MB.
                 </FormDescription>
                <FormMessage />
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
                 {/* Ensure type="number" for better UX, but Zod handles coercion */}
                 <Input type="number" min="1" max="5" placeholder="3" {...field}
                  // Ensure value is handled correctly for number input
                  value={field.value ?? ''}
                  onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                 />
               </FormControl>
               <FormDescription>Lower number means higher priority.</FormDescription>
               <FormMessage />
             </FormItem>
           )}
         />

        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto"> {/* Make button full width on small screens */}
          {isLoading ? 'Adding Notice...' : 'Add Notice'}
        </Button>
      </form>
    </Form>
  );
}
