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
  const itemChangeIntervalRef = useRef<NodeJS.Timeout | null>(null); // Interval for changing items (PDF/Image/Video)
  const pdfScrollIntervalRef = useRef<NodeJS.Timeout | null>(null); // Interval for PDF scrolling
  const pdfIframeRef = useRef<HTMLIFrameElement>(null); // Ref for the PDF iframe

   // Debugging Log: Initial render and received notices
   // console.log(`[DEBUG][NoticeBlock] Rendering: Title="${title}", Notices Count=${notices.length}`);
   // if (notices.length > 0) {
   //   console.log(`[DEBUG][NoticeBlock][${title}] Received Notices Data:`, notices);
   // }

  const totalItems = notices.length;
  const itemsPerPage = isTextNotices ? 5 : 1; // Text: 5, Image/Video/PDF: 1
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / itemsPerPage) : 0;

  // Function to start the animation interval for changing items/pages
  const startItemChangeAnimation = () => {
    // Clear any existing interval before starting a new one
    if (itemChangeIntervalRef.current) {
      clearInterval(itemChangeIntervalRef.current);
       // console.log(`[DEBUG][NoticeBlock][${title}] Cleared previous item change interval.`);
    }

    if (totalPages <= 1) {
       // console.log(`[DEBUG][NoticeBlock][${title}] Only one page or no notices, item change animation not started.`);
      return; // Don't start if only one page or no notices
    }

    // Determine animation duration based on type
    let animationDuration: number;
    if (isImageNotices || isVideoNotices) {
      animationDuration = 20000; // 20 seconds for images/videos
    } else { // Includes Text pagination and PDF change
      animationDuration = 10000; // 10 seconds for others
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
      if (!isTextNotices || totalPages === 0) return;

      if (textScrollIntervalRef.current) {
         clearInterval(textScrollIntervalRef.current);
      }

      const scrollDuration = 10000; // Duration for the scroll cycle (e.g., 10 seconds)
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
       if (!isPdfNotices || totalPages === 0) return;

       if (pdfScrollIntervalRef.current) {
           clearInterval(pdfScrollIntervalRef.current);
       }

       const scrollStep = 1; // Pixels to scroll per interval
       const scrollInterval = 100; // Milliseconds between scroll steps (adjust for speed)
       const pdfDisplayDuration = 20000; // Total time to display/scroll one PDF
       let timeElapsed = 0;
       let direction = 'down'; // Track scroll direction
       console.log(`[DEBUG][NoticeBlock][${title}] Starting PDF scroll animation: Interval=${scrollInterval}ms, DisplayDuration=${pdfDisplayDuration}ms`);

       pdfScrollIntervalRef.current = setInterval(() => {
           timeElapsed += scrollInterval;
           if (pdfIframeRef.current && pdfIframeRef.current.contentWindow) {
               try {
                   const iframeWindow = pdfIframeRef.current.contentWindow;
                   const iframeDocBody = iframeWindow.document.body;
                   const iframeScrollHeight = iframeDocBody.scrollHeight;
                   const iframeClientHeight = iframeWindow.innerHeight;
                   let currentScrollTop = iframeWindow.scrollY;

                   if (iframeScrollHeight > iframeClientHeight) {
                       if (direction === 'down') {
                           if (currentScrollTop + iframeClientHeight >= iframeScrollHeight - 5) {
                               direction = 'up'; // Change direction to scroll up
                               console.log(`[DEBUG][NoticeBlock][${title}] PDF reached bottom, changing direction to UP.`);
                           } else {
                               iframeWindow.scrollBy({ top: scrollStep, behavior: 'smooth' });
                           }
                       } else { // direction === 'up'
                           if (currentScrollTop <= 5) {
                               direction = 'down'; // Change direction to scroll down
                               console.log(`[DEBUG][NoticeBlock][${title}] PDF reached top, changing direction to DOWN.`);
                           } else {
                               iframeWindow.scrollBy({ top: -scrollStep, behavior: 'smooth' });
                           }
                       }
                   }

                   // Check if display duration exceeded, then change the PDF via itemChangeInterval
                   if (timeElapsed >= pdfDisplayDuration) {
                       console.log(`[DEBUG][NoticeBlock][${title}] PDF display duration reached. Item change should trigger.`);
                       // The itemChangeInterval will handle changing the PDF page.
                       // We can stop this interval or let the useEffect cleanup handle it.
                       if (pdfScrollIntervalRef.current) clearInterval(pdfScrollIntervalRef.current);
                   }

               } catch (error) {
                   console.warn(`[DEBUG][NoticeBlock][${title}] Could not access PDF iframe content for scrolling. Scrolling disabled.`, error);
                   if (pdfScrollIntervalRef.current) clearInterval(pdfScrollIntervalRef.current);
               }
           } else {
               console.warn(`[DEBUG][NoticeBlock][${title}] PDF iframe or contentWindow not ready for scrolling.`);
               // If the iframe isn't ready, stop trying to prevent infinite warnings.
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
    startItemChangeAnimation(); // Handles changing items for all types if multiple pages exist
    startTextScrollAnimation(); // Handles scrolling within the text block
    startPdfScrollAnimation(); // Handles scrolling within the PDF iframe

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


  const startIndex = currentPage * itemsPerPage;
  // Slice the notices based on current page and items per page
   const currentNotices = notices.slice(startIndex, startIndex + itemsPerPage);

   // Debugging Log: Current notices being displayed
   // console.log(`[DEBUG][NoticeBlock][${title}] Current Page=${currentPage}, StartIndex=${startIndex}, Displaying Notices:`, currentNotices);


  const hasNotices = currentNotices?.length > 0; // Check currentNotices specifically for display

   // Debug log for specific types if needed
   // if (title === "PDF Notices") {
   //   console.log("[DEBUG][NoticeBlock] PDF Notices - currentNotices:", currentNotices);
   // }
   // if (title === "Image Notices" && currentNotices.length > 0) {
   //    console.log("[DEBUG][NoticeBlock] Image Notice URL to render:", currentNotices[0]?.imageUrl);
   // }


  return (
    <Card className="bg-content-block shadow-md rounded-lg overflow-hidden flex flex-col h-full">
      <CardHeader className="p-4 flex-shrink-0">
        <CardTitle className="text-lg font-semibold text-accent-color">{title}</CardTitle>
      </CardHeader>
      {/* Removed fixed height and added min-h-0 for flex-grow */}
      <CardContent className={`flex-grow overflow-hidden ${isTextNotices ? 'p-4' : 'p-1 md:p-2'} min-h-0`} ref={containerRef}>
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
           ) : (
             // Display logic for PDF, Image, Video (shows one at a time)
             currentNotices.length > 0 && (
               <div className="transition-opacity duration-500 ease-in-out h-full" key={currentNotices[0]._id}> {/* Add key for transition */}
                 {/* Changed justify-center to justify-start and removed space-y-2 */}
                 <div className="flex flex-col h-full justify-start items-center text-center">
                   {/* Removed Title and Date display for PDF/Image/Video */}
                   {/*
                   <p className="font-medium px-2 flex-shrink-0">{currentNotices[0].title}</p>
                   <p className="text-sm text-muted-foreground flex-shrink-0">
                      {new Date(currentNotices[0].date).toISOString().split('T')[0]}
                   </p>
                   */}
                   {currentNotices[0].contentType === 'pdf' ? (
                      // Embed PDF using iframe
                      // Container already has overflow-hidden, which should hide the iframe's scrollbar if possible
                      <div className="flex-grow w-full h-full flex items-center justify-center overflow-hidden">
                         {/* Ensure the URL is correctly passed and accessible */}
                         <iframe
                           ref={pdfIframeRef} // Assign ref to the iframe
                           src={`${currentNotices[0].imageUrl}#toolbar=0&navpanes=0&scrollbar=0`} // Attempt to hide toolbar/scrollbar via URL fragment
                           title={currentNotices[0].title}
                           className="w-full h-full border-0 rounded-md"
                           style={{ scrollbarWidth: 'none' }} // Hide scrollbar for Firefox
                           onError={(e) => console.error(`[DEBUG][NoticeBlock][${title}] Error loading PDF:`, currentNotices[0].imageUrl, e)} // Add error handling
                           // sandbox="allow-scripts allow-same-origin" // Use cautiously if needed - might break scrolling
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
                   ) : currentNotices[0].contentType === 'image' ? (
                     // Adjusted image container and image classes
                     (() => {
                        // Log the image URL right before rendering the img tag
                        // console.log(`[DEBUG][NoticeBlock][Image Notices] Rendering Image: Title="${currentNotices[0].title}", URL=${currentNotices[0].imageUrl}`);
                        return null; // This IIFE doesn't render anything
                      })(),
                     <div className="flex-grow w-full h-full flex items-center justify-center overflow-hidden">
                       <img
                         // Ensure we are using the correct property 'imageUrl'
                         src={currentNotices[0].imageUrl}
                         alt={currentNotices[0].title}
                         className="max-w-full max-h-full object-contain rounded-md" // Ensure image fits without cropping
                         // Add error handling for the image tag itself
                         onError={(e) => console.error(`[DEBUG][NoticeBlock][Image Notices] Error loading Image in <img> tag:`, currentNotices[0].imageUrl, e)}
                       />
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
     setTextColorClass(theme === 'dark' ? 'text-[hsl(var(--bulletin-text-dark))]' : 'text-[hsl(var(--bulletin-text-light))]');
   }, [theme]); // Update when theme changes

   // Render initially without theme-specific class or with a default
   // The useEffect will apply the correct class after mount
   if (!textColorClass) {
      // Optional: Render a placeholder or default state before hydration completes
      // console.log(`[DEBUG][MovingBulletin] Initial render or before hydration, no text color class set.`);
     // return <div className="relative w-full h-10 bg-accent py-2 overflow-hidden flex-shrink-0 animate-pulse"></div>;
   } else {
      // console.log(`[DEBUG][MovingBulletin] Rendering with textColorClass: ${textColorClass}`);
   }

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

    