'use client';

import React, { useId, useRef } from 'react';
import { motion } from 'motion/react';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Portal } from '@/components/Portal';
import { useModalFocus } from '@/hooks/use-modal-focus';
import { cn } from '@/lib/utils';

const sizes = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  full: 'sm:max-w-6xl',
} as const;

const DialogTitleContext = React.createContext<string | undefined>(undefined);

interface DialogProps {
  onClose: () => void;
  children: React.ReactNode;
  size?: keyof typeof sizes;
  /** Accessible name when the dialog has no DialogHeader. */
  label?: string;
  role?: 'dialog' | 'alertdialog';
  /** Block Escape and backdrop dismissal (e.g. while saving). */
  locked?: boolean;
  className?: string;
}

/**
 * Shared modal: a bottom sheet on phones and a centred card from 640px.
 * It owns focus (trap, Escape, restore) and names itself from its header.
 * Render it inside AnimatePresence for the exit animation.
 */
export function Dialog({ onClose, children, size = 'lg', label, role = 'dialog', locked = false, className }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const dismiss = () => { if (!locked) onClose(); };
  useModalFocus(panel, dismiss);
  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
        <motion.div aria-hidden="true" onClick={dismiss}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-neutral-950/70 backdrop-blur-sm" />
        <motion.div ref={panel} role={role} aria-modal="true" aria-label={label} aria-labelledby={label ? undefined : titleId} tabIndex={-1}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8, transition: { duration: 0.12 } }}
          className={cn(
            'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border border-line bg-surface text-ink shadow-2xl outline-none sm:rounded-lg',
            'pb-[env(safe-area-inset-bottom,0px)] sm:pb-0',
            sizes[size], className,
          )}>
          <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" />
          <DialogTitleContext.Provider value={label ? undefined : titleId}>{children}</DialogTitleContext.Provider>
        </motion.div>
      </div>
    </Portal>
  );
}

export function DialogHeader({ icon, title, description, onClose, closeLabel = 'Close', actions }: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  actions?: React.ReactNode;
}) {
  const titleId = React.useContext(DialogTitleContext);
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface-inset px-4 py-3 sm:p-5">
      <div className="flex min-w-0 items-center gap-3">
        {icon && <div aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand-ink [&_svg]:size-4">{icon}</div>}
        <div className="min-w-0">
          <h2 id={titleId} className="truncate text-sm font-bold uppercase tracking-wider text-ink">{title}</h2>
          {description && <p className="mt-0.5 font-mono text-micro text-ink-subtle">{description}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {actions}
        {onClose && (
          <button type="button" onClick={onClose} aria-label={closeLabel} title="Close"
            className="flex size-11 cursor-pointer items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-control hover:text-ink touch-manipulation">
            <X className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function DialogBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6', className)}>{children}</div>;
}

export function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex shrink-0 flex-col-reverse gap-2 border-t border-line bg-surface-inset px-4 py-3 sm:flex-row sm:justify-end sm:px-5', className)}>{children}</div>;
}
