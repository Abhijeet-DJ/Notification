'use server';

import { z } from 'zod';
import { getCollegeNotices } from '@/services/college-notices'; // Import to potentially update local state or call backend

// Define the expected schema for the form data coming from the client
const formDataSchema = z.object({
  title: z.string(),
  noticeType: z.enum(['text', 'pdf', 'image', 'video']),
  priority: z.string().transform(Number),
  content: z.string().optional(),
  imageUrl: z.string().optional(), // URL from file upload (placeholder for now)
  fileName: z.string().optional(), // Original file name
});

// In-memory store for demonstration purposes. Replace with database interaction.
let noticesStore: any[] = []; // Ideally fetch initial state if needed

export async function addNotice(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate and parse form data
    const rawData = Object.fromEntries(formData.entries());
    const validatedData = formDataSchema.safeParse(rawData);

    if (!validatedData.success) {
      console.error("Validation errors:", validatedData.error.errors);
      return { success: false, error: 'Invalid form data.' };
    }

    const { title, noticeType, priority, content, imageUrl } = validatedData.data;

    // Construct the new notice object
    const newNotice = {
      _id: `temp_${Date.now()}_${Math.random().toString(16).slice(2)}`, // Temporary unique ID
      title,
      content: noticeType === 'text' ? content : '', // Only store content for text notices
      imageUrl: noticeType !== 'text' ? (imageUrl || '') : '', // Store URL for non-text notices
      priority,
      createdBy: 'admin_interface', // Placeholder user
      date: new Date().toISOString(),
      __v: 0, // Version key if needed
      // Add derived contentType based on logic from getCollegeNotices
      contentType: noticeType
    };

    console.log('Adding new notice:', newNotice);

    // ** Backend Integration Point **
    // Instead of an in-memory store, you would typically:
    // 1. Call your backend API endpoint to save the notice.
    //    e.g., await fetch('YOUR_API_ENDPOINT/notices', { method: 'POST', body: JSON.stringify(newNotice), headers: {'Content-Type': 'application/json'} });
    // 2. Or, if using a database directly (like Prisma, Drizzle, etc.), perform an insert operation.
    //    e.g., await db.insert(noticesTable).values(newNotice);

    // For demonstration, add to the in-memory store
    noticesStore.push(newNotice);

    // Optional: Revalidate the path if using Next.js caching and you want the main page to update immediately
    // revalidatePath('/');

    return { success: true };

  } catch (error) {
    console.error('Error in addNotice server action:', error);
    return { success: false, error: 'An unexpected error occurred while adding the notice.' };
  }
}

// Function to potentially override getCollegeNotices for demo purposes
// This allows the form to "update" the list shown on the main page
// !! THIS IS NOT A PRODUCTION APPROACH - IT ONLY WORKS FOR A SINGLE SERVER INSTANCE !!
export async function getNoticesFromStore() {
  // In a real app, always fetch from the source of truth (API/DB)
  const apiNotices = await getCollegeNotices(); // Get notices from the original source
  // Combine API notices with temporarily stored notices (remove duplicates if necessary)
  const combinedNotices = [...apiNotices, ...noticesStore];
  // Simple deduplication based on _id or a combination of fields if needed
   const uniqueNotices = Array.from(new Map(combinedNotices.map(item => [item._id || `${item.title}-${item.date}`, item])).values());
   // Sort by date or priority if required
   uniqueNotices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return uniqueNotices;
}
