import { z } from 'zod';
import { isCalendarDate } from './dates';

const date = z.string().refine(isCalendarDate, 'Choose a valid calendar date');
const reason = z.string().trim().min(5).max(500);
const studentId = z.string().regex(/^STU-[MF]-[0-9]+$/);
const uuid = z.string().uuid();
const money = z.number().positive().max(100000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, 'Use two decimal places');
const base = { requestKey: uuid };
const examTitle = z.string().trim().min(3).max(160);
/** Optional grading-day details students see: branch (null = all branches), start time and location. */
const examDetails = {
  branchId: z.number().int().positive().nullable().optional(),
  startTime: z.union([z.literal(''), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time such as 09:30')]).optional(),
  location: z.string().trim().max(160).optional(),
};
export const operationsSchema = z.discriminatedUnion('action', [
  z.object({ ...base, action: z.literal('policy'), reminderLeadDays: z.number().int().min(0).max(60), lateGraceDays: z.number().int().min(0).max(60) }).strict(),
  z.object({ ...base, action: z.literal('invoice'), studentId, cycleMonth: date.refine(value => value.endsWith('-01'), 'Choose a billing month'),historicalAmount:z.number().min(0).max(100000).optional(),reason:reason.optional() }).strict(),
  z.object({ ...base, action: z.literal('payment'), studentId, amount: money, paymentDate: date, method: z.enum(['Cash', 'Bank Transfer', 'Credit Card', 'ABA Bank KHQR']), externalReference: z.string().trim().min(3).max(120).nullable(), receivedVerified: z.literal(true), allocations: z.array(z.object({ invoiceId: uuid, amount: money }).strict()).min(1).max(24) }).strict().refine(value => value.method === 'Cash' || value.externalReference !== null, { path: ['externalReference'], message: 'Enter the verified bank or card reference for a non-cash receipt.' }),
  z.object({ ...base, action: z.literal('issue_credit'), studentId, amount: money.max(10000), reason }).strict(),
  z.object({ ...base, action: z.literal('apply_credit'), studentId, invoiceId: uuid, creditId: uuid, amount: money }).strict(),
  z.object({ ...base, action: z.literal('pause'), studentId, startDate: date, resumeDate: date, reason }).strict(),
  z.object({ ...base, action: z.literal('void_pause'), studentId, id: uuid, reason }).strict(),
  z.object({ ...base, action: z.literal('return'), studentId, reason }).strict(),
  z.object({ ...base, action: z.literal('snapshot_sessions'), from: date, to: date }).strict(),
  z.object({ ...base, action: z.literal('holiday'), title: z.string().trim().min(2).max(120), branchId: z.number().int().positive().nullable(), startDate: date, endDate: date, reason }).strict(),
  z.object({ ...base, action: z.literal('session_change'), id: uuid, revision: z.number().int().positive(), status: z.enum(['scheduled', 'cancelled']), startsAt: z.string().datetime({ offset: true }).optional(), endsAt: z.string().datetime({ offset: true }).optional(), reason }).strict(),
  z.object({ ...base, action: z.literal('session_attendance'), studentId, occurrenceId: uuid, status: z.enum(['Present', 'Late', 'Absent']) }).strict(),
  z.object({ ...base, action: z.literal('task'), studentId: studentId.optional(), title: z.string().trim().min(3).max(160), description: z.string().max(1000).optional(), category: z.enum(['attendance', 'billing', 'orders', 'general']), assignedTo: uuid, dueDate: date }).strict(),
  z.object({ ...base, action: z.literal('task_update'), id: uuid, revision: z.number().int().positive(), status: z.enum(['open', 'in_progress', 'completed', 'cancelled']), note: z.string().max(1000).optional() }).strict(),
  z.object({ ...base, action: z.literal('bank_import'), lines: z.array(z.object({ reference: z.string().trim().min(3).max(120), amount: money, transactionDate: date }).strict()).min(1).max(500) }).strict(),
  z.object({ ...base, action: z.literal('reconcile'), bankLineId: uuid, receiptId: uuid }).strict(),
  z.object({ ...base, action: z.literal('exam'), title: examTitle, examDate: date, attendanceFrom: date, targetBeltId: z.number().int().positive(), passingScore: z.number().int().min(0).max(100), minimumAttendance: z.number().int().min(0).max(100), ...examDetails }).strict(),
  z.object({ ...base, action: z.literal('exam_update'), id: uuid, title: examTitle, examDate: date, ...examDetails }).strict(),
  z.object({ ...base, action: z.literal('exam_publish'), id: uuid }).strict(),
  z.object({ ...base, action: z.literal('exam_cancel'), id: uuid, reason }).strict(),
  z.object({ ...base, action: z.literal('assess'), eventId: uuid, studentId, score: z.number().min(0).max(100), notes: z.string().max(1000), revision: z.number().int().min(0) }).strict(),
  z.object({ ...base, action: z.literal('promote'), id: uuid, studentId, revision: z.number().int().positive(), overrideReason: reason.optional() }).strict(),
  z.object({ ...base, action: z.literal('quality_review'), findingKey: z.string().regex(/^[a-z0-9:_-]{1,160}$/i), note: reason }).strict(),
]);
export type OperationInput = z.infer<typeof operationsSchema>;
export function operationPermission(action: OperationInput['action']): string {
  if (['policy', 'quality_review'].includes(action)) return 'action:staff_manage';
  if (['pause', 'void_pause', 'return', 'invoice', 'payment', 'issue_credit', 'apply_credit', 'bank_import', 'reconcile'].includes(action)) return 'action:finance_record_payment';
  if (['snapshot_sessions', 'holiday', 'session_change'].includes(action)) return 'action:schedule_manage';
  if (action === 'session_attendance') return 'action:attendance_mark';
  if (['exam', 'exam_update', 'exam_publish', 'exam_cancel', 'assess', 'promote'].includes(action)) return 'action:evaluations_grade';
  return 'page:dashboard';
}

export function invoiceOutstanding(invoice: { id: string; amount_usd: number | string; waiver_usd: number | string; legacy_settlement_id?: number | null }, allocations: { invoice_id: string; amount_usd: number | string }[], uses: { invoice_id: string; amount_usd: number | string }[]) {
  if (invoice.legacy_settlement_id) return 0;
  const paid = [...allocations, ...uses].filter(row => row.invoice_id === invoice.id).reduce((sum, row) => sum + Math.round(Number(row.amount_usd) * 100), 0);
  return Math.max(0, Math.round(Number(invoice.amount_usd) * 100) - Math.round(Number(invoice.waiver_usd) * 100) - paid) / 100;
}
