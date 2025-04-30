'use server';

/**
 * Represents a college notice with various content types.
 * Matches the provided API data structure.
 */
export interface CollegeNotice {
  _id: string; // Unique identifier from the database
  title: string;
  content?: string; // Optional content, primarily for text notices
  imageUrl?: string; // URL for PDF, image, or video files
  priority: number; // Notice priority
  createdBy: string; // Identifier of the creator
  date: string; // ISO date string
  __v?: number; // Version key, optional
  // Derived property, not directly from API but useful for filtering
  contentType: 'text' | 'pdf' | 'image' | 'video';
}

/**
 * Asynchronously retrieves college notices from the configured API endpoint.
 *
 * @returns A promise that resolves to an array of CollegeNotice objects.
 */
export async function getCollegeNotices(): Promise<CollegeNotice[]> {
  const apiUrl = process.env.NEXT_PUBLIC_NOTICES_API_URL;

  if (!apiUrl) {
    console.error('Error: NEXT_PUBLIC_NOTICES_API_URL is not defined in .env');
    // Return default dummy data if API URL is missing
    return getDefaultNotices();
    // Or return an empty array: return [];
  }

  try {
    const response = await fetch(apiUrl, { cache: 'no-store' }); // Disable caching for fresh data

    if (!response.ok) {
      console.error(`HTTP error fetching notices! status: ${response.status}`);
      return getDefaultNotices(); // Return dummy data on fetch error
      // Or throw an error: throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // Validate and map the data to the CollegeNotice interface
    const notices: CollegeNotice[] = data.map((item: any) => {
      let contentType: 'text' | 'pdf' | 'image' | 'video' = 'text'; // Default to text

      if (item.imageUrl) {
        const url = item.imageUrl.toLowerCase();
        if (url.endsWith('.pdf')) {
          contentType = 'pdf';
        } else if (url.match(/\.(jpeg|jpg|gif|png|webp)$/)) {
          contentType = 'image';
        } else if (url.match(/\.(mp4|mov|avi|webm)$/)) {
          contentType = 'video';
        }
        // If imageUrl exists but doesn't match known file types, keep as 'text'
        // or handle as a generic link if needed.
      } else if (!item.content) {
         // If no imageUrl and no content, maybe default or handle differently
         // For now, keep as 'text' assuming title is always present.
      }


      return {
        _id: item._id,
        title: item.title,
        content: item.content || '', // Ensure content is at least an empty string
        imageUrl: item.imageUrl || '', // Ensure imageUrl is at least an empty string
        priority: item.priority || 3, // Default priority if missing
        createdBy: item.createdBy,
        date: item.date,
        __v: item.__v,
        contentType: contentType, // Set the derived content type
      };
    }).filter((notice: CollegeNotice | null): notice is CollegeNotice => notice !== null); // Filter out any potential nulls if validation fails

    // Sort notices primarily by priority (ascending, lower number is higher priority)
    // and secondarily by date (descending, newest first)
    notices.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });


    return notices;
  } catch (error) {
    console.error('Failed to fetch or process college notices:', error);
    // Return default dummy data on any processing error
    return getDefaultNotices();
    // Or return empty: return [];
  }
}


// Function to provide default dummy notices if API fails or is unavailable
function getDefaultNotices(): CollegeNotice[] {
  console.warn("Using default dummy notices.");
  const now = new Date();
  return [
    {
      _id: 'dummy_text_1',
      title: 'Default Text Notice 1',
      content: 'This is some default content for a text notice. API might be unavailable.',
      imageUrl: '',
      priority: 3,
      createdBy: 'system',
      date: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
      contentType: 'text',
    },
    {
       _id: 'dummy_text_2',
       title: 'Default Text Notice 2 (Higher Priority)',
       content: 'This notice has a higher priority.',
       imageUrl: '',
       priority: 1,
       createdBy: 'system',
       date: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
       contentType: 'text',
     },
    {
      _id: 'dummy_image_1',
      title: 'Default Image Notice',
      content: '',
      imageUrl: 'https://picsum.photos/seed/default1/400/300',
      priority: 2,
      createdBy: 'system',
      date: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
      contentType: 'image',
    },
     {
       _id: 'dummy_pdf_1',
       title: 'Default PDF Notice',
       content: '',
       // Note: This is a placeholder. You'd need a real PDF URL for it to work.
       imageUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
       priority: 3,
       createdBy: 'system',
       date: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
       contentType: 'pdf',
     },
     // Add more dummy notices if needed
  ].sort((a, b) => { // Ensure default notices are also sorted
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
}

/**
 * Asynchronously retrieves important bulletin announcements.
 * In a real app, this would likely fetch from an API.
 *
 * @returns A promise that resolves to an array of strings representing bulletin announcements.
 */
export async function getBulletinAnnouncements(): Promise<string[]> {
  // TODO: Implement this by calling an API or fetching from a database.
  return [
    'Welcome to the College Notifier App!',
    'Check back often for important updates.',
    'Have a great semester!',
    'Admissions Open for 2025 Session.',
    'Scholarship Application Deadline Approaching.',
    'Upcoming Holiday: College Closed on Monday.'
  ];
}