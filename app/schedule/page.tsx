'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/components/ui/States';

const ScheduleView = dynamic(() => import('@/components/ScheduleView').then(mod => mod.ScheduleView), {
  ssr: false,
  loading: () => <PageLoader label="Loading master timetable…" />,
});

export default function SchedulePage() {
  return <ScheduleView />;
}