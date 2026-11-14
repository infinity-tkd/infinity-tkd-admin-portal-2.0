'use client';
import React from 'react';
import { cn } from '@/lib/utils';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Printer } from '@phosphor-icons/react/dist/csr/Printer';
import { X } from '@phosphor-icons/react/dist/csr/X';
import type { PosSaleTransaction } from '@/lib/pos-types';
import { isRefundableSale } from '@/lib/pos-reporting';


interface SalesHistoryPanelProps {
  onRefresh: () => Promise<void>;
  canCancelOrder: boolean;
  totalSalesRevenue: number;
  collectedSales: PosSaleTransaction[];
  totalItemsSold: number;
  averageOrderValue: number;
  setSalesPeriodFilter: React.Dispatch<React.SetStateAction<"ALL" | "TODAY" | "WEEK" | "MONTH">>;
  salesPeriodFilter: "ALL" | "TODAY" | "WEEK" | "MONTH";
  salesMethodFilter: "All" | "ABA Bank KHQR" | "Cash";
  setSalesMethodFilter: React.Dispatch<React.SetStateAction<"All" | "ABA Bank KHQR" | "Cash">>;
  salesSearch: string;
  setSalesSearch: React.Dispatch<React.SetStateAction<string>>;
  salesHistory: PosSaleTransaction[];
  filteredSales: PosSaleTransaction[];
  setCompletedTx: React.Dispatch<React.SetStateAction<PosSaleTransaction | null>>;
  handleVoidSale: (txId: string) => Promise<void>;
}

export function SalesHistoryPanel({ onRefresh, canCancelOrder, totalSalesRevenue, collectedSales, totalItemsSold, averageOrderValue, setSalesPeriodFilter, salesPeriodFilter, salesMethodFilter, setSalesMethodFilter, salesSearch, setSalesSearch, salesHistory, filteredSales, setCompletedTx, handleVoidSale }: SalesHistoryPanelProps) {
  return <>{(
        <div className="flex flex-col space-y-4 flex-1">

          {/* Summary Metric Cards with AOV */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 shadow-sm">
              <span className="text-micro font-mono font-bold uppercase text-neutral-500 dark:text-neutral-400">Recorded collections</span>
              <p className="text-lg sm:text-2xl font-black font-mono text-neutral-900 dark:text-white mt-1">
                ${totalSalesRevenue.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 shadow-sm">
              <span className="text-micro font-mono font-bold uppercase text-neutral-500 dark:text-neutral-400">Collected TX</span>
              <p className="text-lg sm:text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                {collectedSales.length}
              </p>
            </div>
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 shadow-sm">
              <span className="text-micro font-mono font-bold uppercase text-neutral-500 dark:text-neutral-400">Items Sold</span>
              <p className="text-lg sm:text-2xl font-black font-mono text-brand-ink mt-1">
                {totalItemsSold}
              </p>
            </div>
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 shadow-sm">
              <span className="text-micro font-mono font-bold uppercase text-neutral-500 dark:text-neutral-400">Avg Order (AOV)</span>
              <p className="text-lg sm:text-2xl font-black font-mono text-purple-700 dark:text-purple-400 mt-1">
                ${averageOrderValue.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Period Filter Pills, Method Filter & Search */}
          <div className="flex flex-col gap-2.5 sm:gap-3 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-3 sm:p-3.5 rounded-[8px] shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
              {/* Period Filter & Payment Method */}
              <div role="group" aria-label="Sales collection filters" className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {/* Period Filter Pills */}
                <div role="group" aria-label="Collection period" className="flex w-full sm:w-auto bg-neutral-100 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] p-0.5 min-h-11 items-center">
                  {(['ALL', 'TODAY', 'WEEK', 'MONTH'] as const).map(period => (
                    <button
                      key={period}
                      type="button"
                      aria-pressed={salesPeriodFilter === period}
                      onClick={() => setSalesPeriodFilter(period)}
                      className={cn(
                        "min-w-0 flex-1 sm:flex-initial px-1.5 sm:px-2.5 py-1 min-h-[38px] text-micro font-mono rounded-[6px] transition cursor-pointer whitespace-nowrap active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                        salesPeriodFilter === period
                          ? "bg-brand text-white font-bold shadow-sm"
                          : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      )}
                    >
                      {period === 'ALL' ? 'All Time' : period === 'TODAY' ? 'Today' : period === 'WEEK' ? 'This Week' : 'This Month'}
                    </button>
                  ))}
                </div>

                {/* Payment Method Filter */}
                <select
                  aria-label="Sales payment method"
                  value={salesMethodFilter}
                  onChange={e => setSalesMethodFilter(e.target.value as any)}
                  className="min-w-0 w-full sm:w-auto bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] px-3 py-1.5 min-h-11 focus:outline-none focus:border-brand font-mono cursor-pointer"
                >
                  <option value="All">All Payment Methods</option>
                  <option value="ABA Bank KHQR">ABA Bank KHQR</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              {/* Right Side: Search Input with Clear Button & Refresh */}
              <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
                <div className="relative flex-1 sm:w-64">
                  <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Search TX #, customer, item..."
                    value={salesSearch}
                    onChange={e => setSalesSearch(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-900 dark:text-[#E4E4E4] pl-8 pr-7 py-2 min-h-[38px] rounded-[8px] focus:outline-none focus:border-brand font-mono placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                  />
                  {salesSearch && (
                    <button aria-label="Clear search"
                      type="button"
                      onClick={() => setSalesSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer p-1.5 active:scale-90 touch-manipulation min-h-6 min-w-6 inline-flex items-center justify-center"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {salesHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void onRefresh()}
                    className="px-3 py-2 min-h-[38px] text-xs text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 rounded-[8px] font-mono border border-rose-300 dark:border-rose-500/20 cursor-pointer transition-colors whitespace-nowrap font-bold shrink-0 active:scale-95 touch-manipulation flex items-center justify-center pointer-coarse:min-h-11"
                  >
                    Refresh sales
                  </button>
                )}
              </div>
            </div>

            {/* Sub-bar: Showing Counter */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#262626] text-micro font-mono text-neutral-500 dark:text-neutral-400">
              <span>
                Showing <span className="font-bold text-neutral-900 dark:text-neutral-100">{filteredSales.length}</span> of {salesHistory.length} transactions
              </span>
              <span className="hidden sm:inline text-neutral-400 dark:text-neutral-600">
                Audited transactional ledger with payment method verification
              </span>
            </div>
          </div>

          {/* Desktop Sales History Table */}
          <div className="hidden md:block bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm flex-1">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[760px] text-left text-xs font-mono">
                <thead className="bg-neutral-50 dark:bg-[#0F0F0F] text-micro uppercase font-bold text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#262626]">
                  <tr>
                    <th className="py-3 px-4">TX ID</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Customer / Athlete</th>
                    <th className="py-3 px-4">Items Summary</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4 text-right">Grand Total</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-neutral-500 dark:text-neutral-400">
                        No sales transactions recorded matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map(tx => (
                      <tr key={tx.txId} className="hover:bg-neutral-50 dark:hover:bg-[#1a1a1a] transition-colors">
                        <td className="py-3 px-4 font-bold text-brand-ink">{tx.txId}<span className="mt-1 block text-micro font-normal text-neutral-500">{tx.paymentStatus || 'UNKNOWN'}</span></td>
                        <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">{tx.date}</td>
                        <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white">{tx.studentName}</td>
                        <td className="py-3 px-4 text-neutral-700 dark:text-neutral-300 max-w-xs truncate">
                          {tx.items.map(it => `${it.qty}x ${it.name}`).join(', ')}
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded-[6px] text-micro font-bold border",
                            tx.method === 'Cash'
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                              : "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/10 dark:text-brand-ink dark:border-red-500/20"
                          )}>
                            {tx.method}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-neutral-900 dark:text-white">
                          ${tx.total.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setCompletedTx(tx)}
                              title="Re-print Thermal Receipt"
                              className="p-1.5 bg-neutral-100 hover:bg-brand hover:text-white text-neutral-600 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-brand dark:hover:text-white dark:text-neutral-400 dark:border-[#262626] rounded-[6px] transition cursor-pointer"
                            >
                              <Printer size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleVoidSale(tx.txId)}
                              title={isRefundableSale(tx) ? 'Record verified refund' : 'Only paid sales can be refunded'}
                              aria-label={`Record refund for ${tx.txId}`}
                              className="p-1.5 bg-neutral-100 hover:bg-red-600 hover:text-white text-neutral-600 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-red-600 dark:hover:text-white dark:text-neutral-400 dark:border-[#262626] rounded-[6px] transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-neutral-100 disabled:hover:text-neutral-600" disabled={!canCancelOrder || !isRefundableSale(tx)}
                            >
                              <Trash size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Sales Cards View */}
          <div className="md:hidden space-y-3">
            {filteredSales.length === 0 ? (
              <div className="py-10 text-center text-xs font-mono text-neutral-500 dark:text-neutral-400 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                No sales transactions recorded matching criteria.
              </div>
            ) : (
              filteredSales.map(tx => (
                <div
                  key={tx.txId}
                  className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 shadow-sm space-y-2.5 font-mono"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-neutral-100 dark:border-[#202020] pb-2">
                    <div>
                      <span className="text-xs font-bold text-brand-ink">{tx.txId}</span>
                      <p className="text-micro text-neutral-500">{tx.paymentStatus || 'UNKNOWN'}</p>
                      <p className="text-micro text-neutral-500 dark:text-neutral-400 mt-0.5">{tx.date}</p>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-[6px] text-micro font-bold border",
                      tx.method === 'Cash'
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                        : "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/10 dark:text-brand-ink dark:border-red-500/20"
                    )}>
                      {tx.method}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs">
                    <div>
                      <span className="text-micro text-neutral-500 dark:text-neutral-400 block uppercase">Customer</span>
                      <span className="font-bold text-neutral-900 dark:text-white">{tx.studentName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-micro text-neutral-500 dark:text-neutral-400 block uppercase">Total</span>
                      <span className="text-sm font-black text-neutral-900 dark:text-white">${tx.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="text-micro text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-2 rounded-[6px]">
                    <span className="text-micro uppercase font-bold text-neutral-500 dark:text-neutral-400 block mb-0.5">Purchased Items:</span>
                    {tx.items.map(it => `${it.qty}x ${it.name}`).join(', ')}
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-neutral-100 dark:border-[#202020]">
                    <button
                      type="button"
                      onClick={() => setCompletedTx(tx)}
                      className="flex-1 py-2 min-h-[38px] bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-[#1a1a1a] dark:text-neutral-200 dark:border-[#262626] rounded-[8px] text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                    >
                      <Printer size={13} />
                      <span>Print Receipt</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVoidSale(tx.txId)}
                      aria-label={`Record refund for ${tx.txId}`}
                      className="px-3 py-2 min-h-[38px] bg-neutral-100 hover:bg-red-600 hover:text-white text-rose-700 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-red-600 dark:hover:text-white dark:text-rose-400 dark:border-[#262626] rounded-[8px] text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation pointer-coarse:min-h-11 disabled:cursor-not-allowed disabled:opacity-40" disabled={!canCancelOrder || !isRefundableSale(tx)}
                    >
                      <Trash size={13} />
                      <span>Refund</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}</>;
}
