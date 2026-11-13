'use client';

import type React from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { cn } from '@/lib/utils';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { sessionMark } from '@/lib/attendance-index';
import { SafeImage } from '@/components/SafeImage';
import { ArrowsCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowsCounterClockwise';
import { Users } from '@phosphor-icons/react/dist/csr/Users';
import type { AppState, ClassSession, Student } from '@/lib/store';
import type { AttendanceDraft } from '@/lib/attendance-write';
import type { TranslatorFn } from '@/hooks/useTranslation';

export interface LiveRosterPanelProps {
  absentCount: number;
  activeClass: ClassSession | undefined;
  attendanceActions: { busy: boolean; mark: (studentId: string, date: string, status: "Present" | "Absent" | "Late", classId?: number | undefined) => Promise<boolean>; markMany: (rows: AttendanceDraft[]) => Promise<boolean>; clear: (date: string, studentIds: string[], classId?: number | undefined) => Promise<boolean>; };
  canDeleteAttendance: boolean;
  canMarkAttendance: boolean;
  classStudents: Student[];
  classTurnoutPct: number;
  filteredClassStudents: Student[];
  getStudentEnrollDate: (st: Student) => string;
  handleMarkAllClassPresent: () => Promise<void>;
  handleUnmarkStudent: (studentId: string) => Promise<void>;
  lateCount: number;
  presentCount: number;
  rosterSearch: string;
  rosterStatusFilter: "Present" | "Absent" | "Late" | "all" | "Unmarked";
  selectedClassId: number | null;
  setRosterSearch: React.Dispatch<React.SetStateAction<string>>;
  setRosterStatusFilter: React.Dispatch<React.SetStateAction<"Present" | "Absent" | "Late" | "all" | "Unmarked">>;
  state: AppState;
  t: TranslatorFn;
  todayDate: string;
  translateBeltFormatted: (beltName: string, dob?: string | undefined) => string;
  unmarkedCount: number;
}

export function LiveRosterPanel({ absentCount, activeClass, attendanceActions, canDeleteAttendance, canMarkAttendance, classStudents, classTurnoutPct, filteredClassStudents, getStudentEnrollDate, handleMarkAllClassPresent, handleUnmarkStudent, lateCount, presentCount, rosterSearch, rosterStatusFilter, selectedClassId, setRosterSearch, setRosterStatusFilter, state, t, todayDate, translateBeltFormatted, unmarkedCount }: LiveRosterPanelProps) {
  return (
    <div className="lg:col-span-8 bg-white dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 space-y-3 shadow-sm flex flex-col justify-between">
      {/* Top Class Info Bar & Stat Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-neutral-200 dark:border-[#262626] gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
              {activeClass ? activeClass.name : 'No Class Selected'}
            </h3>
            {activeClass && (
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-[#1E1E1E] text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-[#333]">
                {activeClass.startTime} - {activeClass.endTime}
              </span>
            )}
          </div>
          <p className="text-[9px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
            {classStudents.length} total enrolled active students
          </p>
        </div>

        {/* Attendance Stats Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20">
            Present: {presentCount}
          </span>
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            Late: {lateCount}
          </span>
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
            Absent: {absentCount}
          </span>
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-[#1F1F1F] text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-[#333]">
            Unmarked: {unmarkedCount}
          </span>
          <span className="text-[9px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand/10 text-brand-ink border border-brand/20">
            Turnout: {classTurnoutPct}%
          </span>
        </div>
      </div>

      {activeClass && classStudents.length > activeClass.capacity && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">Roster review required: {classStudents.length} active students are enrolled; this class has a capacity of {activeClass.capacity}.</p>}
      {/* Filter Bar: Search, Status Filter Pills, and Bulk "Mark All Present" Action */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-neutral-50 dark:bg-[#141414] p-2 rounded-[8px] border border-neutral-200 dark:border-[#262626]">
        {/* Search bar */}
        <div className="relative flex-1 sm:max-w-xs">
          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
            <MagnifyingGlass className="w-3.5 h-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search student or belt..."
            value={rosterSearch}
            onChange={(e) => setRosterSearch(e.target.value)}
            className="w-full bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] text-neutral-800 dark:text-neutral-200 rounded-[6px] sm:rounded-[8px] pl-8 pr-7 h-8 sm:h-8.5 text-[11px] sm:text-xs font-medium focus:outline-none focus:border-brand/50 placeholder-neutral-400 dark:placeholder-neutral-500"
          />
          {rosterSearch && (
            <button
              type="button"
              onClick={() => setRosterSearch('')}
              className="absolute inset-y-0 right-0 pr-2 flex items-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          {(['all', 'Unmarked', 'Present', 'Late', 'Absent'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              aria-pressed={rosterStatusFilter === tab}
              onClick={() => setRosterStatusFilter(tab)}
              className={cn(
                "min-h-8 pointer-coarse:min-h-9 px-2 py-1 rounded-[6px] text-[9px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer",
                rosterStatusFilter === tab
                  ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm"
                  : "bg-white dark:bg-[#1A1A1A] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-neutral-200 dark:border-[#2D2D2D]"
              )}
            >
              {tab === 'all' ? 'All' : tab}
              {tab === 'all' ? ` (${classStudents.length})` :
               tab === 'Unmarked' ? ` (${unmarkedCount})` :
               tab === 'Present' ? ` (${presentCount})` :
               tab === 'Late' ? ` (${lateCount})` :
               ` (${absentCount})`}
            </button>
          ))}
        </div>

        {/* Mark All Present Batch Action */}
        {canMarkAttendance && <button
          onClick={handleMarkAllClassPresent}
          disabled={attendanceActions.busy || (classStudents.length === 0)}
          className="w-full sm:w-auto px-2.5 h-8 sm:h-auto py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-[6px] text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 shadow-sm shrink-0 cursor-pointer active:scale-95 touch-manipulation"
          title="Mark all eligible enrolled students as Present"
        >
          <CheckCircle className="w-3 h-3" />
          <span>Mark All Present</span>
        </button>}
      </div>

      {/* Student Roster List */}
      <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
        {filteredClassStudents.map(student => {
          const att = sessionMark(state.attendanceRecords, student.id, todayDate, selectedClassId);
          const currentStatus = att?.status || 'Unmarked';
          const enrollDate = getStudentEnrollDate(student)?.split('T')[0];
          const isNotYetEnrolled = enrollDate ? (todayDate < enrollDate) : false;

          return (
            <div
              key={student.id}
              className="bg-neutral-50/70 dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-neutral-300 dark:hover:border-[#383838] transition-all shadow-sm"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <SafeImage
                  src={student.profilePicturePath}
                  alt={student.englishName}
                  containerClassName="w-8 h-8 rounded-[6px] bg-neutral-100 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] flex items-center justify-center overflow-hidden shrink-0 shadow-sm"
                  fallback={<span className="font-bold text-neutral-500 dark:text-neutral-400 text-xs">{student.englishName.charAt(0)}</span>}
                />
                <div className="min-w-0 flex-1">
                  <h4 className="text-[11px] font-bold leading-none flex items-center gap-1.5 truncate text-neutral-900 dark:text-neutral-100">
                    <span className="truncate">{student.englishName}</span>
                    {student.khmerName && (
                      <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-normal">
                        ({student.khmerName})
                      </span>
                    )}
                    {isNotYetEnrolled && (
                      <span className="px-1 py-0.2 rounded bg-red-950/40 border border-red-500/30 text-red-400 font-bold uppercase tracking-widest text-[9px] whitespace-nowrap shrink-0">
                        {t('panel_not_enrolled_yet')}
                      </span>
                    )}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 text-[9px] text-neutral-500 dark:text-neutral-400 font-mono">
                    <span className="uppercase tracking-wider font-semibold text-neutral-700 dark:text-neutral-300">
                      {translateBeltFormatted(student.currentBelt, student.dob)}
                    </span>
                    <span>•</span>
                    <span>{student.id}</span>
                    <span>•</span>
                    <span className={cn(
                      "font-bold uppercase",
                      currentStatus === 'Present' ? "text-green-600 dark:text-green-400" :
                      currentStatus === 'Late' ? "text-amber-600 dark:text-amber-400" :
                      currentStatus === 'Absent' ? "text-red-500 dark:text-red-400" :
                      "text-neutral-400 dark:text-neutral-500"
                    )}>
                      {currentStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Present, Late, Absent, Unmark */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-start pt-1.5 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-[#202020] shrink-0">
                {canMarkAttendance && <><button
                  disabled={attendanceActions.busy || (isNotYetEnrolled)}
                  onClick={() => attendanceActions.mark(student.id, todayDate, 'Present', selectedClassId ?? undefined)}
                  className={cn(
                    "flex-1 sm:flex-none px-2.5 py-1 min-h-[32px] sm:min-h-[28px] text-[9.5px] sm:text-[9px] font-bold uppercase tracking-wider rounded-[6px] border transition-all cursor-pointer flex items-center justify-center active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                    isNotYetEnrolled
                      ? "opacity-25 cursor-not-allowed border-transparent text-neutral-400 bg-neutral-200 dark:bg-[#1A1A1A]"
                      : currentStatus === 'Present'
                        ? "bg-green-600 text-white border-green-600 font-black shadow-sm"
                        : "bg-white dark:bg-[#1A1A1A] border-neutral-200 dark:border-[#2D2D2D] text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/20"
                  )}
                >
                  Present
                </button>
                <button
                  disabled={attendanceActions.busy || (isNotYetEnrolled)}
                  onClick={() => attendanceActions.mark(student.id, todayDate, 'Late', selectedClassId ?? undefined)}
                  className={cn(
                    "flex-1 sm:flex-none px-2.5 py-1 min-h-[32px] sm:min-h-[28px] text-[9.5px] sm:text-[9px] font-bold uppercase tracking-wider rounded-[6px] border transition-all cursor-pointer flex items-center justify-center active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                    isNotYetEnrolled
                      ? "opacity-25 cursor-not-allowed border-transparent text-neutral-400 bg-neutral-200 dark:bg-[#1A1A1A]"
                      : currentStatus === 'Late'
                        ? "bg-amber-500 text-amber-950 border-amber-500 font-black shadow-sm"
                        : "bg-white dark:bg-[#1A1A1A] border-neutral-200 dark:border-[#2D2D2D] text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                  )}
                >
                  Late
                </button>
                <button
                  disabled={attendanceActions.busy || (isNotYetEnrolled)}
                  onClick={() => attendanceActions.mark(student.id, todayDate, 'Absent', selectedClassId ?? undefined)}
                  className={cn(
                    "flex-1 sm:flex-none px-2.5 py-1 min-h-[32px] sm:min-h-[28px] text-[9.5px] sm:text-[9px] font-bold uppercase tracking-wider rounded-[6px] border transition-all cursor-pointer flex items-center justify-center active:scale-95 touch-manipulation pointer-coarse:min-h-11",
                    isNotYetEnrolled
                      ? "opacity-25 cursor-not-allowed border-transparent text-neutral-400 bg-neutral-200 dark:bg-[#1A1A1A]"
                      : currentStatus === 'Absent'
                        ? "bg-red-600 text-white border-red-600 font-black shadow-sm"
                        : "bg-white dark:bg-[#1A1A1A] border-neutral-200 dark:border-[#2D2D2D] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                  )}
                >
                  Absent
                </button></>}
                {canDeleteAttendance && currentStatus !== 'Unmarked' && (
                  <button
                    onClick={() => handleUnmarkStudent(student.id)}
                    className="px-2 py-1 min-h-[32px] sm:min-h-[28px] text-[9px] font-bold uppercase tracking-wider rounded-[6px] border border-neutral-200 dark:border-[#2D2D2D] bg-white dark:bg-[#1A1A1A] text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all cursor-pointer flex items-center justify-center active:scale-95 touch-manipulation shrink-0 pointer-coarse:min-h-11"
                    title="Reset back to Unmarked" disabled={attendanceActions.busy}
                  >
                    <ArrowsCounterClockwise className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredClassStudents.length === 0 && (
          <div className="py-14 text-center border border-dashed border-neutral-200 dark:border-[#262626] rounded-[8px] bg-neutral-50/50 dark:bg-transparent">
            <Users className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
              {classStudents.length === 0
                ? (selectedClassId ? 'No students currently enrolled in this class session.' : 'Please select an active session.')
                : 'No students match the current search or status filter.'}
            </p>
            {rosterSearch && (
              <button
                onClick={() => { setRosterSearch(''); setRosterStatusFilter('all'); }}
                className="mt-2 text-[10px] text-brand-ink hover:underline font-mono uppercase tracking-wider cursor-pointer"
              >
                Clear search &amp; filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
