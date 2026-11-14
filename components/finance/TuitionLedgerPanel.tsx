'use client';
import { pressable } from '@/components/ui/pressable';
import {billingDueDay, membershipDueText} from '@/lib/billing';

// Most urgent first: past the grace period, then within grace, due today, due soon.
const BILLING_URGENCY: Record<string, number> = { Overdue: 0, 'Within grace': 1, 'Due today': 2, 'Due Soon': 3 };
import {tuitionMonth} from '@/lib/tuition-payments';
import { TUITION_MONTHS as monthsListGlobal, isMonthBeforeEnrollment } from '@/lib/tuition-payments';
import { ContactActions } from '@/components/ContactActions';
import React from 'react';
import { useAppStore, Student, getMembershipBillingStatus } from '@/lib/store';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Coins } from '@phosphor-icons/react/dist/csr/Coins';
import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { SquaresFour } from '@phosphor-icons/react/dist/csr/SquaresFour';
import { ListDashes } from '@phosphor-icons/react/dist/csr/ListDashes';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { ArrowClockwise } from '@phosphor-icons/react/dist/csr/ArrowClockwise';
import { cn } from '@/lib/utils';
import { SafeImage } from '@/components/SafeImage';



interface TuitionLedgerPanelProps {
  filteredStudents: Student[];
  filterYear: number;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  setLedgerPage: React.Dispatch<React.SetStateAction<number>>;
  setLedgerStatusFilter: React.Dispatch<React.SetStateAction<"all" | "unpaid" | "paid">>;
  ledgerStatusFilter: "all" | "unpaid" | "paid";
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
  setLedgerSortField: React.Dispatch<React.SetStateAction<"student" | "branch" | "plan" | "dueDay" | null>>;
  setLedgerSortDirection: React.Dispatch<React.SetStateAction<"asc" | "desc">>;
  standardMonthlyFee: number;
  alertSearch: string;
  setIsAlertsCollapsedMobile: React.Dispatch<React.SetStateAction<boolean>>;
  isAlertsCollapsedMobile: boolean;
  setAlertSearch: React.Dispatch<React.SetStateAction<string>>;
  setStudentDetailsId: React.Dispatch<React.SetStateAction<string | null>>;
  setPaymentAmounts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isReadOnlyLedger: boolean;
  paymentBusy: boolean;
  payInvoice: (studentId: string, year: number, month: string, amount: number) => Promise<boolean>;
  showNotification: (message: string, type?: "success" | "error" | "info" | "warning", title?: string, code?: string, details?: string) => void;
  totalCollected: number;
  outstandingBalance: number;
  totalScholarshipDiscounts: number;
  setLedgerViewMode: React.Dispatch<React.SetStateAction<"matrix" | "cards">>;
  ledgerViewMode: "matrix" | "cards";
  exportLedgerMatrixToCsv: () => void;
  paginatedStudents: Student[];
  getStudentEnrollDate: (st: Student) => string;
  currentActualMonthIndex: number;
  cycleFinance: (student: Student, month: string, year: number) => { amount: number; gross: number; discount: number; balance: number; cash: number; settled: boolean; waived: boolean; invoice: boolean; };
  handleLedgerSort: (field: "student" | "branch" | "plan" | "dueDay") => void;
  ledgerSortField: "student" | "branch" | "plan" | "dueDay" | null;
  ledgerSortDirection: "asc" | "desc";
  monthlyLedgerMatrixTotals: { month: string; totalCollected: number; totalExpected: number; paidCount: number; eligibleCount: number; rate: number; }[];
  ledgerPage: number;
  ledgerPerPage: number;
  setLedgerPerPage: React.Dispatch<React.SetStateAction<number>>;
  totalLedgerPages: number;
}

export function TuitionLedgerPanel({ filteredStudents, filterYear, search, setSearch, setLedgerPage, setLedgerStatusFilter, ledgerStatusFilter, setFilterYear, currentActualYear, filterMonth, setFilterMonth, months, filterBranch, setFilterBranch, state, filterScholarship, setFilterScholarship, setLedgerSortField, setLedgerSortDirection, standardMonthlyFee, alertSearch, setIsAlertsCollapsedMobile, isAlertsCollapsedMobile, setAlertSearch, setStudentDetailsId, setPaymentAmounts, isReadOnlyLedger, paymentBusy, payInvoice, showNotification, totalCollected, outstandingBalance, totalScholarshipDiscounts, setLedgerViewMode, ledgerViewMode, exportLedgerMatrixToCsv, paginatedStudents, getStudentEnrollDate, currentActualMonthIndex, cycleFinance, handleLedgerSort, ledgerSortField, ledgerSortDirection, monthlyLedgerMatrixTotals, ledgerPage, ledgerPerPage, setLedgerPerPage, totalLedgerPages }: TuitionLedgerPanelProps) {
  return <>{(
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Controls & Renewal Alerts Left Column */}
            <div className="lg:col-span-1 space-y-4">
              {/* Financial CRM Controls */}
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 flex flex-col gap-3.5 sm:gap-4 shadow-sm">
                <div>
                  <h2 className="font-bold uppercase tracking-widest text-xs text-neutral-900 dark:text-[#E4E4E4] flex items-center justify-between">
                    <span>Financial CRM</span>
                    <span className="text-micro font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-[#202020] text-neutral-600 dark:text-neutral-400 font-bold">
                      {filteredStudents.length} Active / paused
                    </span>
                  </h2>
                  <p className="text-micro text-neutral-500 dark:text-[#888] font-mono leading-relaxed mt-1">
                    Manage tuition, track missing payments, and apply scholarship discounts for {filterYear}.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Search Student Input */}
                  <div className="relative">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-[#666]" />
                    <input
                      type="text"
                      placeholder="Search student or ID..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setLedgerPage(1);
                      }}
                      className="w-full pl-9 pr-8 h-10 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[6px] text-xs focus:outline-none focus:border-brand transition-all placeholder:text-neutral-400 dark:placeholder:text-[#666]"
                    />
                    {search && (
                      <button aria-label="Clear search"
                        onClick={() => {
                          setSearch('');
                          setLedgerPage(1);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white p-1 min-h-6 min-w-6 inline-flex items-center justify-center"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Status Filter Segmented Control */}
                  <div className="space-y-1">
                    <span id="ledger-status-filter-label" className="block text-micro uppercase font-bold text-neutral-500 dark:text-[#888] tracking-wider">
                      Status Filter
                    </span>
                    <div role="group" aria-labelledby="ledger-status-filter-label" className="grid grid-cols-3 gap-1 bg-neutral-100 dark:bg-[#0F0F0F] p-1 rounded-[6px] border border-neutral-200 dark:border-[#262626] text-micro font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setLedgerStatusFilter('all');
                          setLedgerPage(1);
                        }}
                        className={cn(
                          "py-1.5 rounded-[4px] transition-colors cursor-pointer uppercase min-h-[32px] flex items-center justify-center pointer-coarse:min-h-11",
                          ledgerStatusFilter === 'all'
                            ? "bg-white dark:bg-[#202020] text-neutral-900 dark:text-white shadow-xs font-black"
                            : "text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
                        )}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLedgerStatusFilter('unpaid');
                          setLedgerPage(1);
                        }}
                        className={cn(
                          "py-1.5 rounded-[4px] transition-colors cursor-pointer uppercase min-h-[32px] flex items-center justify-center gap-1 pointer-coarse:min-h-11",
                          ledgerStatusFilter === 'unpaid'
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 font-black"
                            : "text-neutral-500 dark:text-[#888] hover:text-rose-600"
                        )}
                      >
                        <span>Unpaid</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLedgerStatusFilter('paid');
                          setLedgerPage(1);
                        }}
                        className={cn(
                          "py-1.5 rounded-[4px] transition-colors cursor-pointer uppercase min-h-[32px] flex items-center justify-center gap-1 pointer-coarse:min-h-11",
                          ledgerStatusFilter === 'paid'
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-black"
                            : "text-neutral-500 dark:text-[#888] hover:text-emerald-600"
                        )}
                      >
                        <span>Paid</span>
                      </button>
                    </div>
                  </div>

                  {/* Year & Month Selectors */}
                  <div className="grid grid-cols-2 gap-2">
                    <select aria-label="Ledger year"
                      value={filterYear}
                      onChange={(e) => {
                        setFilterYear(Number(e.target.value));
                        setLedgerPage(1);
                      }}
                      className="bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs px-2.5 h-10 font-mono font-bold focus:outline-none focus:border-brand cursor-pointer"
                    >
                      <option value={currentActualYear}>{currentActualYear}</option>
                      <option value={currentActualYear - 1}>{currentActualYear - 1}</option>
                      <option value={currentActualYear - 2}>{currentActualYear - 2}</option>
                    </select>

                    <select aria-label="Ledger month"
                      value={filterMonth}
                      onChange={(e) => {
                        setFilterMonth(e.target.value);
                        setLedgerPage(1);
                      }}
                      className="bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs px-2.5 h-10 focus:outline-none focus:border-brand cursor-pointer"
                    >
                      <option value="all">YTD / All</option>
                      {months.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Branch Filter */}
                  <select aria-label="Filter by branch"
                    value={filterBranch}
                    onChange={(e) => {
                      setFilterBranch(e.target.value === 'all' ? 'all' : Number(e.target.value));
                      setLedgerPage(1);
                    }}
                    className="w-full bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs px-3 h-10 focus:outline-none focus:border-brand cursor-pointer"
                  >
                    <option value="all">All Branches</option>
                    {state.branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>

                  {/* Scholarship Tier Filter */}
                  <select aria-label="Filter by scholarship tier"
                    value={filterScholarship}
                    onChange={(e) => {
                      setFilterScholarship(e.target.value === 'all' ? 'all' : Number(e.target.value));
                      setLedgerPage(1);
                    }}
                    className="w-full bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs px-3 h-10 focus:outline-none focus:border-brand cursor-pointer"
                  >
                    <option value="all">Any Scholarship Tier</option>
                    {state.scholarships.map(s => (
                      <option key={s.id} value={s.id}>{s.typeName} ({s.discountPercentage}%)</option>
                    ))}
                  </select>

                  {/* Reset Filters Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setFilterYear(currentActualYear);
                      setFilterMonth('all');
                      setFilterBranch('all');
                      setFilterScholarship('all');
                      setLedgerStatusFilter('all');
                      setLedgerSortField(null);
                      setLedgerSortDirection('asc');
                      setLedgerPage(1);
                    }}
                    className="w-full h-9 px-3 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#222] text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation"
                  >
                    <ArrowClockwise className="w-3.5 h-3.5" />
                    Reset Filters
                  </button>

                  {/* Base Monthly Tuition display */}
                  <div className="pt-2 border-t border-neutral-200 dark:border-[#262626]">
                    <span className="block text-micro text-neutral-500 dark:text-[#888] uppercase font-bold tracking-widest mb-1">
                      Base Standard Tuition
                    </span>
                    <div className="w-full bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-[#888] rounded-[6px] text-xs px-3 py-1.5 font-mono flex items-center justify-between">
                      <span>Full Monthly Rate</span>
                      <span className="text-neutral-900 dark:text-white font-bold">${standardMonthlyFee.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Membership Renewal Alerts Card (With Mobile Accordion Toggle) */}
              {(() => {
                const alerts = state.students
                  .filter(student => ['Active','Paused'].includes(student.studentStatus))
                  .map(student => {
                    const billing = getMembershipBillingStatus(student, state.payments, state.scholarships, state.classEnrollments, state.academyProfile);
                    return { student, billing };
                  })
                  .filter(item => item.billing.status !== 'Current')
                  .filter(item => {
                    if (!alertSearch) return true;
                    const q = alertSearch.toLowerCase();
                    return item.student.englishName.toLowerCase().includes(q) || item.student.id.toLowerCase().includes(q);
                  })
                  .sort((a, b) => (BILLING_URGENCY[a.billing.status] ?? 9) - (BILLING_URGENCY[b.billing.status] ?? 9) || a.billing.daysRemaining - b.billing.daysRemaining);

                return (
                  <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 shadow-sm space-y-3">
                    <div
                      className="flex justify-between items-center border-b border-neutral-200 dark:border-[#262626] pb-2 cursor-pointer lg:cursor-default"
                      {...pressable(() => setIsAlertsCollapsedMobile(prev => !prev))}
                      aria-expanded={!isAlertsCollapsedMobile}
                    >
                      <div className="space-y-0.5">
                        <span className="text-micro uppercase tracking-widest text-brand-ink font-mono font-bold">Billing CRM</span>
                        <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white leading-none">Renewal Alerts</h2>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 rounded-full text-micro font-bold font-mono">
                          {alerts.length} Pending
                        </span>
                        <span className="lg:hidden text-neutral-400 text-xs font-mono ml-1">
                          {isAlertsCollapsedMobile ? '▼' : '▲'}
                        </span>
                      </div>
                    </div>

                    <div className={cn("space-y-3", isAlertsCollapsedMobile && "hidden lg:block")}>
                      {alerts.length > 3 && (
                        <div className="relative">
                          <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400" />
                          <input
                            type="text"
                            placeholder="Filter alerts..."
                            value={alertSearch}
                            onChange={(e) => setAlertSearch(e.target.value)}
                            className="w-full pl-7 pr-2 py-1.5 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded text-micro focus:outline-none focus:border-brand"
                          />
                        </div>
                      )}

                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {alerts.length === 0 ? (
                          <div className="py-6 text-center text-neutral-500 dark:text-neutral-400 text-xs font-mono">
                            <Check className="w-5 h-5 mx-auto mb-1 text-emerald-600 dark:text-emerald-400 opacity-60" />
                            <span>All renewals up to date!</span>
                          </div>
                        ) : (
                          alerts.map(({ student, billing }) => {
                            const branchName = state.branches.find(b => b.id === student.homeBranchId)?.name || 'Central Dojang';
                            return (
                              <div
                                key={student.id}
                                className={cn(
                                  "p-2.5 rounded-[6px] border text-xs flex flex-col gap-2 relative group hover:border-brand/30 transition-all duration-150 shadow-xs",
                                  billing.status === 'Overdue'
                                    ? "bg-rose-500/5 border-rose-500/20"
                                    : "bg-amber-500/5 border-amber-500/20"
                                )}
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => { setStudentDetailsId(student.id); setPaymentAmounts({}); }}
                                      className="inline-flex min-h-6 items-center font-bold text-neutral-900 dark:text-white leading-none hover:text-brand-ink text-left cursor-pointer transition-colors"
                                    >
                                      {student.englishName}
                                    </button>
                                    <div className="text-micro text-neutral-500 dark:text-[#888] font-mono mt-0.5">
                                      {student.id} • {branchName}
                                    </div>
                                    <ContactActions contact={student} name={student.englishName} compact emailSubject="Tuition renewal" />
                                  </div>
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded text-micro font-bold uppercase tracking-wider border",
                                    billing.status === 'Overdue'
                                      ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                                      : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30"
                                  )}>
                                    {billing.status}
                                  </span>
                                </div>

                                <div className="flex justify-between items-end border-t border-neutral-200 dark:border-[#262626] pt-2 mt-0.5">
                                  <div className="text-micro text-neutral-600 dark:text-neutral-400 leading-tight">
                                    <span className="block text-neutral-400 dark:text-[#666] font-mono uppercase tracking-wider text-micro">Target</span>
                                    {membershipDueText(billing)}
                                  </div>

                                  {!isReadOnlyLedger ? (
                                    <button
                                      type="button"
                                      onClick={async () => {



                                        try {
                                          const dueDate = billing.nextRenewalDate;
                                          if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error('Set the enrollment date before collecting tuition.');
                                          if(!await payInvoice(student.id, Number(dueDate.slice(0,4)), monthsListGlobal[Number(dueDate.slice(5,7))-1], billing.amountOwed))return;
                                          showNotification(`Collected $${billing.amountOwed.toFixed(2)} renewal for ${student.englishName}.`, 'success');
                                        } catch (e: any) {
                                          showNotification(`Payment logging failed: ${e.message}`, 'error');
                                        }
                                      }}
                                      className="px-2.5 py-1.5 bg-white hover:bg-neutral-100 dark:bg-[#1A1A1A] dark:hover:bg-[#262626] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white rounded-[6px] text-micro font-bold uppercase tracking-wider transition-all duration-150 flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap shrink-0 active:scale-95 touch-manipulation" disabled={paymentBusy || isReadOnlyLedger} aria-busy={paymentBusy}
                                    >
                                      <Coins className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                      Pay ${billing.amountOwed.toFixed(0)}
                                    </button>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-[#262626] text-neutral-500 rounded text-micro font-bold uppercase tracking-wider shrink-0">
                                      View Only
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Right Column: Analytics & Ledger Matrix / Cards */}
            <div className="lg:col-span-3 space-y-4 min-w-0">
              {/* 3 Quick Analytics Boxes: Responsive 3-grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
                <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 flex flex-col justify-between group overflow-hidden relative shadow-sm">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                  <div>
                    <p className="text-micro text-emerald-700 dark:text-emerald-400 uppercase font-bold tracking-widest mb-1">Tuition allocated</p>
                    <p className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold">${totalCollected.toFixed(2)}</p>
                  </div>
                  <p className="text-micro text-neutral-500 dark:text-[#888] font-mono mt-2 sm:mt-3 border-t border-neutral-200 dark:border-[#262626] pt-2">
                    Applied to billing cycles {filterMonth === 'all' ? 'YTD' : filterMonth} {filterYear}
                  </p>
                </div>

                <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 flex flex-col justify-between group overflow-hidden relative shadow-sm">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                  <div>
                    <p className="text-micro text-rose-700 dark:text-rose-400 uppercase font-bold tracking-widest mb-1">Outstanding Dues</p>
                    <p className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold">${outstandingBalance.toFixed(2)}</p>
                  </div>
                  <p className="text-micro text-neutral-500 dark:text-[#888] font-mono mt-2 sm:mt-3 border-t border-neutral-200 dark:border-[#262626] pt-2">
                    Pending balances {filterMonth === 'all' ? 'YTD' : filterMonth} {filterYear}
                  </p>
                </div>

                <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 flex flex-col justify-between group overflow-hidden relative shadow-sm">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                  <div>
                    <p className="text-micro text-indigo-700 dark:text-indigo-400 uppercase font-bold tracking-widest mb-1">Scholarship Subsidies</p>
                    <p className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold">${totalScholarshipDiscounts.toFixed(2)}</p>
                  </div>
                  <p className="text-micro text-neutral-500 dark:text-[#888] font-mono mt-2 sm:mt-3 border-t border-neutral-200 dark:border-[#262626] pt-2">
                    Fee waivers {filterMonth === 'all' ? 'YTD' : filterMonth} {filterYear}
                  </p>
                </div>
              </div>

              {/* Matrix Toolbar: View Mode Switcher, Legend & CSV Export */}
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Visual Legend */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-micro font-mono font-bold">
                  <span className="text-neutral-500 dark:text-neutral-400 uppercase tracking-widest text-micro mr-0.5">Legend:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> Paid
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> Due
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30 flex items-center gap-1">
                    <Warning className="w-2.5 h-2.5" /> Late
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-[#202020] text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-[#333]">
                    Pre-Join
                  </span>
                </div>

                {/* Right controls: View Switcher (Matrix vs Cards) & CSV Export */}
                <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-neutral-200 dark:border-[#262626]">
                  {/* View Mode Toggle Button */}
                  <div className="flex items-center bg-neutral-100 dark:bg-[#0F0F0F] rounded-[6px] border border-neutral-200 dark:border-[#262626] p-0.5">
                    <button
                      type="button"
                      onClick={() => setLedgerViewMode('matrix')}
                      aria-pressed={ledgerViewMode === 'matrix'}
                      aria-label="Matrix view"
                      className={cn(
                        "min-h-8 min-w-8 pointer-coarse:min-h-9 pointer-coarse:min-w-9 justify-center px-2.5 py-1 rounded text-micro font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer",
                        ledgerViewMode === 'matrix'
                          ? "bg-white dark:bg-[#202020] text-neutral-900 dark:text-white shadow-xs font-black"
                          : "text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
                      )}
                      title="Dense Table Matrix View"
                    >
                      <ListDashes className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Matrix</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLedgerViewMode('cards')}
                      aria-pressed={ledgerViewMode === 'cards'}
                      aria-label="Cards view"
                      className={cn(
                        "min-h-8 min-w-8 pointer-coarse:min-h-9 pointer-coarse:min-w-9 justify-center px-2.5 py-1 rounded text-micro font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer",
                        ledgerViewMode === 'cards'
                          ? "bg-white dark:bg-[#202020] text-neutral-900 dark:text-white shadow-xs font-black"
                          : "text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
                      )}
                      title="Card Dossier View"
                    >
                      <SquaresFour className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Cards</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={exportLedgerMatrixToCsv}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95 touch-manipulation"
                    title="Export 12-Month Matrix to CSV"
                  >
                    <DownloadSimple className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              {/* View 1: Native Mobile / Responsive Student Dossier Cards */}
              {ledgerViewMode === 'cards' && (
                <div className="space-y-3">
                  {paginatedStudents.length === 0 ? (
                    <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-8 text-center text-neutral-500 dark:text-[#666]">
                      <p className="font-bold uppercase tracking-widest text-neutral-900 dark:text-[#E4E4E4] mb-1">No matching students</p>
                      <p className="font-mono text-xs">Adjust search term or filter status</p>
                    </div>
                  ) : (
                    paginatedStudents.map(student => {
                      const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);
                      const isEarlyGroup = scholarship?.typeName === 'Early Group Student';
                      const baseFee = isEarlyGroup ? state.academyProfile.earlyGroupTuitionUsd : state.academyProfile.standardTuitionUsd;
                      const discountPct = isEarlyGroup ? 0 : (scholarship?.discountPercentage || 0);
                      const reqPayment = baseFee * (1 - discountPct / 100);

                      const enrollDate = getStudentEnrollDate(student);
                      const dueDay=String(billingDueDay(student,state.classEnrollments,tuitionMonth(filterMonth==='all'?months[currentActualMonthIndex]:filterMonth,filterYear))??'-');

                      // Check student overdue status
                      let hasOverdue = false;
                      months.slice(0, currentActualMonthIndex + 1).forEach(m => {
                        if (isMonthBeforeEnrollment(m, filterYear, enrollDate)) return;
                        if (cycleFinance(student,m,filterYear).balance>0) {
                          hasOverdue = true;
                        }
                      });

                      return (
                        <div
                          key={student.id}
                          className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 shadow-sm space-y-3 hover:border-neutral-300 dark:hover:border-[#333] transition-all"
                        >
                          {/* Student Header Row */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <SafeImage
                                src={student.profilePicturePath}
                                alt={student.englishName}
                                containerClassName="w-10 h-10 rounded-full bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0"
                                fallback={<span className="font-bold text-neutral-400 dark:text-[#666] text-xs">{student.englishName.charAt(0)}</span>}
                              />
                              <div className="min-w-0">
                                <div className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-1.5 truncate">
                                  <button type="button" onClick={() => {setStudentDetailsId(student.id);setPaymentAmounts({});}} className="min-h-[44px] truncate text-left hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2">{student.englishName}</button>
                                  {student.khmerName && (
                                    <span className="text-micro font-khmer text-neutral-500 dark:text-neutral-400 font-normal shrink-0">
                                      {student.khmerName}
                                    </span>
                                  )}
                                </div>
                                <div className="text-micro text-neutral-500 dark:text-[#888] font-mono mt-0.5 flex flex-wrap items-center gap-1">
                                  <span>{student.id}</span>
                                  <span className="opacity-40">•</span>
                                  <span>{state.branches.find(b => b.id === student.homeBranchId)?.name}</span>
                                  <span className="opacity-40">•</span>
                                  <span className="font-bold text-neutral-800 dark:text-neutral-200">Due: Day {dueDay}</span>
                                </div>
                                <ContactActions contact={student} name={student.englishName} compact emailSubject="Tuition renewal" />
                              </div>
                            </div>

                            <span className={cn(
                              "px-2 py-0.5 rounded text-micro font-bold font-mono uppercase tracking-wider shrink-0 border",
                              hasOverdue
                                ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                            )}>
                              {hasOverdue ? 'Overdue Dues' : 'Up to Date'}
                            </span>
                          </div>

                          {/* Swipeable 12-Month Capsule Rail */}
                          <div className="pt-2 border-t border-neutral-100 dark:border-[#202020]">
                            <div className="text-micro font-mono text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5 flex justify-between">
                              <span>12-Month Billing Timeline</span>
                              <span className="text-neutral-400">Swipe to view</span>
                            </div>
                            <div className="flex overflow-x-auto no-scrollbar scrollbar-none gap-1.5 pb-1">
                              {months.map((m, idx) => {
                                const isFuture = filterYear > currentActualYear || (filterYear === currentActualYear && idx > currentActualMonthIndex);
                                const isBeforeEnroll = isMonthBeforeEnrollment(m, filterYear, enrollDate);
                                const cycle=cycleFinance(student,m,filterYear); const isPaid=cycle.settled;
                                const isCurrent = filterYear === currentActualYear && idx === currentActualMonthIndex;

                                return (
                                  <button
                                    key={m}
                                    type="button"
                                    onClick={() => { setStudentDetailsId(student.id); setPaymentAmounts({}); }}
                                    className={cn(
                                      "min-w-[48px] py-1.5 px-1 rounded-[6px] border flex flex-col items-center justify-between text-center transition-all cursor-pointer shrink-0 active:scale-95 touch-manipulation",
                                      isBeforeEnroll ? "opacity-35 bg-neutral-100 dark:bg-[#1A1A1A] border-transparent" :
                                      isPaid ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25" :
                                      isFuture ? "opacity-30 bg-neutral-100 dark:bg-[#141414] border-neutral-200 dark:border-[#262626]" :
                                      isCurrent ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35 ring-1 ring-amber-500/30" :
                                      "bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/35"
                                    )}
                                  >
                                    <span className="text-micro font-mono font-bold block">{m}</span>
                                    {isBeforeEnroll ? (
                                      <span className="text-micro font-mono text-neutral-400 uppercase mt-0.5">Pre</span>
                                    ) : isPaid ? (
                                      <Check className="w-3 h-3 stroke-[3] mt-0.5" />
                                    ) : isFuture ? (
                                      <span className="w-1 h-1 rounded-full bg-neutral-400 dark:bg-neutral-600 mt-1.5 mb-1" />
                                    ) : (
                                      <span className="text-micro font-mono font-bold mt-0.5 uppercase">
                                        {isCurrent ? 'DUE' : 'LATE'}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Bottom Action Footer */}
                          <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-[#202020]">
                            <div className="font-mono text-xs">
                              <span className="text-neutral-500 dark:text-neutral-400 text-micro">Fee: </span>
                              <strong className="text-neutral-900 dark:text-white">${reqPayment.toFixed(2)}/mo</strong>
                              {scholarship && scholarship.discountPercentage > 0 && (
                                <span className="ml-1 text-micro text-indigo-600 dark:text-indigo-400 font-bold font-mono">
                                  ({scholarship.discountPercentage}% off)
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => { setStudentDetailsId(student.id); setPaymentAmounts({}); }}
                              className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-black rounded-[6px] text-xs font-bold uppercase tracking-wider transition-colors hover:opacity-90 active:scale-95 touch-manipulation cursor-pointer flex items-center gap-1 shadow-xs"
                            >
                              <span>Dossier / Pay</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* View 2: Tablet & Desktop Dense Matrix Table */}
              {ledgerViewMode === 'matrix' && (
                <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
                  {/* Mobile Tip for Matrix Mode */}
                  <div className="md:hidden px-3.5 py-2 bg-neutral-50 dark:bg-[#0F0F0F] border-b border-neutral-200 dark:border-[#262626] flex items-center justify-between text-micro text-neutral-500 dark:text-[#888]">
                    <span>Swipe horizontally for 12-month grid</span>
                    <button
                      type="button"
                      onClick={() => setLedgerViewMode('cards')}
                      className="inline-flex min-h-6 items-center text-brand-ink font-bold uppercase hover:underline cursor-pointer active:scale-95 touch-manipulation"
                    >
                      Cards View →
                    </button>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar max-h-[650px] relative">
                    <table className="w-full text-left text-xs whitespace-nowrap border-collapse min-w-[850px]">
                      <thead className="bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-600 dark:text-neutral-400 uppercase tracking-widest font-bold border-b border-neutral-200 dark:border-[#262626]">
                        <tr>
                          {/* Sticky Left Header: Student / Plan */}
                          <th className="sticky left-0 top-0 z-30 bg-neutral-100 dark:bg-[#0F0F0F] border-r border-neutral-200 dark:border-[#262626] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] px-4 sm:px-5 py-3.5 w-[260px] min-w-[240px] sm:min-w-[260px] max-w-[280px]">
                            <div className="flex items-center justify-between">
                              <span>Student / Plan</span>
                              <div className="flex items-center gap-1 bg-white dark:bg-[#141414] rounded-[6px] px-1.5 py-0.5 text-micro font-mono border border-neutral-200 dark:border-[#262626]">
                                <span className="text-neutral-400 dark:text-[#666] select-none">SORT:</span>
                                <button
                                  type="button"
                                  onClick={() => handleLedgerSort('student')}
                                  className={cn("inline-flex min-h-6 items-center hover:text-neutral-900 dark:hover:text-white transition-colors uppercase font-bold cursor-pointer px-0.5", ledgerSortField === 'student' ? "text-brand-ink" : "text-neutral-500 dark:text-[#999]")}
                                >
                                  Name {ledgerSortField === 'student' && (ledgerSortDirection === 'asc' ? '▲' : '▼')}
                                </button>
                                <span aria-hidden="true" className="text-neutral-300 dark:text-[#333] select-none">|</span>
                                <button
                                  type="button"
                                  onClick={() => handleLedgerSort('dueDay')}
                                  className={cn("inline-flex min-h-6 items-center hover:text-neutral-900 dark:hover:text-white transition-colors uppercase font-bold cursor-pointer px-0.5", ledgerSortField === 'dueDay' ? "text-brand-ink" : "text-neutral-500 dark:text-[#999]")}
                                >
                                  Due {ledgerSortField === 'dueDay' && (ledgerSortDirection === 'asc' ? '▲' : '▼')}
                                </button>
                              </div>
                            </div>
                          </th>

                          {/* 12 Month Headers */}
                          {months.map(m => (
                            <th key={m} className="sticky top-0 z-20 bg-neutral-100 dark:bg-[#0F0F0F] px-1.5 py-3.5 text-center w-16 min-w-[64px] font-mono font-bold text-micro">
                              {m}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                        {state.isLoading ? (
                          [1, 2, 3, 4, 5].map(i => (
                            <tr key={i} className="animate-pulse">
                              <td className="sticky left-0 bg-white dark:bg-[#141414] px-4 sm:px-5 py-3 border-r border-neutral-200 dark:border-[#262626] w-[260px] min-w-[240px] sm:min-w-[260px] max-w-[280px]">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-[#262626]" />
                                  <div className="space-y-1.5 flex-1">
                                    <div className="w-28 h-3.5 bg-neutral-200 dark:bg-[#262626] rounded" />
                                    <div className="w-20 h-2.5 bg-neutral-100 dark:bg-[#202020] rounded" />
                                  </div>
                                </div>
                              </td>
                              {months.map(m => (
                                <td key={m} className="px-1.5 py-2 text-center w-16 min-w-[64px]">
                                  <div className="w-full h-8 rounded-[6px] bg-neutral-100 dark:bg-[#202020]" />
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : paginatedStudents.length === 0 ? (
                          <tr>
                            <td colSpan={13} className="px-6 py-12 text-center text-neutral-500 dark:text-[#666]">
                              <p className="font-bold uppercase tracking-widest text-neutral-900 dark:text-[#E4E4E4] mb-1">No matching students</p>
                              <p className="font-mono text-micro">Adjust search term or filter status</p>
                            </td>
                          </tr>
                        ) : (
                          paginatedStudents.map(student => {
                            const scholarship = state.scholarships.find(s => s.id === student.scholarshipId);

                            const enrollDate = getStudentEnrollDate(student);
                            const dueDay=String(billingDueDay(student,state.classEnrollments,tuitionMonth(filterMonth==='all'?months[currentActualMonthIndex]:filterMonth,filterYear))??'-');

                            return (
                              <tr key={student.id} className="hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors text-neutral-900 dark:text-[#E4E4E4] group">
                                {/* Sticky Student Column */}
                                <td
                                  className="sticky left-0 z-10 bg-white dark:bg-[#141414] group-hover:bg-neutral-50 dark:group-hover:bg-[#1A1A1A] border-r border-neutral-200 dark:border-[#262626] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] px-4 sm:px-5 py-3 cursor-pointer transition-colors w-[260px] min-w-[240px] sm:min-w-[260px] max-w-[280px]"
                                  onClick={() => { setStudentDetailsId(student.id); setPaymentAmounts({}); }}
                                >
                                  <div className="flex items-center gap-3">
                                    <SafeImage
                                      src={student.profilePicturePath}
                                      alt={student.englishName}
                                      containerClassName="w-8 h-8 rounded-full bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 group-hover:border-brand transition-colors"
                                      fallback={<span className="font-bold text-neutral-400 dark:text-[#666] text-micro">{student.englishName.charAt(0)}</span>}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="font-bold text-xs text-neutral-900 dark:text-white group-hover:text-brand-ink dark:group-hover:text-white transition-colors flex items-center gap-1.5 truncate">
                                        <button type="button" onClick={event => {event.stopPropagation();setStudentDetailsId(student.id);setPaymentAmounts({});}} className="min-h-[44px] truncate text-left hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2">{student.englishName}</button>
                                        {student.khmerName && (
                                          <span className="text-micro font-khmer text-neutral-400 dark:text-neutral-500 font-normal shrink-0">
                                            {student.khmerName}
                                          </span>
                                        )}
                                        {scholarship && scholarship.discountPercentage > 0 && (
                                          <span className="px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 font-bold uppercase tracking-widest text-micro border border-indigo-500/20 shrink-0">
                                            {scholarship.typeName}
                                          </span>
                                        )}
                                      </div>
                                      {/* Wraps onto a second line instead of cutting the branch name: the column is a fixed 260px wide. */}
                                      <div className="text-micro text-neutral-500 dark:text-[#666] font-mono mt-0.5 tracking-tight flex flex-wrap items-center gap-x-1">
                                        <span>{student.id}</span>
                                        <span className="opacity-50">•</span>
                                        <span>{state.branches.find(b => b.id === student.homeBranchId)?.name}</span>
                                        <span className="opacity-50">•</span>
                                        <span className="text-neutral-700 dark:text-neutral-300 font-bold">Due: Day {dueDay}</span>
                                      </div>
                                      <ContactActions contact={student} name={student.englishName} compact emailSubject="Tuition renewal" />
                                    </div>
                                  </div>
                                </td>

                                {/* 12 Interactive Month Cells */}
                                {months.map((m, idx) => {
                                  const isFuture = filterYear > currentActualYear || (filterYear === currentActualYear && idx > currentActualMonthIndex);
                                  const isBeforeEnroll = isMonthBeforeEnrollment(m, filterYear, enrollDate);
                                  const cycle=cycleFinance(student,m,filterYear); const isPaid=cycle.settled; const reqPayment=cycle.balance;
                                  const isCurrent = filterYear === currentActualYear && idx === currentActualMonthIndex;

                                  return (
                                    <td key={m} className="px-1.5 py-2 text-center w-16 min-w-[64px]">
                                      {isBeforeEnroll ? (
                                        <div
                                          title={`Pre-Enrollment (Enrolled ${enrollDate || 'N/A'})`}
                                          className="w-full h-8 flex flex-col justify-center items-center opacity-30 select-none"
                                        >
                                          <span className="text-micro font-bold uppercase tracking-wider font-mono text-neutral-400 dark:text-[#666]">Pre-Join</span>
                                        </div>
                                      ) : isPaid ? (
                                        <button
                                          type="button"
                                          onClick={() => { setStudentDetailsId(student.id); setPaymentAmounts({}); }}
                                          title={`${m} ${filterYear}: Paid $${(cycle.cash).toFixed(2)}`}
                                          className="w-full h-8 rounded-[6px] flex flex-col items-center justify-center transition-all bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 cursor-pointer shadow-xs active:scale-95 touch-manipulation"
                                        >
                                          <Check className="w-3.5 h-3.5 stroke-[3]"/>
                                          <span className="text-micro font-mono font-bold mt-0.5">
                                            ${(cycle.cash).toFixed(0)}
                                          </span>
                                        </button>
                                      ) : isFuture ? (
                                        <div
                                          title={`${m} ${filterYear}: Upcoming billing cycle`}
                                          className="w-full h-8 flex flex-col justify-center items-center opacity-30 select-none"
                                        >
                                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-600"></span>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => { setStudentDetailsId(student.id); setPaymentAmounts({}); }}
                                          title={`${m} ${filterYear}: ${isCurrent ? 'Due Now' : 'Overdue'} ($${reqPayment.toFixed(2)})`}
                                          className={cn(
                                            "w-full h-8 rounded-[6px] flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs relative overflow-hidden active:scale-95 touch-manipulation",
                                            isCurrent
                                              ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/35"
                                              : "bg-rose-500/15 hover:bg-rose-500/25 text-rose-800 dark:text-rose-300 border border-rose-500/35"
                                          )}
                                        >
                                          <span className="text-micro font-bold uppercase tracking-widest font-mono">
                                            {isCurrent ? 'DUE' : 'LATE'}
                                          </span>
                                          <span className="text-micro font-mono font-bold mt-0.5">
                                            ${reqPayment.toFixed(0)}
                                          </span>
                                          {isCurrent && <span className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500"></span>}
                                        </button>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        )}
                      </tbody>

                      {/* Sticky Footer: Monthly Yield & Rate Matrix Row */}
                      <tfoot className="sticky bottom-0 z-20 bg-neutral-100 dark:bg-[#0F0F0F] border-t-2 border-neutral-300 dark:border-[#262626] font-mono text-xs">
                        <tr>
                          <td className="sticky left-0 z-30 bg-neutral-100 dark:bg-[#0F0F0F] border-r border-neutral-200 dark:border-[#262626] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] px-4 sm:px-5 py-3 w-[260px] min-w-[240px] sm:min-w-[260px] max-w-[280px]">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-neutral-900 dark:text-white uppercase tracking-wider text-micro">
                                Total Monthly Yield
                              </span>
                              <span className="text-micro text-neutral-500 dark:text-neutral-400">
                                (Roster)
                              </span>
                            </div>
                          </td>
                          {monthlyLedgerMatrixTotals.map(totals => (
                            <td key={totals.month} className="px-1.5 py-2.5 text-center w-16 min-w-[64px]">
                              <div className="space-y-0.5">
                                <span className="font-bold text-emerald-700 dark:text-emerald-400 text-micro block">
                                  ${totals.totalCollected.toFixed(0)}
                                </span>
                                <div className="text-micro text-neutral-500 dark:text-neutral-400 flex items-center justify-center gap-0.5">
                                  <span>{totals.paidCount}/{totals.eligibleCount}</span>
                                </div>
                                {totals.eligibleCount > 0 && (
                                  <div className="w-full bg-neutral-200 dark:bg-[#202020] h-1 rounded-full overflow-hidden mt-1">
                                    <div
                                      className={cn(
                                        "h-full rounded-full",
                                        totals.rate >= 80 ? "bg-emerald-500" : totals.rate >= 50 ? "bg-amber-500" : "bg-rose-500"
                                      )}
                                      style={{ width: `${Math.min(totals.rate, 100)}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Pagination & Per-Page Controls (Responsive) */}
              {filteredStudents.length > 0 && (
                <div className="p-3 border border-neutral-200 dark:border-[#262626] rounded-[8px] bg-white dark:bg-[#141414] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-xs">
                  <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 font-mono text-micro">
                    <span>
                      Showing {Math.min((ledgerPage - 1) * ledgerPerPage + 1, filteredStudents.length)}–{Math.min(ledgerPage * ledgerPerPage, filteredStudents.length)} of {filteredStudents.length} students
                    </span>
                    <span className="opacity-40">•</span>
                    <span>Rows:</span>
                    <select aria-label="Rows per page"
                      value={ledgerPerPage}
                      onChange={(e) => {
                        setLedgerPerPage(Number(e.target.value));
                        setLedgerPage(1);
                      }}
                      className="min-h-8 pointer-coarse:min-h-9 bg-neutral-100 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded px-1.5 py-0.5 text-neutral-900 dark:text-white font-mono cursor-pointer"
                    >
                      <option value={15}>15</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setLedgerPage(p => Math.max(1, p - 1))}
                      disabled={ledgerPage <= 1}
                      className="px-3 py-1.5 rounded-[6px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#222] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 min-h-[34px] pointer-coarse:min-h-11"
                    >
                      <CaretLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>

                    <span className="px-2 font-mono text-micro text-neutral-600 dark:text-neutral-400">
                      Page <strong className="text-neutral-900 dark:text-white">{ledgerPage}</strong> of {totalLedgerPages}
                    </span>

                    <button
                      onClick={() => setLedgerPage(p => Math.min(totalLedgerPages, p + 1))}
                      disabled={ledgerPage >= totalLedgerPages}
                      className="px-3 py-1.5 rounded-[6px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1A1A1A] dark:hover:bg-[#222] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 min-h-[34px] pointer-coarse:min-h-11"
                    >
                      <span>Next</span>
                      <CaretRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}</>;
}
