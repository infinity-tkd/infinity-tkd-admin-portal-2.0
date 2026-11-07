'use client';

import React, { useEffect } from 'react';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { ArrowClockwise } from '@phosphor-icons/react/dist/csr/ArrowClockwise';
import { House } from '@phosphor-icons/react/dist/csr/House';
import Link from 'next/link';
import { reportClientError } from '@/lib/client-telemetry';
import { buttonClass } from '@/components/ui/styles';
import { cn } from '@/lib/utils';

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

    reportClientError(error, sectionName);
  }, [error, sectionName]);

  return (
    <div role="alert" className="flex min-h-[50dvh] flex-col items-center justify-center p-4 text-center">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-line bg-surface p-6 shadow-2xl sm:p-8">
        <div aria-hidden="true" className="mx-auto flex size-14 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Warning className="size-7" />
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
            Isolated View Error
          </div>
          <h2 className="text-base font-bold uppercase tracking-tight text-ink sm:text-lg">
            {sectionName} Unavailable
          </h2>
          <p className="text-xs leading-relaxed text-ink-muted">
            A runtime error occurred in this view. The application shell and your authenticated session remain active.
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

        <div className="flex flex-col gap-2.5 pt-2 sm:flex-row">
          <button type="button" onClick={() => reset()} className={cn(buttonClass({ variant: 'primary' }), 'flex-1')}>
            <ArrowClockwise className="size-4" /> Retry View
          </button>
          <Link href="/dashboard" className={cn(buttonClass(), 'flex-1')}>
            <House className="size-4" /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
