'use client';

import { useRef, useState } from 'react';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Portal } from '@/components/Portal';
import { useModalFocus } from '@/hooks/use-modal-focus';
import type { StudentOrderRecord } from '@/lib/pos-types';
import type { OrderDecisionKind } from './StudentOrderCard';

export function OrderDecisionDialog({ order, kind, busy, error, onClose, onSubmit }: {
  order: StudentOrderRecord;
  kind: OrderDecisionKind;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState('');
  const [verified, setVerified] = useState(false);
  useModalFocus(dialog, () => { if (!busy) onClose(); });
  const title = kind === 'payment' ? 'Record verified payment' : kind === 'cancel' ? 'Cancel student order' : 'Complete handover';
  return <Portal><div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm">
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="order-decision-title" aria-busy={busy} tabIndex={-1} className="my-auto max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-2xl outline-none dark:border-neutral-700 dark:bg-[#141414]">
    <form onSubmit={event => { event.preventDefault(); if (!busy && (kind === 'cancel' ? value.trim().length >= 4 : verified && (kind !== 'payment' || value.trim().length >= 3))) void onSubmit(value.trim()); }} className="contents">
      <fieldset disabled={busy} className="space-y-4">
        <div className="flex items-start justify-between gap-2"><div><h2 id="order-decision-title" className="text-base font-semibold">{title}</h2><p className="mt-1 break-all font-mono text-xs text-neutral-500">{order.order_number}</p></div><button type="button" aria-label="Close order action" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"><X size={18} /></button></div>
        <div className="rounded-lg bg-neutral-50 p-3 dark:bg-[#0F0F0F]"><p className="break-words text-sm font-semibold">{order.students?.english_name || order.customer_name}</p><p className="mt-1 font-mono text-sm">${Number(order.total_usd).toFixed(2)} <span className="font-sans text-xs text-neutral-500">· {order.payment_method}</span></p></div>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-800 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">{error}</p>}
        {kind === 'payment' && <><p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">Check the actual bank receipt or cash collection first. This records the payment; it does not charge the student.</p><label className="block text-xs font-semibold" htmlFor="order-payment-reference">Payment or receipt reference<input id="order-payment-reference" required minLength={3} maxLength={150} value={value} onChange={event => setValue(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700" /></label></>}
        {kind === 'cancel' && <><p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">Reserved stock will be restored. If payment was collected, its refund must be recorded separately after the money is returned.</p><label className="block text-xs font-semibold" htmlFor="order-cancellation-reason">Cancellation reason<textarea id="order-cancellation-reason" required minLength={4} maxLength={500} rows={3} value={value} onChange={event => setValue(event.target.value)} className="mt-2 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700" /></label></>}
        {kind !== 'cancel' && <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-700"><input type="checkbox" required checked={verified} onChange={event => setVerified(event.target.checked)} className="mt-1 h-4 w-4 accent-brand" /><span>{kind === 'payment' ? 'I verified that the full payment was received.' : 'The items have been handed to the customer.'}</span></label>}
        <div className="flex gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800"><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-lg border border-neutral-300 px-3 text-sm font-semibold dark:border-neutral-700">Back</button><button type="submit" disabled={busy || (kind === 'cancel' ? value.trim().length < 4 : !verified || (kind === 'payment' && value.trim().length < 3))} className="min-h-11 flex-1 rounded-lg bg-brand px-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : kind === 'payment' ? 'Record payment' : kind === 'cancel' ? 'Cancel order' : 'Complete handover'}</button></div>
      </fieldset>
    </form>
    </div>
  </div></Portal>;
}
