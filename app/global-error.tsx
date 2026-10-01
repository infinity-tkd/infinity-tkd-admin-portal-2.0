'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[FATAL_ROOT_CRASH]', error);

    // Automated client-to-server telemetry reporting
    try {
      fetch('/api/telemetry/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'FATAL',
          message: error.message || 'Root layout fatal exception',
          stack: error.stack,
          digest: error.digest,
          url: typeof window !== 'undefined' ? window.location.href : '',
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    } catch {
      // Prevent crash loop in error logger
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-dvh flex items-center justify-center bg-[#0A0A0A] text-[#E4E4E4] p-4 sm:p-6 font-sans antialiased selection:bg-red-500/30">
        <div className="w-full max-w-md bg-[#141414] border border-[#262626] rounded-[8px] p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-[#EF2F38] shadow-[0_0_20px_rgba(239,47,56,0.15)]">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-black text-white tracking-tight uppercase">Fatal System Exception</h1>
            <p className="text-xs text-[#999] leading-relaxed">
              The root application shell encountered an unrecoverable runtime error. Core settings and encrypted session state have been preserved.
            </p>
          </div>

          {error.message && (
            <div className="w-full bg-[#0F0F0F] border border-[#262626] rounded-[8px] p-3 text-left">
              <span className="block text-[8px] uppercase tracking-widest font-black text-[#666] mb-1 font-mono">Crash Trace</span>
              <code className="text-[10px] text-red-400 font-mono break-all line-clamp-3">
                {error.message}
              </code>
              {error.digest && (
                <span className="block text-[8px] text-[#555] font-mono mt-1">Digest: {error.digest}</span>
              )}
            </div>
          )}

          <div className="flex flex-col w-full gap-2.5 pt-2">
            <button
              onClick={() => reset()}
              className="w-full min-h-[44px] py-2.5 bg-[#EF2F38] hover:bg-red-600 text-white font-bold uppercase tracking-widest text-xs rounded-[8px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-950/40 cursor-pointer"
            >
              Self-Heal & Reset
            </button>

            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/dashboard';
                }
              }}
              className="w-full min-h-[44px] py-2.5 bg-[#1F1F1F] hover:bg-[#2A2A2A] border border-[#333] text-[#E4E4E4] font-bold uppercase tracking-widest text-xs rounded-[8px] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Reload Portal Home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
