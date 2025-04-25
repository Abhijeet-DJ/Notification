'use client';

import {useState, useEffect} from 'react';

const DateTimeDisplay = () => {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setDateTime(new Date());
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  const formattedTime = dateTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const formattedDate = dateTime.toLocaleDateString();

  return (
    <div className="rounded-md bg-secondary p-2 shadow-md transition-colors duration-300">
      <p className="text-sm text-secondary-foreground">
        {formattedTime}, {formattedDate}
      </p>
    </div>
  );
};

export default DateTimeDisplay;
