'use client';

import {useState, useEffect} from 'react';

interface DateTimeDisplayProps {}

const DateTimeDisplay = () => {
  const [dateTime, setDateTime] = useState<Date | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDateTime(new Date());
      const intervalId = setInterval(() => {
        setDateTime(new Date());
      }, 1000);

      return () => clearInterval(intervalId);
    }
  }, []); // Empty dependency array to run only once on mount

  if (dateTime === null) {
    return <div className="rounded-md bg-secondary p-2 shadow-md transition-colors duration-300">
      <p className="text-sm text-secondary-foreground">Loading...</p>
    </div>;
  }

  const formattedTime: string = dateTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const formattedDate: string = dateTime.toLocaleDateString();

  return (<div className="rounded-md bg-secondary p-2 shadow-md transition-colors duration-300">
      <p className="text-sm text-secondary-foreground">
        {formattedTime}, {formattedDate}
      </p>
    </div>
  );
};

export default DateTimeDisplay;
