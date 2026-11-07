'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/components/ui/States';

const AttendanceView = dynamic(() => import('@/components/AttendanceView').then(mod => mod.AttendanceView), {
  ssr: false,
  loading: () => <PageLoader label="Loading attendance…" />,
});

export default function AttendancePage() {
  return <AttendanceView />;
}