'use client';

import React, { useEffect } from 'react';
import { reportClientError } from '@/lib/client-telemetry';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[FATAL_ROOT_CRASH]', error);

    reportClientError(error, 'Root layout', 'FATAL');
  }, [error]);

  return (
    // Without the root layout there is no theme script, so the fatal screen is always dark.
    <html lang="en" className="dark">
      <body className="min-h-dvh flex items-center justify-center bg-[#0A0A0A] text-[#E4E4E4] p-4 sm:p-6 font-sans antialiased selection:bg-red-500/30">
        <div className="w-full max-w-md bg-[#141414] border border-[#262626] rounded-[8px] p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-brand-ink shadow-[0_0_20px_rgba(239,47,56,0.15)]">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-black text-white tracking-tight">The portal could not load</h1>
            <p className="text-xs text-[#999] leading-relaxed">
              The app ran into an unexpected problem while starting. You are still signed in and nothing you saved has changed. Try again, or reload the portal.
            </p>
          </div>

          {(error.message || error.digest) && (
            <details className="w-full bg-[#0F0F0F] border border-[#262626] rounded-[8px] px-3 text-left">
              <summary className="flex min-h-11 cursor-pointer items-center text-micro uppercase tracking-widest font-black text-[#999] font-mono">Technical details</summary>
              <div className="max-h-40 overflow-y-auto pb-3 space-y-1">
                {error.digest && <p className="text-micro text-[#999] font-mono">Reference: {error.digest}</p>}
                {error.message && <code className="block text-micro text-red-400 font-mono break-all">{error.message}</code>}
              </div>
            </details>
          )}

          <div className="flex flex-col w-full gap-2.5 pt-2">
            <button
              onClick={() => reset()}
              className="w-full min-h-[44px] py-2.5 bg-brand hover:bg-red-600 text-white font-bold uppercase tracking-widest text-xs rounded-[8px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-950/40 cursor-pointer"
            >
              Try again
            </button>

            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/dashboard';
                }
              }}
              className="w-full min-h-[44px] py-2.5 bg-[#1F1F1F] hover:bg-[#2A2A2A] border border-[#333] text-[#E4E4E4] font-bold uppercase tracking-widest text-xs rounded-[8px] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Go to dashboard
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
