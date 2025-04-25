'use client';

import {useEffect, useState} from 'react';
import {CollegeNotice, getBulletinAnnouncements, getCollegeNotices} from '@/services/college-notices';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Switch} from '@/components/ui/switch';
import {useTheme} from 'next-themes';
import DateTimeDisplay from '@/components/DateTimeDisplay';
import ClientOnly from '@/components/ClientOnly';
import {MoonIcon, SunIcon} from 'lucide-react';

const NoticeBlock = ({title, notices}: {title: string; notices: CollegeNotice[]}) => (
  <Card className="bg-content-block shadow-md rounded-lg overflow-hidden flex flex-col">
    <CardHeader className="p-4">
      <CardTitle className="text-lg font-semibold text-accent-color">{title}</CardTitle>
    </CardHeader>
    <CardContent className="p-4 flex-grow overflow-y-auto">
      {notices.length === 0 ? (
        <p className="text-muted-foreground">No {title.toLowerCase()} notices available.</p>
      ) : (
        <ul>
          {notices.map((notice, index) => (
            <li key={index} className="py-2 border-b last:border-b-0">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{notice.title}</p>
                  <p className="text-sm text-muted-foreground">{new Date(notice.dateTime).toISOString().split('T')[0]}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </CardContent>
  </Card>
);

const MovingBulletin = ({announcements}: {announcements: string[]}) => {
  const {theme} = useTheme();
  const textColor = theme === 'dark' ? 'text-white' : 'text-black';

  return (
    <div className="relative w-full h-10 bg-accent-color py-2 overflow-hidden">
      <div className="w-full whitespace-nowrap animate-marquee" style={{animationPlayState: 'running'}}>
        {announcements.map((announcement, index) => (
          <span
            key={index}
            className={`mx-4 inline-block transition-colors duration-300 ${textColor}`}
          >
            {announcement}
          </span>
        ))}
      </div>
    </div>
  );
};

const ThemeToggle = () => {
  const {setTheme, theme} = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <button
      className="rounded-full bg-secondary p-2 shadow-md transition-colors duration-300 hover:bg-accent-color hover:text-white"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    >
      {theme === 'light' ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
      <span className="sr-only">Toggle dark mode</span>
    </button>
  );
};

export default function Home() {
  const [textNotices, setTextNotices] = useState<CollegeNotice[]>([]);
  const [pdfNotices, setPdfNotices] = useState<CollegeNotice[]>([]);
  const [imageNotices, setImageNotices] = useState<CollegeNotice[]>([]);
  const [videoNotices, setVideoNotices] = useState<CollegeNotice[]>([]);
  const [bulletinAnnouncements, setBulletinAnnouncements] = useState<string[]>([]);

  useEffect(() => {
    const loadNotices = async () => {
      const notices = await getCollegeNotices();
      setTextNotices(notices.filter(notice => notice.contentType === 'text'));
      setPdfNotices(notices.filter(notice => notice.contentType === 'pdf'));
      setImageNotices(notices.filter(notice => notice.contentType === 'image'));
      setVideoNotices(notices.filter(notice => notice.contentType === 'video'));
    };

    const loadAnnouncements = async () => {
      const announcements = await getBulletinAnnouncements();
      setBulletinAnnouncements(announcements);
    };

    loadNotices();
    loadAnnouncements();
  }, []);

  return (
    <div className="min-h-screen bg-clean-background py-6 transition-colors duration-300">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold text-accent-color">College Notifier</h1>
        <div className="flex justify-center items-center space-x-4">
          <p className="text-muted-foreground">Stay updated with the latest announcements</p>
          <DateTimeDisplay />
          <ClientOnly>
            <ThemeToggle />
          </ClientOnly>
        </div>
      </header>
      <main className="container mx-auto px-4">
        <div className="grid grid-cols-2 grid-rows-2 gap-4">
          <NoticeBlock title="Text Notices" notices={textNotices} />
          <NoticeBlock title="PDF Notices" notices={pdfNotices} />
          <NoticeBlock title="Image Notices" notices={imageNotices} />
          <NoticeBlock title="Video Notices" notices={videoNotices} />
        </div>
      </main>
      <footer className="mt-8">
        <MovingBulletin announcements={bulletinAnnouncements} />
      </footer>
    </div>
  );
}
