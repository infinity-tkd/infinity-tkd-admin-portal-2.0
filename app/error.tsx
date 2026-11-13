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
          <h2 className="text-lg font-bold uppercase tracking-tight text-ink">System Exception</h2>
          <p className="text-xs leading-relaxed text-ink-muted">
            An unexpected application runtime error occurred. The system has automatically isolated the error state to keep settings intact.
          </p>
        </div>

        {error.message && (
          <div className="w-full rounded-lg border border-line bg-surface-inset p-3 text-left">
            <span className="mb-1 block font-mono text-[10px] font-black uppercase tracking-widest text-ink-subtle">Diagnostics</span>
            <code className="line-clamp-3 break-all font-mono text-[11px] text-red-700 dark:text-red-400">
              {error.message}
            </code>
          </div>
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
