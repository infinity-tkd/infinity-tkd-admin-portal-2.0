'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/components/ui/States';

const StaffView = dynamic(() => import('@/components/StaffView').then(mod => mod.StaffView), {
  ssr: false,
  loading: () => <PageLoader label="Loading staff directory…" />,
});

export default function MembersPage() {
  return <StaffView />;
}