'use client';

import React, { useEffect } from 'react';
import { Warning, ArrowClockwise, House } from '@phosphor-icons/react';
import Link from 'next/link';

interface SegmentErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  sectionName?: string;
}

export function SegmentErrorFallback({
  error,
  reset,
  sectionName = 'Section',
}: SegmentErrorFallbackProps) {
  useEffect(() => {
    console.error(`[SEGMENT_ERROR:${sectionName.toUpperCase()}]`, error);

    try {
      fetch('/api/telemetry/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'ERROR',
          section: sectionName,
          message: error.message || `${sectionName} segment failure`,
          stack: error.stack,
          digest: error.digest,
          url: typeof window !== 'undefined' ? window.location.href : '',
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    } catch {
      // Non-blocking telemetry
    }
  }, [error, sectionName]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
      <div className="w-full max-w-md bg-[#141414] border border-[#262626] rounded-[8px] p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.1)]">
          <Warning className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold uppercase tracking-widest">
            Isolated View Error
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-tight">
            {sectionName} Unavailable
          </h2>
          <p className="text-xs text-[#999] leading-relaxed">
            A runtime error occurred in this view. The application shell and your authenticated session remain active.
          </p>
        </div>

        {error.message && (
          <div className="w-full bg-[#0A0A0A] border border-[#262626] rounded-[8px] p-3 text-left">
            <span className="block text-[8px] uppercase tracking-widest font-black text-[#555] mb-1 font-mono">Diagnostics</span>
            <code className="text-[10px] text-red-400 font-mono break-all line-clamp-3">
              {error.message}
            </code>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 min-h-[44px] py-2 px-4 bg-[#EF2F38] hover:bg-red-600 text-white font-bold uppercase tracking-widest text-[10px] rounded-[8px] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <ArrowClockwise className="w-4 h-4" /> Retry View
          </button>

          <Link
            href="/dashboard"
            className="flex-1 min-h-[44px] py-2 px-4 bg-[#1F1F1F] hover:bg-[#2A2A2A] border border-[#333] text-[#E4E4E4] font-bold uppercase tracking-widest text-[10px] rounded-[8px] transition-all flex items-center justify-center gap-2"
          >
            <House className="w-4 h-4" /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
