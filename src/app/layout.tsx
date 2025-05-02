import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster

const inter = Inter({ subsets: ['latin'] });

// Updated metadata to include icons
export const metadata: Metadata = {
  title: 'College Notifier',
  description: 'Displays notices from a college site.',
  icons: {
    icon: '/logo.png', // Link to the logo in the public folder
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster /> {/* Add Toaster here */}
        </ThemeProvider>
      </body>
    </html>
  );
}
