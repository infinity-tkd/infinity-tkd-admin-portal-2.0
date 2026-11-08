'use client';

import type React from 'react';
import { Portal } from '@/components/Portal';
import { ModalA11y } from '@/components/ui/ModalA11y';
import { motion } from 'motion/react';
import { dialogMotion } from '@/lib/motion';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import type { AppState, BeltHistory } from '@/lib/store';
import type { TranslatorFn } from '@/hooks/useTranslation';

export interface EditPromotionDialogProps {
  BELT_RANK_ORDER: readonly string[];
  editHistoryForm: { beltLevel: string; promotionDate: string; testScore: number; program: string; certificateRef: string; kukkiwonDanCardId: string; };
  editingHistory: BeltHistory;
  handleSaveEditHistorySubmit: () => Promise<void>;
  isSavingEdit: boolean;
  setEditHistoryForm: React.Dispatch<React.SetStateAction<{ beltLevel: string; promotionDate: string; testScore: number; program: string; certificateRef: string; kukkiwonDanCardId: string; }>>;
  setEditingHistory: React.Dispatch<React.SetStateAction<BeltHistory | null>>;
  state: AppState;
  t: TranslatorFn;
}

export function EditPromotionDialog({ BELT_RANK_ORDER, editHistoryForm, editingHistory, handleSaveEditHistorySubmit, isSavingEdit, setEditHistoryForm, setEditingHistory, state, t }: EditPromotionDialogProps) {
  return (
    <Portal>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
        <ModalA11y label="Edit promotion record" onClose={() => setEditingHistory(null)} />
        <motion.div
          {...dialogMotion}
          className="w-full max-w-md bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl overflow-hidden flex flex-col text-neutral-900 dark:text-white max-h-[90dvh] animate-in zoom-in-95 duration-150"
        >
          <div className="p-4 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0A0A0A] flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              <h3 className="text-xs font-black uppercase tracking-widest text-neutral-900 dark:text-white">{t('dir_edit_log_title')}</h3>
            </div>
            <button
              type="button"
              onClick={() => setEditingHistory(null)}
              className="px-3 py-1.5 min-h-[40px] text-xs font-bold rounded-[8px] text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center pointer-coarse:min-h-11"
            >
              {t('act_cancel')}
            </button>
          </div>

          <div className="p-6 space-y-4 bg-white dark:bg-[#0A0A0A] overflow-y-auto max-h-[70dvh]">
            <div>
              <span className="block text-[9px] uppercase font-bold text-neutral-500 dark:text-[#666] tracking-wider mb-1">{t('dir_student_context')}</span>
              <div className="bg-neutral-100 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-700 dark:text-[#999] font-bold">
                {state.students.find(s => s.id === editingHistory.studentId)?.englishName || editingHistory.studentId} ({editingHistory.studentId})
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_target_belt')}</label>
                <select
                  value={editHistoryForm.beltLevel}
                  onChange={(e) => setEditHistoryForm(prev => ({ ...prev, beltLevel: e.target.value }))}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                >
                  {BELT_RANK_ORDER.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_promotion_date')}</label>
                <input
                  type="date"
                  value={editHistoryForm.promotionDate}
                  onChange={(e) => setEditHistoryForm(prev => ({ ...prev, promotionDate: e.target.value }))}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_test_score')}</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editHistoryForm.testScore}
                  onChange={(e) => setEditHistoryForm(prev => ({ ...prev, testScore: Number(e.target.value) }))}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_curriculum_program')}</label>
                <input
                  type="text"
                  value={editHistoryForm.program}
                  onChange={(e) => setEditHistoryForm(prev => ({ ...prev, program: e.target.value }))}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-bold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_cert_ref_hash')}</label>
              <input
                type="text"
                value={editHistoryForm.certificateRef}
                onChange={(e) => setEditHistoryForm(prev => ({ ...prev, certificateRef: e.target.value.toUpperCase() }))}
                className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono uppercase"
                placeholder="e.g. INF-YYYYMMDD-ID-RAND"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_cert_link_label')}</label>
              <input
                type="text"
                value={editHistoryForm.kukkiwonDanCardId}
                onChange={(e) => setEditHistoryForm(prev => ({ ...prev, kukkiwonDanCardId: e.target.value }))}
                className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono"
                placeholder="e.g. https://drive.google.com/file/... or DAN-XXXX"
              />
            </div>
          </div>

          <div className="p-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-end gap-2">
            <button
              onClick={() => setEditingHistory(null)}
              className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-[#1A1A1A] text-neutral-700 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white rounded-[8px] text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer active:scale-95 touch-manipulation"
            >
              {t('act_cancel')}
            </button>
            <button
              onClick={handleSaveEditHistorySubmit}
              disabled={isSavingEdit}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-55 text-black font-extrabold rounded-[8px] text-xs uppercase tracking-widest transition-all shadow-md shadow-amber-500/20 cursor-pointer active:scale-95 touch-manipulation"
            >
              {isSavingEdit ? t('act_saving') : t('act_save_changes')}
            </button>
          </div>
        </motion.div>
      </div>
    </Portal>
  );
}
