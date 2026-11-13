'use client';
import { useRef } from 'react';
import { useModalFocus } from '@/hooks/use-modal-focus';
import React from 'react';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Certificate } from '@phosphor-icons/react/dist/csr/Certificate';
import { formatBeltLocalized } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import { useT } from '@/hooks/useTranslation';
import { useBeltOrder } from '@/hooks/use-belt-order';
import type { BulkBeltRow } from '@/components/students/student-editor-types';


interface StudentBulkBeltDialogProps {
  t: ReturnType<typeof useT>;
  setShowBulkBeltModal: React.Dispatch<React.SetStateAction<boolean>>;
  bulkBelts: BulkBeltRow[];
  handleUpdateBulkBeltCell: (index: number, field: keyof BulkBeltRow, value: any) => void;
  handleRemoveBulkBeltRow: (index: number) => void;
  handleAddBulkBeltRow: () => void;
  isSavingBulkBelt: boolean;
  handleSaveBulkBelts: () => Promise<void>;
}

export function StudentBulkBeltDialog({ t, setShowBulkBeltModal, bulkBelts, handleUpdateBulkBeltCell, handleRemoveBulkBeltRow, handleAddBulkBeltRow, isSavingBulkBelt, handleSaveBulkBelts }: StudentBulkBeltDialogProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const beltOrder = useBeltOrder();
  useModalFocus(dialog, () => { if (!isSavingBulkBelt) setShowBulkBeltModal(false); });
  return <>{(
            <Portal>
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                <div className="w-full h-full md:h-auto md:max-w-5xl bg-white dark:bg-[#0F0F0F] border-0 md:border md:border-neutral-200 md:dark:border-[#262626] rounded-none md:rounded-[8px] shadow-2xl flex flex-col max-h-full md:max-h-[90dvh] overflow-hidden text-neutral-900 dark:text-white" ref={dialog} role="dialog" aria-modal="true" aria-label="Belt history batch" tabIndex={-1} aria-busy={isSavingBulkBelt}><fieldset disabled={isSavingBulkBelt} className="contents">
                   <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#0F0F0F] shrink-0">
                      <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                        <Certificate className="w-5 h-5 text-red-500" />
                        {t('panel_bulk_log_belts_title')}
                      </h2>
                      <button onClick={() => setShowBulkBeltModal(false)} className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                   </div>

                   {/* Table / Card area */}
                   <div className="flex-1 overflow-auto p-4 md:p-6">
                     {/* Desktop Spreadsheet view */}
                     <div className="hidden md:block min-w-[800px] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden">
                       <table className="w-full text-left border-collapse">
                         <thead>
                           <tr className="bg-neutral-100 dark:bg-[#141414] border-b border-neutral-200 dark:border-[#262626]">
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[18%]">{t('panel_next_belt_req')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[16%]">{t('panel_promotion_date_req')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[12%]">{t('panel_col_score_opt')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[18%]">{t('panel_col_program')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[18%]">{t('panel_col_cert_ref_opt')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[18%]">{t('panel_col_cert_url_id')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] text-center w-[6%]">{t('panel_col_act')}</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                           {bulkBelts.map((row, index) => (
                             <tr key={index} className="bg-white dark:bg-[#0A0A0A] hover:bg-neutral-50 dark:hover:bg-[#141414] transition-colors">
                               <td className="p-2">
                                 <select
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-sm text-neutral-900 dark:text-white"
                                   value={row.beltLevel}
                                   onChange={e => handleUpdateBulkBeltCell(index, 'beltLevel', e.target.value)}
                                 >
                                   {beltOrder.map(belt => <option key={belt} value={belt}>{formatBeltLocalized(belt, undefined, t)}</option>)}
                                 </select>
                               </td>
                               <td className="p-2">
                                 <input
                                   type="date"
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-sm text-neutral-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                                   value={row.promotionDate}
                                   onChange={e => handleUpdateBulkBeltCell(index, 'promotionDate', e.target.value)}
                                 />
                               </td>
                               <td className="p-2">
                                 <input
                                   type="number"
                                   min="0"
                                   max="100"
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-sm text-neutral-900 dark:text-white font-mono"
                                   placeholder={t('panel_placeholder_score')}
                                   value={row.testScore}
                                   onChange={e => handleUpdateBulkBeltCell(index, 'testScore', e.target.value)}
                                 />
                               </td>
                               <td className="p-2">
                                 <select
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-sm text-neutral-900 dark:text-white"
                                   value={row.program}
                                   onChange={e => handleUpdateBulkBeltCell(index, 'program', e.target.value)}
                                 >
                                   <option value="Standard Class">{t('panel_program_standard')}</option>
                                   <option value="Elite Team">{t('panel_program_elite')}</option>
                                   <option value="Private Camp">{t('panel_program_private')}</option>
                                 </select>
                               </td>
                               <td className="p-2">
                                 <input
                                   type="text"
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-xs text-neutral-800 dark:text-white font-mono uppercase"
                                   placeholder={t('panel_placeholder_autogen')}
                                   value={row.certificateRef}
                                   onChange={e => handleUpdateBulkBeltCell(index, 'certificateRef', e.target.value)}
                                 />
                               </td>
                               <td className="p-2">
                                 <input
                                   type="text"
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-xs text-neutral-800 dark:text-white font-mono"
                                   placeholder={t('panel_placeholder_cert_url_or_dan')}
                                   value={row.kukkiwonDanCardId}
                                   onChange={e => handleUpdateBulkBeltCell(index, 'kukkiwonDanCardId', e.target.value)}
                                 />
                               </td>
                               <td className="p-2 text-center">
                                 <button
                                   onClick={() => handleRemoveBulkBeltRow(index)}
                                   className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                                   disabled={bulkBelts.length <= 1}
                                   title={t('panel_title_delete_row')}
                                 >
                                   <X className="w-4 h-4 mx-auto" />
                                 </button>
                               </td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     </div>

                     {/* Mobile Card list view */}
                     <div className="block md:hidden space-y-4">
                       {bulkBelts.map((row, index) => (
                         <div key={index} className="border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-white dark:bg-[#0A0A0A] space-y-3 relative shadow-sm">
                           <button
                             onClick={() => handleRemoveBulkBeltRow(index)}
                             className="absolute top-2 right-2 p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                             disabled={bulkBelts.length <= 1}
                             title={t('panel_title_delete_row')}
                           >
                             <X className="w-4 h-4" />
                           </button>
                           <div className="text-[10px] font-bold uppercase tracking-wider text-red-500">{t('bulk_table_row')} #{index + 1}</div>

                           <div className="grid grid-cols-2 gap-3">
                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_next_belt_req')}</label>
                               <select
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white focus:ring-1 focus:ring-red-500"
                                 value={row.beltLevel}
                                 onChange={e => handleUpdateBulkBeltCell(index, 'beltLevel', e.target.value)}
                               >
                                 {beltOrder.map(belt => <option key={belt} value={belt}>{formatBeltLocalized(belt, undefined, t)}</option>)}
                               </select>
                             </div>

                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_promotion_date_req')}</label>
                               <input
                                 type="date"
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                                 value={row.promotionDate}
                                 onChange={e => handleUpdateBulkBeltCell(index, 'promotionDate', e.target.value)}
                               />
                             </div>
                           </div>

                           <div className="grid grid-cols-2 gap-3">
                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_col_score_opt')}</label>
                               <input
                                 type="number"
                                 min="0"
                                 max="100"
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white font-mono"
                                 placeholder={t('panel_placeholder_score')}
                                 value={row.testScore}
                                 onChange={e => handleUpdateBulkBeltCell(index, 'testScore', e.target.value)}
                               />
                             </div>

                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_col_program')}</label>
                               <select
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white"
                                 value={row.program}
                                 onChange={e => handleUpdateBulkBeltCell(index, 'program', e.target.value)}
                               >
                                 <option value="Standard Class">{t('panel_program_standard')}</option>
                                 <option value="Elite Team">{t('panel_program_elite')}</option>
                                 <option value="Private Camp">{t('panel_program_private')}</option>
                               </select>
                             </div>
                           </div>

                           <div className="grid grid-cols-1 gap-3">
                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_col_cert_ref_opt')}</label>
                               <input
                                 type="text"
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-800 dark:text-white font-mono uppercase"
                                 placeholder={t('panel_placeholder_autogen')}
                                 value={row.certificateRef}
                                 onChange={e => handleUpdateBulkBeltCell(index, 'certificateRef', e.target.value)}
                               />
                             </div>

                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-[#666] mb-1">{t('panel_cert_link_or_kukkiwon')}</label>
                               <input
                                 type="text"
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-800 dark:text-white font-mono"
                                 placeholder={t('panel_cert_link_or_kukkiwon')}
                                 value={row.kukkiwonDanCardId}
                                 onChange={e => handleUpdateBulkBeltCell(index, 'kukkiwonDanCardId', e.target.value)}
                               />
                             </div>
                           </div>
                         </div>
                       ))}
                     </div>

                     <button
                       onClick={handleAddBulkBeltRow}
                       className="mt-4 flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-600 transition-colors px-1"
                     >
                       {t('panel_add_row_btn')}
                     </button>
                   </div>

                   <div className="p-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-between items-center shrink-0">
                     <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">* Required fields must be populated.</p>
                     <div className="flex gap-2 text-xs">
                       <button
                         onClick={() => setShowBulkBeltModal(false)}
                         className="px-4 py-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white font-bold uppercase tracking-widest"
                         disabled={isSavingBulkBelt}
                       >
                         {t('act_cancel')}
                       </button>
                       <button
                         onClick={handleSaveBulkBelts}
                         className="px-5 py-2 bg-brand hover:opacity-90 disabled:opacity-50 text-white rounded-[8px] font-bold uppercase tracking-widest shadow-md shadow-brand/20 flex items-center gap-2"
                         disabled={isSavingBulkBelt}
                       >
                         {isSavingBulkBelt ? (
                           <>
                             <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                             {t('act_saving')}
                           </>
                         ) : (
                           t('act_save')
                         )}
                       </button>
                     </div>
                   </div>
                </fieldset></div>
              </div>
             </Portal>
           )}</>;
}
