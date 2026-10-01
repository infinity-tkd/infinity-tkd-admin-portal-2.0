'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore, Student } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MagnifyingGlass, X, ChartLine, CalendarCheck, UsersThree, 
  Warning, Trophy, Sparkle, PhoneCall, CheckSquare,
  Calendar, CaretLeft, CaretRight, Check, ArrowsCounterClockwise,
  Barcode, QrCode, CheckCircle, Clock, SpeakerHigh, SpeakerSlash, XCircle,
  Flame, GraduationCap, ArrowRight
} from '@phosphor-icons/react';
import { cn, formatBelt, formatBeltLocalized } from '@/lib/utils';
import { useT } from '@/hooks/useTranslation';
import { SafeImage } from '@/components/SafeImage';
import { supabase } from '@/lib/supabase';
import { Portal } from '@/components/Portal';

// High-speed zero-latency Web Audio sound synthesizer for Kiosk scanner
const playBeep = (type: 'success' | 'error') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {}
};

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
}

export function DatePicker({ value, onChange }: DatePickerProps) {
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
      const parsedDate = new Date(val);
      if (!isNaN(parsedDate.getTime())) {
        setIsValid(true);
        onChange(val);
      } else {
        setIsValid(false);
      }
    } else {
      setIsValid(val.length === 0 || val.length < 10);
    }
  };

  const currentDate = new Date(value || new Date());
  const [viewYear, setViewYear] = useState(currentDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(currentDate.getMonth());

  useEffect(() => {
    const d = new Date(value || new Date());
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
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const dateStr = d.toISOString().split('T')[0];
    onChange(dateStr);
    setIsOpen(false);
  };

  const stepDate = (days: number) => {
    const [y, m, d] = (value || new Date().toISOString().split('T')[0]).split('-').map(Number);
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
              ? "bg-[#EF2F38] text-white" 
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
                className="py-1 bg-neutral-100 dark:bg-[#0F0F0F] hover:bg-neutral-200 dark:hover:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-[8px] font-black uppercase tracking-wider text-center text-neutral-800 dark:text-[#E4E4E4] transition-colors cursor-pointer"
              >
                {lang === 'kh' ? 'ថ្ងៃនេះ' : lang === 'zh' ? '今天' : 'Today'}
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect(-1)}
                className="py-1 bg-neutral-100 dark:bg-[#0F0F0F] hover:bg-neutral-200 dark:hover:bg-[#1C1C1C] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-[8px] font-black uppercase tracking-wider text-center text-neutral-800 dark:text-[#E4E4E4] transition-colors cursor-pointer"
              >
                {lang === 'kh' ? 'ម្សិលមិញ' : lang === 'zh' ? '昨天' : 'Yesterday'}
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center py-2 text-[7px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
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
                        ? "bg-[#EF2F38] text-white font-extrabold shadow-sm shadow-[#EF2F38]/30" 
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

export function AttendanceView() {
  const { state, markAttendance, commitRoster, deleteAttendanceRecords, showNotification, showConfirm, can } = useAppStore();
  const t = useT();
  const lang = state.language || 'en';

  const getStudentEnrollDate = (st: Student) => {
    const enrollments = state.classEnrollments.filter(e => e.studentId === st.id);
    if (enrollments.length === 0) return st.registrationDate?.split('T')[0];
    const dates = enrollments.map(e => e.enrollmentDate).filter(Boolean) as string[];
    if (dates.length === 0) return st.registrationDate?.split('T')[0];
    return dates.sort()[0].split('T')[0];
  };
  const [activeTab, setActiveTab] = useState<'roster' | 'analytics'>('roster');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState<number | 'all'>('all');
  const [filterClass, setFilterClass] = useState<number | 'all'>('all');
  const [statsStudentId, setStatsStudentId] = useState<string | null>(null);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Present' | 'Late' | 'Absent' | 'Unmarked'>('all');
  const [overrideMismatch, setOverrideMismatch] = useState(false);
  
  // Fast Kiosk Terminal State
  const [isKioskOpen, setIsKioskOpen] = useState(false);
  const [kioskBarcode, setKioskBarcode] = useState('');
  const [kioskSound, setKioskSound] = useState(true);
  const [kioskRecentScans, setKioskRecentScans] = useState<Array<{ student: Student; time: string; status: string }>>([]);
  const kioskInputRef = useRef<HTMLInputElement>(null);

  // Student Progress Directory Filters
  const [progressSearch, setProgressSearch] = useState('');
  const [progressBeltFilter, setProgressBeltFilter] = useState('all');
  const [progressStatusFilter, setProgressStatusFilter] = useState<'all' | 'ready' | 'progress' | 'risk'>('all');

  // Multi-Select Row State
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  
  // Loading & Committing states
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    actionType: 'Present' | 'Absent' | 'Reset' | 'Commit';
    title: string;
    message: string;
    affectedCount: number;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    setOverrideMismatch(false);
    setSelectedStudentIds([]);
  }, [filterClass, selectedDate]);

  // Memoized Filtered Students for High Performance
  const filteredStudents = useMemo(() => {
    const q = search.toLowerCase().trim();
    const enrolledSet = filterClass !== 'all' 
      ? new Set(state.classEnrollments.filter(e => e.classId === filterClass).map(e => e.studentId))
      : null;

    return state.students.filter(s => {
      if (s.studentStatus !== 'Active') return false;
      if (filterBranch !== 'all' && s.homeBranchId !== filterBranch) return false;
      if (enrolledSet && !enrolledSet.has(s.id)) return false;
      if (q && !s.englishName.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q) && !(s.khmerName && s.khmerName.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [state.students, state.classEnrollments, search, filterBranch, filterClass]);

  const branchClasses = useMemo(() => {
    return state.classSessions.filter(c => filterBranch === 'all' || c.branchId === filterBranch);
  }, [state.classSessions, filterBranch]);

  const role = state.currentUser?.role;
  const canMarkAttendance = can('action:attendance_mark');
  const canBulkAction = canMarkAttendance;
  const isReadOnlyAttendance = !canMarkAttendance;

  // Memoized Stats calculations for active roster
  const rosterStudents = useMemo(() => {
    const enrolledSet = filterClass !== 'all' 
      ? new Set(state.classEnrollments.filter(e => e.classId === filterClass).map(e => e.studentId))
      : null;

    return state.students.filter(s => {
      if (s.studentStatus !== 'Active') return false;
      if (filterBranch !== 'all' && s.homeBranchId !== filterBranch) return false;
      if (enrolledSet && !enrolledSet.has(s.id)) return false;
      return true;
    });
  }, [state.students, state.classEnrollments, filterBranch, filterClass]);

  const totalRosterCount = rosterStudents.length;
  
  const { presentRosterCount, lateRosterCount, absentRosterCount, unmarkedRosterCount } = useMemo(() => {
    let p = 0, l = 0, a = 0, u = 0;
    const attMap = new Map(state.attendanceRecords.filter(r => r.date === selectedDate).map(r => [r.studentId, r.status]));

    for (const s of rosterStudents) {
      const st = attMap.get(s.id);
      if (st === 'Present') p++;
      else if (st === 'Late') l++;
      else if (st === 'Absent') a++;
      else u++;
    }
    return { presentRosterCount: p, lateRosterCount: l, absentRosterCount: a, unmarkedRosterCount: u };
  }, [rosterStudents, state.attendanceRecords, selectedDate]);

  const markedPercentage = totalRosterCount > 0 
    ? Math.round(((presentRosterCount + lateRosterCount + absentRosterCount) / totalRosterCount) * 100)
    : 0;

  const selectedClassObj = filterClass !== 'all' ? state.classSessions.find(c => c.id === filterClass) : null;
  const selectedClassCoach = selectedClassObj ? state.users.find(u => u.id === selectedClassObj.coachId) : null;

  const getDayNameFromDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[date.getDay()];
  };

  const getLocalizedDayName = (dayName: string) => {
    const lower = (dayName || '').toLowerCase();
    if (lower === 'sunday') return t('day_sunday');
    if (lower === 'monday') return t('day_monday');
    if (lower === 'tuesday') return t('day_tuesday');
    if (lower === 'wednesday') return t('day_wednesday');
    if (lower === 'thursday') return t('day_thursday');
    if (lower === 'friday') return t('day_friday');
    if (lower === 'saturday') return t('day_saturday');
    return dayName;
  };

  const selectedDateDay = getDayNameFromDate(selectedDate);
  const isScheduleMismatch = selectedClassObj ? !(
    (selectedClassObj.daysOfWeek && selectedClassObj.daysOfWeek.includes(selectedDateDay)) ||
    (selectedClassObj.dayOfWeek === selectedDateDay)
  ) : false;

  const isAttendanceLocked = isScheduleMismatch && !overrideMismatch;

  // Filter list by selected status capsule
  const finalFilteredStudents = useMemo(() => {
    const attMap = new Map(state.attendanceRecords.filter(r => r.date === selectedDate).map(r => [r.studentId, r.status]));
    return filteredStudents.filter(s => {
      const currentStatus = attMap.get(s.id);
      if (statusFilter === 'all') return true;
      if (statusFilter === 'Unmarked') return !currentStatus;
      return currentStatus === statusFilter;
    });
  }, [filteredStudents, state.attendanceRecords, selectedDate, statusFilter]);

  // Bulk marking filtered set
  const handleBulkMark = async (status: 'Present' | 'Absent') => {
    setIsCommitting(true);
    try {
      const targetStudents = finalFilteredStudents.filter(s => {
        const rec = state.attendanceRecords.find(r => r.studentId === s.id && r.date === selectedDate);
        const enrollDate = getStudentEnrollDate(s);
        const isNotYetEnrolled = enrollDate ? (selectedDate < enrollDate) : false;
        return rec?.status !== status && !isNotYetEnrolled;
      });
      if (targetStudents.length === 0) return;
      
      await Promise.all(
        targetStudents.map(student => 
          markAttendance(student.id, selectedDate, status)
        )
      );
      showNotification(t('att_bulk_success').replace('{count}', String(targetStudents.length)).replace('{status}', status === 'Present' ? t('att_present') : t('att_absent')), 'success');
    } catch (e: any) {
      console.error(e);
      showNotification(t('att_bulk_error').replace('{error}', e.message || String(e)), 'error');
    } finally {
      setIsCommitting(false);
    }
  };

  // Reset attendance records for currently filtered set
  const handleResetSelection = async () => {
    setIsCommitting(true);
    try {
      const targetIds = finalFilteredStudents
        .filter(s => state.attendanceRecords.some(r => r.studentId === s.id && r.date === selectedDate))
        .map(s => s.id);
        
      if (targetIds.length === 0) return;
      
      await deleteAttendanceRecords(selectedDate, targetIds);
      showNotification(t('att_clear_success').replace('{count}', String(targetIds.length)), 'success');
    } catch (e: any) {
      console.error(e);
      showNotification(t('att_clear_error').replace('{error}', e.message || String(e)), 'error');
    } finally {
      setIsCommitting(false);
    }
  };

  const requestBulkMark = (status: 'Present' | 'Absent') => {
    const targetStudents = finalFilteredStudents.filter(s => {
      const rec = state.attendanceRecords.find(r => r.studentId === s.id && r.date === selectedDate);
      const enrollDate = getStudentEnrollDate(s);
      const isNotYetEnrolled = enrollDate ? (selectedDate < enrollDate) : false;
      return rec?.status !== status && !isNotYetEnrolled;
    });

    if (targetStudents.length === 0) {
      showNotification(t('att_no_students_need_mark').replace('{status}', status === 'Present' ? t('att_present') : t('att_absent')), 'info');
      return;
    }

    setConfirmModal({
      isOpen: true,
      actionType: status,
      title: t('att_confirm_bulk_title').replace('{status}', status === 'Present' ? t('att_present') : t('att_absent')),
      message: t('att_confirm_bulk_desc').replace('{count}', String(targetStudents.length)).replace('{status}', status === 'Present' ? t('att_present') : t('att_absent')).replace('{date}', selectedDate),
      affectedCount: targetStudents.length,
      onConfirm: () => handleBulkMark(status)
    });
  };

  const requestResetSelection = () => {
    const targetStudents = finalFilteredStudents.filter(s => {
      const rec = state.attendanceRecords.find(r => r.studentId === s.id && r.date === selectedDate);
      return !!rec?.status;
    });

    if (targetStudents.length === 0) {
      showNotification(t('att_no_records_to_clear'), 'info');
      return;
    }

    setConfirmModal({
      isOpen: true,
      actionType: 'Reset',
      title: t('att_confirm_clear_title'),
      message: t('att_confirm_clear_desc').replace('{count}', String(targetStudents.length)).replace('{date}', selectedDate),
      affectedCount: targetStudents.length,
      onConfirm: () => handleResetSelection()
    });
  };

  const requestCommitRoster = () => {
    const targetStudents = state.students.filter(student => {
      const matchBranch = filterBranch === 'all' || student.homeBranchId === filterBranch;
      let matchClass = true;
      if (filterClass !== 'all') {
        matchClass = state.classEnrollments.some(ce => ce.studentId === student.id && ce.classId === filterClass);
      }
      const enrollDate = getStudentEnrollDate(student);
      const isNotYetEnrolled = enrollDate ? (selectedDate < enrollDate) : false;
      return matchBranch && matchClass && student.studentStatus === 'Active' && !isNotYetEnrolled;
    }).filter(student => !state.attendanceRecords.some(ar => ar.studentId === student.id && ar.date === selectedDate));

    if (targetStudents.length === 0) {
      showNotification(t('att_all_already_marked'), 'info');
      return;
    }

    setConfirmModal({
      isOpen: true,
      actionType: 'Commit',
      title: t('att_confirm_commit_title'),
      message: t('att_confirm_commit_desc').replace('{count}', String(targetStudents.length)).replace('{date}', selectedDate),
      affectedCount: targetStudents.length,
      onConfirm: () => handleCommitRoster()
    });
  };

  const statsStudent = statsStudentId ? state.students.find(s => s.id === statsStudentId) : null;
  const studentAttendanceRecords = statsStudent ? state.attendanceRecords.filter(r => r.studentId === statsStudent.id) : [];
  
  const presentCount = studentAttendanceRecords.filter(r => r.status === 'Present').length;
  const lateCount = studentAttendanceRecords.filter(r => r.status === 'Late').length;
  const absentCount = studentAttendanceRecords.filter(r => r.status === 'Absent').length;
  const totalCount = studentAttendanceRecords.length;

  // --- Group Analytics Calculations ---
  
  // --- Group Analytics Calculations ---
  
  // Base set of active students filtered by branch & class (not by search/status)
  const activeStudentsForAnalytics = state.students.filter(student => {
    if (student.studentStatus !== 'Active') return false;
    const matchesBranch = filterBranch === 'all' || student.homeBranchId === filterBranch;
    let matchesClass = true;
    if (filterClass !== 'all') {
      matchesClass = state.classEnrollments.some(ce => ce.studentId === student.id && ce.classId === filterClass);
    }
    return matchesBranch && matchesClass;
  });

  const activeStudentIds = new Set(activeStudentsForAnalytics.map(s => s.id));

  // 1. Academy/Cohort Attendance Rate & Statistics
  const filteredRecords = state.attendanceRecords.filter(r => activeStudentIds.has(r.studentId));
  const totalRecordsCount = filteredRecords.length;
  const allPresentCount = filteredRecords.filter(r => r.status === 'Present').length;
  const allLateCount = filteredRecords.filter(r => r.status === 'Late').length;
  const academyAttendanceRate = totalRecordsCount > 0 
    ? Math.round(((allPresentCount + allLateCount) / totalRecordsCount) * 100) 
    : 0;

  const getRequiredSessionsForBelt = (belt: string) => {
    const lower = (belt || '').toLowerCase();
    if (lower.includes('white')) return 12;
    if (lower.includes('yellow')) return 16;
    if (lower.includes('green')) return 20;
    if (lower.includes('blue')) return 24;
    if (lower.includes('brown')) return 30;
    if (lower.includes('red')) return 36;
    return 40;
  };

  const getNextBeltName = (belt: string) => {
    const lower = (belt || '').toLowerCase();
    if (lower.includes('white')) return 'Yellow';
    if (lower.includes('yellow')) return 'Green';
    if (lower.includes('green')) return 'Blue';
    if (lower.includes('blue')) return 'Brown';
    if (lower.includes('brown')) return 'Red';
    if (lower.includes('red')) return 'Poom / Black';
    return 'Dan Black';
  };

  const calculateStreak = (records: any[]) => {
    const sorted = [...records].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    let streak = 0;
    for (const rec of sorted) {
      if (rec.status === 'Present' || rec.status === 'Late') {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  // 2. Attendance Rates & Promotion Milestones by Student
  const studentAttendanceRates = useMemo(() => {
    return activeStudentsForAnalytics.map(st => {
      const records = state.attendanceRecords.filter(r => r.studentId === st.id);
      const p = records.filter(r => r.status === 'Present').length;
      const l = records.filter(r => r.status === 'Late').length;
      const a = records.filter(r => r.status === 'Absent').length;
      const attendedCount = p + l;
      const totalSessions = records.length;
      const rate = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : null;
      const requiredSessions = getRequiredSessionsForBelt(st.currentBelt);
      const progressPercent = Math.min(Math.round((attendedCount / requiredSessions) * 100), 100);
      const streak = calculateStreak(records);
      const isReadyForPromotion = attendedCount >= requiredSessions && (rate === null || rate >= 75);

      return {
        student: st,
        rate,
        attendedCount,
        absentCount: a,
        totalSessions,
        requiredSessions,
        progressPercent,
        streak,
        isReadyForPromotion,
        nextBelt: getNextBeltName(st.currentBelt),
        records
      };
    });
  }, [activeStudentsForAnalytics, state.attendanceRecords]);

  // At-Risk Roster (Rate < 75%, Min 3 sessions)
  const atRiskStudents = useMemo(() => {
    return studentAttendanceRates.filter(sar => 
      sar.rate !== null && sar.rate < 75 && sar.student.studentStatus === 'Active'
    );
  }, [studentAttendanceRates]);

  // Ready for Promotion (Sessions requirement reached OR Rate >= 90% with min 4 sessions)
  const readyStudents = useMemo(() => {
    return studentAttendanceRates.filter(sar => 
      (sar.isReadyForPromotion || (sar.rate !== null && sar.rate >= 90 && sar.totalSessions >= 4)) && sar.student.studentStatus === 'Active'
    );
  }, [studentAttendanceRates]);

  // Filtered Student Progress Roster for the Student Progress Table
  const filteredStudentProgress = useMemo(() => {
    const q = progressSearch.toLowerCase().trim();
    return studentAttendanceRates.filter(sar => {
      const s = sar.student;
      if (q) {
        const matchesName = s.englishName.toLowerCase().includes(q);
        const matchesId = s.id.toLowerCase().includes(q);
        const matchesKhmer = s.khmerName && s.khmerName.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesKhmer) return false;
      }
      if (progressBeltFilter !== 'all') {
        if (!s.currentBelt.toLowerCase().includes(progressBeltFilter.toLowerCase())) return false;
      }
      if (progressStatusFilter === 'ready' && !sar.isReadyForPromotion) return false;
      if (progressStatusFilter === 'risk' && (sar.rate === null || sar.rate >= 75)) return false;
      if (progressStatusFilter === 'progress' && (sar.isReadyForPromotion || (sar.rate !== null && sar.rate < 75))) return false;
      return true;
    });
  }, [studentAttendanceRates, progressSearch, progressBeltFilter, progressStatusFilter]);

  // 3. Branch Average Rates (Filtered if branch is selected)
  const branchAnalytics = state.branches
    .filter(b => filterBranch === 'all' || b.id === filterBranch)
    .map(branch => {
      const branchStudents = state.students.filter(s => s.homeBranchId === branch.id && s.studentStatus === 'Active');
      const branchStudentIds = new Set(branchStudents.map(s => s.id));
      const records = state.attendanceRecords.filter(r => branchStudentIds.has(r.studentId));
      const p = records.filter(r => r.status === 'Present').length;
      const l = records.filter(r => r.status === 'Late').length;
      const rate = records.length > 0 ? Math.round(((p + l) / records.length) * 100) : 0;
      return {
        branch,
        studentCount: branchStudents.length,
        attendanceRate: rate,
        totalSessions: records.length
      };
    });

  // 4. Class Enrollments & Attendance (Filtered by branch/class selection)
  const classAnalytics = state.classSessions
    .filter(cls => {
      const matchBranch = filterBranch === 'all' || cls.branchId === filterBranch;
      const matchClass = filterClass === 'all' || cls.id === filterClass;
      return matchBranch && matchClass;
    })
    .map(cls => {
      const enrollments = state.classEnrollments.filter(e => e.classId === cls.id);
      const enrolledIds = new Set(enrollments.map(e => e.studentId));
      const records = state.attendanceRecords.filter(r => enrolledIds.has(r.studentId));
      const p = records.filter(r => r.status === 'Present').length;
      const l = records.filter(r => r.status === 'Late').length;
      const rate = records.length > 0 ? Math.round(((p + l) / records.length) * 100) : 0;
      const branchName = state.branches.find(b => b.id === cls.branchId)?.name || 'Central Dojang';
      return {
        cls,
        branchName,
        enrolledCount: enrollments.length,
        utilizationRate: cls.capacity > 0 ? Math.round((enrollments.length / cls.capacity) * 100) : 0,
        attendanceRate: rate
      };
    });

  // 5. Belt Ranks Discipline Analysis (Respects filtered active student set)
  const beltTiers = ['White', 'Yellow', 'Green', 'Blue', 'Brown', 'Red', 'Poom', 'Dan'];
  const beltAnalytics = beltTiers.map(tier => {
    const studentsInBelt = activeStudentsForAnalytics.filter(s => 
      s.currentBelt.toLowerCase().includes(tier.toLowerCase())
    );
    const studentIds = new Set(studentsInBelt.map(s => s.id));
    const records = state.attendanceRecords.filter(r => studentIds.has(r.studentId));
    const p = records.filter(r => r.status === 'Present').length;
    const l = records.filter(r => r.status === 'Late').length;
    const rate = records.length > 0 ? Math.round(((p + l) / records.length) * 100) : 0;
    return {
      belt: tier,
      studentCount: studentsInBelt.length,
      attendanceRate: rate,
      totalSessions: records.length
    };
  });

  const getDisciplineStatus = (rate: number) => {
    if (rate >= 85) return { status: 'EXCELLENT', color: 'text-emerald-700 dark:text-emerald-400', iconColor: 'text-amber-600 dark:text-amber-400' };
    if (rate >= 70) return { status: 'CONSISTENT', color: 'text-amber-700 dark:text-amber-400', iconColor: 'text-amber-600 dark:text-amber-400' };
    return { status: 'NEEDS ATTN', color: 'text-rose-700 dark:text-rose-400', iconColor: 'text-rose-600 dark:text-rose-400' };
  };
  const discipline = getDisciplineStatus(academyAttendanceRate);

  // Bulk Commit Trigger
  const handleCommitRoster = async () => {
    setIsCommitting(true);
    setCommitMessage(null);
    try {
      const result = await commitRoster(selectedDate, filterBranch, filterClass);
      setCommitMessage(`${t('att_save_success')} (Marked ${result.count} students as Absent)`);
      setTimeout(() => setCommitMessage(null), 5000);
    } catch (err: any) {
      console.error(err);
      showNotification(`Failed: ${err.message || err}`, 'error');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4">
      {/* Header Tabs */}
      <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-[#EF2F38]"/>
              {t('att_title')}
            </h1>
            <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono tracking-widest mt-0.5">{t('att_subtitle')}</p>
          </div>
          {isReadOnlyAttendance && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-[8px] bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
              <span>👁️</span> Read-Only Mode
            </span>
          )}
        </div>
        <div className="flex w-full md:w-auto bg-neutral-100 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] p-1 shrink-0">
          <button onClick={() => setActiveTab('roster')}
            className={cn("flex-1 md:flex-none justify-center px-3 sm:px-4 py-2 min-h-[38px] rounded-[6px] flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all active:scale-95 touch-manipulation cursor-pointer", activeTab === 'roster' ? "bg-white dark:bg-[#1C1C1C] text-neutral-900 dark:text-white shadow-sm font-black" : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white")}
          >
            <UsersThree className="w-3.5 h-3.5"/> {t('att_status')}
          </button>
          <button onClick={() => setActiveTab('analytics')}
            className={cn("flex-1 md:flex-none justify-center px-3 sm:px-4 py-2 min-h-[38px] rounded-[6px] flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all active:scale-95 touch-manipulation cursor-pointer", activeTab === 'analytics' ? "bg-white dark:bg-[#1C1C1C] text-neutral-900 dark:text-white shadow-sm font-black" : "text-neutral-500 hover:text-neutral-900 dark:text-[#888] dark:hover:text-white")}
          >
            <ChartLine className="w-3.5 h-3.5"/> {t('lms_student_progress')}
          </button>
        </div>
      </div>

      {activeTab === 'roster' && (
        <>
          {/* Daily Roster View */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 flex flex-col gap-4 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
              <div>
                <h3 className="font-bold uppercase tracking-widest text-xs text-neutral-900 dark:text-[#E4E4E4]">{t('att_title')}</h3>
                <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono mt-0.5">{t('att_subtitle')}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto items-stretch sm:items-center">
                <DatePicker value={selectedDate} onChange={(date) => {
                  setSelectedDate(date);
                  setStatusFilter('all');
                }} />
                <button 
                  onClick={() => !isReadOnlyAttendance && setIsKioskOpen(true)}
                  disabled={isReadOnlyAttendance}
                  className={cn(
                    "px-4 py-2 min-h-[40px] rounded-[8px] text-xs font-bold uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto shrink-0 font-mono active:scale-95 touch-manipulation",
                    isReadOnlyAttendance
                      ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border border-neutral-300 dark:border-[#262626] cursor-not-allowed opacity-50 shadow-none"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                  )}
                  title={isReadOnlyAttendance ? "Check-in disabled in Read-Only mode" : "Launch Instant Barcode / QR Student Kiosk Check-in"}
                >
                  <Barcode className="w-4 h-4" /> KIOSK MODE
                </button>
                <button 
                  onClick={requestCommitRoster}
                  disabled={isCommitting || filteredStudents.length === 0 || isAttendanceLocked || isReadOnlyAttendance}
                  className="px-5 sm:px-6 py-2 min-h-[40px] bg-[#EF2F38] hover:bg-[#D0252D] disabled:opacity-50 text-white rounded-[8px] text-xs font-bold uppercase tracking-widest transition-all shadow-md shadow-[#EF2F38]/20 flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto shrink-0 active:scale-95 touch-manipulation"
                >
                  {isCommitting ? t('act_loading') : t('att_commit_roster')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                 <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 dark:text-neutral-400"/>
                 <input 
                   type="text" 
                   placeholder={t('fin_search_student')} 
                   value={search} 
                   onChange={(e) => setSearch(e.target.value)}
                   className="w-full pl-9 pr-8 h-10 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] text-xs focus:outline-none focus:border-[#EF2F38] transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                 />
                 {search && (
                   <button
                     type="button"
                     onClick={() => setSearch('')}
                     className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white p-0.5"
                     title="Clear search"
                   >
                     <X className="w-3.5 h-3.5" />
                   </button>
                 )}
              </div>
              <select value={filterBranch} onChange={(e) => {
                  setFilterBranch(e.target.value === 'all' ? 'all' : Number(e.target.value));
                  setFilterClass('all'); 
                  setStatusFilter('all');
                }}
                className="w-full h-10 bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs px-3 focus:outline-none focus:border-[#EF2F38] cursor-pointer"
              >
                <option value="all">{t('att_all_branches')}</option>
                {state.branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <select value={filterClass} onChange={(e) => {
                  setFilterClass(e.target.value === 'all' ? 'all' : Number(e.target.value));
                  setStatusFilter('all');
                }}
                className="w-full h-10 bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs px-3 focus:outline-none focus:border-[#EF2F38] cursor-pointer"
              >
                <option value="all">{t('att_all_classes')}</option>
                {branchClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.daysOfWeek?.join(', ') || c.dayOfWeek} {c.startTime}-{c.endTime})</option>
                ))}
              </select>
            </div>

            {/* Selected Class Info Card */}
            {selectedClassObj && (
              <div className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626]/80 rounded-[8px] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neutral-900 dark:text-white uppercase text-[10px] tracking-wide">{selectedClassObj.name}</span>
                    <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-[#EF2F38] text-[8px] font-black uppercase tracking-wider rounded">
                      {selectedClassObj.classType}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono">
                    {t('nav_schedule')}: {selectedClassObj.daysOfWeek?.map(d => getLocalizedDayName(d)).join(', ') || getLocalizedDayName(selectedClassObj.dayOfWeek)} • {selectedClassObj.startTime} - {selectedClassObj.endTime}
                  </p>
                </div>
                
                <div className="flex items-center gap-4 text-[10px] font-mono">
                  <div>
                    <span className="text-neutral-500 dark:text-[#888] block">{t('att_instructor')}</span>
                    <span className="text-neutral-900 dark:text-[#E4E4E4] font-bold">{selectedClassCoach?.displayName || t('act_tba')}</span>
                  </div>
                  <div className="border-l border-neutral-200 dark:border-[#262626] h-6 shrink-0"></div>
                  <div>
                    <span className="text-neutral-500 dark:text-[#888] block">{t('att_capacity_utilization')}</span>
                    <span className="text-neutral-900 dark:text-white font-bold">
                      {state.classEnrollments.filter(e => e.classId === selectedClassObj.id).length} / {selectedClassObj.capacity}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {/* Schedule Mismatch Alert */}
            {isScheduleMismatch && (
              <div className={cn(
                "p-4 rounded-[8px] border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all",
                isAttendanceLocked 
                  ? "bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
              )}>
                <div className="flex items-start gap-2.5">
                  <Warning className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold uppercase tracking-wider text-[10px]">{t('att_schedule_mismatch')}</p>
                    <p className="mt-1 leading-relaxed">
                      {isAttendanceLocked 
                        ? t('att_mismatch_locked')
                            .replace('{scheduled}', selectedClassObj?.daysOfWeek?.map(d => getLocalizedDayName(d)).join(', ') || getLocalizedDayName(selectedClassObj?.dayOfWeek || ''))
                            .replace('{date}', selectedDate)
                            .replace('{day}', getLocalizedDayName(selectedDateDay))
                        : t('att_mismatch_override')
                            .replace('{scheduled}', selectedClassObj?.daysOfWeek?.map(d => getLocalizedDayName(d)).join(', ') || getLocalizedDayName(selectedClassObj?.dayOfWeek || ''))
                            .replace('{date}', selectedDate)
                            .replace('{day}', getLocalizedDayName(selectedDateDay))
                      }
                    </p>
                  </div>
                </div>
                
                <label className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-[#262626] hover:border-neutral-400 dark:hover:border-[#444] text-neutral-900 dark:text-white font-bold uppercase text-[9px] tracking-wider shrink-0 cursor-pointer select-none shadow-sm">
                  <input 
                    type="checkbox" 
                    checked={overrideMismatch}
                    onChange={(e) => setOverrideMismatch(e.target.checked)}
                    className="rounded border-neutral-300 dark:border-[#262626] bg-white dark:bg-[#0F0F0F] text-[#EF2F38] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <span>{t('att_override_mismatch')}</span>
                </label>
              </div>
            )}
            {/* Attendance Status Stats & Tabs */}
            <div className="border-t border-neutral-200 dark:border-[#262626]/80 pt-3 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scrollbar-none pb-1 sm:pb-0 flex-nowrap sm:flex-wrap">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={cn(
                      "px-3 py-1.5 min-h-[34px] rounded-[8px] border text-[10px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 shadow-sm cursor-pointer shrink-0 active:scale-95 touch-manipulation",
                      statusFilter === 'all'
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white font-black shadow"
                        : "bg-white dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
                    )}
                  >
                    <span>{t('belt_all')}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono font-bold">
                      {totalRosterCount}
                    </span>
                  </button>
                  <button
                    onClick={() => setStatusFilter('Present')}
                    className={cn(
                      "px-3 py-1.5 min-h-[34px] rounded-[8px] border text-[10px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 shadow-sm cursor-pointer shrink-0 active:scale-95 touch-manipulation",
                      statusFilter === 'Present'
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-800 dark:text-emerald-400 font-black shadow ring-1 ring-emerald-500/30"
                        : "bg-white dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-[#888] hover:text-emerald-600 dark:hover:text-emerald-400"
                    )}
                  >
                    <span>{t('att_present')}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                      {presentRosterCount}
                    </span>
                  </button>
                  <button
                    onClick={() => setStatusFilter('Late')}
                    className={cn(
                      "px-3 py-1.5 min-h-[34px] rounded-[8px] border text-[10px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 shadow-sm cursor-pointer shrink-0 active:scale-95 touch-manipulation",
                      statusFilter === 'Late'
                        ? "bg-amber-500/20 border-amber-500 text-amber-800 dark:text-amber-400 font-black shadow ring-1 ring-amber-500/30"
                        : "bg-white dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-[#888] hover:text-amber-600 dark:hover:text-amber-400"
                    )}
                  >
                    <span>{t('att_late')}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono font-bold">
                      {lateRosterCount}
                    </span>
                  </button>
                  <button
                    onClick={() => setStatusFilter('Absent')}
                    className={cn(
                      "px-3 py-1.5 min-h-[34px] rounded-[8px] border text-[10px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 shadow-sm cursor-pointer shrink-0 active:scale-95 touch-manipulation",
                      statusFilter === 'Absent'
                        ? "bg-rose-500/20 border-rose-500 text-rose-800 dark:text-rose-400 font-black shadow ring-1 ring-rose-500/30"
                        : "bg-white dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-[#888] hover:text-rose-600 dark:hover:text-rose-400"
                    )}
                  >
                    <span>{t('att_absent')}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500/20 text-rose-700 dark:text-rose-300 font-mono font-bold">
                      {absentRosterCount}
                    </span>
                  </button>
                  <button
                    onClick={() => setStatusFilter('Unmarked')}
                    className={cn(
                      "px-3 py-1.5 min-h-[34px] rounded-[8px] border text-[10px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 shadow-sm cursor-pointer shrink-0 active:scale-95 touch-manipulation",
                      statusFilter === 'Unmarked'
                        ? "bg-blue-500/20 border-blue-500 text-blue-800 dark:text-blue-400 font-black shadow ring-1 ring-blue-500/30"
                        : "bg-white dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-[#888] hover:text-blue-600 dark:hover:text-blue-400"
                    )}
                  >
                    <span>{t('dash_unmarked')}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-blue-500/20 text-blue-700 dark:text-blue-300 font-mono font-bold">
                      {unmarkedRosterCount}
                    </span>
                  </button>
                </div>

                {/* Bulk Actions Capsule */}
                {canBulkAction && (
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px]">
                    <span className="text-neutral-600 dark:text-neutral-400 font-bold uppercase tracking-wider text-[9px] sm:text-[10px]">{t('att_quick_actions')}</span>
                    <button
                      type="button"
                      onClick={() => requestBulkMark('Present')}
                      disabled={isCommitting || finalFilteredStudents.length === 0 || isAttendanceLocked}
                      className="px-2.5 py-1.5 min-h-[34px] bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 rounded-[6px] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm active:scale-95 touch-manipulation"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{lang === 'kh' ? 'វត្តមានទាំងអស់' : lang === 'zh' ? '全标记已到' : 'Mark All Present'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => requestBulkMark('Absent')}
                      disabled={isCommitting || finalFilteredStudents.length === 0 || isAttendanceLocked}
                      className="px-2.5 py-1.5 min-h-[34px] bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-700 dark:text-rose-400 rounded-[6px] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm active:scale-95 touch-manipulation"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      <span>{lang === 'kh' ? 'អវត្តមានទាំងអស់' : lang === 'zh' ? '全标记未到' : 'Mark All Absent'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={requestResetSelection}
                      disabled={isCommitting || finalFilteredStudents.length === 0 || isAttendanceLocked}
                      className="px-2.5 py-1.5 min-h-[34px] bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-[#202020] border border-neutral-300 dark:border-[#262626] text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white rounded-[6px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95 touch-manipulation"
                    >
                      <ArrowsCounterClockwise className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{lang === 'kh' ? 'កំណត់ឡើងវិញ' : lang === 'zh' ? '重置筛选' : 'Reset Filtered'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Marked progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] text-neutral-500 dark:text-[#888] font-mono">
                  <span>{lang === 'kh' ? `វឌ្ឍនភាពវត្តមាន៖ ${presentRosterCount + lateRosterCount + absentRosterCount} / ${totalRosterCount} សិស្ស (${markedPercentage}%)` : lang === 'zh' ? `已标记进度: ${presentRosterCount + lateRosterCount + absentRosterCount} / ${totalRosterCount} 学员 (${markedPercentage}%)` : `Marked Progress: ${presentRosterCount + lateRosterCount + absentRosterCount} / ${totalRosterCount} Students (${markedPercentage}%)`}</span>
                  <span className={cn("font-bold", markedPercentage === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-600 dark:text-neutral-400")}>
                    {markedPercentage === 100 ? (lang === 'kh' ? '✓ បញ្ជីរួចរាល់' : lang === 'zh' ? '✓ 名单已完成' : '✓ Roster Complete') : (lang === 'kh' ? 'មិនទាន់រួចរាល់' : lang === 'zh' ? '未完成' : 'Incomplete')}
                  </span>
                </div>
                <div className="w-full bg-neutral-100 dark:bg-[#0F0F0F] rounded-full h-2 overflow-hidden border border-neutral-200 dark:border-[#262626]/40 shadow-inner">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-300", 
                      markedPercentage === 100 ? "bg-emerald-500" : "bg-[#EF2F38]"
                    )} 
                    style={{ width: `${markedPercentage}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {commitMessage && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-4 bg-green-500/10 border border-green-500/30 rounded-[8px] text-green-700 dark:text-green-400 text-xs font-medium flex items-center gap-2">
                <CheckSquare className="w-4 h-4" />
                {commitMessage}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            {state.isLoading ? (
              [1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center animate-pulse">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-[8px] bg-neutral-200 dark:bg-[#262626] shrink-0" />
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="w-36 h-3.5 bg-neutral-200 dark:bg-[#262626] rounded" />
                      <div className="w-24 h-2.5 bg-neutral-100 dark:bg-[#202020] rounded" />
                    </div>
                  </div>
                  <div className="w-full md:w-64 h-11 bg-neutral-200 dark:bg-[#262626] rounded-[8px]" />
                </div>
              ))
            ) : finalFilteredStudents.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-neutral-600 dark:text-neutral-400">
                <p className="text-xs font-bold uppercase tracking-widest">{t('att_no_students')}</p>
              </div>
            ) : (
              finalFilteredStudents.map(student => {
                const record = state.attendanceRecords.find(r => r.studentId === student.id && r.date === selectedDate);
                const currentStatus = record?.status;
                
                const enrollDate = getStudentEnrollDate(student);
                const isNotYetEnrolled = enrollDate ? (selectedDate < enrollDate) : false;
                
                return (
                  <div 
                    key={student.id} 
                    className={cn(
                      "bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center hover:border-neutral-300 dark:hover:border-[#444] transition-all group shadow-sm",
                      currentStatus === 'Present' ? "border-l-4 border-l-emerald-500" :
                      currentStatus === 'Late' ? "border-l-4 border-l-amber-500" :
                      currentStatus === 'Absent' ? "border-l-4 border-l-rose-500" :
                      "border-l-4 border-l-neutral-300 dark:border-l-neutral-700"
                    )}
                  >
                    <div 
                      className="flex items-center gap-3.5 cursor-pointer flex-1 min-w-0" 
                      onClick={() => setStatsStudentId(student.id)}
                      title="Click to view student attendance history"
                    >
                      <div className="relative shrink-0">
                        <SafeImage 
                          src={student.profilePicturePath} 
                          alt={student.englishName} 
                          containerClassName="w-11 h-11 rounded-[8px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 group-hover:border-[#EF2F38] transition-colors"
                          fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-base group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">{student.englishName.charAt(0)}</span>}
                        />
                        <span 
                          className={cn(
                            "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#141414] shadow-sm",
                            student.currentBelt?.toLowerCase().includes('white') ? 'bg-neutral-200' :
                            student.currentBelt?.toLowerCase().includes('yellow') ? 'bg-amber-400' :
                            student.currentBelt?.toLowerCase().includes('green') ? 'bg-emerald-500' :
                            student.currentBelt?.toLowerCase().includes('blue') ? 'bg-blue-500' :
                            student.currentBelt?.toLowerCase().includes('brown') ? 'bg-amber-800' :
                            student.currentBelt?.toLowerCase().includes('red') ? 'bg-red-500' :
                            student.currentBelt?.toLowerCase().includes('poom') ? 'bg-rose-700' :
                            'bg-neutral-900'
                          )}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs mb-0.5 text-neutral-900 dark:text-[#E4E4E4] group-hover:text-[#EF2F38] dark:group-hover:text-white transition-colors truncate">
                          {student.englishName} <span className="text-[10px] font-khmer text-neutral-500 dark:text-[#888] ml-1 font-normal">{student.khmerName}</span>
                          {isNotYetEnrolled && (
                            <span className="ml-2 px-2 py-0.5 rounded-[8px] bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 font-bold uppercase tracking-widest text-[8px] whitespace-nowrap">
                              {t('panel_not_enrolled_yet')}
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono tracking-tight font-semibold truncate flex items-center gap-1.5">
                          <span>{student.id}</span>
                          <span>•</span>
                          <span className="font-bold text-neutral-700 dark:text-neutral-300">{formatBelt(student.currentBelt, student.dob)}</span>
                        </p>
                      </div>
                    </div>
                  
                  <div className="flex bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] w-full md:w-auto p-1 gap-1 shrink-0">
                    <button 
                      disabled={isNotYetEnrolled || isAttendanceLocked || !canMarkAttendance}
                      onClick={() => markAttendance(student.id, selectedDate, 'Present')}
                      className={cn(
                        "flex-1 md:flex-none px-3 sm:px-5 py-2 min-h-[42px] sm:min-h-[38px] rounded-[6px] text-[11px] sm:text-[10px] font-bold uppercase transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation select-none",
                        isNotYetEnrolled || isAttendanceLocked || !canMarkAttendance
                          ? "opacity-30 cursor-not-allowed text-neutral-400 dark:text-[#444] border-transparent"
                          : currentStatus === 'Present' 
                            ? "bg-emerald-600 text-white font-black shadow-md shadow-emerald-600/30" 
                            : "text-neutral-600 dark:text-[#888] hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-500/10 border border-transparent font-bold"
                      )}
                    >
                      <Check className={cn("w-3.5 h-3.5", currentStatus === 'Present' ? "text-white stroke-[3]" : "hidden")} />
                      {t('att_present')}
                    </button>
                    <button 
                      disabled={isNotYetEnrolled || isAttendanceLocked || !canMarkAttendance}
                      onClick={() => markAttendance(student.id, selectedDate, 'Late')}
                      className={cn(
                        "flex-1 md:flex-none px-3 sm:px-5 py-2 min-h-[42px] sm:min-h-[38px] rounded-[6px] text-[11px] sm:text-[10px] font-bold uppercase transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation select-none",
                        isNotYetEnrolled || isAttendanceLocked || !canMarkAttendance
                          ? "opacity-30 cursor-not-allowed text-neutral-400 dark:text-[#444] border-transparent"
                          : currentStatus === 'Late' 
                            ? "bg-amber-500 text-white font-black shadow-md shadow-amber-500/30" 
                            : "text-neutral-600 dark:text-[#888] hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-500/10 border border-transparent font-bold"
                      )}
                    >
                      <Clock className={cn("w-3.5 h-3.5", currentStatus === 'Late' ? "text-white" : "hidden")} />
                      {t('att_late')}
                    </button>
                    <button 
                      disabled={isNotYetEnrolled || isAttendanceLocked || !canMarkAttendance}
                      onClick={() => markAttendance(student.id, selectedDate, 'Absent')}
                      className={cn(
                        "flex-1 md:flex-none px-3 sm:px-5 py-2 min-h-[42px] sm:min-h-[38px] rounded-[6px] text-[11px] sm:text-[10px] font-bold uppercase transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation select-none",
                        isNotYetEnrolled || isAttendanceLocked || !canMarkAttendance
                          ? "opacity-30 cursor-not-allowed text-neutral-400 dark:text-[#444] border-transparent"
                          : currentStatus === 'Absent' 
                            ? "bg-rose-600 text-white font-black shadow-md shadow-rose-600/30" 
                            : "text-neutral-600 dark:text-[#888] hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-500/10 border border-transparent font-bold"
                      )}
                    >
                      <X className={cn("w-3.5 h-3.5", currentStatus === 'Absent' ? "text-white stroke-[3]" : "hidden")} />
                      {t('att_absent')}
                    </button>
                  </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Overall Stats Grid (2x2 on Mobile, 4x1 on Desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
             <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm">
               <p className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-[#888] uppercase font-bold tracking-widest mb-1 truncate">{t('att_status')}</p>
               <h2 className="text-xl sm:text-2xl font-mono text-neutral-900 dark:text-white font-bold">{academyAttendanceRate}%</h2>
               <div className="h-1.5 w-full bg-neutral-100 dark:bg-[#0F0F0F] rounded-full mt-2.5 sm:mt-3 overflow-hidden border border-neutral-200 dark:border-[#262626]/40">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${academyAttendanceRate}%` }} />
               </div>
             </div>
             <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm">
               <p className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-[#888] uppercase font-bold tracking-widest mb-1 truncate">{t('att_perfect_attendance')}</p>
               <h2 className="text-xl sm:text-2xl font-mono text-amber-600 dark:text-amber-400 font-bold">
                 {studentAttendanceRates.filter(sar => sar.rate === 100 && sar.totalSessions >= 3).length}
               </h2>
               <p className="text-[8.5px] sm:text-[9px] text-neutral-500 dark:text-[#888] mt-1.5 sm:mt-2 font-mono uppercase tracking-tight truncate">{t('att_min_3_sessions')}</p>
             </div>
             <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm">
               <p className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-[#888] uppercase font-bold tracking-widest mb-1 truncate">{t('att_total_classes')}</p>
               <h2 className="text-xl sm:text-2xl font-mono text-indigo-600 dark:text-indigo-400 font-bold">{totalRecordsCount}</h2>
               <p className="text-[8.5px] sm:text-[9px] text-neutral-500 dark:text-[#888] mt-1.5 sm:mt-2 font-mono uppercase tracking-tight truncate">{t('att_lifetime_records')}</p>
             </div>
             <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-5 shadow-sm">
                <p className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-[#888] uppercase font-bold tracking-widest mb-1 truncate">{t('att_discipline_status')}</p>
                <h2 className={cn("text-lg sm:text-xl font-mono font-bold flex items-center gap-1.5 mt-0.5 truncate", discipline.color)}>
                  <Trophy className={cn("w-4 h-4 sm:w-5 sm:h-5 shrink-0", discipline.iconColor)}/>
                  <span className="truncate">{discipline.status}</span>
                </h2>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Branch and Class breakdown */}
            <div className="lg:col-span-2 space-y-6">
              {/* Branch Statistics */}
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
                <div className="p-4 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F]">
                   <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                     <UsersThree className="w-4 h-4 text-indigo-500 dark:text-indigo-400"/>
                     {t('att_branch_presence')}
                   </h3>
                </div>
                <div className="divide-y divide-neutral-200 dark:divide-[#262626]">
                  {branchAnalytics.map(ba => (
                    <div key={ba.branch.id} className="p-4 flex items-center justify-between bg-white dark:bg-[#141414] hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors">
                      <div>
                         <p className="text-xs font-bold text-neutral-900 dark:text-[#E4E4E4]">{ba.branch.name}</p>
                         <p className="text-[9px] text-neutral-600 dark:text-neutral-400 font-mono mt-0.5">{ba.studentCount} {t('nav_students')} • {ba.totalSessions} {t('att_sessions_suffix')}</p>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="text-right">
                            <span className="text-xs font-mono text-neutral-900 dark:text-white font-bold">{ba.attendanceRate}%</span>
                            <p className="text-[8px] text-neutral-600 dark:text-neutral-400 uppercase font-bold">{t('nav_attendance')}</p>
                         </div>
                         <div className="w-16 h-1.5 bg-neutral-100 dark:bg-[#0F0F0F] rounded-full overflow-hidden border border-neutral-200 dark:border-[#262626]/40">
                           <div className="h-full bg-[#EF2F38]" style={{ width: `${ba.attendanceRate}%` }} />
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Class Schedule Attendance Utilizations */}
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
                <div className="p-4 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F]">
                   <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                     <CalendarCheck className="w-4 h-4 text-indigo-500 dark:text-indigo-400"/>
                     {t('att_scheduled_class_utilization')}
                   </h3>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-xs whitespace-nowrap">
                     <thead className="bg-neutral-50 dark:bg-[#0F0F0F] sticky top-0 z-10 text-neutral-600 dark:text-neutral-400 uppercase tracking-widest font-bold border-b border-neutral-200 dark:border-[#262626]">
                       <tr>
                         <th className="px-4 py-3">{t('att_scheduled_cohort')}</th>
                         <th className="px-4 py-3">{t('att_location')}</th>
                         <th className="px-4 py-3 text-center">{t('att_enrollment_rate')}</th>
                         <th className="px-4 py-3 text-right">{t('att_avg_attendance')}</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                       {classAnalytics.map(ca => (
                         <tr key={ca.cls.id} className="hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors text-neutral-800 dark:text-[#E4E4E4]">
                           <td className="px-4 py-3">
                             <div className="font-bold text-neutral-900 dark:text-white">{ca.cls.name}</div>
                             <div className="text-[9px] text-neutral-600 dark:text-neutral-400 font-mono mt-0.5">{ca.cls.dayOfWeek} {ca.cls.startTime}-{ca.cls.endTime}</div>
                           </td>
                           <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">{ca.branchName}</td>
                           <td className="px-4 py-3 text-center font-mono">
                             <span className={cn(ca.utilizationRate >= 90 ? 'text-rose-700 dark:text-rose-400 font-bold' : ca.utilizationRate >= 70 ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-600 dark:text-neutral-400')}>
                               {ca.enrolledCount} / {ca.cls.capacity} ({ca.utilizationRate}%)
                             </span>
                           </td>
                           <td className="px-4 py-3 text-right font-bold text-emerald-700 dark:text-emerald-400 font-mono">{ca.attendanceRate}%</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                </div>
              </div>
            </div>

            {/* Right: Belt analysis and Actionable Lists */}
            <div className="space-y-6">
              {/* Belt Rank Analysis */}
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 space-y-4 shadow-sm">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#262626] pb-2">{t('att_presence_by_belt')}</h3>
                 <div className="space-y-3">
                   {beltAnalytics.map(ba => {
                      if (ba.studentCount === 0) return null;
                      return (
                        <div key={ba.belt} className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "w-8 h-2.5 rounded-[3px] shadow-sm relative overflow-hidden flex items-center justify-center shrink-0 border border-black/30",
                              ba.belt === 'White' ? 'bg-white' : 
                              ba.belt === 'Yellow' ? 'bg-yellow-400' : 
                              ba.belt === 'Green' ? 'bg-emerald-600' : 
                              ba.belt === 'Blue' ? 'bg-blue-600' : 
                              ba.belt === 'Brown' ? 'bg-amber-900' : 
                              ba.belt === 'Red' ? 'bg-red-600' : 
                              ba.belt === 'Poom' ? 'bg-gradient-to-b from-red-600 to-neutral-900' : 'bg-neutral-950 border border-neutral-800'
                            )}>
                              {ba.belt === 'Poom' && (
                                <div className="absolute inset-y-0.5 left-0 right-0 h-1/2 bg-red-600" />
                              )}
                              {ba.belt === 'Dan' && (
                                <div className="absolute inset-y-0.5 left-0 right-0 h-0.5 bg-yellow-500/80" />
                              )}
                            </span>
                            <span className="font-bold text-neutral-800 dark:text-neutral-200">{ba.belt} {t('stu_belt')}</span>
                            <span className="text-[10px] text-neutral-600 dark:text-neutral-400 font-mono">({ba.studentCount})</span>
                          </div>
                          <span className="font-mono text-neutral-900 dark:text-white font-bold">{ba.attendanceRate}%</span>
                        </div>
                      );
                    })}
                 </div>
              </div>

              {/* Actionable: At-Risk Students */}
              <div className="bg-white dark:bg-[#141414] border border-rose-500/30 rounded-[8px] p-4 space-y-4 shadow-sm">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-rose-700 dark:text-rose-400 border-b border-rose-500/20 pb-2 flex items-center gap-1.5">
                   <Warning className="w-4 h-4"/>
                   {t('att_at_risk_cohort')}
                 </h3>
                 <div className="space-y-3 max-h-[250px] overflow-y-auto divide-y divide-neutral-200 dark:divide-[#262626]/40">
                   {atRiskStudents.length === 0 ? (
                     <p className="text-[10px] text-neutral-600 dark:text-neutral-400 font-mono text-center py-4">{t('att_no_at_risk_students')}</p>
                   ) : atRiskStudents.map(ar => (
                     <div key={ar.student.id} className="pt-2 flex justify-between items-start text-xs group cursor-pointer" onClick={() => setStatsStudentId(ar.student.id)}>
                       <div className="flex items-center gap-2">
                         <SafeImage 
                           src={ar.student.profilePicturePath} 
                           alt={ar.student.englishName} 
                           containerClassName="w-8 h-8 rounded-[8px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 group-hover:border-[#EF2F38] transition-colors"
                           fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-xs">{ar.student.englishName.charAt(0)}</span>}
                         />
                         <div>
                           <p className="font-bold text-neutral-900 dark:text-[#E4E4E4] group-hover:text-[#EF2F38] dark:group-hover:text-white transition-colors">{ar.student.englishName}</p>
                           <p className="text-[9px] text-neutral-600 dark:text-neutral-400 font-mono">{ar.student.id} • {formatBeltLocalized(ar.student.currentBelt, ar.student.dob, t)}</p>
                           {ar.student.emergencyContactPhone && (
                             <a href={`tel:${ar.student.emergencyContactPhone}`} onClick={(e) => e.stopPropagation()} className="text-[9px] text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1 mt-1">
                               <PhoneCall className="w-3 h-3"/> {t('stu_emergency_contact')}: {ar.student.emergencyContactPhone}
                             </a>
                           )}
                         </div>
                       </div>
                       <span className="font-mono text-rose-700 dark:text-rose-300 font-bold bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-[8px]">{ar.rate}%</span>
                     </div>
                   ))}
                 </div>
              </div>

              {/* Actionable: Excellent Attendance */}
              <div className="bg-white dark:bg-[#141414] border border-emerald-500/30 rounded-[8px] p-4 space-y-4 shadow-sm">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 border-b border-emerald-500/20 pb-2 flex items-center gap-1.5">
                   <Sparkle className="w-4 h-4 text-amber-600 dark:text-amber-400" weight="fill"/>
                   {t('att_exam_candidates')}
                 </h3>
                 <div className="space-y-3 max-h-[250px] overflow-y-auto divide-y divide-neutral-200 dark:divide-[#262626]/40">
                   {readyStudents.length === 0 ? (
                     <p className="text-[10px] text-neutral-600 dark:text-neutral-400 font-mono text-center py-4">{t('att_no_exam_candidates')}</p>
                   ) : readyStudents.map(rd => (
                     <div key={rd.student.id} className="pt-2 flex justify-between items-center text-xs group cursor-pointer" onClick={() => setStatsStudentId(rd.student.id)}>
                       <div className="flex items-center gap-2">
                         <SafeImage 
                           src={rd.student.profilePicturePath} 
                           alt={rd.student.englishName} 
                           containerClassName="w-8 h-8 rounded-[8px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 group-hover:border-emerald-500 transition-colors"
                           fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-xs">{rd.student.englishName.charAt(0)}</span>}
                         />
                         <div>
                           <p className="font-bold text-neutral-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-white transition-colors">{rd.student.englishName}</p>
                           <p className="text-[9px] text-neutral-600 dark:text-neutral-400 font-mono">{rd.student.id} • {formatBeltLocalized(rd.student.currentBelt, rd.student.dob, t)}</p>
                         </div>
                       </div>
                       <span className="font-mono text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-[8px]">{rd.rate}%</span>
                     </div>
                   ))}
                 </div>
              </div>
            </div>
          </div>

          {/* Detailed Student Progress & Belt Promotion Leaderboard */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm space-y-0">
            {/* Header & Quick KPI Badges */}
            <div className="p-4 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#0F0F0F] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {t('lms_student_progress')} — Belt Promotion Tracker
                </h3>
                <p className="text-[10px] text-neutral-600 dark:text-neutral-400 font-mono mt-0.5">
                  Track training volume, belt qualification requirements, and attendance streaks
                </p>
              </div>

              {/* Fast Stats Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-[6px] bg-neutral-200/70 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-[10px] font-mono font-bold">
                  {studentAttendanceRates.length} Active Students
                </span>
                <span className="px-2.5 py-1 rounded-[6px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  {studentAttendanceRates.filter(s => s.isReadyForPromotion).length} Ready for Exam
                </span>
                <span className="px-2.5 py-1 rounded-[6px] bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" weight="fill" />
                  {studentAttendanceRates.filter(s => s.streak >= 3).length} Streaks (3+)
                </span>
                <span className="px-2.5 py-1 rounded-[6px] bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-[10px] font-mono font-bold flex items-center gap-1">
                  <Warning className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  {studentAttendanceRates.filter(s => s.rate !== null && s.rate < 75).length} At-Risk
                </span>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="p-3 border-b border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#141414] grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search by student name or ID..."
                  value={progressSearch}
                  onChange={(e) => setProgressSearch(e.target.value)}
                  className="w-full pl-9 pr-8 h-9 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-neutral-100 rounded-[6px] text-xs focus:outline-none focus:border-[#EF2F38] placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                />
                {progressSearch && (
                  <button
                    onClick={() => setProgressSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={progressBeltFilter}
                onChange={(e) => setProgressBeltFilter(e.target.value)}
                className="w-full h-9 bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs px-3 focus:outline-none focus:border-[#EF2F38] cursor-pointer"
              >
                <option value="all">All Belt Ranks</option>
                {beltTiers.map(tier => (
                  <option key={tier} value={tier}>{tier} Belt</option>
                ))}
              </select>

              <select
                value={progressStatusFilter}
                onChange={(e) => setProgressStatusFilter(e.target.value as any)}
                className="w-full h-9 bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-[#262626] rounded-[6px] text-xs px-3 focus:outline-none focus:border-[#EF2F38] cursor-pointer"
              >
                <option value="all">All Promotion Statuses</option>
                <option value="ready">🎓 Ready for Exam</option>
                <option value="progress">⚡ In Progress</option>
                <option value="risk">⚠️ At-Risk (&lt; 75%)</option>
              </select>
            </div>

            {/* Desktop / Tablet Table View (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-neutral-50 dark:bg-[#0F0F0F] border-b border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-neutral-400 uppercase tracking-wider font-bold text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Current Belt</th>
                    <th className="px-4 py-3">Target Belt</th>
                    <th className="px-4 py-3 min-w-[200px]">Promotion Readiness</th>
                    <th className="px-4 py-3 text-center">Discipline</th>
                    <th className="px-4 py-3 text-center">Streak</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                  {filteredStudentProgress.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-neutral-500 dark:text-neutral-400 font-mono">
                        <p className="text-xs font-bold uppercase tracking-wider mb-1">No students match current filters</p>
                        <button
                          onClick={() => {
                            setProgressSearch('');
                            setProgressBeltFilter('all');
                            setProgressStatusFilter('all');
                          }}
                          className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline cursor-pointer mt-1"
                        >
                          Clear Filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredStudentProgress.map(st => (
                      <tr 
                        key={st.student.id} 
                        className="hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer group"
                        onClick={() => setStatsStudentId(st.student.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <SafeImage
                              src={st.student.profilePicturePath}
                              alt={st.student.englishName}
                              containerClassName="w-8 h-8 rounded-[6px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] overflow-hidden shrink-0 group-hover:border-[#EF2F38] transition-colors"
                              fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-xs">{st.student.englishName.charAt(0)}</span>}
                            />
                            <div>
                              <div className="font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-[#EF2F38] dark:group-hover:text-white transition-colors">
                                {st.student.englishName}
                                {st.student.khmerName && (
                                  <span className="text-[10px] font-khmer text-neutral-500 dark:text-neutral-400 font-normal ml-1.5">
                                    {st.student.khmerName}
                                  </span>
                                )}
                              </div>
                              <div className="text-[9px] text-neutral-500 dark:text-neutral-400 font-mono">
                                {st.student.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-neutral-800 dark:text-neutral-200">
                            {formatBeltLocalized(st.student.currentBelt, st.student.dob, t)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300 font-medium">
                            <ArrowRight className="w-3 h-3 text-neutral-400 shrink-0" />
                            <span>{st.nextBelt}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 min-w-[200px]">
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-mono">
                              <span className="text-neutral-600 dark:text-neutral-400">
                                {st.attendedCount} / {st.requiredSessions} sessions
                              </span>
                              <span className={cn(
                                "font-bold",
                                st.progressPercent >= 100 
                                  ? "text-emerald-700 dark:text-emerald-400" 
                                  : "text-neutral-800 dark:text-neutral-200"
                              )}>
                                {st.progressPercent}%
                              </span>
                            </div>
                            <div className="w-full bg-neutral-100 dark:bg-[#0F0F0F] rounded-full h-2 overflow-hidden border border-neutral-200 dark:border-[#262626]/40">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-300",
                                  st.progressPercent >= 100 ? "bg-emerald-500" : "bg-indigo-600 dark:bg-indigo-500"
                                )}
                                style={{ width: `${Math.min(st.progressPercent, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "font-mono font-bold px-2 py-0.5 rounded-[4px] text-[10px]",
                            st.rate === null ? "text-neutral-400" :
                            st.rate >= 85 ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20" :
                            st.rate >= 70 ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20" :
                            "bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-500/20"
                          )}>
                            {st.rate !== null ? `${st.rate}%` : 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          {st.streak > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-[4px] text-[10px]">
                              <Flame className="w-3 h-3 text-amber-600 dark:text-amber-400" weight="fill" />
                              {st.streak}
                            </span>
                          ) : (
                            <span className="text-neutral-400 dark:text-neutral-600">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {st.isReadyForPromotion ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-bold text-[9px] uppercase tracking-wider">
                              <GraduationCap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              Exam Ready
                            </span>
                          ) : st.rate !== null && st.rate < 75 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300 font-bold text-[9px] uppercase tracking-wider">
                              <Warning className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                              At Risk
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 font-bold text-[9px] uppercase tracking-wider">
                              In Progress
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setStatsStudentId(st.student.id)}
                            className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-[6px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1F1F1F] dark:hover:bg-[#2A2A2A] text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-[#333] transition-colors cursor-pointer"
                          >
                            History
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Native Mobile Card List (block md:hidden) */}
            <div className="block md:hidden divide-y divide-neutral-200 dark:divide-[#262626]">
              {filteredStudentProgress.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 dark:text-neutral-400 font-mono">
                  <p className="text-xs font-bold uppercase tracking-wider mb-1">No students match current filters</p>
                  <button
                    onClick={() => {
                      setProgressSearch('');
                      setProgressBeltFilter('all');
                      setProgressStatusFilter('all');
                    }}
                    className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline cursor-pointer mt-1"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                filteredStudentProgress.map(st => (
                  <div
                    key={st.student.id}
                    onClick={() => setStatsStudentId(st.student.id)}
                    className="p-3.5 hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer flex flex-col gap-2.5 active:bg-neutral-100 dark:active:bg-[#202020]"
                  >
                    {/* Top Row: Avatar, Student Info, Readiness Tag */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <SafeImage
                          src={st.student.profilePicturePath}
                          alt={st.student.englishName}
                          containerClassName="w-10 h-10 rounded-[8px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] overflow-hidden shrink-0"
                          fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-xs">{st.student.englishName.charAt(0)}</span>}
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-neutral-900 dark:text-white truncate">
                            {st.student.englishName}
                            {st.student.khmerName && (
                              <span className="text-[10px] font-khmer text-neutral-500 dark:text-neutral-400 font-normal ml-1">
                                {st.student.khmerName}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono flex items-center gap-1.5 mt-0.5">
                            <span>{st.student.id}</span>
                            <span>•</span>
                            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                              {formatBeltLocalized(st.student.currentBelt, st.student.dob, t)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status Tag */}
                      <div className="shrink-0">
                        {st.isReadyForPromotion ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-bold text-[9px] uppercase tracking-wider">
                            <GraduationCap className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            Exam Ready
                          </span>
                        ) : st.rate !== null && st.rate < 75 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300 font-bold text-[9px] uppercase tracking-wider">
                            <Warning className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                            At Risk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 font-bold text-[9px] uppercase tracking-wider">
                            In Progress
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Belt Progression Route */}
                    <div className="flex items-center justify-between text-[10px] bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[6px] px-2.5 py-1.5 font-medium">
                      <span className="text-neutral-700 dark:text-neutral-300 font-bold">
                        {formatBeltLocalized(st.student.currentBelt, st.student.dob, t)}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-neutral-400 shrink-0 mx-2" />
                      <span className="text-neutral-900 dark:text-white font-bold">
                        {st.nextBelt}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-neutral-600 dark:text-neutral-400">
                          {st.attendedCount} / {st.requiredSessions} sessions
                        </span>
                        <span className={cn(
                          "font-bold",
                          st.progressPercent >= 100 
                            ? "text-emerald-700 dark:text-emerald-400" 
                            : "text-neutral-800 dark:text-neutral-200"
                        )}>
                          {st.progressPercent}%
                        </span>
                      </div>
                      <div className="w-full bg-neutral-100 dark:bg-[#0F0F0F] rounded-full h-2 overflow-hidden border border-neutral-200 dark:border-[#262626]/40">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            st.progressPercent >= 100 ? "bg-emerald-500" : "bg-indigo-600 dark:bg-indigo-500"
                          )}
                          style={{ width: `${Math.min(st.progressPercent, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Bottom Metadata & History Action Button */}
                    <div className="flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-[#1F1F1F]">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-mono font-bold px-2 py-0.5 rounded-[4px] text-[10px]",
                          st.rate === null ? "text-neutral-400" :
                          st.rate >= 85 ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20" :
                          st.rate >= 70 ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20" :
                          "bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-500/20"
                        )}>
                          Rate: {st.rate !== null ? `${st.rate}%` : 'N/A'}
                        </span>
                        {st.streak > 0 && (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-[4px] text-[10px] font-mono">
                            <Flame className="w-3 h-3 text-amber-600 dark:text-amber-400" weight="fill" />
                            {st.streak} streak
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatsStudentId(st.student.id);
                        }}
                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-[6px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1F1F1F] dark:hover:bg-[#2A2A2A] text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-[#333] transition-colors cursor-pointer active:scale-95 touch-manipulation min-h-[32px] flex items-center gap-1"
                      >
                        History
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Attendance Stats Modal */}
      {statsStudentId && statsStudent && (() => {
        const recentRecords = [...studentAttendanceRecords]
          .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 15)
          .reverse();

        const getFormattedDate = (dateStr: string) => {
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return dateStr;
          const options: Intl.DateTimeFormatOptions = { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          };
          const lang = state.language === 'kh' ? 'km-KH' : state.language === 'zh' ? 'zh-CN' : 'en-US';
          return d.toLocaleDateString(lang, options);
        };

        const handleStatusChange = (r: any, newStatus: 'Present' | 'Late' | 'Absent') => {
          if (newStatus === r.status) return;
          
          const oldLabel = r.status === 'Present' ? t('att_present') : r.status === 'Late' ? t('att_late') : t('att_absent');
          const newLabel = newStatus === 'Present' ? t('att_present') : newStatus === 'Late' ? t('att_late') : t('att_absent');
          
          let title = 'Update Attendance';
          let message = `Are you sure you want to change ${statsStudent.englishName}'s status on ${r.date} from "${oldLabel}" to "${newLabel}"?`;
          
          if (state.language === 'kh') {
            title = 'ធ្វើបច្ចុប្បន្នភាពវត្តមាន';
            message = `តើអ្នកពិតជាចង់ផ្លាស់ប្តូរស្ថានភាពវត្តមានរបស់ ${statsStudent.englishName} នៅថ្ងៃ ${r.date} ពី "${oldLabel}" ទៅ "${newLabel}" មែនទេ?`;
          } else if (state.language === 'zh') {
            title = '更新考勤状态';
            message = `您确定要将 ${statsStudent.englishName} 在 ${r.date} 的考勤状态从 "${oldLabel}" 更改为 "${newLabel}" 吗？`;
          }

          showConfirm(
            message,
            async () => {
              await markAttendance(statsStudent.id, r.date, newStatus);
            },
            title,
            () => {
              // Re-render select key to reset select dropdown visuals
              setUpdateTrigger(prev => prev + 1);
            }
          );
        };

        const currentStreak = (() => {
          const sorted = [...studentAttendanceRecords].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          let streak = 0;
          for (const rec of sorted) {
            if (rec.status === 'Present' || rec.status === 'Late') {
              streak++;
            } else {
              break;
            }
          }
          return streak;
        })();

        const requiredSessions = (() => {
          const lower = (statsStudent.currentBelt || '').toLowerCase();
          if (lower.includes('white')) return 12;
          if (lower.includes('yellow')) return 16;
          if (lower.includes('green')) return 20;
          if (lower.includes('blue')) return 24;
          if (lower.includes('brown')) return 30;
          if (lower.includes('red')) return 36;
          return 40;
        })();
        const accumulatedSessions = presentCount + lateCount;
        const progressPercent = Math.min(Math.round((accumulatedSessions / requiredSessions) * 100), 100);

        return (
          <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="fixed inset-0" onClick={() => setStatsStudentId(null)} />
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex flex-col shadow-2xl overflow-hidden max-h-[90dvh] z-10">
                 <div className="p-4 border-b border-neutral-200 dark:border-[#262626] flex justify-between items-center bg-neutral-50 dark:bg-[#0F0F0F]">
               <div className="flex items-center gap-3">
                 <SafeImage 
                   src={statsStudent.profilePicturePath} 
                   alt={statsStudent.englishName} 
                   containerClassName="w-10 h-10 rounded-[8px] bg-neutral-100 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 shadow-sm"
                   fallback={<span className="font-bold text-neutral-600 dark:text-neutral-400 text-sm">{statsStudent.englishName.charAt(0)}</span>}
                 />
                 <div>
                   <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-900 dark:text-[#E4E4E4] leading-tight">{statsStudent.englishName}</h2>
                   <p className="text-[10px] text-neutral-600 dark:text-neutral-400 font-mono tracking-widest mt-0.5">{t('att_insights_title')}</p>
                 </div>
               </div>
               <button onClick={() => setStatsStudentId(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-200 dark:hover:bg-[#262626] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer">
                 <X className="w-4 h-4"/>
               </button>
             </div>
             
             <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 custom-scrollbar">
               <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                 <div className="bg-white dark:bg-[#141414] border border-emerald-500/30 p-2.5 sm:p-4 rounded-[8px] text-center shadow-sm">
                   <p className="text-xl sm:text-2xl font-mono text-emerald-700 dark:text-emerald-400 font-bold mb-0.5 sm:mb-1">{presentCount}</p>
                   <p className="text-[9px] sm:text-[10px] text-neutral-600 dark:text-neutral-400 uppercase font-bold tracking-widest">{t('att_present')}</p>
                 </div>
                 <div className="bg-white dark:bg-[#141414] border border-amber-500/30 p-2.5 sm:p-4 rounded-[8px] text-center shadow-sm">
                   <p className="text-xl sm:text-2xl font-mono text-amber-700 dark:text-amber-400 font-bold mb-0.5 sm:mb-1">{lateCount}</p>
                   <p className="text-[9px] sm:text-[10px] text-neutral-600 dark:text-neutral-400 uppercase font-bold tracking-widest">{t('att_late')}</p>
                 </div>
                 <div className="bg-white dark:bg-[#141414] border border-rose-500/30 p-2.5 sm:p-4 rounded-[8px] text-center shadow-sm">
                   <p className="text-xl sm:text-2xl font-mono text-rose-700 dark:text-rose-400 font-bold mb-0.5 sm:mb-1">{absentCount}</p>
                   <p className="text-[9px] sm:text-[10px] text-neutral-600 dark:text-neutral-400 uppercase font-bold tracking-widest">{t('att_absent')}</p>
                 </div>
               </div>

               {/* Visual Attendance Progress (Streak, Milestone, History) */}
               <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 space-y-4 shadow-sm">
                 <div className="flex items-center justify-between">
                   <div>
                     <h4 className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-bold tracking-widest">{t('att_training_progress')}</h4>
                     <p className="text-[9px] text-neutral-600 dark:text-neutral-400 font-mono mt-0.5">{t('att_active_milestones')}</p>
                   </div>
                   {currentStreak > 0 && (
                     <span className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-[8px] animate-pulse">
                       {t('att_class_streak').replace('{count}', String(currentStreak))}
                     </span>
                   )}
                 </div>

                 {/* Promotion milestone bar */}
                 <div className="space-y-1.5 pt-1">
                   <div className="flex justify-between items-center text-[10px] text-neutral-500 dark:text-[#888] font-mono">
                     <span>{t('att_belt_threshold').replace('{belt}', formatBeltLocalized(statsStudent.currentBelt, statsStudent.dob, t))}</span>
                     <span className="font-bold text-neutral-900 dark:text-white">{accumulatedSessions} / {requiredSessions} {t('att_classes_suffix')} ({progressPercent}%)</span>
                   </div>
                   <div className="w-full bg-neutral-100 dark:bg-[#0F0F0F] rounded-full h-2.5 overflow-hidden border border-neutral-200 dark:border-[#262626]/40 shadow-inner">
                     <div 
                       className={cn(
                         "h-full rounded-full transition-all duration-300", 
                         progressPercent >= 100 ? "bg-emerald-500" : "bg-indigo-500"
                       )} 
                       style={{ width: `${progressPercent}%` }} 
                     />
                   </div>
                   {progressPercent >= 100 ? (
                     <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">{t('lms_target_attendance_achieved')}</p>
                   ) : (
                     <p className="text-[9px] text-neutral-600 dark:text-neutral-400">{t('lms_req_more_sessions').replace('{count}', String(requiredSessions - accumulatedSessions))}</p>
                   )}
                 </div>

                 {/* Last 15 Sessions Grid */}
                 <div className="border-t border-neutral-200 dark:border-[#262626]/40 pt-3.5">
                   <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono uppercase tracking-wider mb-2">{t('att_checkin_history')}</p>
                   <div className="flex flex-wrap gap-1.5">
                     {Array.from({ length: 15 }).map((_, i) => {
                       const rec = recentRecords[i];
                       if (!rec) {
                         return (
                           <div 
                             key={i} 
                             className="w-6 h-6 rounded-[4px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center text-[8px] font-mono text-neutral-400 dark:text-[#444] select-none"
                             title={t('att_no_training_record')}
                           >
                             -
                           </div>
                         );
                       }
                       return (
                         <div 
                           key={i} 
                           className={cn(
                             "w-6 h-6 rounded-[4px] flex items-center justify-center text-[9px] font-black uppercase shadow-sm cursor-help transition-all duration-200 hover:scale-110",
                             rec.status === 'Present' ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-800 dark:text-emerald-300" :
                             rec.status === 'Late' ? "bg-amber-500/20 border border-amber-500/50 text-amber-800 dark:text-amber-300" :
                             "bg-rose-500/20 border border-rose-500/50 text-rose-800 dark:text-rose-300"
                           )}
                           title={`${rec.date} - ${rec.status}`}
                         >
                           {rec.status.charAt(0)}
                         </div>
                       );
                     })}
                   </div>
                 </div>
               </div>

               <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 shadow-sm">
                 <h4 className="text-[10px] text-rose-700 dark:text-rose-400 uppercase font-bold tracking-widest border-b border-neutral-200 dark:border-[#262626] pb-2 mb-4">{t('att_discipline_metrics')}</h4>
                 <div className="space-y-4">
                   <div>
                     <div className="flex justify-between items-center mb-1">
                       <p className="text-[10px] text-neutral-600 dark:text-neutral-400 uppercase font-bold">{t('att_status')}</p>
                       <p className="text-xs font-mono text-neutral-900 dark:text-white font-bold">{totalCount > 0 ? Math.round(((presentCount + lateCount) / totalCount) * 100) : 0}%</p>
                     </div>
                     <div className="h-2 w-full bg-neutral-100 dark:bg-[#0F0F0F] rounded-full overflow-hidden border border-neutral-200 dark:border-[#262626]/40">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${totalCount > 0 ? ((presentCount + lateCount) / totalCount) * 100 : 0}%` }} />
                     </div>
                   </div>
                 </div>
                 
                 {/* Smart Analyze Box */}
                 <div className="mt-6 p-4 rounded-[8px] bg-rose-500/10 border border-rose-500/20">
                   <p className="text-[10px] font-bold uppercase tracking-widest text-rose-700 dark:text-rose-400 mb-2">{t('att_smart_analysis')}</p>
                   {totalCount === 0 ? (
                     <p className="text-xs text-neutral-700 dark:text-[#E4E4E4]">{t('att_no_records_to_analyze').replace('{name}', statsStudent.englishName)}</p>
                   ) : ((presentCount + lateCount) / totalCount) > 0.85 ? (
                     <p className="text-xs text-neutral-700 dark:text-[#E4E4E4] leading-relaxed">
                       {t('att_analysis_excellent').replace('{name}', statsStudent.englishName)}
                     </p>
                   ) : ((presentCount + lateCount) / totalCount) > 0.6 ? (
                     <p className="text-xs text-neutral-700 dark:text-[#E4E4E4] leading-relaxed">
                       {t('att_analysis_consistent').replace('{belt}', formatBeltLocalized(statsStudent.currentBelt, statsStudent.dob, t))}
                     </p>
                   ) : (
                     <p className="text-xs text-neutral-700 dark:text-[#E4E4E4] leading-relaxed">
                       {t('att_analysis_risk').replace('{name}', statsStudent.englishName)}
                     </p>
                   )}
                 </div>
               </div>
               
               <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
                 <table className="w-full text-left">
                   <thead className="bg-neutral-50 dark:bg-[#0F0F0F] border-b border-neutral-200 dark:border-[#262626] text-[10px] uppercase font-bold text-neutral-600 dark:text-neutral-400 tracking-widest">
                     <tr>
                       <th className="px-4 py-3 font-medium">{t('att_date')}</th>
                       <th className="px-4 py-3 font-medium text-right">{t('att_status')}</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-neutral-200 dark:divide-[#262626] text-xs">
                     {studentAttendanceRecords.length === 0 && (
                       <tr>
                         <td colSpan={2} className="px-4 py-8 text-center text-neutral-600 dark:text-neutral-400 font-mono">{t('att_no_records_found')}</td>
                       </tr>
                     )}
                     {studentAttendanceRecords
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map(r => (
                          <tr key={r.id || `${r.studentId}-${r.date}`} className="hover:bg-neutral-50 dark:hover:bg-[#1A1A1A]/30 transition-colors">
                            <td className="px-4 py-3 text-neutral-800 dark:text-[#E4E4E4] font-medium font-sans">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
                                <span>{getFormattedDate(r.date)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <select
                                key={`${r.id || r.date}-${r.status}-${updateTrigger}`}
                                value={r.status}
                                disabled={!canMarkAttendance}
                                onChange={(e) => handleStatusChange(r, e.target.value as 'Present' | 'Late' | 'Absent')}
                                className={cn(
                                  "border text-[10px] font-black uppercase tracking-wider rounded-[6px] px-2.5 py-1 focus:outline-none transition-all cursor-pointer font-sans appearance-none text-center pr-6 relative inline-block select-none disabled:opacity-50 disabled:cursor-not-allowed shadow-sm",
                                  r.status === 'Present' ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20" :
                                  r.status === 'Late' ? "border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20" :
                                  "border-rose-500/30 text-rose-700 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20"
                                )}
                                style={{
                                  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                                  backgroundPosition: 'right 0.5rem center',
                                  backgroundSize: '1em',
                                  backgroundRepeat: 'no-repeat'
                                }}
                              >
                                <option value="Present" className="bg-white dark:bg-[#141414] text-emerald-700 dark:text-emerald-400 font-bold">{t('att_present')}</option>
                                <option value="Late" className="bg-white dark:bg-[#141414] text-amber-700 dark:text-amber-400 font-bold">{t('att_late')}</option>
                                <option value="Absent" className="bg-white dark:bg-[#141414] text-rose-700 dark:text-rose-400 font-bold">{t('att_absent')}</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                   </tbody>
                 </table>
               </div>
             </div>
          </motion.div>
            </div>
          </Portal>
        );
      })()}
      {/* Attendance Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && confirmModal.isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "relative w-full max-w-md bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-6 text-center overflow-y-auto max-h-[90dvh] z-10 shadow-2xl",
                confirmModal.actionType === 'Present' ? "border-emerald-500/30" : 
                confirmModal.actionType === 'Absent' ? "border-rose-500/30" : 
                confirmModal.actionType === 'Reset' ? "border-amber-500/30" : "border-blue-500/30"
              )}
            >
              {/* Top border glow */}
              <div 
                className={cn(
                  "absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent to-transparent",
                  confirmModal.actionType === 'Present' ? "via-emerald-500" : 
                  confirmModal.actionType === 'Absent' ? "via-rose-500" : 
                  confirmModal.actionType === 'Reset' ? "via-amber-500" : "via-blue-500"
                )}
              />

              <button
                onClick={() => setConfirmModal(null)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex justify-center mb-4 mt-2">
                <div 
                  className={cn(
                    "p-4 rounded-full border flex items-center justify-center shadow-sm",
                    confirmModal.actionType === 'Present' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" : 
                    confirmModal.actionType === 'Absent' ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400" : 
                    confirmModal.actionType === 'Reset' ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400" : "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
                  )}
                >
                  <Warning className="w-8 h-8" weight="fill" />
                </div>
              </div>

              <h3 className="text-base font-bold text-neutral-900 dark:text-white tracking-wide mb-2 px-6">
                {confirmModal.title}
              </h3>

              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mb-6 px-2">
                {confirmModal.message}
              </p>

              {/* Quick stats grid inside confirmation modal */}
              <div className="bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 mb-6 flex items-center justify-around text-xs font-mono shadow-inner">
                <div>
                  <span className="text-neutral-600 dark:text-neutral-400 block text-[9px] uppercase tracking-wider">{t('att_affected_cohort')}</span>
                  <span className="text-neutral-900 dark:text-white font-bold">{confirmModal.affectedCount} {t('att_students_suffix')}</span>
                </div>
                <div className="border-l border-neutral-200 dark:border-[#262626] h-6" />
                <div>
                  <span className="text-neutral-600 dark:text-neutral-400 block text-[9px] uppercase tracking-wider">{t('att_session_date')}</span>
                  <span className="text-neutral-900 dark:text-white font-bold">{selectedDate}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 px-5 py-2.5 min-h-[44px] rounded-[8px] font-bold text-xs tracking-wider uppercase transition-all duration-200 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-800 cursor-pointer flex items-center justify-center shadow-sm"
                >
                  {t('act_cancel')}
                </button>
                <button
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                  className={cn(
                    "flex-1 px-5 py-2.5 min-h-[44px] rounded-[8px] font-bold text-xs tracking-wider uppercase transition-all duration-200 text-white cursor-pointer shadow-lg flex items-center justify-center",
                    confirmModal.actionType === 'Present' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30" : 
                    confirmModal.actionType === 'Absent' ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/30" : 
                    confirmModal.actionType === 'Reset' ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/30" : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/30"
                  )}
                >
                  {t('act_confirm')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fast Barcode / QR Student Kiosk Terminal Modal */}
      <AnimatePresence>
        {isKioskOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg max-h-[92dvh] bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl overflow-hidden flex flex-col text-neutral-900 dark:text-white"
            >
              <div className="p-4 bg-emerald-600 text-white flex items-center justify-between shadow-md shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[6px] bg-white/20 flex items-center justify-center shrink-0">
                    <Barcode className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest leading-none">Instant Kiosk Check-In</h3>
                    <p className="text-[10px] text-white/80 font-mono mt-0.5">Scan Barcode / QR or type Student ID</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setKioskSound(!kioskSound)}
                    title={kioskSound ? "Sound chime enabled (Click to mute)" : "Sound chime muted (Click to unmute)"}
                    className="p-1.5 hover:bg-emerald-700 rounded-[6px] transition-colors cursor-pointer text-white/90"
                  >
                    {kioskSound ? <SpeakerHigh className="w-4 h-4" /> : <SpeakerSlash className="w-4 h-4 text-emerald-200" />}
                  </button>
                  <button 
                    onClick={() => setIsKioskOpen(false)}
                    className="p-1.5 hover:bg-emerald-700 rounded-[6px] transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const query = kioskBarcode.trim().toUpperCase();
                    if (!query) return;

                    const student = state.students.find(s => 
                      s.id.toUpperCase() === query || 
                      s.englishName.toUpperCase().includes(query) ||
                      (s.khmerName && s.khmerName.toUpperCase().includes(query))
                    );

                    if (!student) {
                      if (kioskSound) playBeep('error');
                      showNotification(`Student ID/Barcode "${query}" not found!`, 'error');
                      setKioskBarcode('');
                      kioskInputRef.current?.focus();
                      return;
                    }

                    try {
                      await markAttendance(student.id, selectedDate, 'Present');
                      if (kioskSound) playBeep('success');
                      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      setKioskRecentScans(prev => [{ student, time: nowTime, status: 'Present' }, ...prev.slice(0, 3)]);
                      setKioskBarcode('');
                      showNotification(`✅ Checked in ${student.englishName} (${student.id})!`, 'success');
                      kioskInputRef.current?.focus();
                    } catch (err: any) {
                      console.error(err);
                      if (kioskSound) playBeep('error');
                      showNotification(`Failed check-in: ${err.message || err}`, 'error');
                      kioskInputRef.current?.focus();
                    }
                  }}
                  className="space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-[#AAA]">
                    <span>Barcode / Student ID Scanner</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                      Ready for input
                    </span>
                  </div>
                  <div className="relative">
                    <QrCode className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <input 
                      ref={kioskInputRef}
                      type="text" 
                      autoFocus
                      placeholder="e.g. STU-001 or scan membership card..."
                      value={kioskBarcode}
                      onChange={(e) => setKioskBarcode(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] text-neutral-900 dark:text-white rounded-[8px] text-sm font-mono font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                    />
                  </div>
                  <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono">
                    💡 Tip: USB & Bluetooth hardware scanners trigger automatic Enter key submission.
                  </p>
                </form>

                {/* Recent Scanned Students Feed */}
                {kioskRecentScans.length > 0 && (
                  <div className="space-y-2.5 pt-2">
                    <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono uppercase tracking-wider font-bold">
                      Recent Check-Ins ({kioskRecentScans.length})
                    </p>
                    
                    {/* Latest primary scan card */}
                    {kioskRecentScans[0] && (
                      <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-[8px] p-4 flex items-center gap-3.5 shadow-sm animate-in zoom-in-95 duration-200">
                        <SafeImage 
                          src={kioskRecentScans[0].student.profilePicturePath} 
                          alt={kioskRecentScans[0].student.englishName} 
                          containerClassName="w-13 h-13 rounded-[8px] overflow-hidden border border-emerald-500/40 shrink-0"
                          fallback={<span className="font-bold text-emerald-700 dark:text-emerald-300 text-lg">{kioskRecentScans[0].student.englishName.charAt(0)}</span>}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" weight="fill" />
                            <h4 className="text-sm font-black text-neutral-900 dark:text-white truncate">
                              {kioskRecentScans[0].student.englishName}
                            </h4>
                          </div>
                          <p className="text-[10px] text-neutral-600 dark:text-neutral-400 font-mono mt-0.5 truncate">
                            ID: {kioskRecentScans[0].student.id} • Belt: {formatBelt(kioskRecentScans[0].student.currentBelt, kioskRecentScans[0].student.dob)}
                          </p>
                          <span className="inline-block mt-1 text-[9px] font-mono text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-[4px]">
                            ✓ Checked In at {kioskRecentScans[0].time}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Secondary previous scans */}
                    {kioskRecentScans.slice(1).map((scan, idx) => (
                      <div key={`${scan.student.id}-${idx}`} className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[6px] px-3 py-2 flex items-center justify-between text-xs text-neutral-700 dark:text-neutral-300">
                        <div className="flex items-center gap-2 truncate">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="font-bold text-neutral-900 dark:text-white truncate">{scan.student.englishName}</span>
                          <span className="text-[10px] font-mono text-neutral-500 dark:text-[#888]">({scan.student.id})</span>
                        </div>
                        <span className="text-[10px] font-mono text-neutral-500 dark:text-[#888] shrink-0">{scan.time}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 bg-neutral-50 dark:bg-[#0F0F0F] border-t border-neutral-200 dark:border-[#262626] flex justify-between items-center shrink-0">
                <span className="text-[10px] text-neutral-500 dark:text-[#888] font-mono">
                  {kioskSound ? "🔊 Sound Enabled" : "🔇 Sound Muted"}
                </span>
                <button 
                  onClick={() => setIsKioskOpen(false)}
                  className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-[#1F1F1F] dark:hover:bg-[#2A2A2A] text-neutral-800 dark:text-white rounded-[8px] text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Close Kiosk
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
