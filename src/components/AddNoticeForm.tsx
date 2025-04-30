'use client';

import type * as React from 'react';
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

// This schema should closely match the one in the server action for client-side validation
const noticeSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  noticeType: z.enum(['text', 'pdf', 'image', 'video']),
  content: z.string().optional(),
  // Use imageUrl field for URL input
  imageUrl: z.string().url('Please enter a valid URL (e.g., https://...)').optional().or(z.literal('')),
  file: z.any().optional(), // Keep file input for potential future direct uploads, but prioritize imageUrl
  priority: z.coerce // Use coerce to handle string from input type="number"
    .number({ invalid_type_error: "Priority must be a number" })
    .min(1, "Priority must be at least 1")
    .max(5, "Priority must be at most 5")
    .default(3),
}).refine(data => {
    // Require content if type is text
    if (data.noticeType === 'text' && !data.content?.trim()) {
        return false;
    }
    // Require imageUrl if type is not text
    if (data.noticeType !== 'text' && !data.imageUrl?.trim()) {
        // Note: We might add file upload later, this validation assumes URL input for now.
        // If file upload is added, this logic needs adjustment.
        return false;
    }
    return true;
}, {
    // Custom error message based on the type
    message: "Content is required for text notices, and a URL is required for PDF, image, or video notices.",
    // Path indicates which field the error applies to, refinement errors don't belong to a single field easily
    // We can refine specific fields above or handle this general message display
    path: ["content", "imageUrl"], // Associate error with relevant fields
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
      content: '',
      imageUrl: '',
      priority: 3,
    },
  });

  const noticeType = form.watch('noticeType');

  async function onSubmit(values: NoticeFormData) {
    setIsLoading(true);
    console.log('Form values submitting:', values);

    const formData = new FormData();
    formData.append('title', values.title);
    formData.append('noticeType', values.noticeType);
    formData.append('priority', String(values.priority)); // Send priority as string

    if (values.noticeType === 'text') {
      formData.append('content', values.content || '');
    } else {
        // Use the provided imageUrl if available
        if (values.imageUrl) {
            formData.append('imageUrl', values.imageUrl);
        }
        // TODO: Add actual file upload logic here if required in the future
        // else if (values.file?.[0]) {
        //   // Handle file upload, get URL, then append
        //   formData.append('fileName', values.file[0].name);
        //   // Example: const uploadedUrl = await uploadFile(values.file[0]);
        //   // formData.append('imageUrl', uploadedUrl);
        // }
        else {
            // Handle case where neither URL nor file is provided for non-text type
            // This should ideally be caught by Zod validation, but as a fallback:
            toast({
                title: "Missing Content",
                description: `Please provide a URL for the ${values.noticeType} notice.`,
                variant: "destructive",
            });
            setIsLoading(false);
            return; // Stop submission
        }
    }


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
   // React.useEffect(() => {
   //   if (form.formState.errors && Object.keys(form.formState.errors).length > 0) {
   //     console.log("Form validation errors:", form.formState.errors);
   //   }
   // }, [form.formState.errors]);

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
                // Optionally reset other fields when type changes
                if (value === 'text') {
                    form.setValue('imageUrl', ''); // Clear URL if switching to text
                } else {
                    form.setValue('content', ''); // Clear content if switching away from text
                }
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
           // Field for URL input for PDF, Image, Video
          <FormField
            control={form.control}
            name="imageUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                   URL for {noticeType === 'pdf' ? 'PDF' : noticeType === 'image' ? 'Image' : 'Video'}
                </FormLabel>
                <FormControl>
                   <Input
                     type="url"
                     placeholder={`Enter URL (e.g., https://... .${noticeType})`}
                     {...field}
                   />
                </FormControl>
                 <FormDescription>
                   Enter the direct link to the {noticeType} file. Ensure it's publicly accessible.
                 </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          /* Optional File input - keep commented out unless implementing direct uploads
          <FormField
            control={form.control}
            name="file"
            render={({ field: { value, onChange, ...fieldProps } }) => (
              <FormItem>
                <FormLabel>
                  Upload {noticeType === 'pdf' ? 'PDF' : noticeType === 'image' ? 'Image' : 'Video'} (Optional)
                </FormLabel>
                <FormControl>
                   <Input
                     {...fieldProps}
                     type="file"
                     accept={
                       noticeType === 'pdf' ? '.pdf' :
                       noticeType === 'image' ? 'image/*' :
                       noticeType === 'video' ? 'video/*' : ''
                     }
                     onChange={(event) =>
                       onChange(event.target.files)
                     }
                   />
                </FormControl>
                 <FormDescription>
                    Alternative to providing a URL. (File upload not fully implemented yet).
                 </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          */
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
