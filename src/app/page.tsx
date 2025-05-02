
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
  const isPdfNotices = title === "PDF Notices";
  const isImageNotices = title === "Image Notices";
  const isVideoNotices = title === "Video Notices";
  const [currentPage, setCurrentPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const textScrollIntervalRef = useRef<NodeJS.Timeout | null>(null); // Interval for text scrolling animation
  const itemChangeIntervalRef = useRef<NodeJS.Timeout | null>(null); // Interval for changing items (PDF Pairs/Text Pages) - Excludes Video

  const totalItems = notices.length;
  // Adjusted itemsPerPage logic: Text: 5, PDF/Image: All (handled by belt), Video: 1
  const itemsPerPage = isTextNotices ? 5 : isVideoNotices ? 1 : totalItems;
  // Calculate totalPages only for paginated types (Text, Video, PDF pairs)
  const totalPages = (isTextNotices || isVideoNotices) && totalItems > 0
    ? Math.ceil(totalItems / itemsPerPage)
    : (isPdfNotices && totalItems > 0)
      ? Math.ceil(totalItems / 2) // Number of pairs for PDFs
      : 0;
   // Should the PDF section animate? Only if more than one pair exists.
   const shouldPdfAnimate = isPdfNotices && totalPages > 1;


  // Function to start the animation interval for changing items/pages (Text Pages/PDF Pairs)
  // **Excludes Video**
  const startItemChangeAnimation = () => {
    if (itemChangeIntervalRef.current) {
      clearInterval(itemChangeIntervalRef.current);
    }

    // Don't start if it's image notices, video notices, or only one page/pair or no notices for other types
    if (isImageNotices || isVideoNotices || totalPages <= 1) {
      return;
    }

    // Determine animation duration based on type
    let animationDuration: number;
    if (isPdfNotices) {
      animationDuration = 20000; // 20 seconds for PDF pairs
    }
    else { // Includes Text pagination
      animationDuration = 10000; // 10 seconds for text pages
    }

    console.log(`[DEBUG][NoticeBlock][${title}] Starting item change animation: TotalPages/Pairs=${totalPages}, Duration=${animationDuration}ms`);

    itemChangeIntervalRef.current = setInterval(() => {
      setCurrentPage((prevPage) => {
        const nextPage = (prevPage + 1) % totalPages;
         console.log(`[DEBUG][NoticeBlock][${title}] Item change interval tick: prevPage=${prevPage}, nextPage=${nextPage}`);
        return nextPage;
      });
    }, animationDuration);
  };

   // Function to start the text scrolling animation
   const startTextScrollAnimation = () => {
      if (!isTextNotices || totalItems === 0) return;

      if (textScrollIntervalRef.current) {
         clearInterval(textScrollIntervalRef.current);
      }

      const scrollDuration = 10000; // 10 seconds for text scroll cycle
      console.log(`[DEBUG][NoticeBlock][${title}] Starting text scroll animation: Duration=${scrollDuration}ms`);

      textScrollIntervalRef.current = setInterval(() => {
         if (containerRef.current) {
            const container = containerRef.current;
            const scrollAmount = container.scrollHeight - container.clientHeight;

             console.log(`[DEBUG][NoticeBlock][${title}] Text scroll interval tick.`);

            if (scrollAmount > 0) {
                console.log(`[DEBUG][NoticeBlock][${title}] Scrolling text down.`);
               container.scrollTo({
                  top: container.scrollHeight,
                  behavior: 'smooth',
               });

               // Wait for the scroll down to likely finish before scrolling up
               setTimeout(() => {
                  if (containerRef.current) {
                      console.log(`[DEBUG][NoticeBlock][${title}] Scrolling text back to top.`);
                     // Use instantaneous scroll to reset for the next smooth scroll down
                     containerRef.current.scrollTo({
                        top: 0,
                        behavior: 'auto', // Change to 'auto' for instant reset
                     });
                  }
               }, scrollDuration - 500); // Scroll up slightly before the interval restarts
            } else {
                console.log(`[DEBUG][NoticeBlock][${title}] Text content fits, no scroll needed.`);
            }
         }
      }, scrollDuration); // Interval duration remains the same
   };


  // Effect to start/restart animations when notices change or type changes
  useEffect(() => {
    console.log(`[DEBUG][NoticeBlock][${title}] useEffect triggered. Starting relevant animations.`);
    // Stop all previous intervals first
    if (itemChangeIntervalRef.current) clearInterval(itemChangeIntervalRef.current);
    if (textScrollIntervalRef.current) clearInterval(textScrollIntervalRef.current);

    // Start appropriate animations
    startItemChangeAnimation(); // Handles changing items for text pages/PDF pairs (NOT Video)
    startTextScrollAnimation(); // Handles scrolling within the text block

    // Cleanup function to clear intervals on component unmount or before effect runs again
    return () => {
      console.log(`[DEBUG][NoticeBlock][${title}] Cleaning up intervals.`);
      if (itemChangeIntervalRef.current) clearInterval(itemChangeIntervalRef.current);
      if (textScrollIntervalRef.current) clearInterval(textScrollIntervalRef.current);
    };
     // Re-run effect if notices change or dimensions/type impacting animation change
  }, [notices, isTextNotices, isPdfNotices, isImageNotices, isVideoNotices, totalPages]);


  // Get indices for pagination/pairing
  const startIndex = (isTextNotices || isVideoNotices) ? currentPage * itemsPerPage
                   : isPdfNotices ? currentPage * 2 // 2 PDFs per page/pair
                   : 0;
  // Slice the notices based on current page and items per page for paginated types (Text, Video, PDF Pairs)
  // For images, use all notices for the belt animation
   const currentNotices = (isTextNotices || isVideoNotices || isPdfNotices)
     ? notices.slice(startIndex, startIndex + (isPdfNotices ? 2 : itemsPerPage)) // Get 2 for PDF, others as before
     : notices;


   const hasNotices = notices?.length > 0;

   // Handler for when a video finishes playing
   const handleVideoEnded = () => {
     if (isVideoNotices && totalItems > 1) { // Only swap if there's more than one video
       console.log(`[DEBUG][NoticeBlock][Video Notices] Video ended, swapping to next.`);
       setCurrentPage((prevPage) => (prevPage + 1) % totalPages);
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
      {/* Adjust CardContent padding: Remove padding for image/video belt, adjust PDF */}
      <CardContent
          className={`flex-grow overflow-hidden ${isImageNotices || isVideoNotices ? 'p-0' : isPdfNotices ? 'p-0' : 'p-4'} min-h-0`}
          ref={containerRef} // Ref still used for text scrolling and video handling
      >
         {hasNotices ? (
           isTextNotices ? (
             <ul className="h-full overflow-y-hidden"> {/* Prevent default scrollbar */}
               {currentNotices.map((notice) => (
                 <li key={notice._id} className="py-2 border-b last:border-b-0">
                   <div className="flex justify-between items-center">
                     <div>
                       <p className="font-medium">{notice.title}</p>
                       <p className="text-sm">{notice.content}</p>
                       <p className="text-xs text-muted-foreground">
                         {new Date(notice.date).toISOString().split('T')[0]}
                       </p>
                     </div>
                   </div>
                  </li>
               ))}
             </ul>
             ) : isImageNotices ? (
                // Image Belt Logic (Horizontal)
                 <div className="h-full w-full overflow-hidden">
                    <div className="flex h-full animate-marquee-images" style={{ animationPlayState: 'running' }}>
                        {/* Render all images */}
                        {notices.map((notice, index) => (
                             <div key={`${notice._id}-${index}`} className="flex-shrink-0 h-full w-auto px-2">
                                 <img
                                     src={notice.imageUrl}
                                     alt={notice.title}
                                     className="h-full w-auto object-contain rounded-md"
                                     onError={(e) => console.error(`[DEBUG][NoticeBlock][Image Notices] Error loading Image:`, notice.imageUrl, e)}
                                 />
                             </div>
                         ))}
                         {/* Duplicate images for seamless looping */}
                         {notices.map((notice, index) => (
                             <div key={`dup-${notice._id}-${index}`} className="flex-shrink-0 h-full w-auto px-2" aria-hidden="true">
                                 <img
                                     src={notice.imageUrl}
                                     alt=""
                                     className="h-full w-auto object-contain rounded-md"
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
                        className={`flex flex-col h-full ${shouldPdfAnimate ? 'animate-marquee-vertical' : ''}`}
                        style={{ animationPlayState: shouldPdfAnimate ? 'running' : 'paused' }}
                     >
                        {/* Render PDF pairs */}
                        {Array.from({ length: totalPages }).map((_, pageIndex) => {
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
                        {shouldPdfAnimate && Array.from({ length: totalPages }).map((_, pageIndex) => {
                             const pairStartIndex = pageIndex * 2;
                             const pair = notices.slice(pairStartIndex, pairStartIndex + 2);
                             return (
                                 <div key={`dup-pair-${pageIndex}`} className="flex w-full h-full flex-shrink-0" aria-hidden="true">
                                     {pair.map((notice) => (
                                         <div key={`dup-${notice._id}`} className="w-1/2 h-full px-1"> {/* Half width, horizontal padding only */}
                                             <iframe
                                                 src={`${notice.imageUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                                                 title=""
                                                 className="w-full h-full border-0 rounded-md"
                                                 style={{ scrollbarWidth: 'none' }}
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
                         autoPlay
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

        {/* Title */}
        <h1 className="text-3xl font-bold text-primary">College Notifier</h1>

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
         <MovingBulletin announcements={bulletinAnnouncements} />
       </ClientOnly>
    </div>
  );
}
