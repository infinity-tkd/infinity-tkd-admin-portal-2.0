'use client';
import {useState,useRef} from 'react';
import {useModalFocus} from '@/hooks/use-modal-focus';
import {Portal} from '@/components/Portal';

export function ManualBankPaymentDialog({total,customer,busy,onClose,onConfirm}: {
  total:number;customer:string;busy:boolean;onClose:()=>void;onConfirm:(reference:string)=>Promise<void>;
}) {
  const [reference,setReference]=useState('');
  const dialog=useRef<HTMLElement>(null);
  useModalFocus(dialog,()=>{if(!busy)onClose();});
  return <Portal><div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="bank-payment-title" className="my-auto w-full max-w-sm space-y-4 rounded-xl border bg-white p-5 text-neutral-900 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950 dark:text-white">
      <div className="flex items-center justify-between gap-3"><h2 id="bank-payment-title" className="text-sm font-semibold">Verify bank payment</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Close bank payment" className="min-h-11 min-w-11 rounded-lg border">✕</button></div>
      <p className="text-sm">No payment QR is configured here. Use the academy’s verified bank QR and check the receiving account before recording this sale.</p>
      <p className="text-xs text-neutral-500">{customer}</p><p className="text-2xl font-semibold">${total.toFixed(2)} USD</p>
      <form onSubmit={event=>{event.preventDefault();if(!busy)void onConfirm(reference.trim());}}><fieldset disabled={busy} className="space-y-4">
        <label className="block space-y-2 text-sm"><span>Verified bank reference</span><input value={reference} onChange={event=>setReference(event.target.value)} required minLength={3} maxLength={120} className="min-h-11 w-full rounded-lg border bg-transparent px-3"/></label>
        <label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" required/>I checked that the funds reached the academy account.</label>
        <button type="submit" className="min-h-11 w-full rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white">{busy?'Recording sale…':'Confirm payment received'}</button>
      </fieldset></form>
    </section>
  </div></Portal>;
}
