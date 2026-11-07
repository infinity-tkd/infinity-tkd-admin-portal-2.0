'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/components/ui/States';

const PartnersView = dynamic(() => import('@/components/PartnersView').then(mod => mod.PartnersView), {
  ssr: false,
  loading: () => <PageLoader label="Loading partners & MOU directory…" />,
});

export default function PartnersPage() {
  return <PartnersView />;
}