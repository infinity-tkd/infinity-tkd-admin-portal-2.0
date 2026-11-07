'use client';
import { useAppStore } from '@/lib/store';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Globe } from '@phosphor-icons/react/dist/csr/Globe';
import { Pencil } from '@phosphor-icons/react/dist/csr/Pencil';
import { cn, formatBeltLocalized } from '@/lib/utils';
import { useT } from '@/hooks/useTranslation';
import type { Student, BeltHistory } from '@/lib/store';


interface StudentBeltsTabProps {
  t: ReturnType<typeof useT>;
  canEdit: boolean;
  handleOpenBulkBeltModal: () => void;
  handleOpenBeltModal: () => void;
  beltHistory: BeltHistory[];
  state: ReturnType<typeof useAppStore>['state'];
  student: Student;
  handleStartEditBelt: (history: any) => void;
  showConfirm: (message: string, onConfirm: () => void, title?: string, onCancel?: () => void) => void;
  deleteBeltHistory: (id: number, studentId: string) => Promise<void>;
  showNotification: (message: string, type?: "success" | "error" | "info" | "warning", title?: string, code?: string, details?: string) => void;
}

export function StudentBeltsTab({ t, canEdit, handleOpenBulkBeltModal, handleOpenBeltModal, beltHistory, state, student, handleStartEditBelt, showConfirm, deleteBeltHistory, showNotification }: StudentBeltsTabProps) {
  return <>{(
            <div className="space-y-6">
               <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
                 <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-100 dark:bg-[#0F0F0F]">
                   <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-800 dark:text-white">{t('panel_tab_belts')}</h3>
                   {canEdit && (
                     <div className="flex gap-2">
                       <button onClick={handleOpenBulkBeltModal} className="text-[10px] bg-neutral-200 hover:bg-neutral-300 dark:bg-[#262626] dark:hover:bg-white dark:hover:text-black px-3.5 py-1.5 rounded-[8px] font-bold text-neutral-800 dark:text-white uppercase tracking-widest transition-colors border border-neutral-300 dark:border-transparent">
                         {t('panel_bulk_log_btn')}
                       </button>
                       <button onClick={handleOpenBeltModal} className="text-[10px] bg-neutral-200 hover:bg-neutral-300 dark:bg-[#262626] dark:hover:bg-white dark:hover:text-black px-3.5 py-1.5 rounded-[8px] font-bold text-neutral-800 dark:text-white uppercase tracking-widest transition-colors border border-neutral-300 dark:border-transparent">
                         + {t('panel_add_belt_btn')}
                       </button>
                     </div>
                   )}
                 </div>
                 <div className="divide-y divide-neutral-200 dark:divide-[#262626]">
                   {beltHistory.length === 0 ? (
                     <p className="p-4 text-xs text-neutral-500 dark:text-[#666] text-center italic">{t('panel_no_promotion_records')}</p>
                   ) : beltHistory.map((h, i) => (
                     <div key={h.id} className="p-4 flex flex-col gap-2 bg-neutral-50 hover:bg-neutral-100 dark:bg-[#141414] dark:hover:bg-[#1A1A1A] transition-colors relative group">
                       <div className="flex justify-between items-start">
                         <div className="flex items-center gap-3">
                             <span className={cn(
                              "w-3 h-3 rounded-full border shadow-sm shrink-0",
                              h.beltLevel.includes('Poom') || h.beltLevel.includes('Dan') ? "bg-black border-[#444]" :
                              h.beltLevel === 'Red' ? "bg-red-500 border-red-600" :
                              h.beltLevel === 'Brown' ? "bg-[rgb(139,69,19)] border-[rgb(101,67,33)]" :
                              h.beltLevel === 'Blue' ? "bg-blue-500 border-blue-600" :
                              h.beltLevel === 'Green' ? "bg-green-500 border-green-600" :
                              h.beltLevel === 'White' ? "bg-white border-[#E4E4E4]" :
                              "bg-yellow-500 border-yellow-600"
                           )} />
                            <div>
                              <p className="text-sm font-bold text-neutral-900 dark:text-white">
                                {state.language === 'en' ? `${formatBeltLocalized(h.beltLevel, student.dob, t)} Belt` : formatBeltLocalized(h.beltLevel, student.dob, t)}
                              </p>
                              {i === 0 && <p className="text-[10px] text-green-600 dark:text-green-500 uppercase tracking-widest font-bold">{t('panel_current_rank')}</p>}
                            </div>
                         </div>
                         <div className="flex items-center gap-2">
                           <p className="text-xs font-mono text-neutral-500 dark:text-[#666]">{h.promotionDate}</p>
                           {canEdit && (
                             <div className="hover-reveal flex gap-1">
                               <button
                                 type="button"
                                 onClick={() => handleStartEditBelt(h)}
                                 className="flex size-9 pointer-coarse:size-11 items-center justify-center text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-[8px] hover:bg-neutral-200 dark:hover:bg-[#262626] transition-colors"
                                 title="Edit Promotion"
                                 aria-label={`Edit ${h.beltLevel} promotion`}
                               >
                                 <Pencil className="w-3.5 h-3.5" />
                               </button>
                               <button
                                 onClick={() => {
                                   showConfirm("Are you sure you want to delete this promotion record? This will revert the student's current belt to the highest remaining logged promotion rank.", async () => {
                                     try {
                                       await deleteBeltHistory(h.id, student.id);
                                       showNotification("Promotion record deleted.", 'success');
                                     } catch (err: any) {
                                       showNotification(err.message || "Failed to delete promotion record.", 'error');
                                     }
                                   });
                                 }}
                                 type="button"
                                 className="flex size-9 pointer-coarse:size-11 items-center justify-center text-neutral-400 hover:text-red-500 rounded-[8px] hover:bg-neutral-200 dark:hover:bg-[#262626] transition-colors cursor-pointer"
                                 title="Delete Promotion"
                                 aria-label={`Delete ${h.beltLevel} promotion`}
                               >
                                 <X className="w-3.5 h-3.5" />
                               </button>
                             </div>
                           )}
                         </div>
                       </div>

                       {(h.testScore !== undefined || h.program || h.certificateRef) && (
                         <div className="ml-6 mt-2 pt-2 border-t border-neutral-200 dark:border-[#262626] grid grid-cols-2 gap-2 text-xs">
                           {h.program && (
                             <div className="text-neutral-600 dark:text-[#999]"><span className="text-neutral-400 dark:text-[#666]">{t('panel_program')}:</span> <span className="text-neutral-900 dark:text-white font-medium">{h.program}</span></div>
                           )}
                           {h.testScore !== undefined && (
                             <div className="text-neutral-600 dark:text-[#999]"><span className="text-neutral-400 dark:text-[#666]">{t('panel_score')}:</span> <span className="text-emerald-500 dark:text-emerald-400 font-mono font-bold">{h.testScore}/100</span></div>
                           )}
                           {h.certificateRef && (
                             <div className="text-neutral-600 dark:text-[#999] col-span-2 mt-1">
                               <span className="text-neutral-400 dark:text-[#666] text-[10px] uppercase font-bold tracking-widest mr-2 inline-block">{t('panel_certificate_ref')}:</span>
                               <span className="font-mono text-neutral-800 dark:text-white text-[10px] tracking-tight bg-neutral-200 dark:bg-[#262626] px-2 py-0.5 rounded font-bold">{h.certificateRef}</span>
                             </div>
                           )}
                           {h.kukkiwonDanCardId && (
                              <div className="text-neutral-600 dark:text-[#999] col-span-2 mt-1 flex flex-wrap items-center gap-2">
                                <span className="text-red-500 dark:text-red-400 text-[10px] uppercase font-bold tracking-widest mr-2 inline-block">{h.kukkiwonDanCardId.startsWith('http') || h.kukkiwonDanCardId.includes('drive.google.com') ? `${t('panel_certificate_ref')}:` : `${t('panel_kukkiwon_card')}:`}</span>
                                {h.kukkiwonDanCardId.startsWith('http') || h.kukkiwonDanCardId.includes('drive.google.com') ? (
                                  <a
                                    href={h.kukkiwonDanCardId}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-emerald-500 dark:text-emerald-400 font-bold hover:underline bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded"
                                  >
                                    <Globe className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                                    {t('panel_open_gdrive_cert')}
                                  </a>
                                ) : (
                                  <span className="font-mono text-red-500 dark:text-red-400 text-[10px] tracking-tight bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded font-bold">{h.kukkiwonDanCardId}</span>
                                )}
                              </div>
                            )}
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          )}</>;
}
