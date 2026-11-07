'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/components/ui/States';

const InventoryPosView = dynamic(() => import('@/components/InventoryPosView').then(mod => mod.InventoryPosView), {
  ssr: false,
  loading: () => <PageLoader label="Loading pro-shop…" />,
});

export default function PosPage() {
  return <InventoryPosView />;
}