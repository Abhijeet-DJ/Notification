'use client';

import type { Metadata } from 'next';
import { useEffect, useState, useRef } from 'react';
import { CollegeNotice, getCollegeNotices, getBulletinAnnouncements } from '@/services/college-notices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';
import DateTimeDisplay from '@/components/DateTimeDisplay';
import ClientOnly from '@/components/ClientOnly';
import { MoonIcon, SunIcon, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';


const NoticeBlock = ({ title, notices }: { title: string; notices: CollegeNotice[] }) => {
  const isTextNotices = title === "Text Notices";
  const [currentPage, setCurrentPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null); // Ref to hold interval ID

   // --- Debugging Log ---
   // console.log(`[DEBUG] NoticeBlock Rendering: Title="${title}", Notices Count=${notices.length}`);
   // if (title === "Image Notices" && notices.length > 0) {
   //   console.log("[DEBUG] Image Notices Data:", notices);
   // }
   // --- End Debugging Log ---


  // Function to start the animation interval
  const startAnimation = () => {
    // Clear any existing interval before starting a new one
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const totalItems = notices.length;
    if (totalItems === 0) return; // Don't start if no notices

    const itemsPerPage = isTextNotices ? 5 : 1;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    // Increased animation duration for slower scrolling/transitions
    const animationDuration = isTextNotices ? 10000 : 10000; // e.g., 10 seconds for text, 10 seconds for files

    intervalRef.current = setInterval(() => {
      setCurrentPage((prevPage) => {
        const nextPage = (prevPage + 1) % totalPages;

        // Scroll logic for text notices (smooth scroll)
        if (isTextNotices && containerRef.current) {
           // Scroll down effect
           containerRef.current.scrollTo({
             top: containerRef.current.scrollHeight, // Scroll to bottom first
             behavior: 'smooth',
           });
           // After a delay, scroll back to top smoothly to show next batch
           setTimeout(() => {
             if (containerRef.current) {
               // Reset scroll smoothly to top *before* the next interval tick
               containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
             }
           }, animationDuration / 2); // Adjust timing relative to animationDuration
        }
        // For non-text notices, just update the page state for the next item
        return nextPage;
      });
    }, animationDuration);
  };

  // Effect to start/restart animation when notices change
  useEffect(() => {
    startAnimation();
    // Cleanup function to clear interval on component unmount or notices change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [notices, isTextNotices]); // Rerun effect if notices or type change


  const itemsPerPage = isTextNotices ? 5 : 1;
  const startIndex = currentPage * itemsPerPage;
  // Slice the notices based on current page and items per page
   const currentNotices = notices.slice(startIndex, startIndex + itemsPerPage);

   // --- Debugging Log ---
   // console.log(`[DEBUG] Current Notices for "${title}":`, currentNotices);
   // if (title === "Image Notices" && currentNotices.length > 0) {
   //   console.log("[DEBUG] Current Image Notice URL:", currentNotices[0]?.imageUrl);
   // }
   // --- End Debugging Log ---


  const hasNotices = notices?.length > 0;

   // Debug log to see what currentNotices contains for PDF block
   if (title === "PDF Notices") {
     // console.log("PDF Notices - currentNotices:", currentNotices);
   }
   // Debug log for Image Notices
   if (title === "Image Notices") {
     // console.log("[DEBUG] NoticeBlock - Image Notices Data:", currentNotices);
   }


  return (
    <Card className="bg-content-block shadow-md rounded-lg overflow-hidden flex flex-col h-full">
      <CardHeader className="p-4 flex-shrink-0">
        <CardTitle className="text-lg font-semibold text-accent-color">{title}</CardTitle>
      </CardHeader>
      {/* Removed fixed height and added min-h-0 for flex-grow */}
      <CardContent className={`flex-grow overflow-hidden ${isTextNotices ? 'p-4' : 'p-1 md:p-2'} min-h-0`} ref={containerRef}>
         {hasNotices ? (
           isTextNotices ? (
             <ul>
               {currentNotices.map((notice) => (
                 <li key={notice._id} className="py-2 border-b last:border-b-0">
                   <div className="flex justify-between items-center">
                     <div>
                       <p className="font-medium">{notice.title}</p>
                       {/* Display content only for text notices */}
                       <p className="text-sm">{notice.content}</p>
                       <p className="text-xs text-muted-foreground">
                         {new Date(notice.date).toISOString().split('T')[0]}
                       </p>
                     </div>
                   </div>
                  </li>
               ))}
             </ul>
           ) : (
             // Display logic for PDF, Image, Video (shows one at a time)
             currentNotices.length > 0 && (
               <div className="transition-all duration-500 h-full">
                 <div className="flex flex-col space-y-2 h-full justify-center items-center text-center">
                   <p className="font-medium px-2">{currentNotices[0].title}</p>
                   <p className="text-sm text-muted-foreground">
                      {new Date(currentNotices[0].date).toISOString().split('T')[0]}
                   </p>
                   {currentNotices[0].contentType === 'pdf' ? (
                      // Embed PDF using iframe
                      <div className="flex-grow w-full h-full flex items-center justify-center overflow-hidden">
                         {/* Ensure the URL is correctly passed and accessible */}
                         <iframe
                           src={currentNotices[0].imageUrl}
                           title={currentNotices[0].title}
                           className="w-full h-full border-0 rounded-md"
                           onError={(e) => console.error("Error loading PDF:", currentNotices[0].imageUrl, e)} // Add error handling
                           // sandbox="allow-scripts allow-same-origin" // Use cautiously if needed
                         />
                      </div>
                   ) : currentNotices[0].contentType === 'image' ? (
                     // Adjusted image container and image classes
                     // --- Debugging Log ---
                     (() => {
                        console.log(`[DEBUG][NoticeBlock] Rendering Image Notice: Title="${currentNotices[0].title}", URL=${currentNotices[0].imageUrl}`);
                        return null;
                      })(),
                     // --- End Debugging Log ---
                     <div className="flex-grow w-full h-full flex items-center justify-center overflow-hidden">
                       <img
                         src={currentNotices[0].imageUrl}
                         alt={currentNotices[0].title}
                         className="max-w-full max-h-full object-contain rounded-md" // Ensure image fits without cropping
                         onError={(e) => console.error("[DEBUG][NoticeBlock] Error loading Image:", currentNotices[0].imageUrl, e)} // Add error handling
                       />
                      </div>
                   ) : currentNotices[0].contentType === 'video' ? (
                     // Adjusted video container and video classes
                      <div className="flex-grow w-full h-full flex items-center justify-center overflow-hidden">
                       <video
                         src={currentNotices[0].imageUrl}
                         controls
                         className="max-w-full max-h-full rounded-md" // Ensure video fits
                         onError={(e) => console.error("Error loading Video:", currentNotices[0].imageUrl, e)} // Add error handling
                       />
                      </div>
                   ) : null}
                 </div>
               </div>
             )
           )
         ) : (
           <p className="text-muted-foreground p-4">No {title.toLowerCase()} available.</p> /* Added padding for 'no notices' */
         )}
       </CardContent>
        </Card>
    );
  };

const MovingBulletin = ({ announcements }: { announcements: string[] }) => {
  const { theme } = useTheme();
  // Use CSS variables defined in globals.css for dynamic theme colors
   const textColorClass = theme === 'dark' ? 'text-[hsl(var(--bulletin-text-dark))]' : 'text-[hsl(var(--bulletin-text-light))]';


  return (
    <div className="relative w-full h-10 bg-accent py-2 overflow-hidden flex-shrink-0"> {/* Ensure it doesn't grow */}
      {/* Apply text color dynamically */}
      <div className={`w-full whitespace-nowrap animate-marquee ${textColorClass}`} style={{ animationPlayState: 'running' }}>
        {announcements.map((announcement, index) => (
          <span
            key={index}
            className="mx-4 inline-block transition-colors duration-300" // Text color handled by parent div
          >
            {announcement}
          </span>
        ))}
      </div>
    </div>
  );
};

const ThemeToggle = () => {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render a placeholder or null on the server/before hydration
    return <div className="h-8 w-8 rounded-full bg-secondary animate-pulse"></div>;
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-full bg-secondary shadow-md transition-colors duration-300 hover:bg-accent hover:text-accent-foreground"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label="Toggle dark mode"
    >
      {theme === 'light' ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
    </Button>
  );
};


export default function Home() {
  const [notices, setNotices] = useState<CollegeNotice[]>([]);
  const [bulletinAnnouncements, setBulletinAnnouncements] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const noticesData = await getCollegeNotices();
        // console.log("[DEBUG][Home] Fetched notices:", noticesData); // Log fetched data
        setNotices(noticesData);

        const announcements = await getBulletinAnnouncements();
        setBulletinAnnouncements(announcements);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();

     // Optional: Refresh data periodically (e.g., every minute)
     const intervalId = setInterval(loadData, 60000);

     return () => clearInterval(intervalId); // Clean up interval on unmount
  }, []);


  // Filter notices based on the contentType
   const textNotices = notices.filter(notice => notice.contentType === 'text');
   const pdfNotices = notices.filter(notice => notice.contentType === 'pdf');
   const imageNotices = notices.filter(notice => notice.contentType === 'image');
   const videoNotices = notices.filter(notice => notice.contentType === 'video');

   // Log filtered notices for debugging
   // console.log("[DEBUG][Home] Filtered PDF Notices:", pdfNotices);
   // console.log("[DEBUG][Home] Filtered Image Notices:", imageNotices);
   // console.log("[DEBUG][Home] Filtered Video Notices:", videoNotices);
   // console.log("[DEBUG][Home] Filtered Text Notices:", textNotices);


  return (
    // Use flexbox for layout, h-screen for full height, overflow-hidden to prevent body scroll
    <div className="flex flex-col h-screen bg-clean-background transition-colors duration-300 overflow-hidden">
      {/* Header: flex-shrink-0 prevents it from shrinking */}
      <header className="text-center py-4 px-4 flex justify-between items-center flex-shrink-0 border-b">
         {/* Add Notice Button */}
         <Button asChild variant="outline">
           <Link href="/add-notice">
             <PlusCircle className="mr-2 h-4 w-4" /> Add Notice
           </Link>
         </Button>

        <h1 className="text-3xl font-bold text-primary">College Notifier</h1>
        <div className="flex items-center space-x-4">
          <ClientOnly>
             <DateTimeDisplay />
           </ClientOnly>
          <ClientOnly>
            <ThemeToggle />
          </ClientOnly>
        </div>
      </header>

       {/* Main Content Area: flex-grow allows it to take remaining space */}
      <main className="container mx-auto px-4 py-4 grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-4 flex-grow overflow-hidden">
        {/* Each NoticeBlock should fill its grid cell */}
        <NoticeBlock title="Text Notices" notices={textNotices} />
        <NoticeBlock title="PDF Notices" notices={pdfNotices} />
        <NoticeBlock title="Image Notices" notices={imageNotices} />
        <NoticeBlock title="Video Notices" notices={videoNotices} />
      </main>

      {/* Footer (Bulletin): flex-shrink-0 prevents it from shrinking */}
       <ClientOnly>
         <MovingBulletin announcements={bulletinAnnouncements} />
       </ClientOnly>
    </div>
  );
}
