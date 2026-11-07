'use client';

import { useState } from 'react';
import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Package } from '@phosphor-icons/react/dist/csr/Package';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { cn } from '@/lib/utils';
import type { StudentOrderRecord } from '@/lib/pos-types';
import { StudentOrderCard, type OrderAdvanceStatus, type OrderDecisionKind } from './StudentOrderCard';

export type OrderQueueFilter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
export type OrderQueueCounts = Record<OrderQueueFilter, number>;
const filters: OrderQueueFilter[] = ['ALL', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
const labels: Record<OrderQueueFilter, string> = { ALL: 'All', PENDING: 'Received', CONFIRMED: 'Accepted', PREPARING: 'Preparing', READY: 'Ready', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };

export function StudentOrdersPanel({ canCancelOrder, canCreateOrder, setOrdersFilter, ordersFilter, orderStatusCounts, ordersSearch, setOrdersSearch, fetchStudentOrders, isOrdersLoading, filteredStudentOrders, studentOrders, setPackingSlipOrder, busyOrderIds, onDecision, handleUpdateOrderStatus, feedback, onDismissFeedback }: {
  canCancelOrder: boolean;
  canCreateOrder: boolean;
  setOrdersFilter: (value: OrderQueueFilter) => void;
  ordersFilter: OrderQueueFilter;
  orderStatusCounts: OrderQueueCounts;
  ordersSearch: string;
  setOrdersSearch: (value: string) => void;
  fetchStudentOrders: () => Promise<void>;
  isOrdersLoading: boolean;
  filteredStudentOrders: StudentOrderRecord[];
  studentOrders: StudentOrderRecord[];
  setPackingSlipOrder: (order: StudentOrderRecord) => void;
  busyOrderIds: ReadonlySet<string>;
  onDecision: (order: StudentOrderRecord, kind: OrderDecisionKind) => void;
  handleUpdateOrderStatus: (order: StudentOrderRecord, status: OrderAdvanceStatus) => Promise<boolean>;
  feedback: { type: 'success' | 'error' | 'info'; message: string } | null;
  onDismissFeedback: () => void;
}) {
  const signature = ordersFilter + ':' + ordersSearch;
  const [page, setPage] = useState({ signature: '', limit: 24 });
  const limit = page.signature === signature ? page.limit : 24;
  const outstanding = studentOrders.filter(order => order.payment_status === 'PENDING' && !['COMPLETED', 'CANCELLED'].includes(order.order_status)).length;
  const reset = () => { setOrdersFilter('ALL'); setOrdersSearch(''); };
  return <section aria-label="Student order management" className="min-w-0 space-y-4">
    {feedback && <div role={feedback.type === 'error' ? 'alert' : 'status'} className={cn('flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-xs', feedback.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300')}><p className="self-center break-words leading-relaxed">{feedback.message}</p><button type="button" aria-label="Dismiss order update" onClick={onDismissFeedback} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"><X size={14} /></button></div>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[['Awaiting acceptance', orderStatusCounts.PENDING], ['In preparation', orderStatusCounts.CONFIRMED + orderStatusCounts.PREPARING], ['Ready for pickup', orderStatusCounts.READY], ['Payment to verify', outstanding]].map(([label, count]) => <div key={label} className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-[#141414]"><p className="text-[11px] text-neutral-500 dark:text-neutral-400">{label}</p><p className="mt-1 font-mono text-xl font-bold text-neutral-900 dark:text-neutral-100">{count}</p></div>)}
    </div>
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-[#141414]">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1"><MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-3.5 text-neutral-400" /><input aria-label="Search student orders" placeholder="Order number, student or phone" value={ordersSearch} onChange={event => setOrdersSearch(event.target.value)} className="min-h-11 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-11 text-sm outline-none focus:border-[#EF2F38] dark:border-neutral-700 dark:bg-[#0F0F0F]" />{ordersSearch && <button type="button" aria-label="Clear order search" onClick={() => setOrdersSearch('')} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-neutral-500"><X size={15} /></button>}</div>
        <button type="button" onClick={() => void fetchStudentOrders()} disabled={isOrdersLoading} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-neutral-200 px-4 text-xs font-semibold disabled:opacity-50 dark:border-neutral-700"><ArrowsClockwise size={16} className={isOrdersLoading ? 'motion-safe:animate-spin' : ''} />{isOrdersLoading ? 'Refreshing…' : 'Refresh orders'}</button>
      </div>
      <div role="group" aria-label="Order status" className="flex gap-1.5 overflow-x-auto pb-1">{filters.map(filter => <button key={filter} type="button" aria-pressed={ordersFilter === filter} onClick={() => setOrdersFilter(filter)} className={cn('flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs transition-colors', ordersFilter === filter ? 'border-[#EF2F38] bg-[#EF2F38] font-semibold text-white' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800')}>{labels[filter]}<span className={cn('rounded px-1.5 py-0.5 font-mono text-[10px]', ordersFilter === filter ? 'bg-white/20' : 'bg-neutral-100 dark:bg-neutral-800')}>{orderStatusCounts[filter]}</span></button>)}</div>
      <p className="text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">Acceptance, preparation and payment are tracked separately. Record payment only after checking the actual collection.</p>
    </div>
    {isOrdersLoading && !studentOrders.length ? <div role="status" className="rounded-xl border border-neutral-200 p-8 text-center text-sm text-neutral-500 dark:border-neutral-800">Loading student orders…</div> : !filteredStudentOrders.length ? <div className="flex flex-col items-center rounded-xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-[#141414]"><Package size={32} className="mb-3 text-neutral-400" /><h3 className="text-sm font-semibold">{studentOrders.length ? 'No matching orders' : 'No student orders yet'}</h3><p className="mt-2 max-w-sm text-xs leading-relaxed text-neutral-500">{studentOrders.length ? 'Try another status or search term.' : 'Student shop orders will appear here for acceptance, payment verification and pickup.'}</p>{(ordersSearch || ordersFilter !== 'ALL') && <button type="button" onClick={reset} className="mt-3 min-h-11 rounded-lg border border-neutral-200 px-4 text-xs font-semibold dark:border-neutral-700">Clear filters</button>}</div> : <>
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">{filteredStudentOrders.slice(0, limit).map(order => <StudentOrderCard key={order.id} order={order} busy={busyOrderIds.has(order.id)} canManage={canCreateOrder} canCancel={canCancelOrder} onAdvance={handleUpdateOrderStatus} onDecision={onDecision} onPrint={setPackingSlipOrder} />)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500"><p role="status">Showing {Math.min(limit, filteredStudentOrders.length)} of {filteredStudentOrders.length} matching orders</p>{filteredStudentOrders.length > limit && <button type="button" onClick={() => setPage({ signature, limit: limit + 24 })} className="min-h-11 rounded-lg border border-neutral-300 px-4 font-semibold text-neutral-800 dark:border-neutral-700 dark:text-neutral-200">Load more orders</button>}</div>
    </>}
  </section>;
}
