'use client';

import { memo } from 'react';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Printer } from '@phosphor-icons/react/dist/csr/Printer';
import { allowedOrderTransitions, type PosOrderStatus } from '@/lib/pos-order';
import type { StudentOrderRecord } from '@/lib/pos-types';
import { cn } from '@/lib/utils';

export type OrderDecisionKind = 'payment' | 'cancel' | 'handover';
export type OrderAdvanceStatus = 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'COMPLETED';

const statusLabels: Record<PosOrderStatus, string> = {
  PENDING_CONFIRMATION: 'Awaiting acceptance', CONFIRMED: 'Accepted', PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready for pickup', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};
const steps: PosOrderStatus[] = ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED'];

export const StudentOrderCard = memo(function StudentOrderCard({ order, busy, canManage, canCancel, onAdvance, onDecision, onPrint }: {
  order: StudentOrderRecord;
  busy: boolean;
  canManage: boolean;
  canCancel: boolean;
  onAdvance: (order: StudentOrderRecord, status: OrderAdvanceStatus) => void;
  onDecision: (order: StudentOrderRecord, kind: OrderDecisionKind) => void;
  onPrint: (order: StudentOrderRecord) => void;
}) {
  const terminal = order.order_status === 'COMPLETED' || order.order_status === 'CANCELLED';
  const paid = order.payment_status === 'PAID';
  const currentStep = steps.indexOf(order.order_status);
  const allowed = allowedOrderTransitions(order.order_status);
  const next = order.order_status === 'PENDING_CONFIRMATION' ? 'CONFIRMED'
    : order.order_status === 'CONFIRMED' ? 'PREPARING'
    : order.order_status === 'PREPARING' ? 'READY_FOR_PICKUP'
    : order.order_status === 'READY_FOR_PICKUP' ? 'COMPLETED' : null;
  const actionLabel = next === 'CONFIRMED' ? 'Accept order' : next === 'PREPARING' ? 'Start preparing' : next === 'READY_FOR_PICKUP' ? 'Mark ready' : 'Complete handover';
  const button = 'min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <article aria-label={`Order ${order.order_number}`} aria-busy={busy} className="flex min-w-0 flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-[#141414]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-all font-mono text-sm font-bold text-neutral-900 dark:text-neutral-100">{order.order_number}</h3>
          <p className="mt-1 text-micro text-neutral-500 dark:text-neutral-400">{new Date(order.created_at).toLocaleString()} {order.branches?.branch_name ? `· ${order.branches.branch_name}` : ''}</p>
        </div>
        <span className={cn('rounded-full border px-2.5 py-1 text-micro font-semibold', order.order_status === 'CANCELLED' ? 'border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300' : order.order_status === 'COMPLETED' ? 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300' : 'border-neutral-200 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300')}>{statusLabels[order.order_status]}</span>
      </div>
      {!terminal && <ol aria-label="Fulfillment progress" className="grid grid-cols-5 gap-1">
        {steps.map((status, index) => <li key={status} aria-current={index === currentStep ? 'step' : undefined} className="min-w-0">
          <div className={cn('mb-1 h-1 rounded-full', index <= currentStep ? 'bg-brand' : 'bg-neutral-200 dark:bg-neutral-800')} />
          <span className={cn('text-micro leading-tight', index === currentStep ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-500')}>{['Received', 'Accepted', 'Preparing', 'Ready', 'Collected'][index]}</span>
        </li>)}
      </ol>}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg bg-neutral-50 p-3 dark:bg-[#0F0F0F]">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-neutral-900 dark:text-neutral-100">{order.students?.english_name || order.customer_name}</p>
          {order.students?.current_belt && <p className="mt-1 text-micro text-neutral-500">{order.students.current_belt} belt</p>}
          {order.customer_phone && <a href={`tel:${order.customer_phone}`} className="mt-1 inline-block break-all text-xs text-neutral-600 underline-offset-2 hover:underline dark:text-neutral-400">{order.customer_phone}</a>}
        </div>
        <div className="text-right">
          <p className="font-mono text-base font-bold text-neutral-900 dark:text-neutral-100">${Number(order.total_usd).toFixed(2)}</p>
          <p className={cn('mt-1 text-micro font-semibold', paid ? 'text-emerald-700 dark:text-emerald-300' : order.payment_status === 'PENDING' ? 'text-amber-700 dark:text-amber-300' : 'text-neutral-500')}>{order.payment_status.replace(/_/g, ' ')}</p>
          <p className="mt-1 max-w-32 text-micro text-neutral-500">{order.payment_method}</p>
        </div>
      </div>
      <ul aria-label="Order items" className="space-y-2 text-xs">
        {order.items?.map(item => <li key={item.id} className="flex items-start justify-between gap-3">
          <span className="min-w-0 break-words text-neutral-700 dark:text-neutral-300"><span className="mr-1 font-mono font-semibold">{item.quantity}×</span> {item.product_name}<span className="mt-0.5 block text-micro text-neutral-500">{[item.color, item.size, item.sku].filter(Boolean).join(' · ')}</span></span>
          <span className="shrink-0 font-mono font-semibold">${Number(item.total_price_usd).toFixed(2)}</span>
        </li>)}
      </ul>
      {(order.student_notes || order.admin_notes) && <details className="rounded-lg border border-neutral-200 px-3 py-2 text-xs dark:border-neutral-800">
        <summary className="cursor-pointer font-semibold">Order notes</summary>
        {order.student_notes && <p className="mt-2 whitespace-pre-wrap break-words text-neutral-600 dark:text-neutral-400"><span className="font-semibold">Student: </span>{order.student_notes}</p>}
        {order.admin_notes && <p className="mt-2 whitespace-pre-wrap break-words text-neutral-600 dark:text-neutral-400"><span className="font-semibold">Staff: </span>{order.admin_notes}</p>}
      </details>}
      {order.order_status === 'CANCELLED' && order.cancellation_reason && <p className="break-words text-xs text-neutral-500">Reason: {order.cancellation_reason}</p>}
      <div className="mt-auto flex flex-wrap gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <button type="button" onClick={() => onPrint(order)} className={`${button} flex items-center gap-1.5 border-neutral-200 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800`}><Printer size={14} /> Packing slip</button>
        {!terminal && canCancel && <button type="button" disabled={busy} onClick={() => onDecision(order, 'cancel')} className={`${button} border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950`}>Cancel order</button>}
        {!terminal && order.order_status !== 'PENDING_CONFIRMATION' && order.payment_status === 'PENDING' && canManage && <button type="button" disabled={busy} onClick={() => onDecision(order, 'payment')} className={`${button} border-neutral-300 text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800`}>Record payment</button>}
        {next && allowed.includes(next) && canManage && <button type="button" disabled={busy || (next === 'COMPLETED' && !paid)} onClick={() => next === 'COMPLETED' ? onDecision(order, 'handover') : onAdvance(order, next)} className={`${button} ml-auto flex items-center justify-center gap-1.5 border-brand bg-brand text-white hover:bg-brand-strong`}><CheckCircle size={15} />{busy ? 'Saving…' : actionLabel}</button>}
        {next === 'COMPLETED' && !paid && <p className="w-full text-micro text-amber-700 dark:text-amber-300">Record verified payment before completing the handover.</p>}
      </div>
    </article>
  );
});
