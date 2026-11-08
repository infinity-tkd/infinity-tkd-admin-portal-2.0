'use client';

import { useRef, useState } from 'react';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Portal } from '@/components/Portal';
import { useModalFocus } from '@/hooks/use-modal-focus';
import type { PosSaleTransaction } from '@/lib/pos-types';

export interface RefundDecision { reference: string; reason: string; restock: boolean }

/** Records a refund that staff already paid back; field limits match the refund API. */
export function RefundSaleDialog({ sale, busy, error, onClose, onSubmit }: {
  sale: PosSaleTransaction;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (decision: RefundDecision) => Promise<void>;
}) {
  const dialog = useRef<HTMLFormElement>(null);
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [restock, setRestock] = useState(false);
  const [paidBack, setPaidBack] = useState(false);
  useModalFocus(dialog, () => { if (!busy) onClose(); });
  const ready = paidBack && reference.trim().length >= 3 && reason.trim().length >= 3;
  const field = 'mt-2 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#EF2F38] dark:border-neutral-700';
  return <Portal><div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm">
    <form ref={dialog} role="dialog" aria-modal="true" aria-labelledby="refund-sale-title" aria-busy={busy} tabIndex={-1} onSubmit={event => { event.preventDefault(); if (!busy && ready) void onSubmit({ reference: reference.trim(), reason: reason.trim(), restock }); }} className="my-auto max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-2xl outline-none dark:border-neutral-700 dark:bg-[#141414]">
      <fieldset disabled={busy} className="space-y-4">
        <div className="flex items-start justify-between gap-2"><div><h2 id="refund-sale-title" className="text-base font-semibold">Record refund</h2><p className="mt-1 break-all font-mono text-xs text-neutral-500">{sale.txId}</p></div><button type="button" aria-label="Close refund" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"><X size={18} /></button></div>
        <div className="rounded-lg bg-neutral-50 p-3 dark:bg-[#0F0F0F]"><p className="break-words text-sm font-semibold">{sale.studentName}</p><p className="mt-1 font-mono text-sm">${Number(sale.total).toFixed(2)} <span className="font-sans text-xs text-neutral-500">· {sale.method}</span></p></div>
        <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">Return the money first. This records a refund you already paid by cash or bank transfer; it does not move money.</p>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-800 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">{error}</p>}
        <label className="block text-xs font-semibold" htmlFor="refund-reference">Refund receipt or transfer reference<input id="refund-reference" required minLength={3} maxLength={150} autoComplete="off" value={reference} onChange={event => setReference(event.target.value)} className={`min-h-11 ${field}`} /></label>
        <label className="block text-xs font-semibold" htmlFor="refund-reason">Reason<textarea id="refund-reason" required minLength={3} maxLength={500} rows={3} value={reason} onChange={event => setReason(event.target.value)} className={field} /></label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-700"><input type="checkbox" checked={restock} onChange={event => setRestock(event.target.checked)} className="mt-1 h-4 w-4 accent-[#EF2F38]" /><span>Put the items back in stock. Tick only if they were returned and checked as sellable.</span></label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-700"><input type="checkbox" required checked={paidBack} onChange={event => setPaidBack(event.target.checked)} className="mt-1 h-4 w-4 accent-[#EF2F38]" /><span>I returned ${Number(sale.total).toFixed(2)} to the customer.</span></label>
        <div className="flex gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800"><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-lg border border-neutral-300 px-3 text-sm font-semibold dark:border-neutral-700">Back</button><button type="submit" disabled={busy || !ready} className="min-h-11 flex-1 rounded-lg bg-[#EF2F38] px-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Record refund'}</button></div>
      </fieldset>
    </form>
  </div></Portal>;
}
