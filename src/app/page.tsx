
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

   // Debugging Log: Initial render and received notices
   // console.log(`[DEBUG][NoticeBlock] Rendering: Title="${title}", Notices Count=${notices.length}`);
   // if (notices.length > 0) {
   //   console.log(`[DEBUG][NoticeBlock][${title}] Received Notices Data:`, notices);
   // }

  // Function to start the animation interval
  const startAnimation = () => {
    // Clear any existing interval before starting a new one
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
       // console.log(`[DEBUG][NoticeBlock][${title}] Cleared previous interval.`);
    }

    const totalItems = notices.length;
    if (totalItems === 0) {
       // console.log(`[DEBUG][NoticeBlock][${title}] No notices, animation not started.`);
      return; // Don't start if no notices
    }

    const itemsPerPage = isTextNotices ? 5 : 1;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    // Increased animation duration for slower scrolling/transitions
    const animationDuration = 10000; // 10 seconds

     console.log(`[DEBUG][NoticeBlock][${title}] Starting animation: TotalItems=${totalItems}, ItemsPerPage=${itemsPerPage}, TotalPages=${totalPages}, Duration=${animationDuration}ms`);

    intervalRef.current = setInterval(() => {
      setCurrentPage((prevPage) => {
        const nextPage = (prevPage + 1) % totalPages;
         // console.log(`[DEBUG][NoticeBlock][${title}] Interval tick: prevPage=${prevPage}, nextPage=${nextPage}`);

        // Scroll logic for text notices (smooth scroll)
        if (isTextNotices && containerRef.current) {
           // console.log(`[DEBUG][NoticeBlock][${title}] Scrolling text notices down.`);
           // Scroll down effect
           containerRef.current.scrollTo({
             top: containerRef.current.scrollHeight, // Scroll to bottom first
             behavior: 'smooth',
           });
           // After a delay, scroll back to top smoothly to show next batch
           setTimeout(() => {
             if (containerRef.current) {
                // console.log(`[DEBUG][NoticeBlock][${title}] Scrolling text notices back to top.`);
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
    // console.log(`[DEBUG][NoticeBlock][${title}] useEffect triggered due to notices change. Starting animation.`);
    startAnimation();
    // Cleanup function to clear interval on component unmount or notices change
    return () => {
      if (intervalRef.current) {
        // console.log(`[DEBUG][NoticeBlock][${title}] Cleaning up interval.`);
        clearInterval(intervalRef.current);
      }
    };
  }, [notices, isTextNotices]); // Rerun effect if notices or type change


  const itemsPerPage = isTextNotices ? 5 : 1;
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
                           onError={(e) => console.error(`[DEBUG][NoticeBlock][${title}] Error loading PDF:`, currentNotices[0].imageUrl, e)} // Add error handling
                           // sandbox="allow-scripts allow-same-origin" // Use cautiously if needed
                         />
                      </div>
                   ) : currentNotices[0].contentType === 'image' ? (
                     // Adjusted image container and image classes
                     (() => {
                        // Log the image URL right before rendering the img tag
                        console.log(`[DEBUG][NoticeBlock][Image Notices] Rendering Image: Title="${currentNotices[0].title}", URL=${currentNotices[0].imageUrl}`);
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
                         src={currentNotices[0].imageUrl}
                         controls
                         className="max-w-full max-h-full rounded-md" // Ensure video fits
                         onError={(e) => console.error(`[DEBUG][NoticeBlock][Video Notices] Error loading Video:`, currentNotices[0].imageUrl, e)} // Add error handling
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

   const textNotices = notices.filter(notice => {
       const isText = notice.contentType === 'text';
       // if (isText) console.log("[DEBUG][Home] Filtering Text Notice:", notice.title, notice._id);
       return isText;
   });
   const pdfNotices = notices.filter(notice => {
       const isPdf = notice.contentType === 'pdf';
       // if (isPdf) console.log("[DEBUG][Home] Filtering PDF Notice:", notice.title, notice._id);
       return isPdf;
   });
   const imageNotices = notices.filter(notice => {
       const isImage = notice.contentType === 'image';
       // if (isImage) console.log("[DEBUG][Home] Filtering Image Notice:", notice.title, notice._id);
       return isImage;
   });
   const videoNotices = notices.filter(notice => {
      const isVideo = notice.contentType === 'video';
      // if (isVideo) console.log("[DEBUG][Home] Filtering Video Notice:", notice.title, notice._id);
      return isVideo;
   });

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
