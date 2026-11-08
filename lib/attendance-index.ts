/**
 * Shared lookups for roster-wide screens. They are cached against the list object: app state
 * replaces these lists instead of editing them, so one pass serves every student until the data
 * changes, instead of rescanning all records once per student.
 */
const byStudentCache = new WeakMap<readonly object[], Map<string, unknown[]>>();
const onDateCache = new WeakMap<readonly object[], Map<string, Map<string, unknown>>>();

/** Rows grouped by studentId, in their original order. */
export function groupByStudent<T extends { studentId: string }>(rows: readonly T[]): ReadonlyMap<string, readonly T[]> {
  let index = byStudentCache.get(rows) as Map<string, T[]> | undefined;
  if (!index) {
    index = new Map();
    for (const row of rows) {
      const list = index.get(row.studentId);
      if (list) list.push(row); else index.set(row.studentId, [row]);
    }
    byStudentCache.set(rows, index as Map<string, unknown[]>);
  }
  return index;
}

export function rowsForStudent<T extends { studentId: string }>(rows: readonly T[], studentId: string): readonly T[] {
  return groupByStudent(rows).get(studentId) ?? [];
}

export const sessionKey = (studentId: string, classId: number | null | undefined) => `${studentId}/${classId ?? 'daily'}`;

/** The first record per student session on a date, matching Array.find over the same list. */
export function attendanceOnDate<T extends { studentId: string; date: string; classId?: number | null }>(rows: readonly T[], date: string): ReadonlyMap<string, T> {
  let dates = onDateCache.get(rows) as Map<string, Map<string, T>> | undefined;
  if (!dates) { dates = new Map(); onDateCache.set(rows, dates as Map<string, Map<string, unknown>>); }
  let index = dates.get(date);
  if (!index) {
    index = new Map();
    for (const row of rows) {
      if (row.date !== date) continue;
      const key = sessionKey(row.studentId, row.classId);
      if (!index.has(key)) index.set(key, row);
    }
    dates.set(date, index);
  }
  return index;
}

/** A class session's mark for a student on a date; no class selected means no mark (as before). */
export function sessionMark<T extends { studentId: string; date: string; classId?: number | null }>(rows: readonly T[], studentId: string, date: string, classId: number | null | undefined): T | undefined {
  return classId == null ? undefined : attendanceOnDate(rows, date).get(sessionKey(studentId, classId));
}
