import type { Metadata } from 'next';
import Link from 'next/link';
import AddNoticeForm from '@/components/AddNoticeForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Add New Notice | College Notifier',
  description: 'Add a new notice to the College Notifier board.',
};

export default function AddNoticePage() {
  return (
    <div className="container mx-auto max-w-2xl py-10 px-4">
       <Button asChild variant="outline" className="mb-4">
         <Link href="/">
           <ArrowLeft className="mr-2 h-4 w-4" /> Back to Notices
         </Link>
       </Button>
      <h1 className="text-3xl font-bold mb-6 text-primary">Add New Notice</h1>
      <AddNoticeForm />
    </div>
  );
}