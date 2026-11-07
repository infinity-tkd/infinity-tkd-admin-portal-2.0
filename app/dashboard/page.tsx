'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/components/ui/States';

const DashboardView = dynamic(() => import('@/components/DashboardView').then(mod => mod.DashboardView), {
  ssr: false,
  loading: () => <PageLoader label="Loading command center…" />,
});

export default function DashboardPage() {
  return <DashboardView />;
}