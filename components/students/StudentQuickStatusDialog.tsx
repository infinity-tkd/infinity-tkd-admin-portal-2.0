'use client';

import type React from 'react';
import { Portal } from '@/components/Portal';
import { ModalA11y } from '@/components/ui/ModalA11y';
import { cn } from '@/lib/utils';
import type { Student } from '@/lib/store';

export interface StudentQuickStatusDialogProps {
  isSavingStatus: boolean;
  quickStatusForm: { studentStatus: "Active" | "Paused" | "Inactive" | "Suspended" | "Graduated"; statusReason: string; pauseEndDate: string; };
  selectedStudentForStatus: any;
  setIsSavingStatus: React.Dispatch<React.SetStateAction<boolean>>;
  setQuickStatusForm: React.Dispatch<React.SetStateAction<{ studentStatus: "Active" | "Paused" | "Inactive" | "Suspended" | "Graduated"; statusReason: string; pauseEndDate: string; }>>;
  setSelectedStudentForStatus: React.Dispatch<any>;
  showNotification: (message: string, type?: "success" | "error" | "info" | "warning" | undefined, title?: string | undefined, code?: string | undefined, details?: string | undefined) => void;
  updateStudent: (id: string, data: Partial<Student>) => Promise<void>;
}

export function StudentQuickStatusDialog({ isSavingStatus, quickStatusForm, selectedStudentForStatus, setIsSavingStatus, setQuickStatusForm, setSelectedStudentForStatus, showNotification, updateStudent }: StudentQuickStatusDialogProps) {
  return (
    <Portal>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <ModalA11y label="Change student status" onClose={() => setSelectedStudentForStatus(null)} locked={isSavingStatus} />
        <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-6 max-w-md w-full shadow-2xl space-y-4 text-neutral-900 dark:text-white animate-in zoom-in-95 duration-150 max-h-[90dvh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white">Manage Membership Status</h3>
              <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono mt-0.5">{selectedStudentForStatus.englishName} ({selectedStudentForStatus.id})</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedStudentForStatus(null)}
              aria-label="Close status modal"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[8px] text-neutral-400 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] transition-colors text-sm font-bold cursor-pointer active:scale-95 touch-manipulation"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest text-neutral-500 dark:text-[#888] mb-1.5">Select New Status</label>
              <div className="grid grid-cols-2 gap-2">
                {(['Active', 'Paused', 'Inactive', 'Suspended', 'Graduated'] as const).map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setQuickStatusForm({ ...quickStatusForm, studentStatus: st })}
                    className={cn(
                      "px-3 py-2 rounded-[8px] text-xs font-bold uppercase tracking-wider border text-center transition-all cursor-pointer select-none",
                      quickStatusForm.studentStatus === st
                        ? st === 'Active' ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500 font-black"
                          : st === 'Paused' ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500 font-black"
                          : st === 'Inactive' ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-400 dark:border-neutral-600 font-black"
                          : st === 'Suspended' ? "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500 font-black"
                          : "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500 font-black"
                        : "bg-neutral-100 dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-[#1A1A1A]"
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {(quickStatusForm.studentStatus === 'Paused' || quickStatusForm.studentStatus === 'Inactive' || quickStatusForm.studentStatus === 'Suspended') && (
              <div className="space-y-3 bg-neutral-50 dark:bg-[#0F0F0F] p-3 rounded-[8px] border border-neutral-200 dark:border-[#262626] animate-in fade-in duration-150">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-neutral-500 dark:text-[#888] mb-1">Status Reason / Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Medical leave (knee injury), School exam break, Moving away"
                    value={quickStatusForm.statusReason}
                    onChange={e => setQuickStatusForm({ ...quickStatusForm, statusReason: e.target.value })}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white rounded-[8px] px-3 py-2 text-xs focus:outline-none focus:border-brand"
                  />
                </div>

                {quickStatusForm.studentStatus === 'Paused' && (
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-neutral-500 dark:text-[#888] mb-1">Expected Return Date</label>
                    <input
                      type="date"
                      value={quickStatusForm.pauseEndDate}
                      onChange={e => setQuickStatusForm({ ...quickStatusForm, pauseEndDate: e.target.value })}
                      className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white rounded-[8px] px-3 py-2 text-xs focus:outline-none focus:border-brand"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-neutral-200 dark:border-[#262626] pt-3">
            <button
              type="button"
              onClick={() => setSelectedStudentForStatus(null)}
              className="px-4 py-2 rounded-[8px] bg-neutral-100 dark:bg-[#1A1A1A] text-xs font-bold text-neutral-600 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-[#262626] cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSavingStatus}
              onClick={async () => {
                setIsSavingStatus(true);
                try {
                  await updateStudent(selectedStudentForStatus.id, {
                    studentStatus: quickStatusForm.studentStatus,
                    statusReason: quickStatusForm.statusReason,
                    pauseEndDate: quickStatusForm.pauseEndDate
                  });
                  showNotification(`Updated status for ${selectedStudentForStatus.englishName} to ${quickStatusForm.studentStatus}`, 'success');
                  setSelectedStudentForStatus(null);
                } catch (e: any) {
                  showNotification(`Failed to update status: ${e.message}`, 'error');
                } finally {
                  setIsSavingStatus(false);
                }
              }}
              className="px-4 py-2 rounded-[8px] bg-brand text-xs font-bold text-white uppercase tracking-wider hover:opacity-90 disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-md shadow-brand/20"
            >
              {isSavingStatus ? 'Saving...' : 'Update Status'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
