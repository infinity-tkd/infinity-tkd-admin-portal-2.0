'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const DashboardView = dynamic(
  () => import('@/components/DashboardView').then((mod) => mod.DashboardView),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#EF2F38] border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Loading Command Center...</span>
        </div>
      </div>
    ),
  }
);

export default function DashboardPage() {
  return <DashboardView />;
}

