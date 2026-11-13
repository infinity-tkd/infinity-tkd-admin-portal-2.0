'use client';
import React from 'react';
import { useAppStore, Student } from '@/lib/store';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { CaretUp } from '@phosphor-icons/react/dist/csr/CaretUp';
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { ArrowsDownUp } from '@phosphor-icons/react/dist/csr/ArrowsDownUp';
import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { cn } from '@/lib/utils';
import { SafeImage } from '@/components/SafeImage';
import type { Payment } from '@/lib/store';


interface TransactionsPanelProps {
  transactionStats: { count: number; paidCount: number; totalCollected: number; avgVal: number; maxVal: number; };
  searchTransactions: string;
  setSearchTransactions: React.Dispatch<React.SetStateAction<string>>;
  setTxnPage: React.Dispatch<React.SetStateAction<number>>;
  filterTransactionBranch: number | "all";
  setFilterTransactionBranch: React.Dispatch<React.SetStateAction<number | "all">>;
  state: ReturnType<typeof useAppStore>['state'];
  filterTransactionYear: number | "all";
  setFilterTransactionYear: React.Dispatch<React.SetStateAction<number | "all">>;
  currentActualYear: number;
  filterTransactionMonth: string;
  setFilterTransactionMonth: React.Dispatch<React.SetStateAction<string>>;
  months: string[];
  setFilterTransactionStatus: React.Dispatch<React.SetStateAction<"Paid" | "Unpaid" | "Pending" | "all">>;
  setTxnSortField: React.Dispatch<React.SetStateAction<"student" | "branch" | "cycle" | "refId" | "amount" | null>>;
  setTxnSortDirection: React.Dispatch<React.SetStateAction<"desc" | "asc">>;
  exportTransactionsToCsv: () => void;
  paginatedTransactions: Payment[];
  handleCopyTxnId: (idStr: string) => void;
  copiedTxnId: string | null;
  setShowReceipt: React.Dispatch<React.SetStateAction<{ student: Student; month: string; year: number; amount: number; } | null>>;
  handleTxnSort: (field: "student" | "branch" | "cycle" | "refId" | "amount") => void;
  txnSortField: "student" | "branch" | "cycle" | "refId" | "amount" | null;
  txnSortDirection: "desc" | "asc";
  filteredTransactionsList: Payment[];
  txnPage: number;
  txnPerPage: number;
  setTxnPerPage: React.Dispatch<React.SetStateAction<number>>;
  totalTxnPages: number;
}

export function TransactionsPanel({ transactionStats, searchTransactions, setSearchTransactions, setTxnPage, filterTransactionBranch, setFilterTransactionBranch, state, filterTransactionYear, setFilterTransactionYear, currentActualYear, filterTransactionMonth, setFilterTransactionMonth, months, setFilterTransactionStatus, setTxnSortField, setTxnSortDirection, exportTransactionsToCsv, paginatedTransactions, handleCopyTxnId, copiedTxnId, setShowReceipt, handleTxnSort, txnSortField, txnSortDirection, filteredTransactionsList, txnPage, txnPerPage, setTxnPerPage, totalTxnPages }: TransactionsPanelProps) {
  return <>{(
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
          {/* Quick Analytics Summary Box (2x2 on Mobile, 4x1 on Desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm flex flex-col justify-between group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
              <div>
                <p className="text-[9px] sm:text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold tracking-widest mb-1 truncate">Realized Income</p>
                <h2 className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold">${transactionStats.totalCollected.toFixed(2)}</h2>
              </div>
              <p className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-2 sm:mt-3 border-t border-neutral-200 dark:border-[#262626] pt-2 truncate">
                Confirmed collections
              </p>
            </div>

            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm flex flex-col justify-between group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
              <div>
                <p className="text-[9px] sm:text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-bold tracking-widest mb-1 truncate">Transactions</p>
                <h2 className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold">{transactionStats.count}</h2>
              </div>
              <p className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-2 sm:mt-3 border-t border-neutral-200 dark:border-[#262626] pt-2 truncate">
                {transactionStats.paidCount} settlements
              </p>
            </div>

            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm flex flex-col justify-between group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
              <div>
                <p className="text-[9px] sm:text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold tracking-widest mb-1 truncate">Avg Ticket</p>
                <h2 className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold">${transactionStats.avgVal.toFixed(2)}</h2>
              </div>
              <p className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-2 sm:mt-3 border-t border-neutral-200 dark:border-[#262626] pt-2 truncate">
                Avg per receipt
              </p>
            </div>

            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm flex flex-col justify-between group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
              <div>
                <p className="text-[9px] sm:text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold tracking-widest mb-1 truncate">Peak Payment</p>
                <h2 className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold">${transactionStats.maxVal.toFixed(2)}</h2>
              </div>
              <p className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-2 sm:mt-3 border-t border-neutral-200 dark:border-[#262626] pt-2 truncate">
                Highest payment
              </p>
            </div>
          </div>

          {/* Filtering & Export Controls */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 shadow-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 items-center">
              <div className="relative col-span-2">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500"/>
                <input
                  type="text"
                  placeholder="Search name, ID, or Ref ID..."
                  value={searchTransactions}
                  onChange={(e) => {
                    setSearchTransactions(e.target.value);
                    setTxnPage(1);
                  }}
                  className="w-full pl-9 pr-8 h-10 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[6px] text-xs focus:outline-none focus:border-brand transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                />
                {searchTransactions && (
                  <button onClick={() => setSearchTransactions('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={filterTransactionBranch}
                onChange={(e) => {
                  setFilterTransactionBranch(e.target.value === 'all' ? 'all' : Number(e.target.value));
                  setTxnPage(1);
                }}
                className="bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs px-2.5 h-10 focus:outline-none focus:border-brand cursor-pointer"
              >
                <option value="all">All Branches</option>
                {state.branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              <select
                value={filterTransactionYear}
                onChange={(e) => {
                  setFilterTransactionYear(e.target.value === 'all' ? 'all' : Number(e.target.value));
                  setTxnPage(1);
                }}
                className="bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs px-2.5 h-10 focus:outline-none focus:border-brand cursor-pointer"
              >
                <option value="all">All Years</option>
                <option value={currentActualYear}>{currentActualYear}</option>
                <option value={currentActualYear - 1}>{currentActualYear - 1}</option>
                <option value={currentActualYear - 2}>{currentActualYear - 2}</option>
              </select>

              <select
                value={filterTransactionMonth}
                onChange={(e) => {
                  setFilterTransactionMonth(e.target.value);
                  setTxnPage(1);
                }}
                className="bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs px-2.5 h-10 focus:outline-none focus:border-brand cursor-pointer"
              >
                <option value="all">All Months</option>
                {months.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              <div className="col-span-2 sm:col-span-1 flex gap-2">
                <button
                  onClick={() => {
                    setSearchTransactions('');
                    setFilterTransactionBranch('all');
                    setFilterTransactionYear('all');
                    setFilterTransactionMonth('all');
                    setFilterTransactionStatus('all');
                    setTxnSortField(null);
                    setTxnSortDirection('asc');
                    setTxnPage(1);
                  }}
                  className="px-3 h-10 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-[#CCC] hover:text-neutral-900 dark:hover:text-white rounded-[6px] text-xs font-bold transition-all uppercase tracking-wider cursor-pointer active:scale-95 touch-manipulation"
                >
                  Reset
                </button>

                <button
                  onClick={exportTransactionsToCsv}
                  className="flex-1 px-3 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-bold transition-all uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-95 touch-manipulation"
                  title="Export filtered transactions to CSV"
                >
                  <DownloadSimple className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Transactions List: Mobile Cards (md:hidden) */}
          <div className="md:hidden space-y-2.5">
            {paginatedTransactions.length === 0 ? (
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-8 text-center text-neutral-500 dark:text-neutral-400">
                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40 text-neutral-400" />
                <p className="font-bold uppercase tracking-widest text-neutral-800 dark:text-[#E4E4E4] text-xs mb-1">No transaction records</p>
                <p className="font-mono text-[10px]">No payments match the active filter</p>
              </div>
            ) : (
              paginatedTransactions.map(p => {
                const student = state.students.find(s => s.id === p.studentId);
                if (!student) return null;
                const branchName = state.branches.find(b => b.id === student.homeBranchId)?.name || 'Central Dojang';

                const refId = `TXN-PAY-${p.id}`;

                return (
                  <div key={p.id} className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 shadow-sm space-y-2.5">
                    {/* Top row: Avatar, Name, Amount */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <SafeImage
                          src={student.profilePicturePath}
                          alt={student.englishName}
                          containerClassName="w-9 h-9 rounded-full bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0"
                          fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-[10px]">{student.englishName.charAt(0)}</span>}
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-neutral-900 dark:text-white flex items-center gap-1.5 truncate">
                            <span className="truncate">{student.englishName}</span>
                            {student.khmerName && (
                              <span className="text-[10px] font-khmer text-neutral-500 dark:text-neutral-400 font-normal shrink-0">
                                {student.khmerName}
                              </span>
                            )}
                          </div>
                          <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5 truncate">
                            ID: {student.id} • {branchName}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold text-base block">
                          +${(p.amountUsd || 0).toFixed(2)}
                        </span>
                        <span className="text-[9px] font-mono text-neutral-500 dark:text-neutral-400">
                          {p.month} {p.year}
                        </span>
                      </div>
                    </div>

                    {/* Middle row: Ref ID & Status */}
                    <div className="flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-[#202020] text-xs">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
                        <span>{refId}</span>
                        <button
                          onClick={() => handleCopyTxnId(refId)}
                          title="Copy Transaction ID"
                          className="p-1 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                        >
                          {copiedTxnId === refId ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-white" />
                          )}
                        </button>
                      </div>

                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-mono font-bold text-[9px] uppercase tracking-wider",
                        p.status === 'Paid'
                          ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                      )}>
                        {p.status === 'Paid' ? <Check className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                        {p.status}
                      </span>
                    </div>

                    {/* Action: Receipt */}
                    <button
                      onClick={() => setShowReceipt({
                        student,
                        month: p.month,
                        year: p.year,
                        amount: p.amountUsd || 0
                      })}
                      className="w-full py-1.5 px-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#222] border border-neutral-200 dark:border-[#333] text-neutral-800 dark:text-[#E4E4E4] rounded-[6px] text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 touch-manipulation"
                    >
                      <Receipt className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400"/>
                      <span>View E-Receipt</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Transactions Ledger: Tablet & Desktop Dense Table (hidden md:block) */}
          <div className="hidden md:block bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs whitespace-nowrap border-collapse min-w-[750px]">
                <thead className="bg-neutral-50 dark:bg-[#0F0F0F] text-neutral-600 dark:text-neutral-400 uppercase tracking-widest font-bold border-b border-neutral-200 dark:border-[#262626] text-[10px]">
                  <tr>
                    <th
                      className="px-5 py-3.5 min-w-[220px] cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#161616] transition-colors group/th select-none"
                      onClick={() => handleTxnSort('student')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Student / ID</span>
                        {txnSortField === 'student' ? (
                          txnSortDirection === 'asc' ? <CaretUp className="w-3.5 h-3.5 text-brand-ink" /> : <CaretDown className="w-3.5 h-3.5 text-brand-ink" />
                        ) : (
                          <ArrowsDownUp className="w-3 h-3 text-neutral-400 dark:text-[#666] opacity-35 group-hover/th:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3.5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#161616] transition-colors group/th select-none"
                      onClick={() => handleTxnSort('branch')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Branch Facility</span>
                        {txnSortField === 'branch' ? (
                          txnSortDirection === 'asc' ? <CaretUp className="w-3.5 h-3.5 text-brand-ink" /> : <CaretDown className="w-3.5 h-3.5 text-brand-ink" />
                        ) : (
                          <ArrowsDownUp className="w-3 h-3 text-neutral-400 dark:text-[#666] opacity-35 group-hover/th:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3.5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#161616] transition-colors group/th select-none"
                      onClick={() => handleTxnSort('cycle')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Billing Cycle</span>
                        {txnSortField === 'cycle' ? (
                          txnSortDirection === 'asc' ? <CaretUp className="w-3.5 h-3.5 text-brand-ink" /> : <CaretDown className="w-3.5 h-3.5 text-brand-ink" />
                        ) : (
                          <ArrowsDownUp className="w-3 h-3 text-neutral-400 dark:text-[#666] opacity-35 group-hover/th:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3.5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#161616] transition-colors group/th select-none"
                      onClick={() => handleTxnSort('refId')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Reference ID</span>
                        {txnSortField === 'refId' ? (
                          txnSortDirection === 'asc' ? <CaretUp className="w-3.5 h-3.5 text-brand-ink" /> : <CaretDown className="w-3.5 h-3.5 text-brand-ink" />
                        ) : (
                          <ArrowsDownUp className="w-3 h-3 text-neutral-400 dark:text-[#666] opacity-35 group-hover/th:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th
                      className="px-4 py-3.5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#161616] transition-colors group/th select-none text-right"
                      onClick={() => handleTxnSort('amount')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Amount</span>
                        {txnSortField === 'amount' ? (
                          txnSortDirection === 'asc' ? <CaretUp className="w-3.5 h-3.5 text-brand-ink" /> : <CaretDown className="w-3.5 h-3.5 text-brand-ink" />
                        ) : (
                          <ArrowsDownUp className="w-3 h-3 text-neutral-400 dark:text-[#666] opacity-35 group-hover/th:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                  {paginatedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center text-neutral-500 dark:text-neutral-400">
                         <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40 text-neutral-400" />
                         <p className="font-bold uppercase tracking-widest text-neutral-800 dark:text-[#E4E4E4] text-xs mb-1">No transaction records found</p>
                         <p className="font-mono text-[10px]">No payments match the active filter criteria</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedTransactions.map(p => {
                      const student = state.students.find(s => s.id === p.studentId);
                      if (!student) return null;
                      const branchName = state.branches.find(b => b.id === student.homeBranchId)?.name || 'Central Dojang';
                      const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);
                      const refId = `TXN-PAY-${p.id}`;

                      return (
                        <tr key={p.id} className="hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors text-neutral-800 dark:text-[#E4E4E4] group">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <SafeImage
                                src={student.profilePicturePath}
                                alt={student.englishName}
                                containerClassName="w-8 h-8 rounded-full bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 group-hover:border-brand transition-colors"
                                fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-[10px]">{student.englishName.charAt(0)}</span>}
                              />
                              <div>
                                <div className="font-bold text-xs text-neutral-900 dark:text-white flex items-center gap-1.5 group-hover:text-brand-ink dark:group-hover:text-white transition-colors">
                                  {student.englishName}
                                  {student.khmerName && (
                                    <span className="text-[10px] font-khmer text-neutral-500 dark:text-neutral-400 font-normal">
                                      {student.khmerName}
                                    </span>
                                  )}
                                  {scholarship && scholarship.discountPercentage > 0 && (
                                    <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-bold uppercase text-[9px] border border-indigo-500/20">
                                      {scholarship.typeName}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                                  ID: {student.id}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-neutral-600 dark:text-neutral-300">
                            {branchName}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-[10px] font-bold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] px-2.5 py-1 rounded-[6px] font-mono">
                              {p.month} {p.year}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[10px]">
                            <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                              <span>{refId}</span>
                              <button
                                onClick={() => handleCopyTxnId(refId)}
                                title="Copy Transaction ID"
                                className="p-0.5 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                              >
                                {copiedTxnId === refId ? (
                                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-white" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-mono font-bold text-[9px] uppercase tracking-wider",
                              p.status === 'Paid'
                                ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                                : "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                            )}>
                              {p.status === 'Paid' ? <Check className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                            ${(p.amountUsd || 0).toFixed(2)}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => setShowReceipt({
                                student,
                                month: p.month,
                                year: p.year,
                                amount: p.amountUsd || 0
                              })}
                              className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] border border-neutral-200 dark:border-[#333] hover:border-neutral-300 dark:hover:border-[#444] text-neutral-800 dark:text-[#E4E4E4] hover:text-neutral-900 dark:hover:text-white rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ml-auto cursor-pointer shadow-xs active:scale-95 touch-manipulation"
                            >
                              <Receipt className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400"/>
                              <span>Receipt</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls (Responsive) */}
          {filteredTransactionsList.length > 0 && (
            <div className="p-3 border border-neutral-200 dark:border-[#262626] rounded-[8px] bg-white dark:bg-[#141414] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 font-mono text-[10px]">
                <span>
                  Showing {Math.min((txnPage - 1) * txnPerPage + 1, filteredTransactionsList.length)}–{Math.min(txnPage * txnPerPage, filteredTransactionsList.length)} of {filteredTransactionsList.length} transactions
                </span>
                <span className="opacity-40">•</span>
                <span>Per page:</span>
                <select
                  value={txnPerPage}
                  onChange={(e) => {
                    setTxnPerPage(Number(e.target.value));
                    setTxnPage(1);
                  }}
                  className="min-h-8 pointer-coarse:min-h-9 bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded px-1.5 py-0.5 text-neutral-900 dark:text-white font-mono cursor-pointer"
                >
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setTxnPage(p => Math.max(1, p - 1))}
                  disabled={txnPage <= 1}
                  className="px-3 py-1.5 rounded-[6px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#222] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 min-h-[34px] pointer-coarse:min-h-11"
                >
                  <CaretLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>

                <span className="px-2 font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
                  Page <strong className="text-neutral-900 dark:text-white">{txnPage}</strong> of {totalTxnPages}
                </span>

                <button
                  onClick={() => setTxnPage(p => Math.min(totalTxnPages, p + 1))}
                  disabled={txnPage >= totalTxnPages}
                  className="px-3 py-1.5 rounded-[6px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#222] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 min-h-[34px] pointer-coarse:min-h-11"
                >
                  <span>Next</span>
                  <CaretRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}</>;
}
