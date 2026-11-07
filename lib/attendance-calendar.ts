import { calendarDate, isCalendarDate } from './dates';

export type AttendanceScope = 'all' | 'daily' | number;
type Mark = { id: number; studentId: string; date: string; classId?: number; status: 'Present' | 'Late' | 'Absent' };
type Enrollment = { studentId: string; classId: number; enrollmentDate?: string };

export function attendanceMonthDays(month: string): (string | null)[] {
  if (!isCalendarDate(`${month}-01`)) throw new Error('Invalid attendance month.');
  const [year, number] = month.split('-').map(Number);
  const offset = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let day = 1; day <= count; day++) cells.push(calendarDate(year, number - 1, day));
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** Month navigation keeps the selected day when possible, including leap years. */
export function shiftAttendanceDate(date: string, months: number): string {
  if (!isCalendarDate(date) || !Number.isSafeInteger(months)) throw new Error('Invalid calendar navigation.');
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1 + months, 1));
  if (next.getUTCFullYear() < 1900 || next.getUTCFullYear() > 2100) return date;
  return calendarDate(next.getUTCFullYear(), next.getUTCMonth(), day);
}

/** Keep separate daily/class marks; a combined calendar is never a write target. */
export function indexAttendanceCalendar<T extends Mark>(records: T[], studentId: string, scope: AttendanceScope): Map<string, T[]> {
  const days = new Map<string, T[]>();
  for (const record of records) {
    if (record.studentId !== studentId || !isCalendarDate(record.date)) continue;
    if (scope === 'daily' ? record.classId != null : scope !== 'all' && record.classId !== scope) continue;
    days.set(record.date, [...(days.get(record.date) || []), record]);
  }
  for (const records of days.values()) records.sort((a, b) => (a.classId ?? -1) - (b.classId ?? -1));
  return days;
}

export function attendanceMarkBlock({ date, today, registrationDate, classId, studentId, enrollments, existing }: {
  date: string; today: string; registrationDate: string; classId?: number; studentId: string; enrollments: Enrollment[]; existing: boolean;
}): 'future' | 'before_registration' | 'not_enrolled' | 'before_enrollment' | null {
  if (!isCalendarDate(date) || date > today) return 'future';
  // Existing historical marks remain correctable even if enrollment details changed.
  if (existing) return null;
  if (date < registrationDate.slice(0, 10)) return 'before_registration';
  if (classId !== undefined) {
    const enrollment = enrollments.find(item => item.studentId === studentId && item.classId === classId);
    if (!enrollment) return 'not_enrolled';
    if (date < (enrollment.enrollmentDate || registrationDate).slice(0, 10)) return 'before_enrollment';
  }
  return null;
}
