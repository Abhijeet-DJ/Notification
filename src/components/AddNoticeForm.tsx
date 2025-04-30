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

const noticeSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  noticeType: z.enum(['text', 'pdf', 'image', 'video']),
  content: z.string().optional(),
  file: z.any().optional(), // For file uploads
  priority: z.coerce.number().min(1).max(5).optional().default(3),
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
      priority: 3,
    },
  });

  const noticeType = form.watch('noticeType');

  async function onSubmit(values: NoticeFormData) {
    setIsLoading(true);
    console.log('Form values:', values);

    const formData = new FormData();
    formData.append('title', values.title);
    formData.append('noticeType', values.noticeType);
    formData.append('priority', String(values.priority));

    if (values.noticeType === 'text') {
      formData.append('content', values.content || '');
    } else if (values.file?.[0]) {
       // In a real app, you'd upload the file here and get a URL
       // For now, we'll just pass the file name for demonstration
      formData.append('fileName', values.file[0].name);
      // TODO: Implement actual file upload logic here to get a URL
      // For demo purposes, using a placeholder URL structure
      let placeholderUrl = '';
      switch(values.noticeType) {
        case 'pdf': placeholderUrl = `/uploads/placeholder.pdf`; break;
        case 'image': placeholderUrl = `https://picsum.photos/400/300?random=${Date.now()}`; break; // Use picsum for images
        case 'video': placeholderUrl = `/uploads/placeholder.mp4`; break;
      }
       formData.append('imageUrl', placeholderUrl); // Send placeholder URL
    }


    try {
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
          title: "Error",
          description: result.error || "Failed to add notice.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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

        {noticeType === 'text' && (
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Content</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter notice content"
                    className="resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {noticeType !== 'text' && (
          <FormField
            control={form.control}
            name="file"
            render={({ field: { value, onChange, ...fieldProps } }) => (
              <FormItem>
                <FormLabel>
                  Upload {noticeType === 'pdf' ? 'PDF' : noticeType === 'image' ? 'Image' : 'Video'}
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
                   {/* In a real app, you'd handle the upload process here. */}
                   Select a file to upload.
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
                 <Input type="number" min="1" max="5" {...field} />
               </FormControl>
               <FormMessage />
             </FormItem>
           )}
         />

        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Adding...' : 'Add Notice'}
        </Button>
      </form>
    </Form>
  );
}