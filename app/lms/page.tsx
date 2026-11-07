'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/components/ui/States';

const LmsView = dynamic(() => import('@/components/LmsView').then(mod => mod.LmsView), {
  ssr: false,
  loading: () => <PageLoader label="Loading student curriculum…" />,
});

export default function LmsPage() {
  return <LmsView />;
}