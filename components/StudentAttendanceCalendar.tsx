'use client';

import { useMemo, useRef, useState } from 'react';
import type { Attendance, ClassEnrollment, ClassSession, Student } from '@/lib/store';
import { attendanceMarkBlock, attendanceMonthDays, indexAttendanceCalendar, shiftAttendanceDate, type AttendanceScope } from '@/lib/attendance-calendar';
import { academyDate, isCalendarDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/useTranslation';
import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { MakeupAttendancePanel } from './MakeupAttendancePanel';

type Status = Attendance['status'];
const statuses: Status[] = ['Present', 'Late', 'Absent'];
const tones = {
  Present: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
  Late: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
  Absent: 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300',
};

export function StudentAttendanceCalendar({ student, records, classes, enrollments, initialDate, initialClass, canMark, canDelete, dataReady, language, onMark, onDelete, onBusyChange }: {
  student: Student; records: Attendance[]; classes: ClassSession[]; enrollments: ClassEnrollment[];
  initialDate: string; initialClass: number | 'all'; canMark: boolean; canDelete: boolean; dataReady: boolean; language: string;
  onMark: (studentId: string, date: string, status: Status, classId?: number) => Promise<void>;
  onDelete: (id: number, studentId: string) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const t = useT();
  const today = academyDate();
  const [selectedDate, setSelectedDate] = useState(() => isCalendarDate(initialDate) && initialDate >= '1900-01-01' && initialDate <= '2100-12-31' ? initialDate : today);
  const [scope, setScope] = useState<AttendanceScope>(initialClass);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [clearId, setClearId] = useState<number | null>(null);
  const [makeup, setMakeup] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const locale = language === 'kh' ? 'km-KH' : language === 'zh' ? 'zh-CN' : 'en-US';
  const month = selectedDate.slice(0, 7);
  const days = useMemo(() => attendanceMonthDays(month), [month]);
  const byDate = useMemo(() => indexAttendanceCalendar(records, student.id, scope), [records, student.id, scope]);
  const classIds = useMemo(() => [...new Set([
    ...enrollments.filter(item => item.studentId === student.id).map(item => item.classId),
    ...records.filter(item => item.studentId === student.id && item.classId != null).map(item => item.classId!),
    ...(typeof initialClass === 'number' ? [initialClass] : []),
  ])].sort((a, b) => a - b), [enrollments, records, student.id, initialClass]);
  const classNames = useMemo(() => new Map(classes.map(item => [item.id, item.name])), [classes]);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' }), [locale]);
  const monthLabel = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00Z`));
  const weekdayLabels = useMemo(() => Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'narrow' }).format(new Date(Date.UTC(2024, 0, i + 1)))), [locale]);
  const statusLabel = (status: Status) => t(status === 'Present' ? 'att_present' : status === 'Late' ? 'att_late' : 'att_absent');
  const scopeLabel = (classId?: number) => classId == null ? t('att_calendar_daily') : classNames.get(classId) || `Class #${classId}`;
  const selectedRecords = byDate.get(selectedDate) || [];
  const targets: { classId?: number; record?: Attendance }[] = scope === 'all'
    ? selectedRecords.map(record => ({ classId: record.classId, record }))
    : [{ classId: scope === 'daily' ? undefined : scope, record: selectedRecords[0] }];

  const resetMessages = () => { setClearId(null); setMakeup(false); setError(''); setFeedback(''); };
  const selectDate = (date: string) => {
    if (busy || !isCalendarDate(date) || date < '1900-01-01' || date > '2100-12-31') return;
    setSelectedDate(date); resetMessages();
  };
  const navigateMonth = (amount: number) => selectDate(shiftAttendanceDate(selectedDate, amount));

  const save = async (target: { classId?: number; record?: Attendance }, status: Status | 'clear') => {
    if (running.current || !dataReady || (status === 'clear' ? !canDelete || !target.record : !canMark)) return;
    running.current = true; setBusy(true); onBusyChange(true); setError(''); setFeedback('');
    try {
      if (status === 'clear') {
        await onDelete(target.record!.id, student.id);
        setFeedback(t('att_calendar_cleared'));
      } else {
        await onMark(student.id, selectedDate, status, target.classId);
        setFeedback(`${t('att_calendar_saved')} ${statusLabel(status)} · ${scopeLabel(target.classId)}`);
      }
      setClearId(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : t('att_calendar_failed'));
    } finally { running.current = false; setBusy(false); onBusyChange(false); }
  };

  return <section aria-label={t('att_calendar')} className="rounded-lg border border-neutral-200 bg-white p-2 dark:border-neutral-700 dark:bg-[#141414] sm:p-3">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-xs font-bold text-neutral-900 dark:text-white">{t('att_calendar')}</h3>
      <button type="button" disabled={busy} onClick={() => selectDate(today)} className="min-h-[44px] rounded-md px-3 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800">{t('att_calendar_today')}</button>
    </div>
    <div className="mb-3 grid grid-cols-2 gap-2">
      <div>
        <label htmlFor="student-attendance-scope" className="mb-1 block min-h-[28px] text-[11px] font-medium text-neutral-500">{t('att_calendar_scope')}</label>
        <select id="student-attendance-scope" value={scope} disabled={busy} onChange={event => { setScope(event.target.value === 'all' || event.target.value === 'daily' ? event.target.value : Number(event.target.value)); resetMessages(); }} className="min-h-[44px] w-full rounded-md border border-neutral-200 bg-white px-2 text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white">
          <option value="all">{t('att_calendar_all')}</option><option value="daily">{t('att_calendar_daily')}</option>
          {classIds.map(id => <option key={id} value={id}>{scopeLabel(id)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="student-attendance-date" className="mb-1 block min-h-[28px] text-[11px] font-medium text-neutral-500">{t('att_calendar_date')}</label>
        <input id="student-attendance-date" type="date" min="1900-01-01" max="2100-12-31" value={selectedDate} disabled={busy} onChange={event => selectDate(event.target.value)} className="min-h-[44px] w-full min-w-0 rounded-md border border-neutral-200 bg-white px-2 text-xs [color-scheme:light] dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:[color-scheme:dark]" />
      </div>
    </div>
    <div className="mb-2 flex items-center justify-between">
      <button type="button" aria-label={t('att_calendar_prev')} disabled={busy || month === '1900-01'} onClick={() => navigateMonth(-1)} className="flex h-11 w-11 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-800"><CaretLeft aria-hidden="true" /></button>
      <span aria-live="polite" className="text-sm font-semibold text-neutral-900 dark:text-white">{monthLabel}</span>
      <button type="button" aria-label={t('att_calendar_next')} disabled={busy || month === '2100-12'} onClick={() => navigateMonth(1)} className="flex h-11 w-11 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-800"><CaretRight aria-hidden="true" /></button>
    </div>
    <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
      {weekdayLabels.map((label, i) => <span key={i} className="py-1 text-center text-[10px] font-medium text-neutral-500" aria-hidden="true">{label}</span>)}
      {days.map((date, i) => {
        if (!date) return <span key={`empty-${i}`} />;
        const marks = byDate.get(date) || [];
        const counts = statuses.map(status => ({ status, count: marks.filter(record => record.status === status).length })).filter(item => item.count);
        return <button key={date} type="button" data-attendance-date={date} aria-label={`${date}: ${counts.map(item => `${statusLabel(item.status)} (${item.count})`).join(', ') || t('att_unmarked')}`} aria-pressed={date === selectedDate} disabled={busy} onClick={() => selectDate(date)} className={cn('flex min-h-[54px] min-w-0 flex-col items-center justify-start gap-1 rounded-md border border-transparent py-1.5 text-xs transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#EF2F38] disabled:opacity-50 dark:hover:bg-neutral-800', date === selectedDate ? 'border-[#EF2F38] bg-red-50 dark:bg-red-500/10' : 'bg-neutral-50 dark:bg-neutral-900/50', date > today && 'text-neutral-400')}>
          <span className={cn('flex h-5 w-5 items-center justify-center rounded-full font-medium', date === today && 'bg-[#EF2F38] text-white')}>{Number(date.slice(-2))}</span>
          <span className="flex max-w-full flex-wrap justify-center gap-0.5">
            {counts.map(({ status, count }) => <span key={status} aria-hidden="true" className={cn('rounded border px-0.5 text-[9px] font-semibold', tones[status])}>{status[0]}{count > 1 ? count : ''}</span>)}
          </span>
        </button>;
      })}
    </div>
    <div className="my-3 flex flex-wrap gap-2 text-[10px]">
      {statuses.map(status => <span key={status} className={cn('rounded border px-2 py-1', tones[status])}>{statusLabel(status)}</span>)}
    </div>
    {!dataReady && <p role="alert" className="mb-2 text-xs text-amber-700 dark:text-amber-300">{t('att_calendar_partial')}</p>}
    {!canMark && !canDelete && <p className="mb-2 text-xs text-neutral-500">{t('att_calendar_readonly')}</p>}
    <h4 className="mb-2 text-xs font-semibold text-neutral-900 dark:text-white">{dateFormatter.format(new Date(`${selectedDate}T00:00:00Z`))}</h4>
    {targets.length === 0 && <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('att_calendar_empty')}</p>}
    <div className="space-y-2">
      {targets.map(target => {
        const label = scopeLabel(target.classId);
        const block = attendanceMarkBlock({ date: selectedDate, today, registrationDate: student.registrationDate, studentId: student.id, classId: target.classId, enrollments, existing: Boolean(target.record) });
        const session = classes.find(item => item.id === target.classId);
        const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(new Date(`${selectedDate}T00:00:00Z`));
        const offSchedule = !target.record && session && !(session.daysOfWeek.length ? session.daysOfWeek : [session.dayOfWeek]).includes(weekday);
        return <div key={target.classId ?? 'daily'} role="group" aria-label={`${label} attendance`} className="rounded-md border border-neutral-200 p-2 dark:border-neutral-700">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-xs"><span className="font-medium text-neutral-900 dark:text-white">{label}</span><span className="text-neutral-500">{target.record ? statusLabel(target.record.status) : t('att_unmarked')}</span></div>
          {block && <p className="mb-2 text-[11px] text-neutral-500">{t(`att_calendar_${block}`)}</p>}
          {offSchedule && !block && canMark && <label className="mb-2 flex items-start gap-2 text-[11px] text-neutral-500"><input type="checkbox" checked={makeup} disabled={busy || !dataReady} onChange={event => setMakeup(event.target.checked)} className="mt-0.5 accent-[#EF2F38]" />{t('att_calendar_makeup')}</label>}
          <div className="grid grid-cols-3 gap-1">
            {statuses.map(status => <button key={status} type="button" aria-label={`${statusLabel(status)} — ${label}`} aria-pressed={target.record?.status === status} disabled={busy || !dataReady || !canMark || Boolean(block) || Boolean(offSchedule && !makeup) || target.record?.status === status} onClick={() => void save(target, status)} className={cn('min-h-[44px] rounded-md border px-1 text-[11px] font-medium transition-colors enabled:hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40', tones[status])}>{statusLabel(status)}</button>)}
          </div>
          {target.record && canDelete && <div className="mt-2">
            {clearId === target.record.id ? <div className="space-y-2"><p className="text-[11px] text-neutral-600 dark:text-neutral-300">{t('att_calendar_clear_confirm')}</p><div className="flex gap-2"><button type="button" disabled={busy || !dataReady} onClick={() => void save(target, 'clear')} className="min-h-[44px] rounded-md bg-rose-600 px-3 text-xs font-semibold text-white disabled:opacity-40">{t('att_calendar_confirm_clear')}</button><button type="button" disabled={busy} onClick={() => setClearId(null)} className="min-h-[44px] rounded-md px-3 text-xs text-neutral-500">{t('act_cancel')}</button></div></div>
              : <button type="button" aria-label={`${t('att_calendar_clear')} — ${label}`} disabled={busy || !dataReady} onClick={() => {setClearId(target.record!.id); setError(''); setFeedback('');}} className="min-h-[44px] rounded-md px-2 text-[11px] font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:text-rose-300 dark:hover:bg-rose-500/10">{t('att_calendar_clear')}</button>}
          </div>}
        </div>;
      })}
    </div>
    {error && <p role="alert" className="mt-3 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
    <p role="status" aria-live="polite" className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{busy ? t('att_calendar_pending') : feedback}</p>
    <div className="mt-4"><MakeupAttendancePanel studentId={student.id} /></div>
  </section>;
}
