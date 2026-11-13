'use client';
import { academyDate, addCalendarDays, isCalendarDate } from '@/lib/dates';
import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar } from '@phosphor-icons/react/dist/csr/Calendar';
import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useTranslation';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
}
export function AttendanceDatePicker({ value, onChange }: DatePickerProps) {
  const t = useT();
  const { state } = useAppStore();
  const lang = state.language || 'en';
  const [isOpen, setIsOpen] = useState(false);
  const [typedValue, setTypedValue] = useState(value);
  const [isValid, setIsValid] = useState(true);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTypedValue(value);
    setIsValid(true);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^\d-]/g, '');
    if (val.length === 4 && !val.includes('-')) {
      val = val + '-';
    } else if (val.length === 7 && val.split('-').length === 2) {
      val = val + '-';
    }
    if (val.length > 10) val = val.substring(0, 10);
    setTypedValue(val);

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(val)) {
      if (isCalendarDate(val)) {
        setIsValid(true);
        onChange(val);
      } else {
        setIsValid(false);
      }
    } else {
      setIsValid(val.length === 0 || val.length < 10);
    }
  };

  const currentDate = new Date(`${isCalendarDate(value || '') ? value : academyDate()}T12:00:00`);
  const [viewYear, setViewYear] = useState(currentDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(currentDate.getMonth());

  useEffect(() => {
    const d = new Date(`${isCalendarDate(value || '') ? value : academyDate()}T12:00:00`);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [value]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getLocalizedMonthName = (monthIndex: number, language: string) => {
    if (language === 'kh') {
      const khMonths = [
        'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
        'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
      ];
      return khMonths[monthIndex];
    } else if (language === 'zh') {
      const zhMonths = [
        '一月', '二月', '三月', '四月', '五月', '六月',
        '七月', '八月', '九月', '十月', '十一月', '十二月'
      ];
      return zhMonths[monthIndex];
    }
    return monthNames[monthIndex];
  };

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const firstDayIndex = (y: number, m: number) => {
    const day = new Date(y, m, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const selectDate = (day: number) => {
    const formattedMonth = String(viewMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const newDateStr = `${viewYear}-${formattedMonth}-${formattedDay}`;
    onChange(newDateStr);
    setIsOpen(false);
  };

  const handleQuickSelect = (offset: number) => {
    const dateStr = addCalendarDays(academyDate(), offset);
    onChange(dateStr);
    setIsOpen(false);
  };

  const stepDate = (days: number) => {
    const [y, m, d] = (value || academyDate()).split('-').map(Number);
    const current = new Date(y, m - 1, d);
    current.setDate(current.getDate() + days);
    const nextY = current.getFullYear();
    const nextM = String(current.getMonth() + 1).padStart(2, '0');
    const nextD = String(current.getDate()).padStart(2, '0');
    onChange(`${nextY}-${nextM}-${nextD}`);
  };

  const totalDays = daysInMonth(viewYear, viewMonth);
  const prevMonthTotalDays = daysInMonth(viewYear, viewMonth - 1 < 0 ? 11 : viewMonth - 1);
  const padOffset = firstDayIndex(viewYear, viewMonth);

  const daysGrid: { day: number; isCurrentMonth: boolean; monthOffset: number }[] = [];

  for (let i = padOffset - 1; i >= 0; i--) {
    daysGrid.push({ day: prevMonthTotalDays - i, isCurrentMonth: false, monthOffset: -1 });
  }

  for (let i = 1; i <= totalDays; i++) {
    daysGrid.push({ day: i, isCurrentMonth: true, monthOffset: 0 });
  }

  const remainingCells = 42 - daysGrid.length;
  for (let i = 1; i <= remainingCells; i++) {
    daysGrid.push({ day: i, isCurrentMonth: false, monthOffset: 1 });
  }

  return (
    <div className="relative shrink-0 w-full sm:w-auto" ref={popoverRef}>
      <div className="flex bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-0.5 items-center justify-between gap-1 w-full sm:w-auto shadow-sm">
        <button
          type="button"
          onClick={() => stepDate(-1)}
          title="Previous Day"
          className="p-1.5 hover:bg-neutral-200 dark:hover:bg-[#1A1A1A] rounded-[6px] text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer shrink-0"
        >
          <CaretLeft className="w-3.5 h-3.5" />
        </button>
        <input
          type="text"
          value={typedValue}
          onChange={handleInputChange}
          placeholder="YYYY-MM-DD"
          className={cn(
            "bg-transparent text-xs font-mono text-center focus:outline-none py-1.5 w-24 shrink-0 transition-colors",
            isValid ? "text-neutral-900 dark:text-[#E4E4E4] font-bold" : "text-red-500 font-bold"
          )}
        />
        <button
          type="button"
          onClick={() => stepDate(1)}
          title="Next Day"
          className="p-1.5 hover:bg-neutral-200 dark:hover:bg-[#1A1A1A] rounded-[6px] text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer shrink-0"
        >
          <CaretRight className="w-3.5 h-3.5" />
        </button>
        <div className="w-[1px] h-4 bg-neutral-300 dark:bg-[#262626] mx-0.5" />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "p-1.5 rounded-[6px] transition-colors cursor-pointer shrink-0",
            isOpen
              ? "bg-brand text-white"
              : "hover:bg-neutral-200 dark:hover:bg-[#1A1A1A] text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
          )}
          title="Open Calendar"
        >
          <Calendar className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-[260px] max-w-[calc(100vw-2rem)] bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl p-3 z-50 select-none text-neutral-900 dark:text-neutral-200"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-neutral-200 dark:border-[#262626]">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-[8px] hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer"
              >
                <CaretLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-900 dark:text-[#E4E4E4] font-sans">
                {getLocalizedMonthName(viewMonth, lang)} {viewYear}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-[8px] hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer"
              >
                <CaretRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2 pb-2.5 border-b border-neutral-200 dark:border-[#262626]/50">
              <button
                type="button"
                onClick={() => handleQuickSelect(0)}
                className="py-1 bg-neutral-100 dark:bg-[#0F0F0F] hover:bg-neutral-200 dark:hover:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-[9px] font-black uppercase tracking-wider text-center text-neutral-800 dark:text-[#E4E4E4] transition-colors cursor-pointer"
              >
                {lang === 'kh' ? 'ថ្ងៃនេះ' : lang === 'zh' ? '今天' : 'Today'}
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect(-1)}
                className="py-1 bg-neutral-100 dark:bg-[#0F0F0F] hover:bg-neutral-200 dark:hover:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-[9px] font-black uppercase tracking-wider text-center text-neutral-800 dark:text-[#E4E4E4] transition-colors cursor-pointer"
              >
                {lang === 'kh' ? 'ម្សិលមិញ' : lang === 'zh' ? '昨天' : 'Yesterday'}
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center py-2 text-[9px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
              <span>{t('day_short_mon')}</span>
              <span>{t('day_short_tue')}</span>
              <span>{t('day_short_wed')}</span>
              <span>{t('day_short_thu')}</span>
              <span>{t('day_short_fri')}</span>
              <span>{t('day_short_sat')}</span>
              <span>{t('day_short_sun')}</span>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-mono">
              {daysGrid.map((cell, idx) => {
                const isSelected = cell.isCurrentMonth &&
                  currentDate.getDate() === cell.day &&
                  currentDate.getMonth() === viewMonth &&
                  currentDate.getFullYear() === viewYear;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (cell.isCurrentMonth) {
                        selectDate(cell.day);
                      } else {
                        const targetMonth = viewMonth + cell.monthOffset;
                        let targetYear = viewYear;
                        let normalizedMonth = targetMonth;
                        if (targetMonth < 0) {
                          normalizedMonth = 11;
                          targetYear -= 1;
                        } else if (targetMonth > 11) {
                          normalizedMonth = 0;
                          targetYear += 1;
                        }
                        const formattedMonth = String(normalizedMonth + 1).padStart(2, '0');
                        const formattedDay = String(cell.day).padStart(2, '0');
                        onChange(`${targetYear}-${formattedMonth}-${formattedDay}`);
                        setIsOpen(false);
                      }
                    }}
                    className={cn(
                      "h-6.5 w-6.5 rounded-[4px] flex items-center justify-center transition-all text-[11px] cursor-pointer",
                      isSelected
                        ? "bg-brand text-white font-extrabold shadow-sm shadow-brand/30"
                        : cell.isCurrentMonth
                          ? "text-neutral-800 dark:text-[#E4E4E4] hover:bg-neutral-100 dark:hover:bg-[#1A1A1A] hover:text-neutral-900 dark:hover:text-white"
                          : "text-neutral-400 dark:text-[#444] hover:text-neutral-600 dark:hover:text-[#666]"
                    )}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
