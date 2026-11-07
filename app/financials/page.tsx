'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/components/ui/States';

const FinancialsView = dynamic(() => import('@/components/FinancialsView').then(mod => mod.FinancialsView), {
  ssr: false,
  loading: () => <PageLoader label="Loading tuition ledger…" />,
});

export default function FinancialsPage() {
  return <FinancialsView />;
}