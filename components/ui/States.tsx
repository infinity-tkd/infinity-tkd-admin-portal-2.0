import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/** Placeholder for a route chunk that is still loading. */
export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[50dvh] flex-1 items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div aria-hidden="true" className="size-8 rounded-full border-2 border-brand border-t-transparent motion-safe:animate-spin" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-subtle">{label}</span>
      </div>
    </div>
  );
}

/** Full-screen brand splash shown while the session is restored. */
export function BrandSplash({ message, tone = 'brand' }: { message: string; tone?: 'brand' | 'success' }) {
  const accent = tone === 'success' ? 'bg-emerald-500' : 'bg-brand';
  return (
    <div role="status" aria-live="polite" className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-page text-ink selection:bg-red-500/30">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,47,56,0.06)_0%,transparent_70%)]" />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <Image unoptimized priority width={56} height={56} src="/icons/logo.svg" alt="" className="size-14 object-contain drop-shadow-[0_0_15px_rgba(239,47,56,0.35)] motion-safe:animate-pulse" />
        <div className="flex flex-col items-center gap-1.5 text-center">
          <p className="text-[11px] font-black uppercase leading-none tracking-[0.25em]">Infinity TKD</p>
          <p className={cn('font-mono text-[10px] uppercase tracking-[0.18em]', tone === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-brand-ink')}>{message}</p>
        </div>
        <div aria-hidden="true" className="relative h-0.5 w-32 overflow-hidden rounded-full bg-line">
          <div className={cn('absolute inset-y-0 left-0 w-1/2 rounded-full animate-shimmer', accent)} />
        </div>
      </div>
    </div>
  );
}

/** Dashed empty/loading/error placeholder for lists and grids. */
export function EmptyState({ icon, title, description, action, className, busy }: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  busy?: boolean;
}) {
  return (
    <div role={busy ? 'status' : undefined} className={cn('rounded-lg border border-dashed border-line bg-surface-muted px-4 py-14 text-center sm:py-20', className)}>
      {icon && <div aria-hidden="true" className="mx-auto mb-3 flex justify-center text-ink-subtle [&_svg]:size-12">{icon}</div>}
      <h3 className="text-sm font-bold uppercase tracking-wider text-ink">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-muted">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Inline error with an optional retry action. */
export function ErrorBanner({ title, children, action, className }: { title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300', className)}>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-1')}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
