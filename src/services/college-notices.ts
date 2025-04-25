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
  dateTime: string;
  /**
   * The type of the notice content (e.g., 'text', 'pdf', 'image', 'video').
   */
  contentType: 'text' | 'pdf' | 'image' | 'video';
  /**
   * The content of the notice. This could be text, a URL to a PDF, image, or video.
   */
  content: string;
}

/**
 * Asynchronously retrieves college notices.
 *
 * @returns A promise that resolves to an array of CollegeNotice objects.
 */
export async function getCollegeNotices(): Promise<CollegeNotice[]> {
  // TODO: Implement this by calling an API.

  return [
    {
      title: 'Important Announcement',
      dateTime: '2024-01-01T12:00:00Z',
      contentType: 'text',
      content: 'Classes will be cancelled tomorrow due to weather.',
    },
    {
      title: 'New PDF Available',
      dateTime: '2024-01-02T14:30:00Z',
      contentType: 'pdf',
      content: 'https://vadimdez.dev/s/pdf-sample.pdf',
    },
    {
      title: 'Campus Photo',
      dateTime: '2024-01-03T09:15:00Z',
      contentType: 'image',
      content: 'https://fastly.picsum.photos/id/10/2500/1667.jpg?hmac=J04WWC_ebchx3WwzbM-Z4f6ttwWq6bLnaB9iyIKG-2Q',
    },
    {
      title: 'Video Update',
      dateTime: '2024-01-04T16:45:00Z',
      contentType: 'video',
      content: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
    },
    {
      title: 'Orientation Day',
      dateTime: '2024-01-05T10:00:00Z',
      contentType: 'text',
      content: 'Orientation day for new students on Jan 10th.',
    },
  ];
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
  ];
}
