'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const DirectoryView = dynamic(
  () => import('@/components/DirectoryView').then((mod) => mod.DirectoryView),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 p-8 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[#EF2F38] border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
);

export default function StudentsPage() {
  return <DirectoryView />;
}

