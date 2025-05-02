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
  const isVideoNotices = title === "Video Notices"; // Added for clarity
  const [currentPage, setCurrentPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const textScrollIntervalRef = useRef<NodeJS.Timeout | null>(null); // Interval for text scrolling animation
  const itemChangeIntervalRef = useRef<NodeJS.Timeout | null>(null); // Interval for changing items (PDF/Video)
  const pdfScrollIntervalRef = useRef<NodeJS.Timeout | null>(null); // Interval for PDF scrolling
  const pdfIframeRef = useRef<HTMLIFrameElement>(null); // Ref for the PDF iframe

  const totalItems = notices.length;
  // Adjusted itemsPerPage logic: Text: 5, PDF/Video: 1, Images: All (handled separately)
  const itemsPerPage = isTextNotices ? 5 : (isPdfNotices || isVideoNotices) ? 1 : totalItems;
  // Calculate totalPages only for paginated types (Text, PDF, Video)
  const totalPages = (isTextNotices || isPdfNotices || isVideoNotices) && totalItems > 0
    ? Math.ceil(totalItems / itemsPerPage)
    : 0;


  // Function to start the animation interval for changing items/pages (PDF/Video/Text Pages)
  const startItemChangeAnimation = () => {
    // Clear any existing interval before starting a new one
    if (itemChangeIntervalRef.current) {
      clearInterval(itemChangeIntervalRef.current);
    }

    // Don't start if it's image notices or only one page or no notices for other types
    if (isImageNotices || totalPages <= 1) {
      return;
    }

    // Determine animation duration based on type
    let animationDuration: number;
    if (isVideoNotices || isPdfNotices) {
      animationDuration = 20000; // 20 seconds for videos/PDFs
    } else { // Includes Text pagination
      animationDuration = 10000; // 10 seconds for text pages
    }

    console.log(`[DEBUG][NoticeBlock][${title}] Starting item change animation: TotalPages=${totalPages}, Duration=${animationDuration}ms`);

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
      if (!isTextNotices || totalItems === 0) return; // Check totalItems for text

      if (textScrollIntervalRef.current) {
         clearInterval(textScrollIntervalRef.current);
      }

      const scrollDuration = 20000; // Increased duration for slower scroll (20 seconds)
      console.log(`[DEBUG][NoticeBlock][${title}] Starting text scroll animation: Duration=${scrollDuration}ms`);

      textScrollIntervalRef.current = setInterval(() => {
         if (containerRef.current) {
            const container = containerRef.current;
            const scrollAmount = container.scrollHeight - container.clientHeight;

             console.log(`[DEBUG][NoticeBlock][${title}] Text scroll interval tick.`);

            if (scrollAmount > 0) {
               // Scroll down smoothly
                console.log(`[DEBUG][NoticeBlock][${title}] Scrolling text down.`);
               container.scrollTo({
                  top: container.scrollHeight,
                  behavior: 'smooth',
               });

               // Schedule scroll back to top after a delay (half the interval time)
               setTimeout(() => {
                  if (containerRef.current) { // Check ref again in timeout
                      console.log(`[DEBUG][NoticeBlock][${title}] Scrolling text back to top.`);
                     containerRef.current.scrollTo({
                        top: 0,
                        behavior: 'smooth',
                     });
                  }
               }, scrollDuration / 2); // Adjust timing as needed
            } else {
                console.log(`[DEBUG][NoticeBlock][${title}] Text content fits, no scroll needed.`);
            }
         }
      }, scrollDuration); // Interval matches the full scroll cycle duration
   };

   // Function to start the PDF scrolling animation
   const startPdfScrollAnimation = () => {
       if (!isPdfNotices || totalItems === 0) return; // Use totalItems for PDF check

       if (pdfScrollIntervalRef.current) {
           clearInterval(pdfScrollIntervalRef.current);
       }

       const scrollStep = 1; // Pixels to scroll per interval
       const scrollInterval = 150; // Milliseconds between scroll steps (increased for slower scroll)
       const pdfDisplayDuration = 20000; // Total time to display/scroll one PDF
       let timeElapsed = 0;
       let direction = 'down'; // Track scroll direction
       console.log(`[DEBUG][NoticeBlock][${title}] Starting PDF scroll animation: Interval=${scrollInterval}ms, DisplayDuration=${pdfDisplayDuration}ms`);

       pdfScrollIntervalRef.current = setInterval(() => {
           timeElapsed += scrollInterval;
           if (pdfIframeRef.current && pdfIframeRef.current.contentWindow) {
               try {
                   const iframeWindow = pdfIframeRef.current.contentWindow;
                   // Access body directly for scroll height
                   const iframeDocBody = iframeWindow.document.body;
                   const iframeScrollHeight = iframeDocBody.scrollHeight;
                   const iframeClientHeight = iframeWindow.innerHeight; // Use innerHeight of the iframe window
                   let currentScrollTop = iframeWindow.scrollY;

                    // console.log(`[DEBUG][PDF Scroll] scrollH=${iframeScrollHeight}, clientH=${iframeClientHeight}, currentScrollTop=${currentScrollTop}, direction=${direction}`);

                   if (iframeScrollHeight > iframeClientHeight) {
                       if (direction === 'down') {
                           // Scroll down until near the bottom (adjust buffer as needed)
                           if (currentScrollTop + iframeClientHeight >= iframeScrollHeight - 5) { // Check if near the bottom
                               direction = 'up'; // Change direction to scroll up
                               console.log(`[DEBUG][NoticeBlock][${title}] PDF reached bottom, changing direction to UP.`);
                           } else {
                               iframeWindow.scrollBy({ top: scrollStep, behavior: 'smooth' });
                           }
                       } else { // direction === 'up'
                           // Scroll up until near the top (adjust buffer as needed)
                           if (currentScrollTop <= 5) { // Check if near the top
                               direction = 'down'; // Change direction to scroll down
                               console.log(`[DEBUG][NoticeBlock][${title}] PDF reached top, changing direction to DOWN.`);
                           } else {
                               iframeWindow.scrollBy({ top: -scrollStep, behavior: 'smooth' });
                           }
                       }
                   } else {
                        console.log(`[DEBUG][NoticeBlock][${title}] PDF content fits in iframe, no scroll needed.`);
                        // Optionally clear interval if no scroll needed ever
                        // if (pdfScrollIntervalRef.current) clearInterval(pdfScrollIntervalRef.current);
                   }

                   // Check if display duration exceeded, then change the PDF via itemChangeInterval
                   // Note: The itemChangeInterval will handle changing the page/PDF source.
                   // This scrolling interval should ideally just manage the scroll within the current PDF.
                   // Resetting timeElapsed ensures the scroll logic restarts correctly for the next PDF.
                   if (timeElapsed >= pdfDisplayDuration) {
                       console.log(`[DEBUG][NoticeBlock][${title}] PDF display duration reached. Item change should trigger soon.`);
                       // We let the useEffect cleanup handle clearing this interval when the component re-renders due to currentPage change.
                       timeElapsed = 0; // Reset time for the next PDF's scroll cycle (or when same PDF reloads)
                       direction = 'down'; // Reset direction for next cycle
                       // Scroll to top when duration ends, ready for next cycle or new PDF
                       iframeWindow.scrollTo({ top: 0, behavior: 'smooth' });
                   }

               } catch (error) {
                   console.warn(`[DEBUG][NoticeBlock][${title}] Could not access PDF iframe content for scrolling. Scrolling disabled.`, error);
                   if (pdfScrollIntervalRef.current) clearInterval(pdfScrollIntervalRef.current);
               }
           } else {
               console.warn(`[DEBUG][NoticeBlock][${title}] PDF iframe or contentWindow not ready for scrolling.`);
               // Optionally clear interval if iframe is not available
               // if (pdfScrollIntervalRef.current) clearInterval(pdfScrollIntervalRef.current);
           }
       }, scrollInterval);
   };


  // Effect to start/restart animations when notices change or type changes
  useEffect(() => {
    console.log(`[DEBUG][NoticeBlock][${title}] useEffect triggered. Starting relevant animations.`);
    // Stop all previous intervals first
    if (itemChangeIntervalRef.current) clearInterval(itemChangeIntervalRef.current);
    if (textScrollIntervalRef.current) clearInterval(textScrollIntervalRef.current);
    if (pdfScrollIntervalRef.current) clearInterval(pdfScrollIntervalRef.current);

    // Start appropriate animations
    startItemChangeAnimation(); // Handles changing items for non-image types if multiple pages exist
    startTextScrollAnimation(); // Handles scrolling within the text block
    // Defer PDF scroll start until iframe is loaded
    // startPdfScrollAnimation(); // Moved to onLoad of iframe

    // Cleanup function to clear intervals on component unmount or before effect runs again
    return () => {
      console.log(`[DEBUG][NoticeBlock][${title}] Cleaning up intervals.`);
      if (itemChangeIntervalRef.current) clearInterval(itemChangeIntervalRef.current);
      if (textScrollIntervalRef.current) clearInterval(textScrollIntervalRef.current);
      if (pdfScrollIntervalRef.current) clearInterval(pdfScrollIntervalRef.current);
    };
     // Dependencies ensure effect runs when notices or type-specific flags change
     // Include currentPage in dependencies for PDF scrolling to restart if the PDF source changes
  }, [notices, isTextNotices, isPdfNotices, isImageNotices, isVideoNotices, totalPages, currentPage]);


  const startIndex = (isTextNotices || isPdfNotices || isVideoNotices) ? currentPage * itemsPerPage : 0;
  // Slice the notices based on current page and items per page for paginated types
  // For images, use all notices
   const currentNotices = (isTextNotices || isPdfNotices || isVideoNotices)
     ? notices.slice(startIndex, startIndex + itemsPerPage)
     : notices; // Use all notices for Image Notices


   const hasNotices = notices?.length > 0; // Check if there are any notices for this type


  return (
    <Card className="bg-content-block shadow-md rounded-lg overflow-hidden flex flex-col h-full">
      <CardHeader className="p-4 flex-shrink-0">
        <CardTitle className="text-lg font-semibold text-accent-color">{title}</CardTitle>
      </CardHeader>
      {/* Adjust CardContent padding for image belt */}
      <CardContent
          className={`flex-grow overflow-hidden ${isImageNotices ? 'p-0' : isTextNotices ? 'p-4' : 'p-1 md:p-2'} min-h-0`}
          ref={containerRef}
      >
         {hasNotices ? (
           isTextNotices ? (
             <ul className="h-full overflow-y-hidden"> {/* Ensure ul can contain scrolled content */}
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
             ) : isImageNotices ? (
                // Image Belt Logic
                 <div className="h-full w-full overflow-hidden"> {/* Container for the belt */}
                    {/* The inner div handles the animation */}
                    <div className="flex h-full animate-marquee-images" style={{ animationPlayState: 'running' }}>
                         {/* Render all images */}
                        {notices.map((notice, index) => (
                             <div key={`${notice._id}-${index}`} className="flex-shrink-0 h-full w-auto px-2"> {/* Ensure images don't shrink, add padding */}
                                 <img
                                     src={notice.imageUrl}
                                     alt={notice.title}
                                     className="h-full w-auto object-contain rounded-md" // Display full height, auto width, contain aspect ratio
                                     onError={(e) => console.error(`[DEBUG][NoticeBlock][Image Notices] Error loading Image in <img> tag:`, notice.imageUrl, e)}
                                 />
                             </div>
                         ))}
                         {/* Duplicate images for seamless looping */}
                         {notices.map((notice, index) => (
                             <div key={`dup-${notice._id}-${index}`} className="flex-shrink-0 h-full w-auto px-2" aria-hidden="true">
                                 <img
                                     src={notice.imageUrl}
                                     alt="" // Empty alt for decorative duplicates
                                     className="h-full w-auto object-contain rounded-md"
                                 />
                             </div>
                         ))}
                    </div>
                </div>
           ) : (
             // Display logic for PDF, Video (shows one at a time)
             currentNotices.length > 0 && (
               <div className="transition-opacity duration-500 ease-in-out h-full" key={currentNotices[0]._id}> {/* Add key for transition */}
                 <div className="flex flex-col h-full justify-start items-center text-center"> {/* Changed justify-center to justify-start */}
                   {currentNotices[0].contentType === 'pdf' ? (
                      // Embed PDF using iframe
                      <div className="flex-grow w-full h-full flex items-center justify-center overflow-hidden">
                         {/* Ensure the URL is correctly passed and accessible */}
                         <iframe
                           ref={pdfIframeRef} // Assign ref to the iframe
                           src={`${currentNotices[0].imageUrl}#toolbar=0&navpanes=0&scrollbar=0`} // Attempt to hide toolbar/scrollbar via URL fragment
                           title={currentNotices[0].title}
                           className="w-full h-full border-0 rounded-md"
                           style={{ scrollbarWidth: 'none' }} // Hide scrollbar for Firefox
                           onError={(e) => console.error(`[DEBUG][NoticeBlock][${title}] Error loading PDF:`, currentNotices[0].imageUrl, e)} // Add error handling
                           onLoad={() => {
                               console.log(`[DEBUG][NoticeBlock][${title}] PDF Iframe loaded: ${currentNotices[0].imageUrl}`);
                               // Restart scroll animation on load
                               startPdfScrollAnimation();
                           }}
                         />
                         {/* CSS to hide scrollbar in WebKit browsers (Chrome, Safari) */}
                         <style>{`
                           iframe::-webkit-scrollbar {
                             display: none;
                           }
                         `}</style>
                      </div>
                   ) : currentNotices[0].contentType === 'video' ? (
                     // Adjusted video container and video classes
                      <div className="flex-grow w-full h-full flex items-center justify-center overflow-hidden">
                       <video
                         key={currentNotices[0].imageUrl} // Add key to force re-render on source change
                         src={currentNotices[0].imageUrl}
                         controls
                         autoPlay // Add autoPlay if desired for video cycling
                         muted // Often necessary for autoPlay to work in browsers
                         loop // Loop the video if it's the only one
                         className="max-w-full max-h-full rounded-md" // Ensure video fits
                         onError={(e) => console.error(`[DEBUG][NoticeBlock][Video Notices] Error loading Video:`, currentNotices[0].imageUrl, e)}
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
  const [textColorClass, setTextColorClass] = useState('');

   useEffect(() => {
     // This effect runs only on the client after hydration
     // console.log(`[DEBUG][MovingBulletin] Theme changed to: ${theme}. Setting text color.`);
     // Ensure the correct class is applied based on theme
     // Use the specific class names from globals.css
     setTextColorClass(theme === 'dark' ? 'text-bulletin-dark' : 'text-bulletin-light');
   }, [theme]); // Update when theme changes


  return (
    <div className="relative w-full h-10 bg-accent py-2 overflow-hidden flex-shrink-0"> {/* Ensure it doesn't grow */}
      {/* Apply text color dynamically */}
      <ClientOnly> {/* Wrap the animated content */}
        <div className={`w-full whitespace-nowrap animate-marquee ${textColorClass}`} style={{ animationPlayState: 'running' }}>
          {announcements.map((announcement, index) => (
            <span
              key={index}
              className="mx-4 inline-block transition-colors duration-300" // Text color handled by parent div
            >
              {announcement}
            </span>
          ))}
          {/* Duplicate announcements for seamless looping */}
           {announcements.map((announcement, index) => (
             <span
               key={`dup-${index}`}
               className="mx-4 inline-block transition-colors duration-300"
               aria-hidden="true" // Hide duplicate from accessibility tree
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
    // Render a placeholder or null on the server/before hydration
    // Using a div with same dimensions as button can prevent layout shifts
    return <div className="h-10 w-10 rounded-full bg-secondary animate-pulse"></div>;
  }

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
        // Use no-store cache to always get fresh data
        const noticesData = await getCollegeNotices();
        console.log("[DEBUG][Home] Fetched notices raw data:", noticesData); // Log fetched data BEFORE setting state
        setNotices(noticesData); // Update state

        const announcements = await getBulletinAnnouncements();
         console.log("[DEBUG][Home] Fetched bulletin announcements:", announcements);
        setBulletinAnnouncements(announcements);
      } catch (error) {
        console.error('[DEBUG][Home] Error loading data:', error);
      }
    };

    loadData();

     // Optional: Refresh data periodically (e.g., every 5 minutes)
     const intervalId = setInterval(loadData, 5 * 60 * 1000); // 5 minutes
      console.log("[DEBUG][Home] Set up data refresh interval (5 min).");

     return () => {
        console.log("[DEBUG][Home] Cleaning up data refresh interval.");
       clearInterval(intervalId); // Clean up interval on unmount
     }
  }, []);


  // Filter notices based on the contentType
   // Log BEFORE filtering
   console.log("[DEBUG][Home] notices state before filtering:", notices);

   const textNotices = notices.filter(notice => notice.contentType === 'text');
   const pdfNotices = notices.filter(notice => notice.contentType === 'pdf');
   const imageNotices = notices.filter(notice => notice.contentType === 'image');
   const videoNotices = notices.filter(notice => notice.contentType === 'video');

   // Log AFTER filtering
    console.log(`[DEBUG][Home] Filtered Notices - Text: ${textNotices.length}, PDF: ${pdfNotices.length}, Image: ${imageNotices.length}, Video: ${videoNotices.length}`);


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
          {/* DateTimeDisplay wrapped in ClientOnly to prevent hydration issues */}
          <ClientOnly>
             <DateTimeDisplay />
           </ClientOnly>
          {/* ThemeToggle wrapped in ClientOnly */}
          <ClientOnly>
            <ThemeToggle />
          </ClientOnly>
        </div>
      </header>

       {/* Main Content Area: flex-grow allows it to take remaining space */}
      <main className="container mx-auto px-4 py-4 grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-4 flex-grow overflow-hidden">
        {/* Each NoticeBlock should fill its grid cell */}
        {/* Pass the correctly filtered arrays to each NoticeBlock */}
        <NoticeBlock title="Text Notices" notices={textNotices} />
        <NoticeBlock title="PDF Notices" notices={pdfNotices} />
        <NoticeBlock title="Image Notices" notices={imageNotices} />
        <NoticeBlock title="Video Notices" notices={videoNotices} />
      </main>

      {/* Footer (Bulletin): flex-shrink-0 prevents it from shrinking */}
       {/* MovingBulletin wrapped in ClientOnly */}
       <ClientOnly>
         <MovingBulletin announcements={bulletinAnnouncements} />
       </ClientOnly>
    </div>
  );
}
