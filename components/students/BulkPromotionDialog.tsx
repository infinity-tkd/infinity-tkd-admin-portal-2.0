'use client';

import type React from 'react';
import { Portal } from '@/components/Portal';
import { ModalA11y } from '@/components/ui/ModalA11y';
import { motion } from 'motion/react';
import { dialogMotion } from '@/lib/motion';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { cn } from '@/lib/utils';
import type { TranslatorFn } from '@/hooks/useTranslation';

export interface BulkPromotionDialogProps {
  BELT_RANK_ORDER: readonly string[];
  handleBulkPromoteSubmit: () => Promise<void>;
  promotionForm: { targetBeltMode: "next" | "fixed"; fixedTargetBelt: string; testScore: number; program: string; promotionDate: string; certificateUrl: string; };
  selectedStudentsForPromotion: string[];
  setPromotionForm: React.Dispatch<React.SetStateAction<{ targetBeltMode: "next" | "fixed"; fixedTargetBelt: string; testScore: number; program: string; promotionDate: string; certificateUrl: string; }>>;
  setShowPromotionModal: React.Dispatch<React.SetStateAction<boolean>>;
  t: TranslatorFn;
}

export function BulkPromotionDialog({ BELT_RANK_ORDER, handleBulkPromoteSubmit, promotionForm, selectedStudentsForPromotion, setPromotionForm, setShowPromotionModal, t }: BulkPromotionDialogProps) {
  return (
    <Portal>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
        <ModalA11y label="Belt promotion" onClose={() => setShowPromotionModal(false)} />
        <motion.div
          {...dialogMotion}
          className="w-full max-w-md bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl overflow-hidden flex flex-col text-neutral-900 dark:text-white max-h-[90dvh]"
        >
          <div className="p-4 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0A0A0A] flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#EF2F38]" />
              <h3 className="text-xs font-black uppercase tracking-widest text-neutral-900 dark:text-white">{t('dir_bulk_promotion_title')}</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowPromotionModal(false)}
              className="px-3 py-1.5 min-h-[40px] text-xs font-bold rounded-[8px] text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center pointer-coarse:min-h-11"
            >
              {t('act_cancel')}
            </button>
          </div>

          <div className="p-6 space-y-4 bg-white dark:bg-[#0A0A0A] overflow-y-auto flex-1">
            <p className="text-xs text-neutral-600 dark:text-[#999] leading-relaxed">
              {t('dir_bulk_promotion_desc').split('{count}')[0]}
              <span className="font-mono text-neutral-900 dark:text-white font-bold bg-neutral-100 dark:bg-[#141414] px-1.5 py-0.5 rounded border border-neutral-200 dark:border-[#262626]">{selectedStudentsForPromotion.length}</span>
              {t('dir_bulk_promotion_desc').split('{count}')[1]}
            </p>

            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_promotion_mode')}</label>
              <div className="grid grid-cols-2 gap-2 bg-neutral-100 dark:bg-[#141414] p-1 border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                <button
                  type="button"
                  onClick={() => setPromotionForm(prev => ({ ...prev, targetBeltMode: 'next' }))}
                  className={cn(
                    "py-1.5 rounded text-xs font-bold transition-all uppercase tracking-wider cursor-pointer active:scale-95 touch-manipulation",
                    promotionForm.targetBeltMode === 'next'
                      ? "bg-white dark:bg-[#262626] text-neutral-900 dark:text-white shadow-sm font-extrabold"
                      : "text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
                  )}
                >
                  {t('dir_next_rank_dynamic')}
                </button>
                <button
                  type="button"
                  onClick={() => setPromotionForm(prev => ({ ...prev, targetBeltMode: 'fixed' }))}
                  className={cn(
                    "py-1.5 rounded text-xs font-bold transition-all uppercase tracking-wider cursor-pointer active:scale-95 touch-manipulation",
                    promotionForm.targetBeltMode === 'fixed'
                      ? "bg-white dark:bg-[#262626] text-neutral-900 dark:text-white shadow-sm font-extrabold"
                      : "text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
                  )}
                >
                  {t('dir_fixed_rank')}
                </button>
              </div>
            </div>

            {promotionForm.targetBeltMode === 'fixed' && (
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_target_belt')}</label>
                <select
                  value={promotionForm.fixedTargetBelt}
                  onChange={(e) => setPromotionForm(prev => ({ ...prev, fixedTargetBelt: e.target.value }))}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                >
                  {BELT_RANK_ORDER.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_test_score')}</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={promotionForm.testScore}
                  onChange={(e) => setPromotionForm(prev => ({ ...prev, testScore: Number(e.target.value) }))}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_promotion_date')}</label>
                <input
                  type="date"
                  value={promotionForm.promotionDate}
                  onChange={(e) => setPromotionForm(prev => ({ ...prev, promotionDate: e.target.value }))}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_curriculum_program')}</label>
              <input
                type="text"
                value={promotionForm.program}
                onChange={(e) => setPromotionForm(prev => ({ ...prev, program: e.target.value }))}
                className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-[#666]">{t('dir_cert_url_label')}</label>
              <input
                type="url"
                placeholder="e.g. https://drive.google.com/file/d/..."
                value={promotionForm.certificateUrl || ''}
                onChange={(e) => setPromotionForm(prev => ({ ...prev, certificateUrl: e.target.value }))}
                className="w-full bg-white dark:bg-[#1A1A1A] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38] font-mono"
              />
            </div>
          </div>

          <div className="p-4 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex justify-end gap-2 shrink-0">
            <button
              onClick={() => setShowPromotionModal(false)}
              className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-[#1A1A1A] text-neutral-700 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white rounded-[8px] text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer active:scale-95 touch-manipulation"
            >
              {t('act_cancel')}
            </button>
            <button
              onClick={handleBulkPromoteSubmit}
              className="px-5 py-2 bg-[#EF2F38] hover:bg-[#D9222B] text-white rounded-[8px] text-xs font-bold uppercase tracking-widest transition-all shadow-md shadow-[#EF2F38]/20 cursor-pointer active:scale-95 touch-manipulation"
            >
              {t('dir_confirm_promotion')}
            </button>
          </div>
        </motion.div>
      </div>
    </Portal>
  );
}
