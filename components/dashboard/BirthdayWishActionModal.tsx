'use client';
import { useRef } from 'react';
import { useModalFocus } from '@/hooks/use-modal-focus';
import { copyText } from '@/lib/clipboard';
import { dialogMotion } from '@/lib/motion';
import { useState } from 'react';
import { Student, useAppStore } from '@/lib/store';
import { useT } from '@/hooks/useTranslation';
import { motion } from 'motion/react';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Portal } from '@/components/Portal';

export function BirthdayWishActionModal({ student, onClose, onMarkSent }: { student: Student, onClose: () => void, onMarkSent: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  useModalFocus(dialog, () => { onClose(); });
  const { showNotification } = useAppStore();
  const t = useT();
  const [copied, setCopied] = useState(false);
  const birthYear = parseInt(student.dob.split('-')[0], 10);
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;

  const messageText = t('dash_birthday_greeting_text').replace('{name}', student.englishName);

  const handleCopy = async () => {
    if (!(await copyText(messageText))) { showNotification('Copying is unavailable. Select the text and copy it manually.', 'warning'); return; }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const telegramUrl = `https://telegram.me/share/url?text=${encodeURIComponent(messageText)}`;
  const whatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;

  return (
    <Portal>
      <div className="fixed inset-0 bg-neutral-950/75 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <motion.div
          {...dialogMotion}
          className="w-full max-w-md bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl p-6 relative overflow-hidden flex flex-col space-y-6 text-neutral-900 dark:text-white max-h-[90dvh] overflow-y-auto" ref={dialog} role="dialog" aria-modal="true" aria-label="Birthday greeting" tabIndex={-1}
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b border-neutral-200 dark:border-[#262626] pb-3">
            <div>
              <span className="text-[8px] font-bold uppercase tracking-widest text-[#EF2F38] font-mono">{t('dash_birthday_wizard')}</span>
              <h3 className="text-sm font-bold text-neutral-800 dark:text-white mt-1">{t('dash_send_birthday_greeting')}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Birthday Wizard"
              className="p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1C1C1C] rounded-full transition-colors cursor-pointer active:scale-95 touch-manipulation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Student Profile Preview */}
          <div className="flex items-center gap-3 bg-neutral-50 dark:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] p-3 rounded-[8px]">
            <div className="w-10 h-10 rounded-full bg-[#EF2F38] text-white flex items-center justify-center font-black text-sm">
              {student.englishName.charAt(0)}
            </div>
            <div>
              <h4 className="text-xs font-bold text-neutral-900 dark:text-white">{student.englishName}</h4>
              <p className="text-[9px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                Turning {age} • DOB: {student.dob} • Belt: {student.currentBelt}
              </p>
            </div>
          </div>

          {/* Message Preview Textbox */}
          <div className="space-y-2">
            <label className="block text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider font-mono">{t('dash_greeting_preview')}</label>
            <div className="bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 text-xs font-mono leading-relaxed text-neutral-800 dark:text-neutral-300 select-all whitespace-pre-wrap">
              {messageText}
            </div>
          </div>

          {/* Action Links */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"

              className="h-10 sm:h-11 bg-sky-500 hover:bg-sky-600 text-white rounded-[6px] sm:rounded-[8px] text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-sky-500/10 cursor-pointer active:scale-95 touch-manipulation"
            >
              {t('dash_send_telegram')}
            </a>
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"

              className="h-10 sm:h-11 bg-green-500 hover:bg-green-600 text-white rounded-[6px] sm:rounded-[8px] text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-green-500/10 cursor-pointer active:scale-95 touch-manipulation"
            >
              {t('dash_send_whatsapp')}
            </a>
          </div>

          <div className="flex gap-2.5 sm:gap-3">
            <button
              onClick={handleCopy}
              className="flex-1 h-9 sm:h-10 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1C1C1C] dark:hover:bg-[#262626] border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-white rounded-[6px] sm:rounded-[8px] text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 touch-manipulation cursor-pointer flex items-center justify-center"
            >
              {copied ? t('dash_copied_msg') : t('dash_copy_clipboard')}
            </button>
            <button
              onClick={onMarkSent}
              className="flex-1 h-9 sm:h-10 bg-[#EF2F38] hover:bg-[#D0252D] text-white rounded-[6px] sm:rounded-[8px] text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all shadow-md shadow-[#EF2F38]/20 active:scale-95 touch-manipulation cursor-pointer flex items-center justify-center"
            >
              {t('dash_mark_sent')}
            </button>
          </div>
        </motion.div>
      </div>
    </Portal>
  );
}
