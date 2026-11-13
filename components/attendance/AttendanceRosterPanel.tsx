'use client';
import { AttendanceDatePicker as DatePicker } from '@/components/attendance/AttendanceDatePicker';
import React from 'react';
import { useAppStore, Student } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { CheckSquare } from '@phosphor-icons/react/dist/csr/CheckSquare';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { ArrowsCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowsCounterClockwise';
import { Barcode } from '@phosphor-icons/react/dist/csr/Barcode';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { XCircle } from '@phosphor-icons/react/dist/csr/XCircle';
import { cn, formatBelt } from '@/lib/utils';
import { useT } from '@/hooks/useTranslation';
import { SafeImage } from '@/components/SafeImage';



interface AttendanceRosterPanelProps {
  t: ReturnType<typeof useT>;
  selectedDate: string;
  setSelectedDate: React.Dispatch<React.SetStateAction<string>>;
  setStatusFilter: React.Dispatch<React.SetStateAction<"all" | "Present" | "Late" | "Absent" | "Unmarked">>;
  isReadOnlyAttendance: boolean;
  setIsKioskOpen: React.Dispatch<React.SetStateAction<boolean>>;
  requestCommitRoster: () => void;
  isCommitting: boolean;
  filteredStudents: Student[];
  isAttendanceLocked: boolean;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  filterBranch: number | "all";
  setFilterBranch: React.Dispatch<React.SetStateAction<number | "all">>;
  setFilterClass: React.Dispatch<React.SetStateAction<number | "all">>;
  state: ReturnType<typeof useAppStore>['state'];
  filterClass: number | "all";
  branchClasses: import("@/lib/store").ClassSession[];
  selectedClassObj: import("@/lib/store").ClassSession | null | undefined;
  getLocalizedDayName: (dayName: string) => string;
  selectedClassCoach: import("@/lib/store").User | null | undefined;
  isScheduleMismatch: boolean;
  selectedDateDay: string;
  overrideMismatch: boolean;
  setOverrideMismatch: React.Dispatch<React.SetStateAction<boolean>>;
  statusFilter: "all" | "Present" | "Late" | "Absent" | "Unmarked";
  totalRosterCount: number;
  presentRosterCount: number;
  lateRosterCount: number;
  absentRosterCount: number;
  unmarkedRosterCount: number;
  canBulkAction: boolean;
  requestBulkMark: (status: "Present" | "Absent") => void;
  finalFilteredStudents: Student[];
  lang: "en" | "kh" | "zh";
  requestResetSelection: () => void;
  markedPercentage: number;
  commitMessage: string | null;
  selectedAttendance: Map<string, import("@/lib/store").Attendance>;
  getStudentEnrollDate: (st: Student) => string;
  setStatsStudentId: React.Dispatch<React.SetStateAction<string | null>>;
  canMarkAttendance: boolean;
  canDeleteAttendance: boolean;
  markAttendance: (studentId: string, date: string, status: "Present" | "Absent" | "Late", classId?: number) => Promise<void>;
}

export function AttendanceRosterPanel({ t, selectedDate, setSelectedDate, setStatusFilter, setIsKioskOpen, requestCommitRoster, isCommitting, isAttendanceLocked, search, setSearch, filterBranch, setFilterBranch, setFilterClass, state, filterClass, branchClasses, selectedClassObj, getLocalizedDayName, selectedClassCoach, isScheduleMismatch, selectedDateDay, overrideMismatch, setOverrideMismatch, statusFilter, totalRosterCount, presentRosterCount, lateRosterCount, absentRosterCount, unmarkedRosterCount, canBulkAction, requestBulkMark, finalFilteredStudents, lang, requestResetSelection, markedPercentage, commitMessage, selectedAttendance, getStudentEnrollDate, setStatsStudentId, canMarkAttendance, canDeleteAttendance, markAttendance }: AttendanceRosterPanelProps) {
  return <>{(
        <>
          {/* Daily Roster View */}
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 flex flex-col gap-4 shadow-sm">
            <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4">
              <div>
                <h2 className="font-bold uppercase tracking-widest text-xs text-neutral-900 dark:text-[#E4E4E4]">{t('att_title')}</h2>
                <p className="text-[10px] text-neutral-500 dark:text-[#888] font-mono mt-0.5">{t('att_subtitle')}</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full xl:w-auto items-stretch sm:items-center">
                <DatePicker value={selectedDate} onChange={(date) => {
                  setSelectedDate(date);
                  setStatusFilter('all');
                }} />
                <button
                  onClick={() => canMarkAttendance && setIsKioskOpen(true)}
                  disabled={!canMarkAttendance}
                  className={cn(
                    "px-4 py-2 min-h-[40px] rounded-[8px] text-xs font-bold uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto shrink-0 font-mono active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                    !canMarkAttendance
                      ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border border-neutral-300 dark:border-[#262626] cursor-not-allowed opacity-50 shadow-none"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                  )}
                  title={!canMarkAttendance ? "Attendance marking permission is required" : "Launch Instant Barcode / QR Student Kiosk Check-in"}
                >
                  <Barcode className="w-4 h-4" /> KIOSK MODE
                </button>
                <button
                  onClick={requestCommitRoster}
                  title="Choose a class to finalize its saved session roster." disabled={isCommitting || filterClass==='all' || isAttendanceLocked || !canMarkAttendance}
                  className="px-5 sm:px-6 py-2 min-h-[40px] bg-brand hover:bg-brand-strong disabled:opacity-50 text-white rounded-[8px] text-xs font-bold uppercase tracking-widest transition-all shadow-md shadow-brand/20 flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto shrink-0 active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                >
                  {isCommitting ? t('act_loading') : t('att_commit_roster')}
                </button>
              </div>
            </div>

            {filterClass==='all' && <p className="rounded-lg border p-3 text-xs text-neutral-600 dark:text-neutral-300">This view summarizes daily check-ins and class status. Clearing here removes daily marks only. Select a class to edit session attendance, finalize absences and review makeup eligibility.</p>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                 <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 dark:text-neutral-400"/>
                 <input
                   type="text"
                   placeholder={t('fin_search_student')}
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   className="w-full pl-9 pr-8 h-10 bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] text-xs focus:outline-none focus:border-brand transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
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
              <select aria-label="Attendance branch" value={filterBranch} onChange={(e) => {
                  setFilterBranch(e.target.value === 'all' ? 'all' : Number(e.target.value));
                  setFilterClass('all');
                  setStatusFilter('all');
                }}
                className="w-full h-10 bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs px-3 focus:outline-none focus:border-brand cursor-pointer"
              >
                <option value="all">{t('att_all_branches')}</option>
                {state.branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <select aria-label="Attendance class" value={filterClass} onChange={(e) => {
                  setFilterClass(e.target.value === 'all' ? 'all' : Number(e.target.value));
                  setStatusFilter('all');
                }}
                className="w-full h-10 bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-900 dark:text-[#E4E4E4] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-xs px-3 focus:outline-none focus:border-brand cursor-pointer"
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
                    <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-brand-ink text-[9px] font-black uppercase tracking-wider rounded">
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
                    className="rounded border-neutral-300 dark:border-[#262626] bg-white dark:bg-[#0F0F0F] text-brand-ink focus:ring-0 focus:ring-offset-0 cursor-pointer"
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
                      "px-3 py-1.5 min-h-[34px] rounded-[8px] border text-[10px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 shadow-sm cursor-pointer shrink-0 active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                      statusFilter === 'all'
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white font-black shadow"
                        : "bg-white dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white"
                    )}
                  >
                    <span>{t('belt_all')}</span>
                    {/* On the selected (black) chip, light mode forces its contents to white text,
                        so the count sits on a translucent white pill instead of a light grey one. */}
                    <span className={cn("px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold",
                      statusFilter === 'all'
                        ? "bg-white/20 text-white dark:bg-neutral-900/10 dark:text-neutral-900"
                        : "bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300")}>
                      {totalRosterCount}
                    </span>
                  </button>
                  <button
                    onClick={() => setStatusFilter('Present')}
                    className={cn(
                      "px-3 py-1.5 min-h-[34px] rounded-[8px] border text-[10px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 shadow-sm cursor-pointer shrink-0 active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                      statusFilter === 'Present'
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-800 dark:text-emerald-400 font-black shadow ring-1 ring-emerald-500/30"
                        : "bg-white dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-[#888] hover:text-emerald-600 dark:hover:text-emerald-400"
                    )}
                  >
                    <span>{t('att_present')}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                      {presentRosterCount}
                    </span>
                  </button>
                  <button
                    onClick={() => setStatusFilter('Late')}
                    className={cn(
                      "px-3 py-1.5 min-h-[34px] rounded-[8px] border text-[10px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 shadow-sm cursor-pointer shrink-0 active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                      statusFilter === 'Late'
                        ? "bg-amber-500/20 border-amber-500 text-amber-800 dark:text-amber-400 font-black shadow ring-1 ring-amber-500/30"
                        : "bg-white dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-[#888] hover:text-amber-600 dark:hover:text-amber-400"
                    )}
                  >
                    <span>{t('att_late')}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono font-bold">
                      {lateRosterCount}
                    </span>
                  </button>
                  <button
                    onClick={() => setStatusFilter('Absent')}
                    className={cn(
                      "px-3 py-1.5 min-h-[34px] rounded-[8px] border text-[10px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 shadow-sm cursor-pointer shrink-0 active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                      statusFilter === 'Absent'
                        ? "bg-rose-500/20 border-rose-500 text-rose-800 dark:text-rose-400 font-black shadow ring-1 ring-rose-500/30"
                        : "bg-white dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-[#888] hover:text-rose-600 dark:hover:text-rose-400"
                    )}
                  >
                    <span>{t('att_absent')}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500/10 text-rose-700 dark:text-rose-300 font-mono font-bold">
                      {absentRosterCount}
                    </span>
                  </button>
                  <button
                    onClick={() => setStatusFilter('Unmarked')}
                    className={cn(
                      "px-3 py-1.5 min-h-[34px] rounded-[8px] border text-[10px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 shadow-sm cursor-pointer shrink-0 active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                      statusFilter === 'Unmarked'
                        ? "bg-blue-500/20 border-blue-500 text-blue-800 dark:text-blue-400 font-black shadow ring-1 ring-blue-500/30"
                        : "bg-white dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626] text-neutral-600 dark:text-[#888] hover:text-blue-600 dark:hover:text-blue-400"
                    )}
                  >
                    <span>{t('dash_unmarked')}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-blue-500/10 text-blue-700 dark:text-blue-300 font-mono font-bold">
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
                      disabled={!canMarkAttendance || isCommitting || finalFilteredStudents.length===0 || isAttendanceLocked}
                      className="px-2.5 py-1.5 min-h-[34px] bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 rounded-[6px] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{lang === 'kh' ? 'វត្តមានទាំងអស់' : lang === 'zh' ? '全标记已到' : 'Mark All Present'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => requestBulkMark('Absent')}
                      disabled={!canMarkAttendance || isCommitting || finalFilteredStudents.length===0 || isAttendanceLocked}
                      className="px-2.5 py-1.5 min-h-[34px] bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-700 dark:text-rose-400 rounded-[6px] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm active:scale-95 touch-manipulation pointer-coarse:min-h-11"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      <span>{lang === 'kh' ? 'អវត្តមានទាំងអស់' : lang === 'zh' ? '全标记未到' : 'Mark All Absent'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={requestResetSelection}
                      disabled={!canDeleteAttendance || isCommitting || finalFilteredStudents.length===0}
                      className="px-2.5 py-1.5 min-h-[34px] bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-[#202020] border border-neutral-300 dark:border-[#262626] text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white rounded-[6px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95 touch-manipulation pointer-coarse:min-h-11"
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
                      markedPercentage === 100 ? "bg-emerald-500" : "bg-brand"
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
                const record = selectedAttendance.get(student.id);
                const currentStatus = record?.status;

                const enrollDate = getStudentEnrollDate(student);
                const isNotYetEnrolled = enrollDate ? (selectedDate < enrollDate) : false;

                return (
                  <div
                    key={student.id}
                    className={cn(
                      "bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 flex flex-col md:flex-row gap-3 md:gap-4 justify-between items-stretch md:items-center hover:border-neutral-300 dark:hover:border-[#444] transition-colors group shadow-sm",
                      currentStatus === 'Present' ? "border-l-4 border-l-emerald-500" :
                      currentStatus === 'Late' ? "border-l-4 border-l-amber-500" :
                      currentStatus === 'Absent' ? "border-l-4 border-l-rose-500" :
                      "border-l-4 border-l-neutral-300 dark:border-l-neutral-700"
                    )}
                  >
                    <div
                      className="flex items-center gap-3.5 cursor-pointer flex-1 min-w-0"
                      onClick={() => setStatsStudentId(student.id)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Attendance details for ${student.englishName}`}
                      onKeyDown={event => {if (event.key==='Enter'||event.key===' ') {event.preventDefault();setStatsStudentId(student.id);}}}
                      title="Click to view student attendance history"
                    >
                      <div className="relative shrink-0">
                        <SafeImage
                          src={student.profilePicturePath}
                          alt={student.englishName}
                          containerClassName="w-11 h-11 rounded-[8px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 group-hover:border-brand transition-colors"
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
                        <p className="font-bold text-xs mb-0.5 text-neutral-900 dark:text-[#E4E4E4] group-hover:text-brand-ink dark:group-hover:text-white transition-colors truncate">
                          {student.englishName} <span className="text-[10px] font-khmer text-neutral-500 dark:text-[#888] ml-1 font-normal">{student.khmerName}</span>
                          {isNotYetEnrolled && (
                            <span className="ml-2 px-2 py-0.5 rounded-[8px] bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 font-bold uppercase tracking-widest text-[9px] whitespace-nowrap">
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
                      disabled={isCommitting || isNotYetEnrolled || isAttendanceLocked || !canMarkAttendance}
                      onClick={() => markAttendance(student.id, selectedDate, 'Present', filterClass === 'all' ? undefined : filterClass)}
                      className={cn(
                        "flex-1 md:flex-none px-3 sm:px-5 py-2 min-h-11 pointer-fine:min-h-[38px] rounded-[6px] text-[11px] sm:text-[10px] font-bold uppercase transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation select-none",
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
                      disabled={isCommitting || isNotYetEnrolled || isAttendanceLocked || !canMarkAttendance}
                      onClick={() => markAttendance(student.id, selectedDate, 'Late', filterClass === 'all' ? undefined : filterClass)}
                      className={cn(
                        "flex-1 md:flex-none px-3 sm:px-5 py-2 min-h-11 pointer-fine:min-h-[38px] rounded-[6px] text-[11px] sm:text-[10px] font-bold uppercase transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation select-none",
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
                      disabled={isCommitting || isNotYetEnrolled || isAttendanceLocked || !canMarkAttendance}
                      onClick={() => markAttendance(student.id, selectedDate, 'Absent', filterClass === 'all' ? undefined : filterClass)}
                      className={cn(
                        "flex-1 md:flex-none px-3 sm:px-5 py-2 min-h-11 pointer-fine:min-h-[38px] rounded-[6px] text-[11px] sm:text-[10px] font-bold uppercase transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation select-none",
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
      )}</>;
}
