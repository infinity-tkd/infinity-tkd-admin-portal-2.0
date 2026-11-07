'use client';
import React, { useId } from 'react';
import { cn } from '@/lib/utils';

export const inputClass = 'h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-[#EF2F38] focus:outline-none disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white';
export const primaryButton = 'inline-flex min-h-10 items-center justify-center rounded-lg bg-[#EF2F38] px-4 py-2 text-xs font-bold text-white hover:bg-[#d6262f] disabled:opacity-40';
export const secondaryButton = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800';
export const cardClass = 'rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#141414]';

export function Labeled({ label, children, wide = false, hint }: { label: string; children: React.ReactElement<{ id?: string; 'aria-describedby'?: string }>; wide?: boolean; hint?: string }) {
  const id = useId(), hintId = useId();
  return <div className={cn('min-w-0 space-y-1', wide && 'sm:col-span-2')}>
    <label htmlFor={id} className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">{label}</label>
    {React.cloneElement(children, { id, ...(hint ? { 'aria-describedby': hintId } : {}) })}
    {hint && <p id={hintId} className="text-[11px] text-neutral-500">{hint}</p>}
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
  return <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold', tones[tone])}>{children}</span>;
}

export function ErrorNote({ message }: { message?: string }) {
  return message ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{message}</p> : null;
}

export const CANDIDATE_STATUS: Record<string, { label: string; tone: 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'black' }> = {
  registered: { label: 'Registered', tone: 'neutral' }, scoring: { label: 'Scoring', tone: 'blue' }, finalized: { label: 'Finalized', tone: 'amber' },
  promoted: { label: 'Promoted', tone: 'green' }, withdrawn: { label: 'Withdrawn', tone: 'neutral' },
  nominated: { label: 'Nominated', tone: 'neutral' }, submitted: { label: 'Submitted to CTF', tone: 'blue' }, passed: { label: 'Passed at Kukkiwon', tone: 'green' },
  failed: { label: 'Not passed', tone: 'red' }, certified: { label: 'Certificate recorded', tone: 'amber' },
};
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
