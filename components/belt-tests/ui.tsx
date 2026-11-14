'use client';
import React, { useId } from 'react';
import { cn } from '@/lib/utils';

// Belt-test controls use the portal theme tokens (see components/ui/styles.ts).
export const inputClass = 'min-h-11 w-full rounded-lg border border-line-strong bg-surface-muted px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20 disabled:opacity-60 dark:border-line dark:bg-control';
export const primaryButton = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-on-brand shadow-sm hover:bg-brand-strong disabled:opacity-40 touch-manipulation';
export const secondaryButton = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-line bg-control px-3 py-2 text-xs font-semibold text-ink hover:bg-control-hover disabled:opacity-40 touch-manipulation';
export const cardClass = 'rounded-lg border border-line bg-surface p-4 shadow-xs';

export function Labeled({ label, children, wide = false, hint }: { label: string; children: React.ReactElement<{ id?: string; 'aria-describedby'?: string }>; wide?: boolean; hint?: string }) {
  const id = useId(), hintId = useId();
  return <div className={cn('min-w-0 space-y-1', wide && 'sm:col-span-2')}>
    <label htmlFor={id} className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">{label}</label>
    {React.cloneElement(children, { id, ...(hint ? { 'aria-describedby': hintId } : {}) })}
    {hint && <p id={hintId} className="text-micro text-neutral-500">{hint}</p>}
  </div>;
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'black'; children: React.ReactNode }) {
  const tones = {
    neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
    green: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    red: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300',
    blue: 'bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
    black: 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900',
  };
  return <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-micro font-semibold', tones[tone])}>{children}</span>;
}

export function ErrorNote({ message }: { message?: string }) {
  return message ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{message}</p> : null;
}

export const CANDIDATE_STATUS: Record<string, { label: string; tone: 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'black' }> = {
  registered: { label: 'Registered', tone: 'neutral' }, scoring: { label: 'Scoring', tone: 'blue' }, finalized: { label: 'Finalized', tone: 'amber' },
  promoted: { label: 'Promoted', tone: 'green' }, withdrawn: { label: 'Withdrawn', tone: 'neutral' },
  nominated: { label: 'Nominated', tone: 'neutral' }, submitted: { label: 'Submitted to CTF', tone: 'blue' }, passed: { label: 'Passed at Kukkiwon', tone: 'green' },
  failed: { label: 'Not passed', tone: 'red' }, certified: { label: 'Certificate recorded', tone: 'amber' },
  requested: { label: 'Requested', tone: 'blue' }, declined: { label: 'Declined', tone: 'neutral' },
};
/** Statuses that are not (yet) on the test day: pending or declined requests, and withdrawals. */
export const OFF_ROSTER = new Set(['requested', 'declined', 'withdrawn']);
export const FEE_LABEL: Record<string, { label: string; tone: 'neutral' | 'green' | 'amber' | 'blue' }> = {
  none: { label: 'No fee', tone: 'neutral' }, unpaid: { label: 'Fee unpaid', tone: 'amber' }, paid: { label: 'Fee paid', tone: 'green' }, waived: { label: 'Fee waived', tone: 'blue' },
};
export const usd = (value: number | null | undefined) => value == null ? '' : '$' + Number(value).toFixed(2).replace(/\.00$/, '');
export const RESULT_LABEL: Record<string, { label: string; tone: 'neutral' | 'green' | 'amber' | 'red' | 'blue' }> = {
  pending: { label: 'Pending', tone: 'neutral' }, distinction: { label: 'Distinction', tone: 'green' }, pass: { label: 'Pass', tone: 'green' },
  retest: { label: 'Retest', tone: 'amber' }, fail: { label: 'Not yet', tone: 'red' },
};

export function eventStatus(event: { published_at: string | null; cancelled_at: string | null; results_published_at: string | null }) {
  if (event.cancelled_at) return { label: 'Cancelled', tone: 'neutral' as const };
  if (event.results_published_at) return { label: 'Results published', tone: 'green' as const };
  if (event.published_at) return { label: 'Published to students', tone: 'blue' as const };
  return { label: 'Private draft', tone: 'amber' as const };
}

export const hhmm = (value?: string | null) => value ? value.slice(0, 5) : '';
