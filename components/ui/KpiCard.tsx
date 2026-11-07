import React from 'react';
import { cn } from '@/lib/utils';

const tones = {
  neutral: { text: 'text-ink', label: 'text-ink-subtle', tile: 'border-line bg-control text-ink-muted', active: 'border-brand ring-2 ring-brand/40 bg-brand/[0.04] dark:bg-brand/[0.08]', hover: 'hover:border-line-strong' },
  brand: { text: 'text-brand', label: 'text-brand', tile: 'border-brand/20 bg-brand/10 text-brand', active: 'border-brand ring-2 ring-brand/40 bg-brand/[0.06]', hover: 'hover:border-brand/40' },
  green: { text: 'text-emerald-700 dark:text-emerald-400', label: 'text-emerald-700 dark:text-emerald-400', tile: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', active: 'border-emerald-500 ring-2 ring-emerald-500/50 bg-emerald-500/[0.06]', hover: 'hover:border-emerald-500/40' },
  blue: { text: 'text-blue-700 dark:text-blue-400', label: 'text-blue-700 dark:text-blue-400', tile: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400', active: 'border-blue-500 ring-2 ring-blue-500/50 bg-blue-500/[0.06]', hover: 'hover:border-blue-500/40' },
  amber: { text: 'text-amber-700 dark:text-amber-400', label: 'text-amber-700 dark:text-amber-400', tile: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400', active: 'border-amber-500 ring-2 ring-amber-500/50 bg-amber-500/[0.06]', hover: 'hover:border-amber-500/40' },
  violet: { text: 'text-violet-700 dark:text-violet-400', label: 'text-violet-700 dark:text-violet-400', tile: 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-400', active: 'border-violet-500 ring-2 ring-violet-500/50 bg-violet-500/[0.06]', hover: 'hover:border-violet-500/40' },
} as const;
export type KpiTone = keyof typeof tones;

interface KpiCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: KpiTone;
  /** Secondary line under the value. */
  hint?: React.ReactNode;
  /** Makes the card a filter toggle. */
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

/** Metric tile shared by every page (Partners KPI style); a toggle when it filters the page. */
export function KpiCard({ label, value, icon, tone = 'neutral', hint, onClick, active = false, className }: KpiCardProps) {
  const palette = tones[tone];
  const body = (
    <>
      <div className="min-w-0">
        <p className={cn('truncate font-mono text-[10px] font-bold uppercase tracking-wider', palette.label)}>{label}</p>
        <p className={cn('mt-0.5 font-mono text-xl font-black tabular-nums sm:text-2xl', palette.text)}>{value}</p>
        {hint && <div className="mt-1 truncate text-[10px] font-medium text-ink-subtle">{hint}</div>}
      </div>
      {icon && <div aria-hidden="true" className={cn('hidden size-9 shrink-0 items-center justify-center rounded-lg border min-[420px]:flex [&_svg]:size-4', palette.tile)}>{icon}</div>}
    </>
  );
  const base = cn('flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border bg-surface-muted p-3 text-left shadow-2xs sm:p-4', className);
  if (!onClick) return <div className={cn(base, 'border-line')}>{body}</div>;
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={cn(base, 'cursor-pointer touch-manipulation transition-colors', active ? palette.active : cn('border-line', palette.hover))}>
      {body}
    </button>
  );
}
