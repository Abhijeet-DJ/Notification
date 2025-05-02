'use client';

import type { Metadata } from 'next';
import { useEffect, useState, useRef } from 'react';
import Image from 'next/image'; // Import next/image
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
  const isPdfNotices = title === "PDF Notices";
  const isImageNotices = title === "Image Notices";
  const isVideoNotices = title === "Video Notices";
  const [currentPage, setCurrentPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null); // Used for PDF scrolling now

  const totalItems = notices.length;
  // Items per page logic: Text: All (handled by belt), PDF/Image: All (handled by belt), Video: 1
  const itemsPerPage = isVideoNotices ? 1 : totalItems;
  // Threshold for text notice animation - **CHANGED TO 3**
  const textAnimationThreshold = 3;

  // Calculate totalPages or determine if animation should occur
  const totalPdfPages = (isPdfNotices && totalItems > 0) ? Math.ceil(totalItems / 2) : 0; // Number of pairs for PDFs
  const totalVideoPages = (isVideoNotices && totalItems > 0) ? Math.ceil(totalItems / itemsPerPage) : 0;

  // Should the section animate?
  const shouldAnimatePdf = isPdfNotices && totalPdfPages > 1; // Animate PDFs if more than 1 pair
  const shouldAnimateText = isTextNotices && totalItems > textAnimationThreshold; // Animate text if more than threshold items
  const shouldAnimateImages = isImageNotices && totalItems > 0; // Always animate images if any exist

  // Effect to manage animations
  useEffect(() => {
    console.log(`[DEBUG][NoticeBlock][${title}] useEffect triggered.`);

    const stopInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log(`[DEBUG][NoticeBlock][${title}] Cleared interval.`);
      }
    };

    const startVideoInterval = () => {
      if (isVideoNotices && totalItems > 1 && !intervalRef.current) {
         // Interval logic removed for videos, handled by onEnded
      }
    };

    const startPdfScroll = () => {
        if (isPdfNotices && shouldAnimatePdf) {
           // PDF scrolling animation is handled by CSS, no interval needed here
        }
    };

    const startTextScroll = () => {
         if (isTextNotices && shouldAnimateText) {
             // Text scrolling animation is handled by CSS, no interval needed here
         }
    };

     const startImageScroll = () => {
         if (isImageNotices && shouldAnimateImages) {
             // Image scrolling animation is handled by CSS, no interval needed here
         }
     };


    stopInterval(); // Clear existing interval before starting a new one
    startVideoInterval();
    startPdfScroll();
    startTextScroll();
    startImageScroll();


    // Cleanup function
    return () => {
      stopInterval();
    };
  }, [notices, title, isTextNotices, isPdfNotices, isImageNotices, isVideoNotices, totalItems, totalPdfPages, totalVideoPages, shouldAnimatePdf, shouldAnimateText, shouldAnimateImages, currentPage]); // Added dependencies

  // Get indices for pagination/pairing
  const startIndex = isVideoNotices ? currentPage * itemsPerPage : 0;
  const currentNotices = isVideoNotices
     ? notices.slice(startIndex, startIndex + itemsPerPage)
     : notices;


   const hasNotices = notices?.length > 0;

   // Handler for when a video finishes playing
   const handleVideoEnded = () => {
     if (isVideoNotices && totalItems > 1) { // Only swap if there's more than one video
       console.log(`[DEBUG][NoticeBlock][Video Notices] Video ended, swapping to next.`);
       setCurrentPage((prevPage) => (prevPage + 1) % totalVideoPages);
     } else if (isVideoNotices && totalItems === 1) {
         // If only one video, restart it
         const videoElement = containerRef.current?.querySelector('video');
         if (videoElement) {
             console.log(`[DEBUG][NoticeBlock][Video Notices] Restarting single video.`);
             videoElement.currentTime = 0;
             videoElement.play();
         }
     }
   };


  return (
    <Card className="bg-content-block shadow-md rounded-lg overflow-hidden flex flex-col h-full">
      {/* Conditionally render header based on whether it's video notices */}
      {!isVideoNotices && (
        <CardHeader className="p-4 flex-shrink-0">
          <CardTitle className="text-lg font-semibold text-accent-color">{title}</CardTitle>
        </CardHeader>
      )}
      {/* Adjust CardContent padding: Remove padding for image/video/pdf belt, keep for text belt */}
      <CardContent
          className={`flex-grow overflow-hidden ${isImageNotices || isVideoNotices || isPdfNotices || isTextNotices ? 'p-0' : 'p-4'} min-h-0`}
          ref={containerRef} // Ref still used for video handling
      >
         {hasNotices ? (
           isTextNotices ? (
             // Text Belt Logic (Vertical)
             <div className="h-full w-full overflow-hidden">
               <div
                  // Conditionally apply animation class and style for text
                  className={`flex flex-col h-full ${shouldAnimateText ? 'animate-marquee-vertical' : ''}`}
                  style={{ animationPlayState: shouldAnimateText ? 'running' : 'paused' }}
                >
                  {/* Render all text items */}
                  <div className="flex-shrink-0 w-full px-4 py-2"> {/* Added padding for spacing */}
                      {notices.map((notice) => (
                         <div key={notice._id} className="py-2 border-b last:border-b-0">
                           <p className="font-medium">{notice.title}</p>
                           <p className="text-sm">{notice.content}</p>
                           <p className="text-xs text-muted-foreground">
                             {new Date(notice.date).toISOString().split('T')[0]}
                           </p>
                         </div>
                       ))}
                  </div>
                   {/* Duplicate text items for seamless looping, only if animating */}
                  {shouldAnimateText && (
                    <div className="flex-shrink-0 w-full px-4 py-2" aria-hidden="true"> {/* Added padding */}
                        {notices.map((notice) => (
                           <div key={`dup-${notice._id}`} className="py-2 border-b last:border-b-0">
                              <p className="font-medium">{notice.title}</p>
                              <p className="text-sm">{notice.content}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(notice.date).toISOString().split('T')[0]}
                              </p>
                           </div>
                         ))}
                    </div>
                  )}
               </div>
            </div>
             ) : isImageNotices ? (
                // Image Belt Logic (Horizontal)
                 <div className="h-full w-full overflow-hidden">
                    <div className="flex h-full animate-marquee-images" style={{ animationPlayState: 'running' }}>
                        {/* Render all images */}
                        {notices.map((notice, index) => (
                             <div key={`${notice._id}-${index}`} className="flex-shrink-0 h-full w-auto px-2">
                                 <Image
                                     src={notice.imageUrl}
                                     alt={notice.title}
                                     width={200} // Specify a width for optimization, adjust as needed
                                     height={200} // Specify a height for optimization, adjust based on aspect ratio
                                     className="h-full w-auto object-contain rounded-md"
                                     onError={(e) => console.error(`[DEBUG][NoticeBlock][Image Notices] Error loading Image:`, notice.imageUrl, e)}
                                 />
                             </div>
                         ))}
                         {/* Duplicate images for seamless looping */}
                         {notices.map((notice, index) => (
                             <div key={`dup-${notice._id}-${index}`} className="flex-shrink-0 h-full w-auto px-2" aria-hidden="true">
                                 <Image
                                     src={notice.imageUrl}
                                     alt="" // Alt text empty for decorative duplicate
                                     width={200} // Specify a width for optimization
                                     height={200} // Specify a height for optimization
                                     className="h-full w-auto object-contain rounded-md"
                                     onError={(e) => console.error(`[DEBUG][NoticeBlock][Image Notices] Error loading duplicate Image:`, notice.imageUrl, e)}
                                 />
                             </div>
                         ))}
                    </div>
                </div>
           ) : isPdfNotices ? (
                 // PDF Belt Logic (Vertical - 2 side-by-side)
                 <div className="h-full w-full overflow-hidden">
                   {/* Apply animation class and style conditionally */}
                    <div
                        className={`flex flex-col h-full ${shouldAnimatePdf ? 'animate-marquee-vertical' : ''}`}
                        style={{ animationPlayState: shouldAnimatePdf ? 'running' : 'paused' }}
                     >
                        {/* Render PDF pairs */}
                        {Array.from({ length: totalPdfPages }).map((_, pageIndex) => {
                            const pairStartIndex = pageIndex * 2;
                            const pair = notices.slice(pairStartIndex, pairStartIndex + 2);
                            return (
                                <div key={`pair-${pageIndex}`} className="flex w-full h-full flex-shrink-0">
                                    {pair.map((notice) => (
                                        <div key={notice._id} className="w-1/2 h-full px-1"> {/* Half width, horizontal padding only */}
                                            <iframe
                                                src={`${notice.imageUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                                                title={notice.title}
                                                className="w-full h-full border-0 rounded-md"
                                                style={{ scrollbarWidth: 'none' }} // Hide scrollbar for Firefox
                                                onError={(e) => console.error(`[DEBUG][NoticeBlock][PDF Notices] Error loading PDF:`, notice.imageUrl, e)}
                                            />
                                        </div>
                                    ))}
                                    {/* Add placeholder if only one PDF in the last pair */}
                                    {pair.length === 1 && <div className="w-1/2 h-full px-1"></div>}
                                </div>
                            );
                        })}
                        {/* Duplicate PDF pairs for seamless looping, only if animating */}
                        {shouldAnimatePdf && Array.from({ length: totalPdfPages }).map((_, pageIndex) => {
                             const pairStartIndex = pageIndex * 2;
                             const pair = notices.slice(pairStartIndex, pairStartIndex + 2);
                             return (
                                 <div key={`dup-pair-${pageIndex}`} className="flex w-full h-full flex-shrink-0" aria-hidden="true">
                                     {pair.map((notice) => (
                                         <div key={`dup-${notice._id}`} className="w-1/2 h-full px-1"> {/* Half width, horizontal padding only */}
                                             <iframe
                                                 src={`${notice.imageUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                                                 title="" // Empty title for duplicate
                                                 className="w-full h-full border-0 rounded-md"
                                                 style={{ scrollbarWidth: 'none' }}
                                                 onError={(e) => console.error(`[DEBUG][NoticeBlock][PDF Notices] Error loading duplicate PDF:`, notice.imageUrl, e)}
                                             />
                                         </div>
                                     ))}
                                     {pair.length === 1 && <div className="w-1/2 h-full px-1"></div>}
                                 </div>
                              );
                        })}
                         {/* CSS to hide scrollbar in WebKit browsers for iframes */}
                         <style>{`
                           iframe::-webkit-scrollbar {
                             display: none;
                           }
                         `}</style>
                    </div>
                 </div>
           ) : isVideoNotices ? (
             // Display logic for Video (shows one at a time)
             currentNotices.length > 0 && (
               // Make the container take full height and width
               <div className="transition-opacity duration-500 ease-in-out h-full w-full" key={currentNotices[0]._id}>
                  {/* Ensure the inner div also takes full height and centers content */}
                  <div className="flex flex-col h-full w-full justify-center items-center text-center">
                     {/* Video container - ensures video expands but respects aspect ratio */}
                       <div className="flex-grow w-full h-full flex items-center justify-center overflow-hidden">
                       <video
                         key={currentNotices[0].imageUrl} // Use URL as key to force remount on change if needed
                         src={currentNotices[0].imageUrl}
                         controls
                         autoPlay // Added autoPlay attribute
                         // muted // Keep unmuted as requested
                         // Make video take full width/height within its container, maintain aspect ratio
                         className="w-full h-full object-contain rounded-md"
                         onEnded={handleVideoEnded} // Call handler when video finishes
                         onError={(e) => console.error(`[DEBUG][NoticeBlock][Video Notices] Error loading Video:`, currentNotices[0].imageUrl, e)}
                       />
                      </div>
                  </div>
               </div>
             )
           ) : null // Fallback if type is unknown
         ) : (
           <p className="text-muted-foreground p-4">No {title.toLowerCase()} available.</p>
         )}
       </CardContent>
        </Card>
    );
  };

const MovingBulletin = ({ announcements }: { announcements: string[] }) => {
  const { theme } = useTheme();
  const [textColorClass, setTextColorClass] = useState('');

   useEffect(() => {
     // Ensure this runs only on the client
     setTextColorClass(theme === 'dark' ? 'text-bulletin-dark' : 'text-bulletin-light');
   }, [theme]); // Dependency on theme ensures it updates


  return (
    <div className="relative w-full h-10 bg-accent py-2 overflow-hidden flex-shrink-0">
      <ClientOnly> {/* Wrap dynamic part in ClientOnly */}
        <div
          className={`w-full whitespace-nowrap animate-marquee ${textColorClass}`} // Apply dynamic text color class
          style={{ animationPlayState: 'running' }}
        >
          {/* Render announcements twice for seamless loop */}
          {[...announcements, ...announcements].map((announcement, index) => (
            <span
              key={index}
              className="mx-4 inline-block transition-colors duration-300" // Added transition
              aria-hidden={index >= announcements.length} // Hide duplicates from screen readers
            >
              {announcement}
            </span>
          ))}
        </div>
      </ClientOnly>
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
    // Render a placeholder or null during server render / hydration mismatch prevention
    // Using a placeholder consistent with the button size
    return <div className="h-10 w-10 rounded-full bg-secondary animate-pulse"></div>;
  }

  // Now safe to render based on theme
  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-full bg-secondary shadow-md transition-colors duration-300 hover:bg-accent hover:text-accent-foreground"
      onClick={() => {
         const newTheme = theme === 'light' ? 'dark' : 'light';
         console.log(`[DEBUG][ThemeToggle] Toggling theme to: ${newTheme}`);
         setTheme(newTheme);
      }}
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
       console.log("[DEBUG][Home] Fetching data...");
      try {
        const noticesData = await getCollegeNotices();
        console.log("[DEBUG][Home] Fetched notices raw data:", noticesData);
        setNotices(noticesData);

        const announcements = await getBulletinAnnouncements();
         console.log("[DEBUG][Home] Fetched bulletin announcements:", announcements);
        setBulletinAnnouncements(announcements);
      } catch (error) {
        console.error('[DEBUG][Home] Error loading data:', error);
      }
    };

    loadData();

     const intervalId = setInterval(loadData, 5 * 60 * 1000); // 5 minutes
      console.log("[DEBUG][Home] Set up data refresh interval (5 min).");

     return () => {
        console.log("[DEBUG][Home] Cleaning up data refresh interval.");
       clearInterval(intervalId);
     }
  }, []);


   console.log("[DEBUG][Home] notices state before filtering:", notices);

   const textNotices = notices.filter(notice => notice.contentType === 'text');
   const pdfNotices = notices.filter(notice => notice.contentType === 'pdf');
   const imageNotices = notices.filter(notice => notice.contentType === 'image');
   const videoNotices = notices.filter(notice => notice.contentType === 'video');

   console.log(`[DEBUG][Home] Filtered Notices - Text: ${textNotices.length}, PDF: ${pdfNotices.length}, Image: ${imageNotices.length}, Video: ${videoNotices.length}`);


  return (
    <div className="flex flex-col h-screen bg-clean-background transition-colors duration-300 overflow-hidden"> {/* Prevent outer scroll */}
      {/* Header */}
      <header className="text-center py-4 px-4 flex justify-between items-center flex-shrink-0 border-b"> {/* flex-shrink-0 prevents header shrinking */}
         {/* Add Notice Button */}
         <Button asChild variant="outline">
           <Link href="/add-notice">
             <PlusCircle className="mr-2 h-4 w-4" /> Add Notice
           </Link>
         </Button>

        {/* Title and Logo */}
        <div className="flex items-center justify-center space-x-3"> {/* Centered title and logo */}
           <Image
             src="/logo.png" // Assuming logo.png is in the /public folder
             alt="College Logo"
             width={40} // Adjust width as needed
             height={40} // Adjust height as needed
             className="object-contain" // Maintain aspect ratio
           />
           <h1 className="text-3xl font-bold text-primary">College Notifier</h1>
        </div>

        {/* Right side controls: Date/Time and Theme Toggle */}
        <div className="flex items-center space-x-4">
          <ClientOnly> {/* Wrap DateTimeDisplay */}
             <DateTimeDisplay />
           </ClientOnly>
          <ClientOnly> {/* Wrap ThemeToggle */}
            <ThemeToggle />
          </ClientOnly>
        </div>
      </header>

      {/* Main content grid */}
      {/* Use flex-grow to make main take remaining space, overflow-hidden to prevent its scroll */}
      <main className="container mx-auto px-4 py-4 grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-4 flex-grow overflow-hidden">
        <NoticeBlock title="Text Notices" notices={textNotices} />
        <NoticeBlock title="PDF Notices" notices={pdfNotices} />
        <NoticeBlock title="Image Notices" notices={imageNotices} />
        {/* Pass the video notices to NoticeBlock, the header is handled inside NoticeBlock */}
        <NoticeBlock title="Video Notices" notices={videoNotices} />
      </main>

      {/* Moving Bulletin - Place outside main, flex-shrink-0 prevents it shrinking */}
       <ClientOnly>
         {bulletinAnnouncements.length > 0 && <MovingBulletin announcements={bulletinAnnouncements} />}
       </ClientOnly>
    </div>
  );
}
