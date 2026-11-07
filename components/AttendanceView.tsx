'use client';
import dynamic from 'next/dynamic';


import { dialogMotion } from '@/lib/motion';
import { academyDate, isCalendarDate } from '@/lib/dates';
import { rosterAttendance } from '@/lib/attendance';

import Link from 'next/link';
import { MakeupAttendancePanel } from './MakeupAttendancePanel';
import { useNotificationTarget } from '@/hooks/use-notification-target';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore, Student } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';

import { X } from '@phosphor-icons/react/dist/csr/X';
import { ChartLine } from '@phosphor-icons/react/dist/csr/ChartLine';
import { CalendarCheck } from '@phosphor-icons/react/dist/csr/CalendarCheck';
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';



















import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useTranslation';
import { PageHeader, SegmentedTabs } from './ui/PageHeader';




const AttendanceAnalyticsPanel = dynamic(() => import('./attendance/AttendanceAnalyticsPanel').then(module => module.AttendanceAnalyticsPanel), { ssr: false });
const AttendanceKioskDialog = dynamic(() => import('./attendance/AttendanceKioskDialog').then(module => module.AttendanceKioskDialog), { ssr: false });

const AttendanceRosterPanel = dynamic(() => import('@/components/attendance/AttendanceRosterPanel').then(module => module.AttendanceRosterPanel), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const StudentAttendanceDialog = dynamic(() => import('@/components/attendance/StudentAttendanceDialog').then(module => module.StudentAttendanceDialog), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });

export function AttendanceView() {

  const { state, markAttendance, markAttendanceMany, commitRoster, deleteAttendanceRecords, deleteAttendanceRecord, showNotification, showConfirm, can } = useAppStore();
  const t = useT();
  const lang = state.language || 'en';

  const getStudentEnrollDate = (st: Student) => {
    const enrollments = state.classEnrollments.filter(e => e.studentId === st.id && (filterClass === 'all' || e.classId === filterClass));
    if (enrollments.length === 0) return st.registrationDate?.split('T')[0];
    const dates = enrollments.map(e => e.enrollmentDate).filter(Boolean) as string[];
    if (dates.length === 0) return st.registrationDate?.split('T')[0];
    return dates.sort()[0].split('T')[0];
  };
  const [activeTab, setActiveTab] = useState<'roster' | 'analytics'>('roster');
  const [selectedDate, setSelectedDate] = useState(() => academyDate());
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState<number | 'all'>('all');
  const [filterClass, setFilterClass] = useState<number | 'all'>('all');
  const [statsStudentId, setStatsStudentId] = useState<string | null>(null);
  const [studentDetailsTab, setStudentDetailsTab] = useState<'calendar' | 'insights'>('calendar');
  const [calendarBusy, setCalendarBusy] = useState(false);
  const calendarBusyRef = useRef(false);
  calendarBusyRef.current = calendarBusy;
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Present' | 'Late' | 'Absent' | 'Unmarked'>('all');
  const [overrideMismatch, setOverrideMismatch] = useState(false);
  useNotificationTarget(url=>{if(url.pathname!=='/attendance')return;const date=url.searchParams.get('date'),id=Number(url.searchParams.get('class'));if(date&&isCalendarDate(date))setSelectedDate(date);if(state.classSessions.some(lesson=>lesson.id===id))setFilterClass(id);},state.classSessions.length>0);

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
  const [, setSelectedStudentIds] = useState<string[]>([]);

  // Loading & Committing states
  const [isCommitting, setIsCommitting] = useState(false);
  const rosterWorking = useRef(false);
  const canDeleteAttendance = can('action:attendance_delete');
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
    if (!statsStudentId) return;
    setStudentDetailsTab('calendar');
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[aria-label="Close attendance details"]')?.focus());
    const keydown = (event: KeyboardEvent) => {
      // A confirmation or error dialog has its own keyboard owner.
      if (document.querySelector('[role="alertdialog"]')) return;
      const dialog = document.getElementById('attendance-student-title')?.closest<HTMLElement>('[role="dialog"]');
      if (event.key === 'Escape' && !calendarBusyRef.current) {event.preventDefault();setStatsStudentId(null);}
      if (event.key !== 'Tab' || !dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]')]
        .filter(element => element.tabIndex >= 0 && !element.hasAttribute('disabled') && element.getClientRects().length);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (!first) {event.preventDefault();dialog.focus();}
      else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {event.preventDefault();last.focus();}
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown', keydown);
    return () => {cancelAnimationFrame(frame);document.removeEventListener('keydown', keydown);document.body.style.overflow=previousOverflow;if(previousFocus instanceof HTMLElement && previousFocus.isConnected)previousFocus.focus();};
  }, [statsStudentId]);

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
      if (filterBranch !== 'all' && (filterClass==='all'?s.homeBranchId:state.classSessions.find(lesson=>lesson.id===filterClass)?.branchId) !== filterBranch) return false;
      if (enrolledSet && !enrolledSet.has(s.id)) return false;
      if (q && !s.englishName.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q) && !(s.khmerName && s.khmerName.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [state.students, state.classEnrollments, state.classSessions, search, filterBranch, filterClass]);

  const branchClasses = useMemo(() => {
    return state.classSessions.filter(c => filterBranch === 'all' || c.branchId === filterBranch);
  }, [state.classSessions, filterBranch]);


  const canMarkAttendance = can('action:attendance_mark');
  const canBulkAction = canMarkAttendance || canDeleteAttendance;
  const isReadOnlyAttendance = !canMarkAttendance && !canDeleteAttendance;

  // Memoized Stats calculations for active roster
  const rosterStudents = useMemo(() => {
    const enrolledSet = filterClass !== 'all'
      ? new Set(state.classEnrollments.filter(e => e.classId === filterClass).map(e => e.studentId))
      : null;

    return state.students.filter(s => {
      if (s.studentStatus !== 'Active') return false;
      if (filterBranch !== 'all' && (filterClass==='all'?s.homeBranchId:state.classSessions.find(lesson=>lesson.id===filterClass)?.branchId) !== filterBranch) return false;
      if (enrolledSet && !enrolledSet.has(s.id)) return false;
      return true;
    });
  }, [state.students, state.classEnrollments, state.classSessions, filterBranch, filterClass]);

  const totalRosterCount = rosterStudents.length;
  const selectedAttendance = useMemo(() => rosterAttendance(state.attendanceRecords, selectedDate, filterClass === 'all' ? undefined : filterClass), [state.attendanceRecords, selectedDate, filterClass]);

  const { presentRosterCount, lateRosterCount, absentRosterCount, unmarkedRosterCount } = useMemo(() => {
    let p = 0, l = 0, a = 0, u = 0;

    for (const s of rosterStudents) {
      const st = selectedAttendance.get(s.id)?.status;
      if (st === 'Present') p++;
      else if (st === 'Late') l++;
      else if (st === 'Absent') a++;
      else u++;
    }
    return { presentRosterCount: p, lateRosterCount: l, absentRosterCount: a, unmarkedRosterCount: u };
  }, [selectedAttendance, rosterStudents]);

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

  const isAttendanceLocked = selectedDate > academyDate() || (isScheduleMismatch && !overrideMismatch);

  // Filter list by selected status capsule
  const finalFilteredStudents = useMemo(() => {
    return filteredStudents.filter(s => {
      const currentStatus = selectedAttendance.get(s.id)?.status;
      if (statusFilter === 'all') return true;
      if (statusFilter === 'Unmarked') return !currentStatus;
      return currentStatus === statusFilter;
    });
  }, [filteredStudents, selectedAttendance, statusFilter]);

  // Bulk marking filtered set
  const handleRosterMark = async (...args: Parameters<typeof markAttendance>) => {
    if (rosterWorking.current || !canMarkAttendance || isAttendanceLocked) return;
    rosterWorking.current=true;setIsCommitting(true);
    try {await markAttendance(...args);}
    catch(error){showNotification(error instanceof Error?error.message:'Attendance could not be saved. Reload before retrying.','error');}
    finally{rosterWorking.current=false;setIsCommitting(false);}
  };
  const handleBulkMark = async (status: 'Present' | 'Absent') => {
    if (rosterWorking.current || !canMarkAttendance || isAttendanceLocked) return;
    rosterWorking.current = true;
    setIsCommitting(true);
    try {
      const targetStudents = finalFilteredStudents.filter(s => {
        const rec = selectedAttendance.get(s.id);
        const enrollDate = getStudentEnrollDate(s);
        const isNotYetEnrolled = enrollDate ? (selectedDate < enrollDate) : false;
        return rec?.status !== status && !isNotYetEnrolled;
      });
      if (targetStudents.length === 0) return;

      await markAttendanceMany(targetStudents.map(student => ({studentId:student.id,date:selectedDate,status,classId:filterClass==='all'?undefined:filterClass})));
      showNotification(t('att_bulk_success').replace('{count}', String(targetStudents.length)).replace('{status}', status === 'Present' ? t('att_present') : t('att_absent')), 'success');
    } catch (e: any) {
      console.error(e);
      showNotification(t('att_bulk_error').replace('{error}', e.message || String(e)), 'error');
    } finally {
      rosterWorking.current = false;
      setIsCommitting(false);
    }
  };

  // Reset attendance records for currently filtered set
  const handleResetSelection = async () => {
    if(rosterWorking.current || !canDeleteAttendance)return;
    rosterWorking.current=true;
    setIsCommitting(true);
    try {
      const targetIds = finalFilteredStudents
        .filter(s => {const record=selectedAttendance.get(s.id);return record && record.classId===(filterClass==='all'?undefined:filterClass);})
        .map(s => s.id);

      if (targetIds.length === 0) return;

      await deleteAttendanceRecords(selectedDate, targetIds, filterClass === 'all' ? undefined : filterClass);
      showNotification(t('att_clear_success').replace('{count}', String(targetIds.length)), 'success');
    } catch (e: any) {
      console.error(e);
      showNotification(t('att_clear_error').replace('{error}', e.message || String(e)), 'error');
    } finally {
      rosterWorking.current = false;
      setIsCommitting(false);
    }
  };

  const requestBulkMark = (status: 'Present' | 'Absent') => {
    if(rosterWorking.current || !canMarkAttendance || isAttendanceLocked)return;
    const targetStudents = finalFilteredStudents.filter(s => {
      const rec = selectedAttendance.get(s.id);
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
    if(rosterWorking.current || !canDeleteAttendance)return;
    const targetStudents = finalFilteredStudents.filter(s => {
      const rec = selectedAttendance.get(s.id);
      return !!rec?.status && rec.classId===(filterClass==='all'?undefined:filterClass);
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
    if (rosterWorking.current || !canMarkAttendance || isAttendanceLocked) return;
    if(filterClass==='all'){showNotification('Select a class before finalizing attendance. Daily check-ins do not establish which class a student attended.','info');return;}
    setConfirmModal({isOpen:true,actionType:'Commit',title:t('att_confirm_commit_title'),message:'Mark unmarked members of the saved session rosters as Absent for '+selectedDate+'? Existing marks and cancelled sessions are preserved.',affectedCount:0,onConfirm:()=>handleCommitRoster()});
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
    const matchesBranch = filterBranch === 'all' || (filterClass==='all'?student.homeBranchId:selectedClassObj?.branchId) === filterBranch;
    let matchesClass = true;
    if (filterClass !== 'all') {
      matchesClass = state.classEnrollments.some(ce => ce.studentId === student.id && ce.classId === filterClass);
    }
    return matchesBranch && matchesClass;
  });

  const activeStudentIds = new Set(activeStudentsForAnalytics.map(s => s.id));

  // 1. Academy/Cohort Attendance Rate & Statistics
  const analyticsRecords = useMemo(() => state.attendanceRecords.filter(r => filterClass === 'all' || r.classId === filterClass), [state.attendanceRecords, filterClass]);
  const filteredRecords = analyticsRecords.filter(r => activeStudentIds.has(r.studentId));
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
      const records = analyticsRecords.filter(r => r.studentId === st.id);
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
  }, [activeStudentsForAnalytics, analyticsRecords]);

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
      const branchStudents = activeStudentsForAnalytics.filter(s => s.homeBranchId === branch.id);
      const branchStudentIds = new Set(branchStudents.map(s => s.id));
      const records = analyticsRecords.filter(r => branchStudentIds.has(r.studentId));
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
      const enrollments = state.classEnrollments.filter(e => e.classId === cls.id && state.students.some(s => s.id === e.studentId && s.studentStatus === 'Active'));
      const enrolledIds = new Set(enrollments.map(e => e.studentId));
      const records = state.attendanceRecords.filter(r => r.classId === cls.id && enrolledIds.has(r.studentId));
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
    const records = analyticsRecords.filter(r => studentIds.has(r.studentId));
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
    if(rosterWorking.current || !canMarkAttendance || selectedDate>academyDate())return;
    rosterWorking.current=true;
    setIsCommitting(true);
    setCommitMessage(null);
    try {
      const result = await commitRoster(selectedDate, filterBranch, filterClass);
      setCommitMessage(`${t('att_save_success')} (Marked ${result.count} session records as Absent)`);
      setTimeout(() => setCommitMessage(null), 5000);
    } catch (err: any) {
      console.error(err);
      showNotification(`Failed: ${err.message || err}`, 'error');
    } finally {
      rosterWorking.current = false;
      setIsCommitting(false);
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4 pb-12 sm:space-y-5">
      <PageHeader
        icon={<CalendarCheck weight="bold" />}
        eyebrow="Daily check-in"
        title={t('att_title')}
        description={t('att_subtitle')}
        actions={<SegmentedTabs label="Attendance views" value={activeTab} onChange={setActiveTab} items={[
          { id: 'roster', label: t('att_status'), icon: <UsersThree /> },
          { id: 'analytics', label: t('lms_student_progress'), icon: <ChartLine /> },
        ]} />}
      >
        <div className="mt-1 flex flex-wrap items-center gap-x-3">
          <Link href="/operations?view=sessions" className="inline-flex min-h-11 items-center text-xs font-semibold text-brand hover:underline">Dated sessions, rescheduling and holidays</Link>
          {isReadOnlyAttendance && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Read-Only Mode
            </span>
          )}
        </div>
      </PageHeader>

      <MakeupAttendancePanel />
      {activeTab === 'roster' && <AttendanceRosterPanel t={t} selectedDate={selectedDate} setSelectedDate={setSelectedDate} setStatusFilter={setStatusFilter} isReadOnlyAttendance={isReadOnlyAttendance} setIsKioskOpen={setIsKioskOpen} requestCommitRoster={requestCommitRoster} isCommitting={isCommitting} filteredStudents={filteredStudents} isAttendanceLocked={isAttendanceLocked} search={search} setSearch={setSearch} filterBranch={filterBranch} setFilterBranch={setFilterBranch} setFilterClass={setFilterClass} state={state} filterClass={filterClass} branchClasses={branchClasses} selectedClassObj={selectedClassObj} getLocalizedDayName={getLocalizedDayName} selectedClassCoach={selectedClassCoach} isScheduleMismatch={isScheduleMismatch} selectedDateDay={selectedDateDay} overrideMismatch={overrideMismatch} setOverrideMismatch={setOverrideMismatch} statusFilter={statusFilter} totalRosterCount={totalRosterCount} presentRosterCount={presentRosterCount} lateRosterCount={lateRosterCount} absentRosterCount={absentRosterCount} unmarkedRosterCount={unmarkedRosterCount} canBulkAction={canBulkAction} requestBulkMark={requestBulkMark} finalFilteredStudents={finalFilteredStudents} lang={lang} requestResetSelection={requestResetSelection} markedPercentage={markedPercentage} commitMessage={commitMessage} selectedAttendance={selectedAttendance} getStudentEnrollDate={getStudentEnrollDate} setStatsStudentId={setStatsStudentId} canMarkAttendance={canMarkAttendance} canDeleteAttendance={canDeleteAttendance} markAttendance={handleRosterMark} />}

      {activeTab === 'analytics' && <AttendanceAnalyticsPanel t={t} academyAttendanceRate={academyAttendanceRate} studentAttendanceRates={studentAttendanceRates} totalRecordsCount={totalRecordsCount} discipline={discipline} branchAnalytics={branchAnalytics} classAnalytics={classAnalytics} beltAnalytics={beltAnalytics} atRiskStudents={atRiskStudents} setStatsStudentId={setStatsStudentId} readyStudents={readyStudents} progressSearch={progressSearch} setProgressSearch={setProgressSearch} progressBeltFilter={progressBeltFilter} setProgressBeltFilter={setProgressBeltFilter} beltTiers={beltTiers} progressStatusFilter={progressStatusFilter} setProgressStatusFilter={setProgressStatusFilter} filteredStudentProgress={filteredStudentProgress} />}

      {/* Attendance Stats Modal */}
      {statsStudentId && statsStudent && <StudentAttendanceDialog studentAttendanceRecords={studentAttendanceRecords} state={state} t={t} statsStudent={statsStudent} showConfirm={showConfirm} markAttendance={markAttendance} setUpdateTrigger={setUpdateTrigger} presentCount={presentCount} lateCount={lateCount} calendarBusy={calendarBusy} setStatsStudentId={setStatsStudentId} studentDetailsTab={studentDetailsTab} setStudentDetailsTab={setStudentDetailsTab} selectedDate={selectedDate} filterClass={filterClass} canMarkAttendance={canMarkAttendance} can={can} lang={lang} deleteAttendanceRecord={deleteAttendanceRecord} setCalendarBusy={setCalendarBusy} absentCount={absentCount} totalCount={totalCount} updateTrigger={updateTrigger} />}
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
              {...dialogMotion}
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
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center pointer-coarse:min-h-11 pointer-coarse:min-w-11"
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
                  <span className="text-neutral-900 dark:text-white font-bold">{confirmModal.actionType==='Commit'?'Saved session rosters':confirmModal.affectedCount+' '+t('att_students_suffix')}</span>
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
        {isKioskOpen && <AttendanceKioskDialog setKioskSound={setKioskSound} kioskSound={kioskSound} setIsKioskOpen={setIsKioskOpen} kioskBarcode={kioskBarcode} state={state} showNotification={showNotification} setKioskBarcode={setKioskBarcode} kioskInputRef={kioskInputRef} markAttendance={markAttendance} selectedDate={selectedDate} filterClass={filterClass} setKioskRecentScans={setKioskRecentScans} kioskRecentScans={kioskRecentScans} />}
      </AnimatePresence>
    </div>
  );
}
