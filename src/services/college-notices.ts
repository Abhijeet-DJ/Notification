'use server';

/**
 * Represents a college notice with various content types.
 */
export interface CollegeNotice {
  /**
   * The title of the notice.
   */
  title: string;
  /**
   * The date and time the notice was published.
   */
  date: string;
  /**
   * The type of the notice content (e.g., 'text', 'pdf', 'image', 'video').
   */
  contentType: 'text' | 'pdf' | 'image' | 'video';
  /**
   * The content of the notice. This could be text, a URL to a PDF, image, or video.
   */
  content: string;
  imageUrl: string;
}

/**
 * Asynchronously retrieves college notices.
 *
 * @returns A promise that resolves to an array of CollegeNotice objects.
 */
export async function getCollegeNotices(): Promise<CollegeNotice[]> {
  const apiUrl = process.env.NEXT_PUBLIC_NOTICES_API_URL;

  if (!apiUrl) {
    console.error('NEXT_PUBLIC_NOTICES_API_URL is not defined in .env');
    return [];
  }

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // Map the data to the CollegeNotice interface, setting contentType based on imageUrl
    const notices: CollegeNotice[] = data.map((item: any) => ({
      title: item.title,
      date: item.date,
      contentType: item.imageUrl
        ? item.imageUrl.endsWith('.pdf') ? 'pdf'
        : item.imageUrl.match(/\.(jpeg|jpg|gif|png)$/) != null ? 'image'
        : item.imageUrl.match(/\.(mp4|mov|avi)$/) != null ? 'video' : 'text'
        : 'text',
      content: item.content,
      imageUrl: item.imageUrl,
    }));
    return notices;
  } catch (error) {
    console.error('Failed to fetch college notices:', error);
    return [];
  }
}

/**
 * Asynchronously retrieves important bulletin announcements.
 *
 * @returns A promise that resolves to an array of strings representing bulletin announcements.
 */
export async function getBulletinAnnouncements(): Promise<string[]> {
  // TODO: Implement this by calling an API.

  return [
    'Welcome to the College Notifier App!',
    'Check back often for important updates.',
    'Have a great semester!',
    'Admissions Open for 2025',
    'Scholarship Applications Available'
  ];
}
