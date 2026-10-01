'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const InventoryPosView = dynamic(
  () => import('@/components/InventoryPosView').then((mod) => mod.InventoryPosView),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 p-8 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[#EF2F38] border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
);

export default function ProShopPage() {
  return <InventoryPosView />;
}

