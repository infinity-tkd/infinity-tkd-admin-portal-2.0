import React from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { cn } from '@/lib/utils';
import { fieldClass } from './styles';

/** Search input with leading icon and a 40px clear button. */
export function SearchField({ value, onChange, placeholder, label, className, inputClassName }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Accessible name; defaults to the placeholder. */
  label?: string;
  className?: string;
  inputClassName?: string;
}) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
      <input
        type="text"
        aria-label={label ?? placeholder}
        placeholder={placeholder}
        value={value}
        onChange={event => onChange(event.target.value)}
        className={cn(fieldClass, 'pl-10 pr-11 text-xs', inputClassName)}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" title="Clear search"
          className="absolute right-0.5 top-1/2 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-ink-subtle hover:text-ink touch-manipulation">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Horizontally scrolling filter row on phones; wraps from the sm breakpoint. */
export function FilterRail({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('no-scrollbar -mx-3.5 flex touch-pan-x items-center gap-2 overflow-x-auto px-3.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0', className)}>{children}</div>;
}

export interface ViewOption<T extends string> { id: T; label: string; title?: string; icon: React.ReactNode }

/** Icon toggle for switching between list layouts (grid, table, ...). */
export function ViewToggle<T extends string>({ value, onChange, options, label = 'Layout' }: {
  value: T;
  onChange: (value: T) => void;
  options: ViewOption<T>[];
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex min-h-11 shrink-0 items-center rounded-lg border border-line bg-control p-0.5">
      {options.map(option => (
        <button key={option.id} type="button" onClick={() => onChange(option.id)} aria-pressed={value === option.id}
          aria-label={option.label} title={option.title ?? option.label}
          className={cn('flex size-10 cursor-pointer items-center justify-center rounded-md transition-colors touch-manipulation [&_svg]:size-4',
            value === option.id ? 'bg-surface text-ink shadow-2xs' : 'text-ink-subtle hover:text-ink')}>
          {option.icon}
        </button>
      ))}
    </div>
  );
}
