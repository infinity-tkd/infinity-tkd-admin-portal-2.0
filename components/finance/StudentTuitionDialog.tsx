'use client';
import { isMonthBeforeEnrollment } from '@/lib/tuition-payments';
import { ContactActions } from '@/components/ContactActions';
import { MembershipSchedulePanel } from '@/components/MembershipSchedulePanel';
import { dialogMotion } from '@/lib/motion';
import React, { useRef } from 'react';
import { useModalFocus } from '@/hooks/use-modal-focus';
import { useAppStore, Student } from '@/lib/store';
import { motion } from 'motion/react';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { FileText } from '@phosphor-icons/react/dist/csr/FileText';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';

import { cn } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { SafeImage } from '@/components/SafeImage';



interface StudentTuitionDialogProps {
  activeStudentProfile: Student;
  filterYear: number;
  setStudentDetailsId: React.Dispatch<React.SetStateAction<string | null>>;
  activeStudentScholarship: import("@/lib/store").Scholarship | null | undefined;
  activeDiscountPct: number;
  netMonthlyFee: number;
  studentBasePrice: number;
  activeBillingAnchorDay: string;
  activeStudentEnrollDate: string | null;
  isReadOnlyLedger: boolean;
  paymentBusy: boolean;
  setShowPrepayPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showPrepayPanel: boolean;
  prepayMonths: number;
  setPrepayMonths: React.Dispatch<React.SetStateAction<number>>;
  setPrepayAmount: React.Dispatch<React.SetStateAction<string>>;
  prepayStartMonth: string;
  setPrepayStartMonth: React.Dispatch<React.SetStateAction<string>>;
  months: string[];
  prepayStartYear: number;
  setPrepayStartYear: React.Dispatch<React.SetStateAction<number>>;
  currentActualYear: number;
  prepayAmount: string;
  prepayPreviewList: { year: number; month: string; amount: number; }[];
  handleProcessBulkPrepay: () => Promise<void>;
  isProcessingPrepay: boolean;
  getStudentEnrollDate: (st: Student) => string;
  state: ReturnType<typeof useAppStore>['state'];
  cycleFinance: (student: Student, month: string, year: number) => { amount: number; gross: number; discount: number; balance: number; cash: number; settled: boolean; waived: boolean; invoice: boolean; };
  currentActualMonthIndex: number;
  paymentAmounts: Record<string, string>;
  setPaymentAmounts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  payInvoice: (studentId: string, year: number, month: string, amount: number) => Promise<boolean>;
  showNotification: (message: string, type?: "success" | "error" | "info" | "warning", title?: string, code?: string, details?: string) => void;
  setShowReceipt: React.Dispatch<React.SetStateAction<{ student: Student; month: string; year: number; amount: number; } | null>>;
}

export function StudentTuitionDialog({ activeStudentProfile, filterYear, setStudentDetailsId, activeStudentScholarship, activeDiscountPct, netMonthlyFee, studentBasePrice, activeBillingAnchorDay, activeStudentEnrollDate, isReadOnlyLedger, paymentBusy, setShowPrepayPanel, showPrepayPanel, prepayMonths, setPrepayMonths, setPrepayAmount, prepayStartMonth, setPrepayStartMonth, months, prepayStartYear, setPrepayStartYear, currentActualYear, prepayAmount, prepayPreviewList, handleProcessBulkPrepay, isProcessingPrepay, getStudentEnrollDate, state, cycleFinance, currentActualMonthIndex, paymentAmounts, setPaymentAmounts, payInvoice, showNotification, setShowReceipt }: StudentTuitionDialogProps) {
  const dialog=useRef<HTMLDivElement>(null);
  useModalFocus(dialog,()=>{if(!(paymentBusy || isProcessingPrepay))setStudentDetailsId(null);});
  return <>{(
          <Portal>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
               <motion.div ref={dialog} role="dialog" aria-modal="true" aria-label="Student tuition details" tabIndex={-1} {...dialogMotion} className="w-full max-w-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl flex flex-col overflow-hidden max-h-[90dvh]"><fieldset disabled={isProcessingPrepay || paymentBusy} className="contents">
                  <div className="p-5 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-between items-center z-10 sticky top-0 shrink-0">
                    <div className="flex items-center gap-3">
                      <SafeImage
                        src={activeStudentProfile.profilePicturePath}
                        alt={activeStudentProfile.englishName}
                        containerClassName="w-10 h-10 rounded-[8px] bg-neutral-100 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0"
                        fallback={<span className="font-bold text-[#666] text-xs">{activeStudentProfile.englishName.charAt(0)}</span>}
                      />
                      <div>
                        <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2 leading-tight">
                          {activeStudentProfile.englishName}
                          <span className="text-xs font-mono text-[#666] bg-neutral-200 dark:bg-[#1A1A1A] text-neutral-700 dark:text-[#888] px-2 py-0.5 rounded-[8px]">{activeStudentProfile.id}</span>
                        </h2>
                        <p className="text-micro text-neutral-500 dark:text-[#888] uppercase font-bold tracking-widest mt-1">Financial Dossier • FY {filterYear}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={paymentBusy || isProcessingPrepay} onClick={() => setStudentDetailsId(null)}
                      aria-label="Close student dossier"
                      className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:text-[#666] dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-[#262626] transition-colors cursor-pointer active:scale-95 touch-manipulation"
                    >
                      <X className="w-4 h-4"/>
                    </button>
                  </div>

                  <div className="p-5 flex-1 overflow-y-auto space-y-6 bg-white dark:bg-[#0A0A0A] custom-scrollbar">
                     <ContactActions contact={activeStudentProfile} name={activeStudentProfile.englishName} emailSubject="Tuition renewal" />
                     <MembershipSchedulePanel studentId={activeStudentProfile.id} />
                     {/* Student Insight Cards */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 flex items-center justify-between">
                           <div>
                              <p className="text-micro text-[#666] uppercase font-bold tracking-widest mb-1">Scholarship / Plan</p>
                              <p className="text-sm text-neutral-900 dark:text-[#E4E4E4] font-bold">{activeStudentScholarship?.typeName || 'Standard'}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-micro text-[#666] uppercase font-bold tracking-widest mb-1">Discount Rate</p>
                              <p className="text-sm font-mono text-indigo-400">{activeDiscountPct}%</p>
                           </div>
                        </div>
                        <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 flex items-center justify-between">
                            <div>
                               <p className="text-micro text-[#666] uppercase font-bold tracking-widest mb-1">Net Monthly Fee</p>
                               <p className="text-xl font-mono text-neutral-900 dark:text-white">${netMonthlyFee.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                               <p className="text-micro text-[#666] uppercase font-bold tracking-widest mb-1">Base Price</p>
                               <p className="text-xs font-mono text-[#666] line-through">${studentBasePrice.toFixed(2)}</p>
                            </div>
                         </div>
                         <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 flex items-center justify-between col-span-1 md:col-span-2">
                             <div>
                                <p className="text-micro text-[#666] uppercase font-bold tracking-widest mb-1">Monthly Billing Anniversary</p>
                                <p className="text-xs text-neutral-800 dark:text-white">
                                  Due day: <span className="font-bold text-red-500 font-mono">{activeBillingAnchorDay}</span> (enrollment anniversary unless an admin change applies)
                                </p>
                             </div>
                             <div className="text-right">
                                <p className="text-micro text-[#666] uppercase font-bold tracking-widest mb-1">Enrollment Base Date</p>
                                <p className="text-xs font-mono text-[#CCC]">{activeStudentEnrollDate || 'Not set'}</p>
                             </div>
                          </div>
                      </div>

                      {/* Rapid Prepayment Console */}
                      {!isReadOnlyLedger && (
                        <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
                          <button
                            onClick={() => setShowPrepayPanel(!showPrepayPanel)}
                            className="w-full px-4 py-3 bg-neutral-100 dark:bg-[#0F0F0F] flex items-center justify-between text-xs font-bold uppercase tracking-wider text-indigo-400 hover:text-white transition-colors cursor-pointer"
                          >
                           <span className="flex items-center gap-2">
                             <Sparkle className="w-4 h-4 text-indigo-400"/>
                             ⭐ Rapid Multi-Month Prepayment Console
                           </span>
                           <span className="text-micro text-[#666] font-mono">
                             {showPrepayPanel ? 'Collapse ▲' : 'Expand ▼'}
                           </span>
                         </button>

                         {showPrepayPanel && (
                           <div className="p-4 border-t border-neutral-200 dark:border-[#262626] space-y-4 animate-in slide-in-from-top-2 duration-200">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                 <div>
                                    <label htmlFor="student-tuition-dialog-prepay-term" className="block text-micro uppercase font-bold text-[#666] mb-1.5">Prepay Term</label>
                                    <select id="student-tuition-dialog-prepay-term"
                                      value={prepayMonths}
                                      onChange={(e) => {
                                        const mCount = Number(e.target.value);
                                        setPrepayMonths(mCount);
                                        setPrepayAmount('');
                                      }}
                                      className="w-full bg-white dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs px-3 py-2.5 focus:outline-none focus:border-[#444]"
                                    >
                                      <option value={1}>1 Month</option>
                                      <option value={3}>3 Months (Quarterly)</option>
                                      <option value={6}>6 Months (Half-Year)</option>
                                      <option value={12}>12 Months (1 Year Plan)</option>
                                      <option value={24}>24 Months (2 Years Plan)</option>
                                    </select>
                                 </div>

                                 <div>
                                    <label className="block text-micro uppercase font-bold text-[#666] mb-1.5">Start Month / Year</label>
                                    <div className="flex gap-2">
                                       <select aria-label="Prepay start month"
                                         value={prepayStartMonth}
                                         onChange={(e) => setPrepayStartMonth(e.target.value)}
                                         className="flex-1 bg-white dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs px-2.5 py-2.5 focus:outline-none focus:border-[#444]"
                                       >
                                         {months.map(m => (
                                           <option key={m} value={m}>{m}</option>
                                         ))}
                                       </select>
                                       <select aria-label="Prepay start year"
                                         value={prepayStartYear}
                                         onChange={(e) => setPrepayStartYear(Number(e.target.value))}
                                         className="flex-1 bg-white dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs px-2.5 py-2.5 focus:outline-none focus:border-[#444]"
                                       >
                                         <option value={currentActualYear}>{currentActualYear}</option>
                                         <option value={currentActualYear + 1}>{currentActualYear + 1}</option>
                                       </select>
                                    </div>
                                 </div>

                                 <div>
                                    <label htmlFor="student-tuition-dialog-total-prepaid-amount" className="block text-micro uppercase font-bold text-[#666] mb-1.5">Total Prepaid Amount</label>
                                    <div className="relative">
                                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#666]">$</span>
                                       <input id="student-tuition-dialog-total-prepaid-amount"
                                         type="number"
                                         placeholder={(netMonthlyFee * prepayMonths).toFixed(2)}
                                         value={prepayAmount}
                                         onChange={(e) => setPrepayAmount(e.target.value)}
                                         className="w-full pl-6 pr-3 py-2 bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-[#E4E4E4] rounded-[8px] text-xs focus:outline-none focus:border-[#444] transition-all placeholder:text-[#444] font-mono"
                                       />
                                    </div>
                                 </div>
                              </div>

                              {/* Dynamic Prepayment Schedule Preview */}
                              <div className="border-t border-[#262626] pt-4 mt-2">
                                <p className="text-micro text-[#888] uppercase font-bold tracking-wider mb-2">Prepayment Coverage Timeline</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                                  {prepayPreviewList.map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2.5 flex flex-col justify-between hover:border-[#333] transition-colors"
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="text-micro font-bold text-white">{item.month} {item.year}</span>
                                        <span className="text-micro bg-indigo-500/20 text-indigo-400 font-mono font-bold px-1.5 py-0.5 rounded-[8px]">#{idx + 1}</span>
                                      </div>
                                      <div className="flex items-end justify-between mt-2.5">
                                        <span className="text-micro text-[#666] uppercase tracking-wider font-mono">Billed</span>
                                        <span className="text-micro font-bold text-green-400 font-mono">${item.amount.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-3 rounded-[8px] flex items-center justify-between text-xs mt-3">
                                 <div>
                                    <span className="text-[#666] uppercase text-micro font-bold block mb-0.5">Prepayment breakdown</span>
                                    <span className="text-white font-mono">
                                      {prepayMonths} Months × ${(prepayPreviewList[0]?.amount ?? 0).toFixed(2)}/mo
                                    </span>
                                 </div>
                                 <button
                                   onClick={handleProcessBulkPrepay}
                                   disabled={isProcessingPrepay}
                                   className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[8px] font-bold uppercase tracking-wider text-micro transition-colors shadow-md shadow-indigo-600/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                 >
                                   {isProcessingPrepay ? (
                                     <>
                                       <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                       Processing...
                                     </>
                                   ) : (
                                     'Process Prepayment'
                                   )}
                                 </button>
                              </div>
                           </div>
                         )}
                      </div>
                      )}

                      {/* Ledger Table */}
                      <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-x-auto custom-scrollbar shadow-sm">
                        <table className="w-full text-left text-xs whitespace-nowrap min-w-[500px]">
                           <thead className="bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-500 dark:text-neutral-400 uppercase tracking-widest font-bold border-b border-neutral-200 dark:border-[#262626]">
                             <tr>
                                <th className="px-4 py-3">Billing Cycle</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                                <th className="px-4 py-3 text-right">Action</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                             {months.map((m, i) => {
                                const isBeforeEnroll = isMonthBeforeEnrollment(m, filterYear, getStudentEnrollDate(activeStudentProfile));
                                if (isBeforeEnroll) {
                                  return (
                                    <tr key={m} className="opacity-45 text-[#666] select-none">
                                      <td className="px-4 py-3">
                                        <div className="font-bold">{m} {filterYear}</div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className="px-2.5 py-1 bg-neutral-900 border border-[#262626] rounded-[8px] font-bold uppercase text-micro tracking-widest text-[#666] font-mono">
                                          Pre-Enrollment
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-right font-mono">—</td>
                                      <td className="px-4 py-3 flex justify-end">—</td>
                                    </tr>
                                  );
                                }

                                const payment = state.payments.find(p => p.studentId === activeStudentProfile.id && p.year === filterYear && p.month === m);
                                const cycle=cycleFinance(activeStudentProfile,m,filterYear); const isPaid=cycle.settled;
                                const isCurrent = filterYear === currentActualYear && i === currentActualMonthIndex;
                                const isFuture = filterYear > currentActualYear || (filterYear === currentActualYear && i > currentActualMonthIndex);
                                const requiredAmt = cycle.balance;

                                return (
                                  <tr key={m} className={cn("hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors text-neutral-800 dark:text-[#E4E4E4]", isCurrent && !isPaid && "bg-yellow-500/5", isFuture && !isPaid && "opacity-70")}>
                                    <td className="px-4 py-3">
                                      <div className="font-bold flex items-center gap-2">
                                        {m} {filterYear}
                                        {isCurrent && <span className="text-micro bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded-[8px] uppercase tracking-widest font-bold">Current</span>}
                                        {isFuture && !isPaid && <span className="text-micro bg-[#262626] text-[#888] px-1.5 py-0.5 rounded-[8px] uppercase tracking-widest font-bold font-mono">Upcoming</span>}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={cn(
                                        "px-2 py-1 rounded-[8px] font-bold uppercase text-micro tracking-widest border",
                                        isPaid ? "bg-green-500/10 text-green-500 border-green-500/20" :
                                        (isCurrent ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                                        (isFuture ? "bg-neutral-900 text-[#888] border-neutral-800" : "bg-red-500/10 text-red-500 border-red-500/20"))
                                      )}>
                                        {isPaid ? (cycle.waived ? 'Waived' : cycle.cash>0 ? 'Paid' : 'Settled without cash') : (cycle.cash>0 ? 'Partly paid' : isFuture ? 'Upcoming' : 'Unpaid')}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-[#999]">
                                      {isPaid ? (
                                        <span className="text-neutral-900 dark:text-white font-bold">${cycle.cash.toFixed(2)} collected</span>
                                      ) : (
                                        <div className="flex items-center justify-end gap-1">
                                          <span className="text-[#666]">$</span>
                                          <input aria-label={`Amount for ${m}`}
                                            type="number"
                                            disabled={isReadOnlyLedger || paymentBusy || isProcessingPrepay}
                                            value={paymentAmounts[m] !== undefined ? paymentAmounts[m] : requiredAmt.toFixed(2)}
                                            onChange={(e) => setPaymentAmounts(prev => ({ ...prev, [m]: e.target.value }))}
                                            className="w-16 bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1 text-xs text-neutral-800 dark:text-white text-right focus:outline-none focus:border-[#444] disabled:opacity-50 disabled:cursor-not-allowed"
                                          />
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 flex justify-end">
                                      {!isPaid && !isReadOnlyLedger && (
                                        <button onClick={async () => {
                                           try {
                                             const inputAmt = parseFloat(paymentAmounts[m] !== undefined ? paymentAmounts[m] : String(requiredAmt));
                                             if (!Number.isFinite(inputAmt) || inputAmt < 0) throw new Error('Enter a valid amount.');
                                             if(!await payInvoice(activeStudentProfile.id, filterYear, m, inputAmt))return;
                                             showNotification(`Payment recorded for ${m} ${filterYear}: ${inputAmt.toFixed(2)}`, 'success');
                                           } catch (error) { showNotification(error instanceof Error ? error.message : 'Payment was not recorded.', 'error'); }
                                          }}
                                          className="px-3.5 py-1.5 min-h-[32px] bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 rounded-[6px] text-micro font-bold uppercase tracking-widest transition-colors shadow-xs cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center pointer-coarse:min-h-11" disabled={paymentBusy || isReadOnlyLedger} aria-busy={paymentBusy}
                                        >
                                          Mark Paid
                                        </button>
                                      )}
                                      {!isPaid && isReadOnlyLedger && (
                                        <span className="text-micro font-mono text-neutral-500 uppercase">View Only</span>
                                      )}
                                      {(isPaid || payment?.verifiedCollection) && (
                                        <button
                                          onClick={() => setShowReceipt({
                                            student: activeStudentProfile,
                                            month: m,
                                            year: filterYear,
                                            amount: payment?.amountUsd !== undefined ? payment.amountUsd : requiredAmt
                                          })}
                                          className="px-3.5 py-1.5 min-h-[32px] bg-[#1A1A1A] hover:bg-[#262626] border border-[#333] hover:border-[#444] text-[#E4E4E4] hover:text-white rounded-[6px] text-micro font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                                        >
                                          <FileText className="w-3.5 h-3.5"/> E-Receipt
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                             })}
                           </tbody>
                        </table>
                     </div>
                  </div>
                </fieldset></motion.div>
              </div>
          </Portal>
        )}</>;
}
