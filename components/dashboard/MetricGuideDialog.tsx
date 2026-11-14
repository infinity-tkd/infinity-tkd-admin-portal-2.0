'use client';

import type React from 'react';
import { Portal } from '@/components/Portal';
import { ModalA11y } from '@/components/ui/ModalA11y';
import { motion } from 'motion/react';
import { dialogMotion } from '@/lib/motion';
import { X } from '@phosphor-icons/react/dist/csr/X';
import type { TranslatorFn } from '@/hooks/useTranslation';

export interface MetricGuideDialogProps {
  activeHelpSection: "revenue" | "turnout" | "promotion" | "retention";
  helpContent: { revenue: { title: string; math: string; read: string[]; work: string[]; story: string; }; turnout: { title: string; math: string; read: string[]; work: string[]; story: string; }; promotion: { title: string; math: string; read: string[]; work: string[]; story: string; }; retention: { title: string; math: string; read: string[]; work: string[]; story: string; }; };
  setActiveHelpSection: React.Dispatch<React.SetStateAction<"revenue" | "turnout" | "promotion" | "retention" | null>>;
  t: TranslatorFn;
}

export function MetricGuideDialog({ activeHelpSection, helpContent, setActiveHelpSection, t }: MetricGuideDialogProps) {
  return (
    <Portal>
      <div className="fixed inset-0 bg-neutral-950/75 backdrop-blur-sm z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setActiveHelpSection(null)}>
        <ModalA11y label={helpContent[activeHelpSection].title} onClose={() => setActiveHelpSection(null)} />
        <motion.div
          {...dialogMotion}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl p-6 relative overflow-hidden flex flex-col space-y-5 text-neutral-900 dark:text-white max-h-[90dvh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b border-neutral-200 dark:border-[#262626] pb-3">
            <div className="space-y-1">
              <span className="text-micro font-bold uppercase tracking-widest text-brand-ink font-mono">{t('dash_intel_guide')}</span>
              <h2 className="text-sm font-black text-neutral-800 dark:text-white mt-1">
                {helpContent[activeHelpSection].title}
              </h2>
            </div>
            <button type="button" aria-label={t('act_close')} onClick={() => setActiveHelpSection(null)} className="flex size-9 items-center justify-center text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#1C1C1C] rounded-full transition-colors cursor-pointer pointer-coarse:size-11">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Math Formula Card */}
          <div className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 text-center">
            <span className="text-micro uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-widest block font-mono mb-1">{t('dash_math_formula')}</span>
            <code className="text-micro font-mono text-red-500 dark:text-red-400 font-bold">{helpContent[activeHelpSection].math}</code>
          </div>

          {/* Read Section */}
          <div className="space-y-2">
            <h3 className="text-micro uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider font-mono">{t('dash_read_data')}</h3>
            <ul className="space-y-1.5 text-xs text-neutral-700 dark:text-neutral-300">
              {helpContent[activeHelpSection].read.map((item, idx) => (
                <li key={idx} className="flex gap-2 items-start">
                  <span className="text-brand-ink mt-1 shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Work Section */}
          <div className="space-y-2">
            <h3 className="text-micro uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider font-mono">{t('dash_work_data')}</h3>
            <ul className="space-y-1.5 text-xs text-neutral-700 dark:text-neutral-300">
              {helpContent[activeHelpSection].work.map((item, idx) => (
                <li key={idx} className="flex gap-2 items-start">
                  <span className="text-indigo-500 mt-1 shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Story Section */}
          <div className="space-y-2">
            <h3 className="text-micro uppercase font-bold text-neutral-500 dark:text-neutral-400 tracking-wider font-mono">{t('dash_operational_story')}</h3>
            <p className="text-xs text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] p-3.5 rounded-[8px] leading-relaxed font-medium italic">
              &quot;{helpContent[activeHelpSection].story}&quot;
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => setActiveHelpSection(null)}
              className="h-8.5 sm:h-9 px-4 sm:px-5 bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 rounded-[6px] sm:rounded-[8px] text-micro sm:text-xs font-black uppercase tracking-wider transition-colors cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
            >
              {t('act_close')}
            </button>
          </div>
        </motion.div>
      </div>
    </Portal>
  );
}
