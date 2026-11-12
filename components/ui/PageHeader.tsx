import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** Rendered icon (24px glyph); shown in the brand-tinted tile. */
  icon?: React.ReactNode;
  eyebrow?: React.ReactNode;
  meta?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons or links; they share the row on desktop and stretch on phones. */
  actions?: React.ReactNode;
  /** Extra content under the description (status pills, links). */
  children?: React.ReactNode;
  className?: string;
  actionsClassName?: string;
}

/** The one page heading used across the portal (modelled on Partners & MOU). */
export function PageHeader({ icon, eyebrow, meta, title, description, actions, children, className, actionsClassName }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4 border-b border-line pb-4 sm:pb-5 lg:flex-row lg:items-center lg:justify-between', className)}>
      {/* The title keeps a readable width; extra actions wrap instead of squeezing it. */}
      <div className="flex min-w-0 items-start gap-3 lg:min-w-72 lg:flex-1">
        {icon && (
          <div aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand [&_svg]:size-5">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {(eyebrow || meta) && (
            <div className="flex flex-wrap items-center gap-2">
              {eyebrow && <span className="rounded-md border border-brand/20 bg-brand/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-brand">{eyebrow}</span>}
              {meta && <span className="font-mono text-[10px] text-ink-subtle">{meta}</span>}
            </div>
          )}
          <h1 className={cn('text-lg font-bold tracking-tight text-ink sm:text-xl', (eyebrow || meta) && 'mt-1')}>{title}</h1>
          {description && <p className="mt-0.5 text-xs font-medium leading-relaxed text-ink-muted">{description}</p>}
          {children}
        </div>
      </div>
      {actions && (
        <div className={cn('flex w-full flex-wrap items-center gap-2 lg:w-auto lg:max-w-[62%] lg:justify-end [&>*]:flex-1 sm:[&>*]:flex-none', actionsClassName)}>
          {actions}
        </div>
      )}
    </header>
  );
}

export interface SegmentItem<T extends string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  hidden?: boolean;
  /** Accessible name when the visible label is abbreviated. */
  ariaLabel?: string;
  /** Count or status shown after the label. */
  badge?: React.ReactNode;
}

/** Toggle-button group for switching a page's views (kept as buttons for existing automation). */
export function SegmentedTabs<T extends string>({ items, value, onChange, label, className, stretch = true, stacked = false }: {
  items: SegmentItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  /** Fill the row on phones (default) instead of scrolling. */
  stretch?: boolean;
  /** Phone tab-bar style: icon above a short label below 640px. */
  stacked?: boolean;
}) {
  const visible = items.filter(item => !item.hidden);
  return (
    <div role="group" aria-label={label} className={cn(
      'flex gap-1 rounded-lg border border-line bg-surface-inset p-1',
      stretch ? 'w-full sm:w-fit [&>button]:flex-1 sm:[&>button]:flex-none' : 'no-scrollbar max-w-full overflow-x-auto',
      className,
    )}>
      {visible.map(item => {
        const active = item.id === value;
        return (
          <button key={item.id} type="button" aria-pressed={active} aria-label={item.ariaLabel} onClick={() => onChange(item.id)}
            className={cn(
              'relative inline-flex min-h-11 min-w-0 shrink-0 cursor-pointer select-none items-center justify-center gap-1.5 rounded-md px-3 text-[11px] font-bold uppercase tracking-wider transition-colors touch-manipulation sm:min-h-10 sm:pointer-coarse:min-h-11 sm:px-4 sm:text-xs [&_svg]:size-3.5 [&_svg]:shrink-0',
              stacked && 'flex-col gap-1 px-1 py-1.5 text-[10px] tracking-wide sm:flex-row sm:gap-1.5 sm:px-4 sm:py-0 sm:text-xs sm:tracking-wider',
              active ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-ink-subtle hover:text-ink',
            )}>
            {item.icon}
            <span className={cn('text-balance', stacked && 'max-w-full truncate')}>{item.label}</span>
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}
