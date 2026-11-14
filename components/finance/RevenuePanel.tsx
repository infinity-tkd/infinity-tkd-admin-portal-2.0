'use client';
import React from 'react';
import { useAppStore, Student } from '@/lib/store';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { ChartLine } from '@phosphor-icons/react/dist/csr/ChartLine';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { PhoneCall } from '@phosphor-icons/react/dist/csr/PhoneCall';
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { Coins } from '@phosphor-icons/react/dist/csr/Coins';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { TrendUp } from '@phosphor-icons/react/dist/csr/TrendUp';
import { ArrowClockwise } from '@phosphor-icons/react/dist/csr/ArrowClockwise';
import { cn, formatBelt } from '@/lib/utils';
import { SafeImage } from '@/components/SafeImage';
import type { Branch, Scholarship } from '@/lib/store';


interface RevenuePanelProps {
  filterYear: number;
  setFilterYear: React.Dispatch<React.SetStateAction<number>>;
  currentActualYear: number;
  filterMonth: string;
  setFilterMonth: React.Dispatch<React.SetStateAction<string>>;
  months: string[];
  filterBranch: number | "all";
  setFilterBranch: React.Dispatch<React.SetStateAction<number | "all">>;
  state: ReturnType<typeof useAppStore>['state'];
  filterScholarship: number | "all";
  setFilterScholarship: React.Dispatch<React.SetStateAction<number | "all">>;
  collectionRate: number;
  totalExpected: number;
  totalScholarshipDiscounts: number;
  totalCollected: number;
  outstandingBalance: number;
  agingReceivables: { student: Student; expected: number; discount: number; collected: number; owed: number; overdueMonths: string[]; branchName: string; scholarshipName: string; }[];
  peakRevenueMonth: { month: string; expected: number; collected: number; owed: number; discounts: number; rate: number; isPastOrCurrent: boolean; } | null;
  monthlyRevenueTrajectory: { month: string; expected: number; collected: number; owed: number; discounts: number; rate: number; isPastOrCurrent: boolean; }[];
  currentActualMonthIndex: number;
  filteredAgingReceivables: { student: Student; expected: number; discount: number; collected: number; owed: number; overdueMonths: string[]; branchName: string; scholarshipName: string; }[];
  totalAgingOwed: number;
  agingSearch: string;
  setAgingSearch: React.Dispatch<React.SetStateAction<string>>;
  setAgingSeverityFilter: React.Dispatch<React.SetStateAction<"all" | "1m" | "2m_plus">>;
  agingSeverityFilter: "all" | "1m" | "2m_plus";
  setStudentDetailsId: React.Dispatch<React.SetStateAction<string | null>>;
  setPaymentAmounts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  branchFinancials: { branch: Branch; collected: number; expected: number; outstanding: number; owed: number; discount: number; rate: number; studentCount: number; }[];
  scholarshipFinancialImpacts: { scholarship: Scholarship; studentCount: number; discountPct: number; monthlyTotalWaived: number; annualProjectedWaived: number; }[];
}

export function RevenuePanel({ filterYear, setFilterYear, currentActualYear, filterMonth, setFilterMonth, months, filterBranch, setFilterBranch, state, filterScholarship, setFilterScholarship, collectionRate, totalExpected, totalScholarshipDiscounts, totalCollected, outstandingBalance, agingReceivables, peakRevenueMonth, monthlyRevenueTrajectory, currentActualMonthIndex, filteredAgingReceivables, totalAgingOwed, agingSearch, setAgingSearch, setAgingSeverityFilter, agingSeverityFilter, setStudentDetailsId, setPaymentAmounts, branchFinancials, scholarshipFinancialImpacts }: RevenuePanelProps) {
  return <>{(
        <div className="space-y-4 sm:space-y-6">
          {/* Header & Integrated Filter Bar */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4 shadow-sm">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-900 dark:text-white flex items-center gap-2">
                <ChartLine className="w-4 h-4 text-brand-ink" />
                Revenue & Receivable Analytics
              </h2>
              <p className="text-micro text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                Realized tuition yield, facility-level performance, and overdue receivable tracking
              </p>
            </div>

            {/* Quick Filter Capsule Controls (Responsive Grid on Mobile) */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
              <select aria-label="Revenue year"
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className="h-9 px-3 bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs font-mono font-bold focus:outline-none focus:border-brand cursor-pointer"
              >
                <option value={currentActualYear}>{currentActualYear}</option>
                <option value={currentActualYear - 1}>{currentActualYear - 1}</option>
                <option value={currentActualYear - 2}>{currentActualYear - 2}</option>
              </select>

              <select aria-label="Revenue month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="h-9 px-3 bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs focus:outline-none focus:border-brand cursor-pointer"
              >
                <option value="all">All Months</option>
                {months.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              <select aria-label="Revenue branch"
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="h-9 px-3 bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs focus:outline-none focus:border-brand cursor-pointer"
              >
                <option value="all">All Branches</option>
                {state.branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              <select aria-label="Revenue plan"
                value={filterScholarship}
                onChange={(e) => setFilterScholarship(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="h-9 px-3 bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs focus:outline-none focus:border-brand cursor-pointer"
              >
                <option value="all">All Plans</option>
                {state.scholarships.map(s => (
                  <option key={s.id} value={s.id}>{s.typeName}</option>
                ))}
              </select>

              <button
                onClick={() => {
                  setFilterYear(currentActualYear);
                  setFilterMonth('all');
                  setFilterBranch('all');
                  setFilterScholarship('all');
                }}
                className="col-span-2 sm:col-span-1 h-9 px-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation"
                title="Reset active revenue filters"
              >
                <ArrowClockwise className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>

          {/* 4 KPI Summary Cards (2x2 on Mobile, 4x1 on Desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
             <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm">
               <p className="text-micro sm:text-micro text-neutral-600 dark:text-neutral-400 uppercase font-bold tracking-widest mb-1 truncate">Collection Rate</p>
               <h2 className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold">{collectionRate}%</h2>
               <div className="h-1.5 w-full bg-neutral-100 dark:bg-[#0F0F0F] rounded-full mt-2.5 sm:mt-3 overflow-hidden border border-neutral-200 dark:border-[#262626]/40">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      collectionRate >= 80 ? "bg-emerald-500" : collectionRate >= 60 ? "bg-amber-500" : "bg-rose-500"
                    )}
                    style={{ width: `${Math.min(collectionRate, 100)}%` }}
                  />
               </div>
               <p className="text-micro text-neutral-500 dark:text-neutral-400 mt-2 font-mono uppercase tracking-tight truncate">
                 ${(totalExpected - totalScholarshipDiscounts).toFixed(0)} Net Due
               </p>
             </div>

             <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm">
               <p className="text-micro sm:text-micro text-neutral-600 dark:text-neutral-400 uppercase font-bold tracking-widest mb-1 truncate">Realized Revenue</p>
               <h2 className="text-xl sm:text-2xl font-mono text-emerald-700 dark:text-emerald-400 font-bold">${totalCollected.toFixed(2)}</h2>
               <p className="text-micro text-neutral-500 dark:text-neutral-400 mt-2 font-mono uppercase tracking-tight truncate">Confirmed tuition yield</p>
             </div>

             <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm">
               <p className="text-micro sm:text-micro text-neutral-600 dark:text-neutral-400 uppercase font-bold tracking-widest mb-1 truncate">Outstanding Dues</p>
               <h2 className="text-xl sm:text-2xl font-mono text-rose-700 dark:text-rose-400 font-bold">${outstandingBalance.toFixed(2)}</h2>
               <p className="text-micro text-neutral-500 dark:text-neutral-400 mt-2 font-mono uppercase tracking-tight truncate">{agingReceivables.length} accounts overdue</p>
             </div>

             <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm">
               <p className="text-micro sm:text-micro text-neutral-600 dark:text-neutral-400 uppercase font-bold tracking-widest mb-1 truncate">Subsidies</p>
               <h2 className="text-xl sm:text-2xl font-mono text-indigo-600 dark:text-indigo-400 font-bold">${totalScholarshipDiscounts.toFixed(2)}</h2>
               <p className="text-micro text-neutral-500 dark:text-neutral-400 mt-2 font-mono uppercase tracking-tight truncate">Academy waivers</p>
             </div>
          </div>

          {/* 12-Month Revenue & Collection Trajectory (Responsive rail on Mobile, 12-col on Desktop) */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 dark:border-[#262626] pb-3">
              <div>
                <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <TrendUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Monthly Tuition Trajectory & Velocity ({filterYear})
                </h3>
                <p className="text-micro text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                  12-month receipt velocity comparing collected revenue against net billing obligations
                </p>
              </div>

              {peakRevenueMonth && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-micro font-mono font-bold shrink-0 self-start sm:self-auto">
                  <Sparkle className="w-3.5 h-3.5 text-amber-500" weight="fill" />
                  Peak: {peakRevenueMonth.month} (${peakRevenueMonth.collected.toFixed(0)})
                </div>
              )}
            </div>

            {/* Trajectory Rail: Swipeable on mobile, 4-col on tablet, 12-col on desktop */}
            <div className="flex sm:grid sm:grid-cols-4 lg:grid-cols-12 overflow-x-auto sm:overflow-visible no-scrollbar scrollbar-none gap-2 pt-1 pb-1 snap-x">
              {monthlyRevenueTrajectory.map(item => {
                const isCurrentMonth = filterYear === currentActualYear && item.month === months[currentActualMonthIndex];
                return (
                  <div
                    key={item.month}
                    className={cn(
                      "p-2.5 rounded-[8px] border flex flex-col justify-between transition-all min-w-[76px] sm:min-w-0 shrink-0 snap-start",
                      isCurrentMonth
                        ? "bg-neutral-50 dark:bg-[#1C1C1C] border-brand/40 ring-1 ring-brand/20 shadow-sm"
                        : "bg-neutral-50/50 dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626]"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn("text-xs font-mono font-bold", isCurrentMonth ? "text-brand-ink" : "text-neutral-900 dark:text-neutral-100")}>
                        {item.month}
                      </span>
                      <span className={cn(
                        "text-micro font-mono font-bold px-1 py-0.2 rounded",
                        item.rate >= 80 ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" :
                        item.rate >= 50 ? "bg-amber-500/10 text-amber-800 dark:text-amber-300" :
                        item.expected === 0 ? "text-neutral-400" : "bg-rose-500/10 text-rose-800 dark:text-rose-300"
                      )}>
                        {item.expected > 0 ? `${item.rate}%` : '-'}
                      </span>
                    </div>

                    <div className="w-full bg-neutral-200 dark:bg-[#1F1F1F] rounded h-11 sm:h-12 overflow-hidden flex flex-col justify-end p-0.5 mb-2 border border-neutral-200 dark:border-[#262626]">
                      <div
                        className={cn(
                          "w-full rounded-sm transition-all duration-300",
                          item.rate >= 80 ? "bg-emerald-500" : item.rate >= 50 ? "bg-amber-500" : "bg-rose-500"
                        )}
                        style={{ height: `${Math.min(100, Math.max(8, item.rate))}%` }}
                        title={`${item.month}: ${item.collected.toFixed(2)} / ${item.expected.toFixed(2)} (${item.rate}%)`}
                      />
                    </div>

                    <div className="space-y-0.5 text-micro font-mono">
                      <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                        <span>Rec:</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">${item.collected.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between text-neutral-500 dark:text-neutral-500">
                        <span>Due:</span>
                        <span>${item.expected.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left: Aging Receivables (Responsive Mobile Cards + Desktop Table) */}
            <div className="lg:col-span-2 space-y-4 min-w-0">
              <div className="bg-white dark:bg-[#141414] border border-rose-500/30 rounded-[8px] overflow-hidden shadow-sm">
                <div className="p-3.5 sm:p-4 border-b border-rose-500/20 bg-rose-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                   <div>
                     <h3 className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-widest flex items-center gap-2">
                       <Warning className="w-4 h-4"/>
                       Aging Receivables & Delinquent Dues
                     </h3>
                     <p className="text-micro text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                       Actionable accounts requiring tuition collection follow-up
                     </p>
                   </div>
                   <div className="flex items-center gap-1.5 sm:gap-2">
                     <span className="text-micro sm:text-micro bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 font-bold px-2 py-0.5 rounded-[6px] font-mono uppercase tracking-wider">
                       {filteredAgingReceivables.length} Overdue
                     </span>
                     <span className="text-micro sm:text-micro bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 font-bold px-2 py-0.5 rounded-[6px] font-mono">
                       ${totalAgingOwed.toFixed(2)}
                     </span>
                   </div>
                </div>

                {/* Aging Search & Severity Filters */}
                <div className="p-3 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex flex-col sm:flex-row gap-2.5 items-center justify-between">
                  <div className="relative w-full sm:w-64">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Search overdue student..."
                      value={agingSearch}
                      onChange={(e) => setAgingSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-brand"
                    />
                    {agingSearch && (
                      <button aria-label="Clear search" onClick={() => setAgingSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white min-h-6 min-w-6 inline-flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar pb-0.5">
                    <button
                      onClick={() => setAgingSeverityFilter('all')}
                      className={cn(
                        "px-2.5 py-1 rounded-[6px] text-micro font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 min-h-[30px] pointer-coarse:min-h-11",
                        agingSeverityFilter === 'all'
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-black shadow-xs"
                          : "bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                      )}
                    >
                      All ({agingReceivables.length})
                    </button>
                    <button
                      onClick={() => setAgingSeverityFilter('1m')}
                      className={cn(
                        "px-2.5 py-1 rounded-[6px] text-micro font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 min-h-[30px] pointer-coarse:min-h-11",
                        agingSeverityFilter === '1m'
                          ? "bg-amber-500 text-white font-black shadow-xs"
                          : "bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                      )}
                    >
                      1 Month ({agingReceivables.filter(a => a.overdueMonths.length === 1).length})
                    </button>
                    <button
                      onClick={() => setAgingSeverityFilter('2m_plus')}
                      className={cn(
                        "px-2.5 py-1 rounded-[6px] text-micro font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 min-h-[30px] pointer-coarse:min-h-11",
                        agingSeverityFilter === '2m_plus'
                          ? "bg-rose-600 text-white font-black shadow-xs"
                          : "bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-rose-700 dark:text-rose-400 hover:bg-rose-500/10"
                      )}
                    >
                      2+ Months ({agingReceivables.filter(a => a.overdueMonths.length >= 2).length})
                    </button>
                  </div>
                </div>

                {/* Mobile View: Delinquent Cards (md:hidden) */}
                <div className="md:hidden divide-y divide-neutral-200 dark:divide-[#262626]">
                  {filteredAgingReceivables.length === 0 ? (
                    <div className="p-8 text-center text-neutral-500 dark:text-neutral-400 font-mono">
                      <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">No overdue accounts!</p>
                      <p className="text-micro mt-0.5">All student accounts are currently settled.</p>
                    </div>
                  ) : (
                    filteredAgingReceivables.map(ar => {
                      const phone = ar.student.emergencyContactPhone || ar.student.phone;
                      return (
                        <div key={ar.student.id} className="p-3.5 space-y-2.5 bg-white dark:bg-[#141414]">
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <SafeImage
                                src={ar.student.profilePicturePath}
                                alt={ar.student.englishName}
                                containerClassName="w-9 h-9 rounded-full bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0"
                                fallback={<span className="font-bold text-neutral-500 dark:text-neutral-400 text-xs">{ar.student.englishName.charAt(0)}</span>}
                              />
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-neutral-900 dark:text-white flex items-center gap-1.5 truncate">
                                  <span className="truncate">{ar.student.englishName}</span>
                                  {ar.student.khmerName && (
                                    <span className="text-micro font-khmer text-neutral-500 dark:text-neutral-400 font-normal shrink-0">
                                      {ar.student.khmerName}
                                    </span>
                                  )}
                                </div>
                                <p className="text-micro text-neutral-500 dark:text-neutral-400 font-mono mt-0.5 truncate">
                                  {ar.student.id} • {ar.branchName}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-mono font-bold text-rose-700 dark:text-rose-400 text-sm block">
                                ${ar.owed.toFixed(2)}
                              </span>
                              <span className="text-micro text-neutral-500 dark:text-neutral-400 font-mono">
                                Total Owed
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            <span className="text-micro uppercase font-mono font-bold text-neutral-500 dark:text-neutral-400 mr-1">
                              Cycles:
                            </span>
                            {ar.overdueMonths.map(om => (
                              <span key={om} className="px-1.5 py-0.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25 rounded text-micro font-mono font-bold">
                                {om}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-2 pt-1 border-t border-neutral-100 dark:border-[#202020]">
                            {phone ? (
                              <a
                                href={`tel:${phone}`}
                                className="flex-1 py-1.5 px-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#222] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center justify-center gap-1 active:scale-95 touch-manipulation"
                              >
                                <PhoneCall className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Call Parent</span>
                              </a>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => { setStudentDetailsId(ar.student.id); setPaymentAmounts({}); }}
                              className="flex-1 py-1.5 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 shadow-xs active:scale-95 touch-manipulation cursor-pointer"
                            >
                              <Coins className="w-3.5 h-3.5" />
                              <span>Collect</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Tablet & Desktop View: High-Density Table (hidden md:block) */}
                <div className="hidden md:block overflow-x-auto custom-scrollbar">
                   <table className="w-full text-left text-xs whitespace-nowrap">
                     <thead className="bg-neutral-50 dark:bg-[#0F0F0F] text-neutral-600 dark:text-neutral-400 uppercase tracking-widest font-bold border-b border-neutral-200 dark:border-[#262626]">
                       <tr>
                         <th className="px-4 py-3">Student</th>
                         <th className="px-4 py-3 text-center">Overdue Period</th>
                         <th className="px-4 py-3 text-right">Owed Balance</th>
                         <th className="px-4 py-3 text-right">Actions</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                       {filteredAgingReceivables.length === 0 ? (
                         <tr>
                           <td colSpan={4} className="px-4 py-12 text-center text-neutral-500 dark:text-neutral-400 font-mono">
                             <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                             <p className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">No matching overdue accounts!</p>
                             <p className="text-micro mt-0.5">All student accounts are currently settled under active criteria.</p>
                           </td>
                         </tr>
                       ) : filteredAgingReceivables.map(ar => (
                         <tr key={ar.student.id} className="hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors text-neutral-800 dark:text-[#E4E4E4] group">
                           <td className="px-4 py-3">
                             <div className="flex items-center gap-3">
                               <SafeImage
                                 src={ar.student.profilePicturePath}
                                 alt={ar.student.englishName}
                                 containerClassName="w-8 h-8 rounded-full bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 group-hover:border-brand transition-colors"
                                 fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-micro">{ar.student.englishName.charAt(0)}</span>}
                               />
                               <div>
                                 <div className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 group-hover:text-brand-ink dark:group-hover:text-white transition-colors">
                                   {ar.student.englishName}
                                   {ar.student.khmerName && (
                                     <span className="text-micro font-khmer text-neutral-500 dark:text-neutral-400 font-normal">
                                       {ar.student.khmerName}
                                     </span>
                                   )}
                                   <span className="text-micro text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] px-1.5 py-0.2 rounded font-mono">
                                     {ar.student.id}
                                   </span>
                                 </div>
                                 <p className="text-micro text-neutral-500 dark:text-neutral-400 mt-0.5">
                                   {ar.branchName} • Belt: {formatBelt(ar.student.currentBelt, ar.student.dob)} • Plan: {ar.scholarshipName}
                                 </p>
                               </div>
                             </div>
                           </td>
                           <td className="px-4 py-3 text-center">
                             <div className="flex items-center justify-center gap-1 flex-wrap">
                               {ar.overdueMonths.map(m => (
                                 <span key={m} className="px-1.5 py-0.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 rounded font-mono font-bold text-micro">
                                   {m}
                                 </span>
                               ))}
                             </div>
                           </td>
                           <td className="px-4 py-3 text-right font-mono font-bold text-rose-700 dark:text-rose-400 text-xs">
                             ${ar.owed.toFixed(2)}
                           </td>
                           <td className="px-4 py-3 text-right">
                             <div className="flex items-center justify-end gap-1.5">
                               {ar.student.emergencyContactPhone && (
                                 <a
                                   href={`tel:${ar.student.emergencyContactPhone}`}
                                   title={`Call Guardian: ${ar.student.emergencyContactPhone}`}
                                   className="p-1.5 rounded-[6px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1F1F1F] dark:hover:bg-[#2A2A2A] border border-neutral-200 dark:border-[#333] text-neutral-600 dark:text-neutral-300 transition-colors"
                                 >
                                   <PhoneCall className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                 </a>
                               )}
                               <button
                                 onClick={() => { setStudentDetailsId(ar.student.id); setPaymentAmounts({}); }}
                                 className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-micro font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer active:scale-95 touch-manipulation"
                               >
                                 Pay Dues
                               </button>
                             </div>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                </div>
              </div>
            </div>

            {/* Right: Branch & Subsidy Financial Breakdown */}
            <div className="space-y-4">
              {/* Branch Facility Performance */}
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 space-y-4 shadow-sm">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#262626] pb-2 flex items-center gap-2">
                   <UsersThree className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/>
                   Revenue by Facility
                 </h3>
                 <div className="space-y-3">
                   {branchFinancials.map(({ branch, expected, collected, outstanding, rate }) => {
                     return (
                       <div key={branch.id} className="p-2.5 rounded-[6px] bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs">
                          <div className="flex justify-between items-center mb-1">
                             <span className="font-bold text-neutral-900 dark:text-neutral-100">{branch.name}</span>
                             <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">${collected.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-micro text-neutral-500 dark:text-neutral-400 font-mono mb-2">
                             <span>Due: ${expected.toFixed(0)}</span>
                             <span>Pending: ${outstanding.toFixed(0)} ({rate}%)</span>
                          </div>
                          <div className="w-full bg-neutral-200 dark:bg-[#202020] h-1.5 rounded-full overflow-hidden flex">
                            <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${rate}%` }} />
                            <div className="h-full bg-rose-500 rounded-r-full" style={{ width: `${100 - rate}%` }} />
                          </div>
                       </div>
                     );
                   })}
                 </div>
              </div>

              {/* Scholarship Waivers Impact analysis */}
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 space-y-4 shadow-sm">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#262626] pb-2 flex items-center gap-2">
                   <ChartLine className="w-4 h-4 text-indigo-600 dark:text-indigo-400"/>
                   Scholarship Subsidies & Valuation
                 </h3>
                 <div className="space-y-3">
                    {scholarshipFinancialImpacts.map(item => (
                      <div key={item.scholarship.id} className="p-2.5 rounded-[6px] bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs">
                         <div className="flex justify-between items-center mb-1">
                            <div>
                               <span className="font-bold text-neutral-900 dark:text-neutral-100">{item.scholarship.typeName}</span>
                               <span className="text-micro text-neutral-500 dark:text-neutral-400 ml-1.5">({item.discountPct}% Discount)</span>
                            </div>
                            <span className="font-mono text-neutral-800 dark:text-neutral-200 bg-neutral-200/60 dark:bg-[#1C1C1C] border border-neutral-300 dark:border-[#333] px-2 py-0.5 rounded text-micro font-bold">
                              {item.studentCount} Students
                            </span>
                         </div>
                         <div className="flex justify-between items-center text-micro font-mono text-neutral-600 dark:text-neutral-400 mt-1.5 pt-1.5 border-t border-neutral-200 dark:border-[#262626]">
                           <span>Waived Volume:</span>
                           <span className="font-bold text-indigo-600 dark:text-indigo-400">
                             ${item.monthlyTotalWaived.toFixed(2)}/mo (${item.annualProjectedWaived.toFixed(0)}/yr)
                           </span>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}</>;
}
