'use client';
import { ContactActions } from '@/components/ContactActions';
import { dialogMotion } from '@/lib/motion';
import React, {useRef} from 'react';
import {useModalFocus} from '@/hooks/use-modal-focus';
import { Student } from '@/lib/store';
import { motion } from 'motion/react';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Portal } from '@/components/Portal';
import { SafeImage } from '@/components/SafeImage';


interface RenewalDayDialogProps {
  selectedCalendarDay: { year: number; month: string; day: number; };
  calendarData: { daysInMonth: number; firstDayOffset: number; dayMap: Record<number, { student: Student; billingStatus: "Paid" | "Due Soon" | "Due today" | "Within grace" | "Overdue" | "Waived" | "Upcoming"; amountOwed: number; baseFee: number; discountPct: number; branchName: string; scholarshipName: string; dueDay: number; }[]>; stats: { total: number; paid: number; pending: number; overdue: number; waived: number; expected: number; collected: number; outstanding: number; }; };
  setSelectedCalendarDay: React.Dispatch<React.SetStateAction<{ year: number; month: string; day: number; } | null>>;
  selectedDaySearch: string;
  setSelectedDaySearch: React.Dispatch<React.SetStateAction<string>>;
  setStudentDetailsId: React.Dispatch<React.SetStateAction<string | null>>;
  setPaymentAmounts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isReadOnlyLedger: boolean;
  paymentBusy: boolean;
  payInvoice: (studentId: string, year: number, month: string, amount: number) => Promise<boolean>;
  showNotification: (message: string, type?: "success" | "error" | "info" | "warning", title?: string, code?: string, details?: string) => void;
  setShowReceipt: React.Dispatch<React.SetStateAction<{ student: Student; month: string; year: number; amount: number; } | null>>;
}

export function RenewalDayDialog({ selectedCalendarDay, calendarData, setSelectedCalendarDay, selectedDaySearch, setSelectedDaySearch, setStudentDetailsId, setPaymentAmounts, isReadOnlyLedger, paymentBusy, payInvoice, showNotification, setShowReceipt }: RenewalDayDialogProps) {
  const dialog=useRef<HTMLDivElement>(null);
  useModalFocus(dialog,()=>{if(!(paymentBusy))setSelectedCalendarDay(null);});
  return <>{(
          <Portal>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <motion.div ref={dialog} role="dialog" aria-modal="true" aria-label="Renewals for selected date" tabIndex={-1}
                {...dialogMotion}
                className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] w-full max-w-2xl max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl transition-colors"
              >
                {/* Modal Header */}
                <div className="p-4 bg-neutral-50 dark:bg-[#0F0F0F] border-b border-neutral-200 dark:border-[#262626] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#EF2F38]/10 border border-[#EF2F38]/30 flex items-center justify-center text-[#EF2F38] font-mono font-bold text-sm">
                      {selectedCalendarDay.day}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
                        <span>Renewal Cohort - {selectedCalendarDay.month} {selectedCalendarDay.day}, {selectedCalendarDay.year}</span>
                      </h2>
                      <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono tracking-widest mt-0.5 font-semibold">
                        {calendarData.dayMap[selectedCalendarDay.day]?.length || 0} Students Scheduled For Billing Renewal
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={paymentBusy} onClick={() => setSelectedCalendarDay(null)}
                    aria-label="Close renewal cohort modal"
                    className="p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center bg-neutral-200 hover:bg-neutral-300 dark:bg-[#1F1F1F] dark:hover:bg-[#2A2A2A] text-neutral-700 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white rounded-[8px] transition-colors cursor-pointer active:scale-95 touch-manipulation"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Search Bar inside Drawer */}
                <div className="p-3 bg-white dark:bg-[#141414] border-b border-neutral-200 dark:border-[#262626]">
                  <div className="relative">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 dark:text-[#666]"/>
                    <input
                      type="text"
                      placeholder="Search student in this cohort..."
                      value={selectedDaySearch}
                      onChange={(e) => setSelectedDaySearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] text-xs focus:outline-none focus:border-[#EF2F38] transition-all placeholder:text-neutral-400 dark:placeholder:text-[#666] font-mono"
                    />
                  </div>
                </div>

                {/* Cohort Student List */}
                <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-2.5">
                  {(() => {
                    const cohort = (calendarData.dayMap[selectedCalendarDay.day] || []).filter(item => {
                      if (!selectedDaySearch.trim()) return true;
                      const q = selectedDaySearch.toLowerCase();
                      return item.student.englishName.toLowerCase().includes(q) || item.student.id.toLowerCase().includes(q);
                    });

                    if (cohort.length === 0) {
                      return (
                        <div className="py-12 text-center text-neutral-500 dark:text-[#666]">
                          <p className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white mb-1">No matching students found</p>
                          <p className="text-[10px] font-mono">Try adjusting your search criteria</p>
                        </div>
                      );
                    }

                    return cohort.map(item => {
                      const { student, billingStatus, amountOwed, discountPct, branchName, scholarshipName } = item;

                      return (
                        <div key={student.id} className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] hover:border-neutral-300 dark:hover:border-[#333] rounded-[8px] p-3 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Left Student Info */}
                          <div className="flex items-center gap-3">
                            <SafeImage
                              src={student.profilePicturePath}
                              alt={student.englishName}
                              className="w-10 h-10 rounded-full object-cover border border-neutral-300 dark:border-[#262626] shrink-0"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => {setSelectedCalendarDay(null);setStudentDetailsId(student.id);setPaymentAmounts({});}} className="text-xs font-bold text-neutral-900 hover:text-[#EF2F38] dark:text-white tracking-tight text-left">{student.englishName}</button>
                                {billingStatus === 'Paid' && (
                                  <span className="px-2 py-0.5 rounded-[8px] bg-green-500/10 text-green-600 dark:text-green-400 font-bold uppercase text-[9px] border border-green-500/30 flex items-center gap-1">
                                    <CheckCircle className="w-2.5 h-2.5" /> Paid
                                  </span>
                                )}
                                {billingStatus === 'Overdue' && (
                                  <span className="px-2 py-0.5 rounded-[8px] bg-red-500/10 text-red-600 dark:text-red-400 font-bold uppercase text-[9px] border border-red-500/30 flex items-center gap-1">
                                    <Warning className="w-2.5 h-2.5" /> Overdue
                                  </span>
                                )}
                                {['Due Soon','Due today','Within grace'].includes(billingStatus) && (
                                  <span className="px-2 py-0.5 rounded-[8px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold uppercase text-[9px] border border-amber-500/30 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" /> {billingStatus}
                                  </span>
                                )}
                                {billingStatus === 'Waived' && (
                                  <span className="px-2 py-0.5 rounded-[8px] bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold uppercase text-[9px] border border-purple-500/30">
                                    Waived (100%)
                                  </span>
                                )}
                              </div>

                              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                                <span>ID: {student.id}</span>
                                <span>•</span>
                                <span>{branchName}</span>
                                <span>•</span>
                                <span>{scholarshipName}</span>
                              </div>
                              <ContactActions contact={student} name={student.englishName} emailSubject="Tuition renewal" />
                            </div>
                          </div>

                          {/* Right Action & Amount */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t border-neutral-200/60 dark:border-[#1E1E1E] sm:border-t-0">
                            <div className="text-left sm:text-right">
                              <span className="text-[9px] text-neutral-500 dark:text-[#666] font-mono uppercase block font-semibold">Monthly Fee</span>
                              <div className="text-xs font-bold font-mono text-neutral-900 dark:text-white">
                                {discountPct === 100 ? (
                                  <span className="text-purple-600 dark:text-purple-400">$0.00</span>
                                ) : (
                                  <span>${amountOwed.toFixed(2)}</span>
                                )}
                                {discountPct > 0 && discountPct < 100 && (
                                  <span className="text-[9px] text-green-600 dark:text-green-400 font-mono ml-1 font-bold">({discountPct}% Off)</span>
                                )}
                              </div>
                            </div>

                            {billingStatus !== 'Paid' && billingStatus !== 'Waived' ? (
                              !isReadOnlyLedger ? (
                                <button
                                  onClick={async () => {
                                    try {
                                      if(!await payInvoice(student.id, selectedCalendarDay.year, selectedCalendarDay.month, amountOwed))return;
                                      showNotification(`Recorded $${amountOwed.toFixed(2)} payment for ${student.englishName}!`, 'success');
                                    } catch (e: any) {
                                      console.error(e);
                                      showNotification("Failed to record payment.", 'error');
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-[#EF2F38] hover:bg-[#D0252D] text-white font-bold uppercase tracking-wider text-[10px] rounded-[8px] transition-colors flex items-center gap-1 shadow-md cursor-pointer" disabled={paymentBusy || isReadOnlyLedger} aria-busy={paymentBusy}
                                >
                                  Record Payment
                                </button>
                              ) : (
                                <span className="text-[10px] font-mono text-neutral-400 dark:text-[#666] italic">View Only</span>
                              )
                            ) : billingStatus === 'Paid' ? (
                              <button
                                onClick={() => setShowReceipt({
                                  student,
                                  month: selectedCalendarDay.month,
                                  year: selectedCalendarDay.year,
                                  amount: amountOwed
                                })}
                                className="px-3 py-1.5 bg-neutral-200 hover:bg-neutral-300 dark:bg-[#1F1F1F] dark:hover:bg-[#2A2A2A] border border-neutral-300 dark:border-[#333] text-neutral-900 dark:text-white font-bold uppercase tracking-wider text-[10px] rounded-[8px] transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Receipt className="w-3.5 h-3.5 text-[#EF2F38]" /> E-Receipt
                              </button>
                            ) : (
                              <span className="text-[10px] font-mono text-neutral-400 dark:text-[#666] italic">No payment needed</span>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Modal Footer */}
                <div className="p-3 bg-neutral-50 dark:bg-[#0F0F0F] border-t border-neutral-200 dark:border-[#262626] flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                  <span>Anniversary Due Date: Day {selectedCalendarDay.day}</span>
                  <button
                    onClick={() => setSelectedCalendarDay(null)}
                    className="px-3 py-1 bg-neutral-200 hover:bg-neutral-300 dark:bg-[#1F1F1F] dark:hover:bg-[#2A2A2A] text-neutral-800 dark:text-[#CCC] hover:text-neutral-900 dark:hover:text-white rounded-[8px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Close Drawer
                  </button>
                </div>
              </motion.div>
            </div>
          </Portal>
        )}</>;
}
