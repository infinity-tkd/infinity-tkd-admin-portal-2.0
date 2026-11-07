'use client';
import { ContactActions } from '@/components/ContactActions';
import React from 'react';
import { useAppStore, Student } from '@/lib/store';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { X } from '@phosphor-icons/react/dist/csr/X';

import { CalendarCheck } from '@phosphor-icons/react/dist/csr/CalendarCheck';
import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { SquaresFour } from '@phosphor-icons/react/dist/csr/SquaresFour';
import { ListDashes } from '@phosphor-icons/react/dist/csr/ListDashes';
import { cn } from '@/lib/utils';
import { academyDate } from '@/lib/dates';
import { SafeImage } from '@/components/SafeImage';
const monthsListGlobal = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface RenewalCalendarPanelProps {
  calendarMonth: string;
  setCalendarMonth: React.Dispatch<React.SetStateAction<string>>;
  setCalendarYear: React.Dispatch<React.SetStateAction<number>>;
  calendarYear: number;
  currentActualYear: number;
  months: string[];
  currentActualMonthIndex: number;
  setCalendarViewMode: React.Dispatch<React.SetStateAction<"grid" | "agenda">>;
  calendarViewMode: "grid" | "agenda";
  calendarSearch: string;
  setCalendarSearch: React.Dispatch<React.SetStateAction<string>>;
  calendarFilterBranch: number | "all";
  setCalendarFilterBranch: React.Dispatch<React.SetStateAction<number | "all">>;
  state: ReturnType<typeof useAppStore>['state'];
  calendarData: { daysInMonth: number; firstDayOffset: number; dayMap: Record<number, { student: Student; billingStatus: "Paid" | "Due Soon" | "Due today" | "Within grace" | "Overdue" | "Waived" | "Upcoming"; amountOwed: number; baseFee: number; discountPct: number; branchName: string; scholarshipName: string; dueDay: number; }[]>; stats: { total: number; paid: number; pending: number; overdue: number; waived: number; expected: number; collected: number; outstanding: number; }; };
  calendarFilterStatus: "all" | "overdue" | "pending" | "paid" | "waived";
  setCalendarFilterStatus: React.Dispatch<React.SetStateAction<"all" | "overdue" | "pending" | "paid" | "waived">>;
  selectedCalendarDay: { year: number; month: string; day: number; } | null;
  setSelectedCalendarDay: React.Dispatch<React.SetStateAction<{ year: number; month: string; day: number; } | null>>;
  setStudentDetailsId: React.Dispatch<React.SetStateAction<string | null>>;
  setPaymentAmounts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isReadOnlyLedger: boolean;
  paymentBusy: boolean;
  payInvoice: (studentId: string, year: number, month: string, amount: number) => Promise<boolean>;
  showNotification: (message: string, type?: "success" | "error" | "info" | "warning", title?: string, code?: string, details?: string) => void;
  setShowReceipt: React.Dispatch<React.SetStateAction<{ student: Student; month: string; year: number; amount: number; } | null>>;
}

export function RenewalCalendarPanel({ calendarMonth, setCalendarMonth, setCalendarYear, calendarYear, currentActualYear, months, currentActualMonthIndex, setCalendarViewMode, calendarViewMode, calendarSearch, setCalendarSearch, calendarFilterBranch, setCalendarFilterBranch, state, calendarData, calendarFilterStatus, setCalendarFilterStatus, selectedCalendarDay, setSelectedCalendarDay, setStudentDetailsId, setPaymentAmounts, isReadOnlyLedger, paymentBusy, payInvoice, showNotification, setShowReceipt }: RenewalCalendarPanelProps) {
  return <>{(
        <div className="space-y-4">
          {/* Top Bar Header & Controls */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-3 transition-colors">
            {/* Left Cluster: Month Navigator + Jump Today + View Switcher */}
            <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2 sm:gap-3">
              {/* Previous / Next Month Navigator */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => {
                    const monthIdx = monthsListGlobal.indexOf(calendarMonth);
                    if (monthIdx === 0) {
                      setCalendarMonth(monthsListGlobal[11]);
                      setCalendarYear(calendarYear - 1);
                    } else {
                      setCalendarMonth(monthsListGlobal[monthIdx - 1]);
                    }
                  }}
                  className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 dark:bg-[#0F0F0F] dark:hover:bg-[#1F1F1F] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-white rounded-[8px] transition-colors cursor-pointer active:scale-95 touch-manipulation pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                  title="Previous Month"
                  aria-label="Previous Month"
                >
                  <CaretLeft className="w-4 h-4" />
                </button>

                <div className="text-center min-w-[120px] sm:min-w-[130px]">
                  <div className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white tracking-tight flex items-center justify-center gap-1.5 sm:gap-2">
                    <span>{calendarMonth}</span>
                    <span className="text-[#EF2F38] font-mono font-black">{calendarYear}</span>
                  </div>
                  <span className="text-[9px] text-neutral-500 dark:text-[#888] font-mono uppercase tracking-widest block font-semibold">
                    Renewal Schedule
                  </span>
                </div>

                <button
                  onClick={() => {
                    const monthIdx = monthsListGlobal.indexOf(calendarMonth);
                    if (monthIdx === 11) {
                      setCalendarMonth(monthsListGlobal[0]);
                      setCalendarYear(calendarYear + 1);
                    } else {
                      setCalendarMonth(monthsListGlobal[monthIdx + 1]);
                    }
                  }}
                  className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 dark:bg-[#0F0F0F] dark:hover:bg-[#1F1F1F] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-white rounded-[8px] transition-colors cursor-pointer active:scale-95 touch-manipulation pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                  title="Next Month"
                  aria-label="Next Month"
                >
                  <CaretRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setCalendarYear(currentActualYear);
                    setCalendarMonth(months[currentActualMonthIndex]);
                  }}
                  className="px-3 h-9 bg-[#EF2F38] hover:bg-[#D0252D] text-white rounded-[8px] text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm shadow-[#EF2F38]/20 flex items-center gap-1.5 active:scale-95 touch-manipulation shrink-0"
                  title="Jump to Current Month"
                >
                  <CalendarCheck className="w-3.5 h-3.5" /> TODAY
                </button>

                {/* View Mode Toggle: Grid vs Agenda List */}
                <div className="flex bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-0.5 shrink-0 h-9 items-center">
                  <button
                    type="button"
                    onClick={() => setCalendarViewMode('grid')}
                    title="Month Grid View"
                    className={cn(
                      "px-2.5 h-7.5 rounded-[6px] text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer active:scale-95 touch-manipulation",
                      calendarViewMode === 'grid'
                        ? "bg-white dark:bg-[#262626] text-[#EF2F38] dark:text-white shadow-xs font-black"
                        : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white"
                    )}
                  >
                    <SquaresFour className="w-3.5 h-3.5" weight="bold" />
                    <span className="hidden xs:inline">Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarViewMode('agenda')}
                    title="Agenda Cohort Stream"
                    className={cn(
                      "px-2.5 h-7.5 rounded-[6px] text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer active:scale-95 touch-manipulation",
                      calendarViewMode === 'agenda'
                        ? "bg-white dark:bg-[#262626] text-[#EF2F38] dark:text-white shadow-xs font-black"
                        : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white"
                    )}
                  >
                    <ListDashes className="w-3.5 h-3.5" weight="bold" />
                    <span className="hidden xs:inline">Agenda</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Cluster: Quick Filters (Search + Branch + Status Segment Rail) */}
            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
              <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-[200px]">
                {/* Search */}
                <div className="relative flex-1 sm:w-40 md:w-44">
                  <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 dark:text-[#666]"/>
                  <input
                    type="text"
                    placeholder="Filter student..."
                    value={calendarSearch}
                    onChange={(e) => setCalendarSearch(e.target.value)}
                    className="w-full pl-8 pr-7 h-9 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] text-[11px] sm:text-xs focus:outline-none focus:border-[#EF2F38] transition-all placeholder:text-neutral-400 dark:placeholder:text-[#666] font-mono"
                  />
                  {calendarSearch && (
                    <button
                      onClick={() => setCalendarSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white p-0.5 cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Branch Filter */}
                <select
                  value={calendarFilterBranch}
                  onChange={(e) => setCalendarFilterBranch(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-[11px] sm:text-xs h-9 px-2.5 focus:outline-none focus:border-[#EF2F38] font-mono cursor-pointer shrink-0 max-w-[125px] sm:max-w-none"
                >
                  <option value="all">All Branches</option>
                  {state.branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Status Segment Rail - Clean, perfectly sized, no overflow, with counts & semantic colors */}
              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] p-0.5 h-9 overflow-x-auto no-scrollbar touch-pan-x max-w-full">
                {([
                  { key: 'all', label: 'All', count: calendarData.stats.total, dot: 'bg-neutral-400' },
                  { key: 'overdue', label: 'Overdue', count: calendarData.stats.overdue, dot: 'bg-red-500' },
                  { key: 'pending', label: 'Pending', count: calendarData.stats.pending, dot: 'bg-amber-500' },
                  { key: 'paid', label: 'Paid', count: calendarData.stats.paid, dot: 'bg-emerald-500' },
                  { key: 'waived', label: 'Waived', count: calendarData.stats.waived, dot: 'bg-purple-500' },
                ] as const).map(st => {
                  const isActive = calendarFilterStatus === st.key;
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setCalendarFilterStatus(st.key)}
                      className={cn(
                        "h-7.5 px-2.5 rounded-[6px] text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 touch-manipulation whitespace-nowrap",
                        isActive
                          ? st.key === 'overdue'
                            ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 shadow-xs font-black"
                            : st.key === 'pending'
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs font-black"
                            : st.key === 'paid'
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs font-black"
                            : st.key === 'waived'
                            ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 shadow-xs font-black"
                            : "bg-white dark:bg-[#262626] text-neutral-900 dark:text-white shadow-xs font-black"
                          : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white border border-transparent"
                      )}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", st.dot)} />
                      <span>{st.label}</span>
                      <span className={cn(
                        "px-1 py-0.2 rounded-full text-[9px] font-mono font-bold transition-colors",
                        isActive
                          ? st.key === 'overdue'
                            ? "bg-red-500/20 text-red-700 dark:text-red-300"
                            : st.key === 'pending'
                            ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                            : st.key === 'paid'
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                            : st.key === 'waived'
                            ? "bg-purple-500/20 text-purple-700 dark:text-purple-300"
                            : "bg-neutral-200 dark:bg-[#333] text-neutral-800 dark:text-neutral-200"
                          : "bg-neutral-200/60 dark:bg-[#1E1E1E] text-neutral-500 dark:text-[#777]"
                      )}>
                        {st.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Metrics Counter Dashboard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 shadow-xs">
              <span className="text-[9px] uppercase font-mono tracking-widest text-neutral-500 dark:text-[#888] block font-bold truncate">Total Renewals</span>
              <div className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white mt-0.5 flex items-baseline gap-1.5">
                <span>{calendarData.stats.total}</span>
                <span className="text-[10px] font-mono text-neutral-500 dark:text-[#666]">Students</span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#141414] border border-green-500/30 dark:border-green-500/20 rounded-[8px] p-3 shadow-xs bg-gradient-to-br from-green-500/5 to-transparent">
              <span className="text-[9px] uppercase font-mono tracking-widest text-green-600 dark:text-green-400 block font-bold truncate">Tuition allocated</span>
              <div className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400 mt-0.5 font-mono truncate">
                ${calendarData.stats.collected.toFixed(2)}
              </div>
            </div>

            <div className="bg-white dark:bg-[#141414] border border-red-500/30 dark:border-red-500/20 rounded-[8px] p-3 shadow-xs bg-gradient-to-br from-red-500/5 to-transparent">
              <span className="text-[9px] uppercase font-mono tracking-widest text-red-600 dark:text-red-400 block font-bold truncate">Outstanding Dues</span>
              <div className="text-lg sm:text-xl font-bold text-red-600 dark:text-red-400 mt-0.5 font-mono truncate">
                ${calendarData.stats.outstanding.toFixed(2)}
              </div>
            </div>

            <div className="bg-white dark:bg-[#141414] border border-purple-500/30 dark:border-purple-500/20 rounded-[8px] p-3 shadow-xs bg-gradient-to-br from-purple-500/5 to-transparent">
              <span className="text-[9px] uppercase font-mono tracking-widest text-purple-600 dark:text-purple-400 block font-bold truncate">Scholarship Waived</span>
              <div className="text-lg sm:text-xl font-bold text-purple-600 dark:text-purple-400 mt-0.5 flex items-baseline gap-1.5 font-mono">
                <span>{calendarData.stats.waived}</span>
                <span className="text-[10px] font-mono text-neutral-500 dark:text-[#666]">100% Free</span>
              </div>
            </div>
          </div>

          {/* VIEW SWITCHER CONTENT: Month Grid vs Agenda Stream */}
          {calendarViewMode === 'grid' ? (
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm p-2 sm:p-3 md:p-4 transition-colors">
              {/* Weekday Headers (Monday Start) */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[9px] sm:text-[10px] font-bold font-mono text-neutral-500 dark:text-[#888] uppercase tracking-wider pb-2 sm:pb-3 border-b border-neutral-200 dark:border-[#262626]">
                <div><span className="hidden xs:inline">MON</span><span className="xs:hidden">M</span></div>
                <div><span className="hidden xs:inline">TUE</span><span className="xs:hidden">T</span></div>
                <div><span className="hidden xs:inline">WED</span><span className="xs:hidden">W</span></div>
                <div><span className="hidden xs:inline">THU</span><span className="xs:hidden">T</span></div>
                <div><span className="hidden xs:inline">FRI</span><span className="xs:hidden">F</span></div>
                <div><span className="hidden xs:inline">SAT</span><span className="xs:hidden">S</span></div>
                <div><span className="hidden xs:inline">SUN</span><span className="xs:hidden">S</span></div>
              </div>

              {/* Grid Days */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 pt-2 sm:pt-3">
                {/* Empty leading offset cells */}
                {Array.from({ length: calendarData.firstDayOffset }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="min-h-[56px] sm:min-h-[90px] md:min-h-[110px] bg-neutral-50 dark:bg-[#0A0A0A]/40 border border-neutral-200/60 dark:border-[#1A1A1A] rounded-[6px] sm:rounded-[8px] opacity-25" />
                ))}

                {/* Calendar Days */}
                {Array.from({ length: calendarData.daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dueStudents = calendarData.dayMap[dayNum] || [];
                  const isToday = calendarYear === currentActualYear && monthsListGlobal.indexOf(calendarMonth) === currentActualMonthIndex && dayNum === Number(academyDate().slice(8, 10));
                  const isSelected = selectedCalendarDay?.day === dayNum && selectedCalendarDay?.year === calendarYear && selectedCalendarDay?.month === calendarMonth;

                  const paidCount = dueStudents.filter(s => s.billingStatus === 'Paid').length;
                  const overdueCount = dueStudents.filter(s => s.billingStatus === 'Overdue').length;
                  const pendingCount = dueStudents.filter(s => ['Due Soon','Due today','Within grace'].includes(s.billingStatus)).length;
                  const waivedCount = dueStudents.filter(s => s.billingStatus === 'Waived').length;

                  const dayExpectedSum = dueStudents.reduce((acc, curr) => acc + curr.amountOwed, 0);

                  return (
                    <div
                      key={`day-${dayNum}`}
                      onClick={() => {
                        if (dueStudents.length > 0) {
                          setSelectedCalendarDay({ year: calendarYear, month: calendarMonth, day: dayNum });
                        }
                      }}
                      className={cn(
                        "min-h-[56px] sm:min-h-[90px] md:min-h-[110px] p-1 sm:p-2 rounded-[6px] sm:rounded-[8px] border transition-all flex flex-col justify-between group active:scale-95 touch-manipulation",
                        dueStudents.length > 0
                          ? "cursor-pointer hover:border-[#EF2F38]/60 dark:hover:border-[#555] hover:bg-neutral-50 dark:hover:bg-[#1A1A1A]"
                          : "opacity-60 bg-neutral-50/60 dark:bg-[#0F0F0F]/60 border-neutral-200/60 dark:border-[#1F1F1F]",
                        isToday && "border-[#EF2F38] bg-red-500/5 dark:bg-[#EF2F38]/10 ring-1 ring-[#EF2F38]/30",
                        isSelected && "ring-2 ring-[#EF2F38] border-[#EF2F38]"
                      )}
                    >
                      {/* Day Header */}
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "w-5 h-5 sm:w-6 sm:h-6 rounded-full text-[10px] sm:text-xs font-bold font-mono flex items-center justify-center transition-colors",
                          isToday
                            ? "bg-[#EF2F38] text-white font-black shadow-xs shadow-[#EF2F38]/30"
                            : "text-neutral-800 dark:text-[#AAA] group-hover:text-neutral-900 dark:group-hover:text-white"
                        )}>
                          {dayNum}
                        </span>

                        {dueStudents.length > 0 && (
                          <span className="text-[9px] font-bold font-mono px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded-[4px] sm:rounded-[6px] bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-700 dark:text-[#CCC] border border-neutral-200 dark:border-[#262626]">
                            <span className="hidden sm:inline">{dueStudents.length} {dueStudents.length === 1 ? 'due' : 'dues'}</span>
                            <span className="sm:hidden">{dueStudents.length}</span>
                          </span>
                        )}
                      </div>

                      {/* Middle Section: Mobile Micro Dots vs Tablet/Desktop Badges */}
                      {dueStudents.length > 0 ? (
                        <>
                          {/* Mobile Micro Indicator Dots (< 640px) */}
                          <div className="flex sm:hidden items-center justify-center gap-1 my-auto">
                            {overdueCount > 0 && (
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" title={`${overdueCount} Overdue`} />
                            )}
                            {pendingCount > 0 && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title={`${pendingCount} Due Soon`} />
                            )}
                            {paidCount > 0 && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title={`${paidCount} Paid`} />
                            )}
                            {waivedCount > 0 && (
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" title={`${waivedCount} Waived`} />
                            )}
                          </div>

                          {/* Tablet / Desktop Avatars & Status Pills (>= 640px) */}
                          <div className="hidden sm:block my-1 space-y-1">
                            {/* Avatar stack */}
                            <div className="flex items-center -space-x-1.5 overflow-hidden">
                              {dueStudents.slice(0, 3).map((st) => (
                                <SafeImage
                                  key={st.student.id}
                                  src={st.student.profilePicturePath}
                                  alt={st.student.englishName}
                                  className="w-5 h-5 rounded-full object-cover border border-white dark:border-[#141414] shrink-0"
                                />
                              ))}
                              {dueStudents.length > 3 && (
                                <div className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-[#262626] text-[9px] font-mono font-bold text-neutral-800 dark:text-white flex items-center justify-center border border-white dark:border-[#141414] shrink-0">
                                  +{dueStudents.length - 3}
                                </div>
                              )}
                            </div>

                            {/* Status Pills */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {overdueCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-[3px] bg-red-500/10 text-red-600 dark:text-red-400 text-[9px] font-mono font-bold border border-red-500/20">
                                  <span className="w-1 h-1 rounded-full bg-red-500"></span> {overdueCount}
                                </span>
                              )}
                              {pendingCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-[3px] bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-mono font-bold border border-amber-500/20">
                                  <span className="w-1 h-1 rounded-full bg-amber-500"></span> {pendingCount}
                                </span>
                              )}
                              {paidCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-[3px] bg-green-500/10 text-green-600 dark:text-green-400 text-[9px] font-mono font-bold border border-green-500/20">
                                  <span className="w-1 h-1 rounded-full bg-green-500"></span> {paidCount}
                                </span>
                              )}
                              {waivedCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-[3px] bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[9px] font-mono font-bold border border-purple-500/20">
                                  <span className="w-1 h-1 rounded-full bg-purple-500"></span> {waivedCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="my-auto text-center hidden sm:block">
                          <span className="text-[9px] text-neutral-400 dark:text-[#444] font-mono block select-none">No Dues</span>
                        </div>
                      )}

                      {/* Footer Amount */}
                      {dueStudents.length > 0 && (
                        <div className="text-[9px] font-mono text-center sm:text-right text-neutral-600 dark:text-[#888] pt-0.5 sm:pt-1 border-t border-neutral-200/80 dark:border-[#1F1F1F] truncate">
                          {dayExpectedSum > 0 ? (
                            <span className="text-neutral-900 dark:text-white font-bold">${dayExpectedSum >= 1000 ? `${(dayExpectedSum/1000).toFixed(1)}k` : dayExpectedSum.toFixed(0)}</span>
                          ) : (
                            <span className="text-purple-600 dark:text-purple-400 font-bold">Waived</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* AGENDA / COHORT STREAM VIEW (NATIVE FOR MOBILE & TABLET) */
            <div className="space-y-3">
              {(() => {
                const activeDays = Object.keys(calendarData.dayMap)
                  .map(Number)
                  .filter(day => calendarData.dayMap[day]?.length > 0)
                  .sort((a, b) => a - b);

                if (activeDays.length === 0) {
                  return (
                    <div className="py-16 px-4 text-center border border-dashed border-neutral-200 dark:border-[#262626] rounded-[8px] bg-white dark:bg-[#141414]">
                      <CalendarCheck className="w-10 h-10 text-neutral-400 dark:text-[#666] mx-auto mb-2" />
                      <p className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-1">No Renewals Found</p>
                      <p className="text-xs text-neutral-500 dark:text-[#666] font-mono">No students scheduled for renewal matching your filters in {calendarMonth} {calendarYear}.</p>
                    </div>
                  );
                }

                return activeDays.map(dayNum => {
                  const cohort = calendarData.dayMap[dayNum] || [];
                  const isToday = calendarYear === currentActualYear && monthsListGlobal.indexOf(calendarMonth) === currentActualMonthIndex && dayNum === Number(academyDate().slice(8, 10));

                  const paidCount = cohort.filter(s => s.billingStatus === 'Paid').length;
                  const overdueCount = cohort.filter(s => s.billingStatus === 'Overdue').length;
                  const pendingCount = cohort.filter(s => ['Due Soon','Due today','Within grace'].includes(s.billingStatus)).length;
                  const waivedCount = cohort.filter(s => s.billingStatus === 'Waived').length;
                  const totalAmount = cohort.reduce((acc, curr) => acc + curr.amountOwed, 0);

                  return (
                    <div
                      key={`agenda-day-${dayNum}`}
                      className={cn(
                        "bg-white dark:bg-[#141414] border rounded-[8px] p-3.5 sm:p-4 shadow-sm transition-all",
                        isToday
                          ? "border-[#EF2F38] bg-red-500/5 dark:bg-[#EF2F38]/5 ring-1 ring-[#EF2F38]/30"
                          : "border-neutral-200 dark:border-[#262626]"
                      )}
                    >
                      {/* Agenda Day Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-neutral-200 dark:border-[#262626]">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-[8px] flex flex-col items-center justify-center shrink-0 font-mono shadow-xs",
                            isToday
                              ? "bg-[#EF2F38] text-white"
                              : "bg-neutral-100 dark:bg-[#1C1C1C] text-neutral-900 dark:text-white border border-neutral-200 dark:border-[#2A2A2A]"
                          )}>
                            <span className="text-xs font-black leading-none">{dayNum}</span>
                            <span className="text-[9px] uppercase tracking-wider font-bold opacity-80">{calendarMonth.slice(0, 3)}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight">
                                Day {dayNum} Cohort • {cohort.length} {cohort.length === 1 ? 'Student' : 'Students'}
                              </h3>
                              {isToday && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-[#EF2F38] text-white">
                                  Today
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-neutral-500 dark:text-[#888]">
                              <span>Expected: <b className="text-neutral-900 dark:text-white">${totalAmount.toFixed(2)}</b></span>
                            </div>
                          </div>
                        </div>

                        {/* Status Tags & Action */}
                        <div className="flex items-center justify-between sm:justify-end gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {overdueCount > 0 && (
                              <span className="px-2 py-0.5 rounded-[6px] bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-mono font-bold border border-red-500/20">
                                {overdueCount} Overdue
                              </span>
                            )}
                            {pendingCount > 0 && (
                              <span className="px-2 py-0.5 rounded-[6px] bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-bold border border-amber-500/20">
                                {pendingCount} Pending
                              </span>
                            )}
                            {paidCount > 0 && (
                              <span className="px-2 py-0.5 rounded-[6px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/20">
                                {paidCount} Paid
                              </span>
                            )}
                            {waivedCount > 0 && (
                              <span className="px-2 py-0.5 rounded-[6px] bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-mono font-bold border border-purple-500/20">
                                {waivedCount} Waived
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedCalendarDay({ year: calendarYear, month: calendarMonth, day: dayNum })}
                            className="px-3 py-1.5 rounded-[8px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer active:scale-95 touch-manipulation shrink-0"
                          >
                            <span>Cohort</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Students List in Cohort */}
                      <div className="divide-y divide-neutral-200 dark:divide-[#202020] pt-1">
                        {cohort.slice(0, 4).map(item => {
                          const { student, billingStatus, amountOwed, branchName, scholarshipName } = item;
                          return (
                            <div key={student.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <SafeImage
                                  src={student.profilePicturePath}
                                  alt={student.englishName}
                                  className="w-8 h-8 rounded-full object-cover border border-neutral-200 dark:border-[#262626] shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <button type="button" onClick={() => {setStudentDetailsId(student.id);setPaymentAmounts({});}} className="font-bold text-neutral-900 hover:text-[#EF2F38] dark:text-white truncate text-left">{student.englishName}</button>
                                    <span className="text-[10px] font-mono text-neutral-400">({student.id})</span>
                                  </div>
                                  <p className="text-[10px] font-mono text-neutral-500 dark:text-[#777] truncate">
                                    {branchName} • {scholarshipName}
                                  </p>
                                  <ContactActions contact={student} name={student.englishName} compact emailSubject="Tuition renewal" />
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                <div className="text-right">
                                  <span className="font-mono font-bold text-neutral-900 dark:text-white block">
                                    ${amountOwed.toFixed(2)}
                                  </span>
                                  <span className={cn(
                                    "text-[9px] font-mono font-bold uppercase",
                                    billingStatus === 'Paid' ? "text-emerald-600 dark:text-emerald-400" :
                                    billingStatus === 'Overdue' ? "text-red-600 dark:text-red-400" :
                                    ['Due Soon','Due today','Within grace'].includes(billingStatus) ? "text-amber-600 dark:text-amber-400" :
                                    "text-purple-600 dark:text-purple-400"
                                  )}>
                                    {billingStatus}
                                  </span>
                                </div>

                                {billingStatus !== 'Paid' && billingStatus !== 'Waived' ? (
                                  !isReadOnlyLedger ? (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          if(!await payInvoice(student.id, calendarYear, calendarMonth, amountOwed))return;
                                          showNotification(`Recorded $${amountOwed.toFixed(2)} payment for ${student.englishName}!`, 'success');
                                        } catch (e: any) {
                                          console.error(e);
                                          showNotification("Failed to record payment.", 'error');
                                        }
                                      }}
                                      className="px-2.5 py-1 bg-[#EF2F38] hover:bg-[#D0252D] text-white font-bold uppercase tracking-wider text-[10px] rounded-[6px] transition-colors cursor-pointer active:scale-95 touch-manipulation" disabled={paymentBusy || isReadOnlyLedger} aria-busy={paymentBusy}
                                    >
                                      Pay
                                    </button>
                                  ) : null
                                ) : billingStatus === 'Paid' ? (
                                  <button
                                    type="button"
                                    onClick={() => setShowReceipt({
                                      student,
                                      month: calendarMonth,
                                      year: calendarYear,
                                      amount: amountOwed
                                    })}
                                    className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1F1F1F] text-neutral-700 dark:text-[#AAA] font-mono text-[10px] rounded-[6px] transition-colors cursor-pointer active:scale-95 touch-manipulation"
                                  >
                                    Receipt
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}

                        {cohort.length > 4 && (
                          <div className="pt-2 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedCalendarDay({ year: calendarYear, month: calendarMonth, day: dayNum })}
                              className="text-[11px] font-mono text-[#EF2F38] hover:underline font-bold cursor-pointer"
                            >
                              + {cohort.length - 4} more students in Day {dayNum} cohort →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}</>;
}
