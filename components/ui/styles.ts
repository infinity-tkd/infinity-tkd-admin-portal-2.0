import { cva } from 'class-variance-authority';

/*
 * Shared portal styling, taken from the Partners & MOU page. Colours come from
 * the theme tokens in app/globals.css (brand, surface, control, line, ink), so
 * every class here works in light and dark mode without per-page overrides.
 */

export const buttonClass = cva(
  'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-bold uppercase tracking-wider transition-colors touch-manipulation cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-on-brand shadow-sm hover:bg-brand-strong',
        secondary: 'border border-line bg-control text-ink hover:bg-control-hover',
        ghost: 'text-ink-muted hover:bg-control hover:text-ink',
        danger: 'border border-red-500/30 bg-red-500/10 text-red-700 hover:bg-red-600 hover:text-on-brand dark:text-red-400',
      },
      size: {
        md: 'min-h-11 px-4 text-xs',
        sm: 'min-h-9 px-3 text-[11px]',
        icon: 'size-11 shrink-0 p-0',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

/** Raised content card (lists, panels, tables). */
export const cardClass = 'rounded-lg border border-line bg-surface shadow-xs';
/** Small uppercase section label. */
export const sectionLabelClass = 'font-mono text-[10px] font-bold uppercase tracking-wider text-ink-subtle';

export const fieldClass = 'min-h-11 w-full rounded-lg border border-line-strong bg-surface-muted px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20 disabled:opacity-60 dark:border-line dark:bg-control';
export const labelClass = 'mb-1 block text-[11px] font-semibold text-ink-muted';
/** Compact toolbar select (filters, sort). */
export const filterSelectClass = 'min-h-11 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-surface-muted px-3 font-mono text-xs font-bold text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20 dark:border-line dark:bg-control touch-manipulation';
/** Toolbar strip that holds search, filters and layout toggles. */
export const toolbarClass = 'flex flex-col items-stretch justify-between gap-2.5 rounded-lg border border-line bg-surface p-3 shadow-xs sm:gap-3 sm:p-4 md:flex-row md:items-center';
