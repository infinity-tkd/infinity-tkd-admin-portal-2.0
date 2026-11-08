import { openDB, type IDBPDatabase } from 'idb';
import type { AttendanceDraft } from './attendance-write';

/**
 * Attendance marks taken while the connection is down. Only the intent is kept (student, date,
 * class, status, who marked it) — never a session token — and sending it later is an idempotent
 * upsert of the same mark. Marks belong to the staff account that took them and are only sent
 * while that account is signed in.
 */
export interface QueuedAttendanceMark extends AttendanceDraft {
  key: string;
  userId: string;
  queuedAt: number;
  /** Set when the server rejected the mark; it is kept for review instead of being retried. */
  failedReason?: string;
}

export const attendanceMarkKey = (row: Pick<AttendanceDraft, 'studentId' | 'date' | 'classId'>) => `${row.studentId}/${row.date}/${row.classId ?? 'daily'}`;
export const queuedMarkKey = (userId: string, row: Pick<AttendanceDraft, 'studentId' | 'date' | 'classId'>) => `${userId}|${attendanceMarkKey(row)}`;

/** A stable negative id per queued mark: list keys stay stable and never collide with database ids. */
export function queuedMarkId(key: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index++) { hash ^= key.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return -(1 + ((hash >>> 0) % 2_000_000_000));
}

/** Show queued marks in place of loaded records for the same student, date and class. */
export function overlayQueuedAttendance<T extends { id: number; studentId: string; date: string; classId?: number; status: string }>(records: T[], queued: readonly QueuedAttendanceMark[]): (T | (AttendanceDraft & { id: number; pending: true }))[] {
  if (!queued.length) return records;
  const keys = new Set(queued.map(attendanceMarkKey));
  return [...records.filter(record => !keys.has(attendanceMarkKey(record))), ...queued.map(mark => ({ id: queuedMarkId(mark.key), studentId: mark.studentId, date: mark.date, status: mark.status, ...(mark.classId !== undefined ? { classId: mark.classId } : {}), pending: true as const }))];
}

/** Later marks for the same student session replace earlier ones. */
export function mergeQueuedMarks(existing: readonly QueuedAttendanceMark[], incoming: readonly QueuedAttendanceMark[]): QueuedAttendanceMark[] {
  const replaced = new Set(incoming.map(mark => mark.key));
  return [...existing.filter(mark => !replaced.has(mark.key)), ...incoming].sort((a, b) => a.queuedAt - b.queuedAt);
}

export function buildQueuedMarks(userId: string, rows: readonly AttendanceDraft[], now = Date.now()): QueuedAttendanceMark[] {
  return rows.map((row, index) => ({
    studentId: row.studentId, date: row.date, status: row.status, ...(row.classId !== undefined ? { classId: row.classId } : {}),
    userId, key: queuedMarkKey(userId, row), queuedAt: now + index,
  }));
}

// --- Device storage (IndexedDB, with an in-memory fallback when storage is blocked) ---
const DB_NAME = 'infinity_attendance_queue';
const STORE = 'marks';
let database: Promise<IDBPDatabase> | null = null;
let snapshot: readonly QueuedAttendanceMark[] = Object.freeze([]);
const listeners = new Set<() => void>();

function openQueue() {
  database ??= openDB(DB_NAME, 1, { upgrade(db) { if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' }); } });
  return database;
}
function publish(next: readonly QueuedAttendanceMark[]) {
  snapshot = Object.freeze([...next].sort((a, b) => a.queuedAt - b.queuedAt));
  listeners.forEach(listener => listener());
}

export const subscribeQueuedAttendance = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const queuedAttendanceSnapshot = () => snapshot;
export const queuedAttendanceFor = (userId: string | undefined) => (userId ? snapshot.filter(mark => mark.userId === userId) : []);

/** Read marks saved on this device by earlier visits. */
export async function loadQueuedAttendance(): Promise<readonly QueuedAttendanceMark[]> {
  try { publish(mergeQueuedMarks(await (await openQueue()).getAll(STORE) as QueuedAttendanceMark[], snapshot)); } catch { /* Storage blocked: keep the in-memory list. */ }
  return snapshot;
}

export async function queueAttendanceMarks(userId: string, rows: readonly AttendanceDraft[]): Promise<QueuedAttendanceMark[]> {
  const marks = buildQueuedMarks(userId, rows);
  publish(mergeQueuedMarks(snapshot, marks));
  try { const db = await openQueue(); const tx = db.transaction(STORE, 'readwrite'); await Promise.all([...marks.map(mark => tx.store.put(mark)), tx.done]); } catch { /* Kept in memory for this visit. */ }
  return marks;
}

export async function removeQueuedAttendance(keys: readonly string[]): Promise<void> {
  if (!keys.length) return;
  const gone = new Set(keys);
  publish(snapshot.filter(mark => !gone.has(mark.key)));
  try { const db = await openQueue(); const tx = db.transaction(STORE, 'readwrite'); await Promise.all([...keys.map(key => tx.store.delete(key)), tx.done]); } catch { /* Already removed from memory. */ }
}

export async function flagQueuedAttendance(keys: readonly string[], reason: string): Promise<void> {
  const flagged = new Set(keys);
  const next = snapshot.map(mark => (flagged.has(mark.key) ? { ...mark, failedReason: reason } : mark));
  publish(next);
  try { const db = await openQueue(); const tx = db.transaction(STORE, 'readwrite'); await Promise.all([...next.filter(mark => flagged.has(mark.key)).map(mark => tx.store.put(mark)), tx.done]); } catch { /* Kept in memory. */ }
}

/** Clear the review flag so rejected marks are sent again. */
export async function retryQueuedAttendance(keys: readonly string[]): Promise<void> {
  const retried = new Set(keys);
  const next = snapshot.map(mark => {
    if (!retried.has(mark.key)) return mark;
    const rest: QueuedAttendanceMark = { ...mark };
    delete rest.failedReason;
    return rest;
  });
  publish(next);
  try { const db = await openQueue(); const tx = db.transaction(STORE, 'readwrite'); await Promise.all([...next.filter(mark => retried.has(mark.key)).map(mark => tx.store.put(mark)), tx.done]); } catch { /* Kept in memory. */ }
}
