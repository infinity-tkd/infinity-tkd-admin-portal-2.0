'use client';
import { useRef } from 'react';
import { useModalFocus } from '@/hooks/use-modal-focus';
import React from 'react';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Trophy } from '@phosphor-icons/react/dist/csr/Trophy';
import { Portal } from '@/components/Portal';
import { useT } from '@/hooks/useTranslation';
import type { BulkAchievementRow } from '@/components/students/student-editor-types';


interface StudentBulkAchievementDialogProps {
  t: ReturnType<typeof useT>;
  setShowBulkAchvModal: React.Dispatch<React.SetStateAction<boolean>>;
  bulkAchvs: BulkAchievementRow[];
  handleUpdateBulkAchvCell: (index: number, field: keyof BulkAchievementRow, value: any) => void;
  handleRemoveBulkAchvRow: (index: number) => void;
  handleAddBulkAchvRow: () => void;
  isSavingBulkAchv: boolean;
  handleSaveBulkAchvs: () => Promise<void>;
}

export function StudentBulkAchievementDialog({ t, setShowBulkAchvModal, bulkAchvs, handleUpdateBulkAchvCell, handleRemoveBulkAchvRow, handleAddBulkAchvRow, isSavingBulkAchv, handleSaveBulkAchvs }: StudentBulkAchievementDialogProps) {
  const dialog = useRef<HTMLDivElement>(null);
  useModalFocus(dialog, () => { if (!isSavingBulkAchv) setShowBulkAchvModal(false); });
  return <>{(
            <Portal>
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                <div className="w-full h-full md:h-auto md:max-w-5xl bg-white dark:bg-[#0F0F0F] border-0 md:border md:border-neutral-200 md:dark:border-[#262626] rounded-none md:rounded-[8px] shadow-2xl flex flex-col max-h-full md:max-h-[90dvh] overflow-hidden text-neutral-900 dark:text-white" ref={dialog} role="dialog" aria-modal="true" aria-label="Achievement batch" tabIndex={-1} aria-busy={isSavingBulkAchv}><fieldset disabled={isSavingBulkAchv} className="contents">
                   <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#0F0F0F] shrink-0">
                      <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        {t('panel_bulk_log_achvs_title')}
                      </h2>
                      <button onClick={() => setShowBulkAchvModal(false)} className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                   </div>

                   {/* Table / Card area */}
                   <div className="flex-1 overflow-auto p-4 md:p-6">
                     {/* Desktop Spreadsheet view */}
                     <div className="hidden md:block min-w-[800px] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden">
                       <table className="w-full text-left border-collapse">
                         <thead>
                           <tr className="bg-neutral-100 dark:bg-[#141414] border-b border-neutral-200 dark:border-[#262626]">
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[26%]">{t('panel_event_name_req')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[16%]">{t('panel_col_category')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[14%]">{t('panel_col_division')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[14%]">{t('panel_col_medal_rank')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[12%]">{t('panel_date_req')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] w-[14%]">{t('panel_col_notes_opt')}</th>
                             <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-[#666] text-center w-[4%]">{t('panel_col_act')}</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                           {bulkAchvs.map((row, index) => (
                             <tr key={index} className="bg-white dark:bg-[#0A0A0A] hover:bg-neutral-50 dark:hover:bg-[#141414] transition-colors">
                               <td className="p-2">
                                 <input
                                   type="text"
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-sm text-neutral-900 dark:text-white"
                                   placeholder={t('panel_placeholder_tournament_event')}
                                   value={row.eventName}
                                   onChange={e => handleUpdateBulkAchvCell(index, 'eventName', e.target.value)}
                                 />
                               </td>
                               <td className="p-2">
                                 <select
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-sm text-neutral-900 dark:text-white"
                                   value={row.category}
                                   onChange={e => handleUpdateBulkAchvCell(index, 'category', e.target.value)}
                                 >
                                   <option value="Recognized Poomsae">{t('panel_event_poomsae')}</option>
                                   <option value="Freestyle Poomsae">{t('panel_event_freestyle')}</option>
                                   <option value="Demonstration">{t('panel_event_demo')}</option>
                                   <option value="Tricking">{t('panel_event_tricking')}</option>
                                 </select>
                               </td>
                               <td className="p-2">
                                 <select
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-sm text-neutral-900 dark:text-white"
                                   value={row.division}
                                   onChange={e => handleUpdateBulkAchvCell(index, 'division', e.target.value)}
                                 >
                                   <option value="Male Division">{t('panel_div_male_indiv')}</option>
                                   <option value="Female Division">{t('panel_div_female_indiv')}</option>
                                   <option value="Pair">{t('panel_div_pair')}</option>
                                   <option value="Team">{t('panel_div_team')}</option>
                                 </select>
                               </td>
                               <td className="p-2">
                                 <select
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-sm text-neutral-900 dark:text-white"
                                   value={row.medalRank}
                                   onChange={e => handleUpdateBulkAchvCell(index, 'medalRank', e.target.value)}
                                 >
                                   <option value="Gold">{t('panel_medal_gold')}</option>
                                   <option value="Silver">{t('panel_medal_silver')}</option>
                                   <option value="Bronze">{t('panel_medal_bronze')}</option>
                                   <option value="Participant">{t('panel_medal_participant')}</option>
                                 </select>
                               </td>
                               <td className="p-2">
                                 <input
                                   type="date"
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-sm text-neutral-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                                   value={row.date}
                                   onChange={e => handleUpdateBulkAchvCell(index, 'date', e.target.value)}
                                 />
                               </td>
                               <td className="p-2">
                                 <input
                                   type="text"
                                   className="w-full bg-transparent border-0 focus:ring-1 focus:ring-red-500 rounded p-1 text-xs text-neutral-800 dark:text-white"
                                   placeholder={t('panel_col_notes_opt')}
                                   value={row.notes}
                                   onChange={e => handleUpdateBulkAchvCell(index, 'notes', e.target.value)}
                                 />
                               </td>
                               <td className="p-2 text-center">
                                 <button
                                   onClick={() => handleRemoveBulkAchvRow(index)}
                                   className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                                   disabled={bulkAchvs.length <= 1}
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
                       {bulkAchvs.map((row, index) => (
                         <div key={index} className="border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-white dark:bg-[#0A0A0A] space-y-3 relative shadow-sm">
                           <button
                             onClick={() => handleRemoveBulkAchvRow(index)}
                             className="absolute top-2 right-2 p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                             disabled={bulkAchvs.length <= 1}
                             title={t('panel_title_delete_row')}
                           >
                             <X className="w-4 h-4" />
                           </button>
                           <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500">{t('bulk_table_row')} #{index + 1}</div>

                           <div className="space-y-3">
                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_event_name_req')}</label>
                               <input
                                 type="text"
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white"
                                 placeholder={t('panel_placeholder_tournament_event')}
                                 value={row.eventName}
                                 onChange={e => handleUpdateBulkAchvCell(index, 'eventName', e.target.value)}
                               />
                             </div>
                           </div>

                           <div className="grid grid-cols-2 gap-3">
                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_col_category')}</label>
                               <select
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white"
                                 value={row.category}
                                 onChange={e => handleUpdateBulkAchvCell(index, 'category', e.target.value)}
                               >
                                 <option value="Recognized Poomsae">{t('panel_event_poomsae')}</option>
                                 <option value="Freestyle Poomsae">{t('panel_event_freestyle')}</option>
                                 <option value="Demonstration">{t('panel_event_demo')}</option>
                                 <option value="Tricking">{t('panel_event_tricking')}</option>
                               </select>
                             </div>

                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_col_division')}</label>
                               <select
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white"
                                 value={row.division}
                                 onChange={e => handleUpdateBulkAchvCell(index, 'division', e.target.value)}
                               >
                                 <option value="Male Division">{t('panel_div_male_indiv')}</option>
                                 <option value="Female Division">{t('panel_div_female_indiv')}</option>
                                 <option value="Pair">{t('panel_div_pair')}</option>
                                 <option value="Team">{t('panel_div_team')}</option>
                               </select>
                             </div>
                           </div>

                           <div className="grid grid-cols-2 gap-3">
                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_col_medal_rank')}</label>
                               <select
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white"
                                 value={row.medalRank}
                                 onChange={e => handleUpdateBulkAchvCell(index, 'medalRank', e.target.value)}
                               >
                                 <option value="Gold">{t('panel_medal_gold')}</option>
                                 <option value="Silver">{t('panel_medal_silver')}</option>
                                 <option value="Bronze">{t('panel_medal_bronze')}</option>
                                 <option value="Participant">{t('panel_medal_participant')}</option>
                               </select>
                             </div>

                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_date_req')}</label>
                               <input
                                 type="date"
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                                 value={row.date}
                                 onChange={e => handleUpdateBulkAchvCell(index, 'date', e.target.value)}
                               />
                             </div>
                           </div>

                           <div className="space-y-3">
                             <div>
                               <label className="block text-[9px] uppercase font-bold text-neutral-400 dark:text-[#666] mb-1">{t('panel_col_notes_opt')}</label>
                               <input
                                 type="text"
                                 className="w-full bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2.5 py-1.5 text-sm text-neutral-800 dark:text-white"
                                 placeholder={t('panel_col_notes_opt')}
                                 value={row.notes}
                                 onChange={e => handleUpdateBulkAchvCell(index, 'notes', e.target.value)}
                               />
                             </div>
                           </div>
                         </div>
                       ))}
                     </div>

                     <button
                       onClick={handleAddBulkAchvRow}
                       className="mt-4 flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-600 transition-colors px-1"
                     >
                       {t('panel_add_row_btn')}
                     </button>
                   </div>

                   <div className="p-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-between items-center shrink-0">
                     <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">{t('panel_required_hint')}</p>
                     <div className="flex gap-2 text-xs">
                       <button
                         onClick={() => setShowBulkAchvModal(false)}
                         className="px-4 py-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white font-bold uppercase tracking-widest"
                         disabled={isSavingBulkAchv}
                       >
                         {t('act_cancel')}
                       </button>
                       <button
                         onClick={handleSaveBulkAchvs}
                         className="px-5 py-2 bg-[#EF2F38] hover:opacity-90 disabled:opacity-50 text-white rounded-[8px] font-bold uppercase tracking-widest shadow-md shadow-[#EF2F38]/20 flex items-center gap-2"
                         disabled={isSavingBulkAchv}
                       >
                         {isSavingBulkAchv ? (
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
