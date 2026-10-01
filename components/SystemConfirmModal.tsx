'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { Warning, X, Question, Check } from '@phosphor-icons/react';
import { useT } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

export function SystemConfirmModal() {
  const { state, hideConfirm } = useAppStore();
  const t = useT();

  const confirmData = state.systemConfirm;

  // Localized default headers based on language
  const getHeader = () => {
    const lang = state.language || 'en';
    if (lang === 'kh') return 'ការបញ្ជាក់';
    if (lang === 'zh') return '确认';
    return 'Confirm Action';
  };

  // Localized default confirm button labels
  const getConfirmLabel = () => {
    const lang = state.language || 'en';
    if (lang === 'kh') return 'យល់ព្រម';
    if (lang === 'zh') return '确定';
    return 'Confirm';
  };

  if (!confirmData) return null;

  const headerText = confirmData.title || getHeader();
  const confirmLabel = getConfirmLabel();

  // Determine modal styling theme dynamically based on intent/message content
  const modalTheme = (() => {
    const msg = confirmData.message.toLowerCase();
    
    // Danger / Red: deletions, voiding, or setting to Absent
    const isDanger = msg.includes('delete') || 
                     msg.includes('remove') || 
                     msg.includes('void') || 
                     msg.includes('erase') || 
                     msg.includes('លុប') || 
                     msg.includes('删除') ||
                     msg.includes('"absent"') || 
                     msg.includes('"អវត្តមាន"') || 
                     msg.includes('"未到"');
                     
    if (isDanger) {
      return {
        borderColor: 'border-red-500/20',
        glowColor: 'rgba(239, 47, 56, 0.15)',
        topBarColor: 'via-red-500/50',
        iconBg: 'border-red-500/20',
        iconType: 'danger',
        confirmBtn: 'bg-[#EF2F38] hover:bg-red-600 text-white'
      };
    }
    
    // Success / Green: setting to Present
    const isSuccess = msg.includes('"present"') || 
                      msg.includes('"វត្តមាន"') || 
                      msg.includes('"已到"');
                      
    if (isSuccess) {
      return {
        borderColor: 'border-green-500/20',
        glowColor: 'rgba(34, 197, 94, 0.15)',
        topBarColor: 'via-green-500/50',
        iconBg: 'border-green-500/20',
        iconType: 'success',
        confirmBtn: 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/20'
      };
    }

    // Warning / Amber: setting to Late
    const isWarning = msg.includes('"late"') || 
                      msg.includes('"យឺត"') || 
                      msg.includes('"迟到"');
                      
    if (isWarning) {
      return {
        borderColor: 'border-yellow-500/20',
        glowColor: 'rgba(234, 179, 8, 0.15)',
        topBarColor: 'via-yellow-500/50',
        iconBg: 'border-yellow-500/20',
        iconType: 'warning',
        confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20'
      };
    }
    
    // Default / Info / Blue
    return {
      borderColor: 'border-blue-500/20',
      glowColor: 'rgba(59, 130, 246, 0.15)',
      topBarColor: 'via-blue-500/50',
      iconBg: 'border-blue-500/20',
      iconType: 'info',
      confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
    };
  })();

  const handleConfirm = () => {
    try {
      confirmData.onConfirm();
    } catch (e) {
      console.error('[SystemConfirmModal] onConfirm error:', e);
    }
    hideConfirm();
  };

  const handleCancel = () => {
    if (confirmData.onCancel) {
      try {
        confirmData.onCancel();
      } catch (e) {
        console.error('[SystemConfirmModal] onCancel error:', e);
      }
    }
    hideConfirm();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop blur with overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCancel}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Modal Card container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.3, bounce: 0.18 }}
          style={{
            boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px ${modalTheme.glowColor}`,
          }}
          className={cn(
            "relative w-full max-w-md bg-white dark:bg-[#0F0F0F] border rounded-[8px] p-5 sm:p-6 text-center overflow-hidden z-10 shadow-2xl",
            modalTheme.borderColor
          )}
        >
          {/* Subtle top edge glow matching modal intent */}
          <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ${modalTheme.topBarColor} to-transparent`} />

          {/* Close button top corner */}
          <button
            onClick={handleCancel}
            className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200 transition-colors p-2 rounded-[8px] hover:bg-neutral-100 dark:hover:bg-neutral-900 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label={t('act_close')}
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon Header */}
          <div className="flex justify-center mb-4 mt-2">
            <div className={`p-3 rounded-full bg-neutral-100 dark:bg-neutral-900/60 border ${modalTheme.iconBg} flex items-center justify-center shadow-xs`}>
              {modalTheme.iconType === 'danger' && (
                <Warning className="w-8 h-8 text-red-500" weight="fill" />
              )}
              {modalTheme.iconType === 'warning' && (
                <Warning className="w-8 h-8 text-yellow-500" weight="fill" />
              )}
              {modalTheme.iconType === 'success' && (
                <Check className="w-8 h-8 text-green-500" weight="fill" />
              )}
              {modalTheme.iconType === 'info' && (
                <Question className="w-8 h-8 text-blue-500" weight="fill" />
              )}
            </div>
          </div>

          {/* Title Header */}
          <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white tracking-wide mb-2 px-4 sm:px-6">
            {headerText}
          </h2>

          {/* Message Content */}
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-6 font-medium whitespace-pre-line px-2">
            {confirmData.message}
          </p>

          {/* Modal Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 w-full">
            <button
              type="button"
              onClick={handleCancel}
              className="w-full sm:w-auto min-w-[120px] min-h-[44px] px-6 py-2.5 rounded-[8px] font-bold text-xs tracking-wider uppercase transition-all duration-200 active:scale-95 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-800 cursor-pointer flex items-center justify-center touch-manipulation"
            >
              {t('act_cancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={cn(
                "w-full sm:w-auto min-w-[120px] min-h-[44px] px-6 py-2.5 rounded-[8px] font-bold text-xs tracking-wider uppercase transition-all duration-200 active:scale-95 shadow-md flex items-center justify-center touch-manipulation cursor-pointer",
                modalTheme.confirmBtn
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

