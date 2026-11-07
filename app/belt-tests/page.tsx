'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/components/ui/States';

const BeltTestsView = dynamic(() => import('@/components/belt-tests/BeltTestsView').then(mod => mod.BeltTestsView), {
  ssr: false,
  loading: () => <PageLoader label="Loading belt tests…" />,
});

export default function BeltTestsPage() {
  return <BeltTestsView />;
}