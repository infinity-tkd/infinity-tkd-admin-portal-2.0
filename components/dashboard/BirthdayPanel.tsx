'use client';

import type React from 'react';
import { Cake } from '@phosphor-icons/react/dist/csr/Cake';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { MONTH_NAMES } from '@/lib/dates';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { PaperPlaneTilt } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt';
import type { TranslatorFn } from '@/hooks/useTranslation';
import type { AppState, Student } from '@/lib/store';

export interface BirthdayPanelProps {
  birthdayStudents: Student[];
  calculateAge: (dob: string | undefined) => number;
  checkIsBirthdayToday: (dob: string | undefined) => boolean;
  getBirthdayDay: (dob: string | undefined) => string | null;
  getLocalizedMonthName: (monthIndex: number, lang: string) => string;
  selectedMonth: number;
  setSelectedMonth: React.Dispatch<React.SetStateAction<number>>;
  setWishStudent: React.Dispatch<React.SetStateAction<Student | null>>;
  state: AppState;
  t: TranslatorFn;
  wishState: Record<string, "sending" | "sent">;
}

export function BirthdayPanel({ birthdayStudents, calculateAge, checkIsBirthdayToday, getBirthdayDay, getLocalizedMonthName, selectedMonth, setSelectedMonth, setWishStudent, state, t, wishState }: BirthdayPanelProps) {
  return (
    <div className="bg-neutral-50 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex flex-col relative overflow-hidden shadow-sm">
      <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(circle_at_top_right,rgba(239,47,56,0.06)_0%,transparent_70%)] pointer-events-none" />

      <div className="py-2.5 px-3 border-b border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#0F0F0F] rounded-t-[8px] flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Cake className="w-3.5 h-3.5 text-brand-ink animate-bounce" />
          <h2 className="text-xs font-bold uppercase tracking-widest">{t('dash_student_birthdays')}</h2>
        </div>

        {/* Dynamic Month Selector Toggles */}
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
          className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-[#E4E4E4] rounded-[6px] sm:rounded-[8px] px-2.5 h-8 sm:h-8.5 text-[10px] sm:text-[9px] uppercase font-bold focus:outline-none focus:border-[#444] font-mono shadow-sm cursor-pointer"
        >
          {MONTH_NAMES.map((name, idx) => (
            <option key={name} value={idx}>{getLocalizedMonthName(idx, state.language)}</option>
          ))}
        </select>
      </div>

      <div className="p-3 flex-1 max-h-[320px] overflow-y-auto space-y-2 bg-white dark:bg-transparent">
        <AnimatePresence mode="popLayout">
          {birthdayStudents.map(student => {
            const isBirthdayToday = checkIsBirthdayToday(student.dob);
            const bDay = getBirthdayDay(student.dob);
            const age = calculateAge(student.dob);

            return (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "p-2 rounded-[8px] border transition-all flex items-center justify-between gap-2 shadow-sm",
                  isBirthdayToday
                    ? "bg-red-50 dark:bg-[#1E1111] border-red-500/40 dark:border-brand/40 shadow-[0_0_12px_rgba(239,47,56,0.15)] relative overflow-hidden"
                    : "bg-white dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626]"
                )}
              >
                {isBirthdayToday && (
                  <div className="absolute top-0 right-0 p-1 flex gap-1">
                    <Sparkle className="w-2.5 h-2.5 text-brand-ink animate-pulse" />
                  </div>
                )}

                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={cn(
                    "w-6.5 h-6.5 rounded-full flex items-center justify-center font-black text-[10px] font-mono border shrink-0",
                    isBirthdayToday
                      ? "bg-brand text-white border-brand"
                      : "bg-neutral-50 dark:bg-[#141414] text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-[#262626]"
                  )}>
                    {bDay}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold truncate text-neutral-900 dark:text-white">{student.englishName}</span>
                      {isBirthdayToday && (
                        <span className="px-1 py-0.2 bg-brand text-white text-[9px] font-black uppercase tracking-wider rounded-full animate-bounce shrink-0">
                          {t('dash_today')}
                        </span>
                      )}
                    </div>
                    <span className="block text-[9px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5 flex items-center flex-wrap gap-1 leading-none">
                      <span>{t('dash_age_belt').replace('{age}', String(age)).replace('{belt}', student.currentBelt)}</span>
                      <span className="text-neutral-300 dark:text-neutral-700 select-none">•</span>
                      <span className="text-[9px] bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-1 py-0.2 text-neutral-500 dark:text-neutral-400 font-bold font-mono">{student.dob}</span>
                    </span>
                  </div>
                </div>

                <button
                  disabled={wishState[student.id] === 'sent'}
                  onClick={() => setWishStudent(student)}
                  aria-label={`Open birthday greeting for ${student.englishName}`}
                  className={cn(
                    "p-2.5 sm:p-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded-[8px] border transition-all cursor-pointer flex items-center justify-center shadow-sm shrink-0",
                    isBirthdayToday
                      ? wishState[student.id] === 'sent'
                        ? "bg-green-600/10 border-green-500/20 text-green-600 dark:text-green-400"
                        : "bg-brand hover:bg-brand-strong border-transparent text-white"
                      : wishState[student.id] === 'sent'
                        ? "bg-green-600/10 border-green-500/20 text-green-600 dark:text-green-400"
                        : "bg-neutral-50 dark:bg-[#141414] hover:bg-neutral-100 dark:hover:bg-[#262626] border-neutral-200 dark:border-[#262626] text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                  )}
                >
                  {wishState[student.id] === 'sent' ? (
                    <CheckCircle className="w-4 h-4 sm:w-3 sm:h-3" />
                  ) : (
                    <PaperPlaneTilt className="w-4 h-4 sm:w-3 sm:h-3" />
                  )}
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {birthdayStudents.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 bg-white dark:bg-transparent">
            <Cake className="w-7 h-7 text-neutral-300 dark:text-neutral-700 animate-pulse" />
            <div>
              <h4 className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200">{t('dash_no_birthdays_in')} {getLocalizedMonthName(selectedMonth, state.language)}</h4>
              <p className="text-[9px] text-neutral-500 dark:text-neutral-400 mt-0.5">{t('dash_no_birthdays_desc')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom mini-summary */}
      <div className="py-2 px-3 bg-white dark:bg-[#0F0F0F] border-t border-neutral-200 dark:border-[#262626] text-[9px] text-neutral-500 dark:text-neutral-400 font-mono text-center flex items-center justify-center gap-1.5 rounded-b-[8px] shadow-sm">
        <span>{t('dash_selected_birthdays').replace('{count}', String(birthdayStudents.length))}</span>
      </div>
    </div>
  );
}
