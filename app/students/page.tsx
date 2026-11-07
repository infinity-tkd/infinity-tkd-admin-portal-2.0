'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/components/ui/States';

const DirectoryView = dynamic(() => import('@/components/DirectoryView').then(mod => mod.DirectoryView), {
  ssr: false,
  loading: () => <PageLoader label="Loading student directory…" />,
});

export default function StudentsPage() {
  return <DirectoryView />;
}