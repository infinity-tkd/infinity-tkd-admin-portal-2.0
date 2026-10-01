'use client';

import React, { useEffect } from 'react';
import { Warning, ArrowClockwise, House } from '@phosphor-icons/react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for tracking
    console.error('System captured exception:', error);
  }, [error]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#0A0A0A] text-[#E4E4E4] p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-[#141414] border border-[#262626] rounded-[8px] p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center space-y-6">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-[#EF2F38] shadow-[0_0_15px_rgba(239,47,56,0.1)]">
          <Warning className="w-8 h-8 font-bold" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white tracking-tight uppercase">System Exception</h2>
          <p className="text-xs text-[#999] leading-relaxed">
            An unexpected application runtime error occurred. The system has automatically isolated the error state to keep settings intact.
          </p>
        </div>

        {error.message && (
          <div className="w-full bg-[#0F0F0F] border border-[#262626] rounded-[8px] p-3 text-left">
            <span className="block text-[8px] uppercase tracking-widest font-black text-[#555] mb-1 font-mono">Diagnostics</span>
            <code className="text-[10px] text-red-400 font-mono break-all line-clamp-3">
              {error.message}
            </code>
          </div>
        )}

        <div className="flex flex-col w-full gap-2.5">
          <button
            onClick={() => reset()}
            className="w-full min-h-[44px] py-2.5 bg-white hover:bg-gray-200 text-black font-bold uppercase tracking-widest text-xs rounded-[8px] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <ArrowClockwise className="w-4 h-4" /> Try Again
          </button>
          
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/dashboard';
              }
            }}
            className="w-full min-h-[44px] py-2.5 bg-[#0F0F0F] hover:bg-[#1A1A1A] border border-[#262626] text-[#999] hover:text-white font-bold uppercase tracking-widest text-xs rounded-[8px] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <House className="w-4 h-4" /> Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
