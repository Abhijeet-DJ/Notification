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
      content: 'https://www.africau.edu/images/default/sample.pdf',
    },
    {
      title: 'Campus Photo',
      dateTime: '2024-01-03T09:15:00Z',
      contentType: 'image',
      content: 'https://www.simplilearn.com/ice9/free_resources_article_thumb/what_is_image_processing.jpg',
    },
    {
      title: 'Video Update',
      dateTime: '2024-01-04T16:45:00Z',
      contentType: 'video',
      content: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360p_10mb.mp4',
    },
    {
      title: 'Orientation Day',
      dateTime: '2024-01-05T10:00:00Z',
      contentType: 'text',
      content: 'Orientation day for new students on Jan 10th.',
    },
    {
      title: 'Academic Calendar PDF',
      dateTime: '2024-01-06T11:20:00Z',
      contentType: 'pdf',
      content: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    },
    {
      title: 'Student Activities Image',
      dateTime: '2024-01-07T13:40:00Z',
      contentType: 'image',
      content: 'https://images.pexels.com/photos/270404/pexels-photo-270404.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500',
    },
    {
      title: 'College Tour Video',
      dateTime: '2024-01-08T15:55:00Z',
      contentType: 'video',
      content: 'https://sample-videos.com/video123/mp4/480/big_buck_bunny_480p_5mb.mp4',
    },
    {
      title: 'Another Important Announcement',
      dateTime: '2024-01-09T18:00:00Z',
      contentType: 'text',
      content: 'Registration for spring semester is now open.',
    },
    {
      title: 'Research Paper PDF',
      dateTime: '2024-01-10T20:30:00Z',
      contentType: 'pdf',
      content: 'https://www.unece.org/fileadmin/DAM/trans/danger/publi/ghs/ghs_rev08/English/GHS_Rev08_E_part1.pdf',
    },
    {
      title: 'Graduation Ceremony Image',
      dateTime: '2024-01-11T08:15:00Z',
      contentType: 'image',
      content: 'https://media.istockphoto.com/id/520049967/photo/graduation.jpg?s=612x612&w=0&k=20&c=EOtd49hq9bqDXvW9j5K-m5U6LGLBjfK3VrsQ3wMOQfs=',
    },
    {
      title: 'Guest Lecture Video',
      dateTime: '2024-01-12T11:45:00Z',
      contentType: 'video',
      content: 'https://sample-videos.com/video123/mp4/480/rocket_320x240.mp4',
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
    'Admissions Open for 2025',
    'Scholarship Applications Available'
  ];
}
