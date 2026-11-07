'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const BeltTestsView = dynamic(() => import('@/components/belt-tests/BeltTestsView').then(mod => mod.BeltTestsView), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#EF2F38] border-t-transparent" />
    </div>
  ),
});

export default function BeltTestsPage() {
  return <BeltTestsView />;
}
