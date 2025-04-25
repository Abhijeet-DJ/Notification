'use client';

import {useEffect, useState, useRef} from 'react';
import {CollegeNotice, getBulletinAnnouncements, getCollegeNotices} from '@/services/college-notices';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Switch} from '@/components/ui/switch';
import {useTheme} from 'next-themes';
import DateTimeDisplay from '@/components/DateTimeDisplay';
import ClientOnly from '@/components/ClientOnly';
import {MoonIcon, SunIcon} from 'lucide-react';

const NoticeBlock = ({title, notices}: {title: string; notices: CollegeNotice[]}) => {
  const isTextNotices = title === "Text Notices";
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = isTextNotices ? 5 : 1;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (!isTextNotices && notices.length > 0) {
      intervalId = setInterval(() => {
        if (containerRef.current) {
          containerRef.current.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior: 'smooth',
          });

          setTimeout(() => {
            containerRef.current!.scrollTo({top: 0, behavior: 'smooth'});
          }, 500);
        }
      }, 7000);
    }

    return () => clearInterval(intervalId);
  }, [notices, isTextNotices]);

  const startIndex = currentPage * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentNotices = isTextNotices ? notices.slice(startIndex, endIndex) : notices.slice(0, 1);

  const totalPages = isTextNotices ? Math.ceil(notices.length / itemsPerPage) : 1;

  const handleNextPage = () => {
    setCurrentPage((prevPage) => (prevPage + 1) % totalPages);
  };

  const hasNotices = notices.length > 0;

  return (
    <Card className="bg-content-block shadow-md rounded-lg overflow-hidden flex flex-col h-full">
      <CardHeader className="p-4">
        <CardTitle className="text-lg font-semibold text-accent-color">{title}</CardTitle>
      </CardHeader>
      <CardContent className={`p-4 flex-grow ${isTextNotices ? 'overflow-y-auto' : 'overflow-hidden'}`} ref={containerRef}>
        {hasNotices ? (
          isTextNotices ? (
            <ul>
              {currentNotices.map((notice, index) => (
                <li key={index} className="py-2 border-b last:border-b-0">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{notice.title}</p>
                      <p className="text-sm">{notice.content}</p>
                    </div>
                  </div>
                 </li>
              ))}
            </ul>
          ) : (
            notices.length > 0 && (
              <div className="transition-all duration-500">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{notices[0].title}</p>
                    <p className="text-sm text-muted-foreground">{new Date(notices[0].date).toISOString().split('T')[0]}</p>
                    {notices[0].contentType === 'pdf' ? (
                      <a href={notices[0].imageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View PDF</a>
                    ) : notices[0].contentType === 'image' ? (
                      <img src={notices[0].imageUrl} alt={notices[0].title} className="max-w-full h-auto" />
                    ) : notices[0].contentType === 'video' ? (
                      <video src={notices[0].imageUrl} controls className="max-w-full h-auto"></video>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          )
        ) : (
          <p className="text-muted-foreground">No {title.toLowerCase()} notices available.</p>
        )}
      </CardContent>
       {isTextNotices && (
         <div className="p-4 flex justify-center">
           <button
             onClick={handleNextPage}
             className="bg-accent-color text-white px-4 py-2 rounded hover:bg-accent-color-dark"
           >
             Next
           </button>
         </div>
       )}
     </Card>
   );
 };

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
      onClick={() => {setTheme(theme === 'light' ? 'dark' : 'light');}}
      aria-label="Toggle dark mode"
    >
      {theme === 'light' ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
    </button>
  );
};

export default function Home() {
  const [notices, setNotices] = useState<CollegeNotice[]>([]);
  const [bulletinAnnouncements, setBulletinAnnouncements] = useState<string[]>([]);

  useEffect(() => {
    const loadNotices = async () => {
      try {
        const noticesData = await getCollegeNotices();
        setNotices(noticesData);
      } catch (error) {
        console.error('Error loading notices:', error);
      }
    };

    const loadAnnouncements = async () => {
      const announcements = await getBulletinAnnouncements();
      setBulletinAnnouncements(announcements);
    };

    loadNotices();
    loadAnnouncements();
  }, []);

  const textNotices = notices.filter(notice => notice.contentType === 'text');
  const pdfNotices = notices.filter(notice => notice.contentType === 'pdf');
  const imageNotices = notices.filter(notice => notice.contentType === 'image');
  const videoNotices = notices.filter(notice => notice.contentType === 'video');

  return (
    <div className="flex flex-col h-screen bg-clean-background transition-colors duration-300">
      <header className="text-center mb-4">
        <h1 className="text-3xl font-bold text-accent-color">College Notifier</h1>
        <div className="flex justify-center items-center space-x-4">
          <DateTimeDisplay />
          <ClientOnly>
            <ThemeToggle />
          </ClientOnly>
        </div>
      </header>
      <main className="container mx-auto px-4 grid grid-cols-2 grid-rows-2 gap-4 flex-grow overflow-hidden">
        <NoticeBlock title="Text Notices" notices={textNotices} />
        <NoticeBlock title="PDF Notices" notices={pdfNotices} />
        <NoticeBlock title="Image Notices" notices={imageNotices} />
        <NoticeBlock title="Video Notices" notices={videoNotices} />
      </main>
      <MovingBulletin announcements={bulletinAnnouncements} />
    </div>
  );
}
