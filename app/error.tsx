'use client';

import React, { useEffect } from 'react';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { ArrowClockwise } from '@phosphor-icons/react/dist/csr/ArrowClockwise';
import { House } from '@phosphor-icons/react/dist/csr/House';
import { reportClientError } from '@/lib/client-telemetry';
import { buttonClass } from '@/components/ui/styles';

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
    reportClientError(error, 'Application view');
  }, [error]);

  return (
    <div role="alert" className="flex min-h-[60dvh] items-center justify-center p-4 font-sans text-ink sm:p-6">
      <div className="flex w-full max-w-md flex-col items-center space-y-6 rounded-lg border border-line bg-surface p-6 text-center shadow-2xl sm:p-8">
        <div aria-hidden="true" className="flex size-16 items-center justify-center rounded-full border border-brand/20 bg-brand/10 text-brand-ink">
          <Warning className="size-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold tracking-tight text-ink">Something went wrong</h2>
          <p className="text-xs leading-relaxed text-ink-muted">
            This page ran into an unexpected problem. You are still signed in and nothing you saved has changed. Try again, or go back to the dashboard.
          </p>
        </div>

        {(error.message || error.digest) && (
          <details className="w-full rounded-lg border border-line bg-surface-inset px-3 text-left">
            <summary className="flex min-h-11 cursor-pointer items-center font-mono text-micro font-black uppercase tracking-widest text-ink-subtle">Technical details</summary>
            <div className="max-h-40 space-y-1 overflow-y-auto pb-3">
              {error.digest && <p className="font-mono text-micro text-ink-muted">Reference: {error.digest}</p>}
              {error.message && <code className="block break-all font-mono text-micro text-red-700 dark:text-red-400">{error.message}</code>}
            </div>
          </details>
        )}

        <div className="flex w-full flex-col gap-2.5">
          <button type="button" onClick={() => reset()} className={buttonClass({ variant: 'primary' })}>
            <ArrowClockwise className="size-4" /> Try Again
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/dashboard';
              }
            }}
            className={buttonClass()}
          >
            <House className="size-4" /> Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
