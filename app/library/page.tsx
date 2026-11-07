'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/components/ui/States';

const LibraryView = dynamic(() => import('@/components/LibraryView').then(mod => mod.LibraryView), {
  ssr: false,
  loading: () => <PageLoader label="Loading academy library…" />,
});

export default function LibraryPage() {
  return <LibraryView />;
}