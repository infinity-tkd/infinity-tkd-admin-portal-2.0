import { z } from 'zod';
import { addCalendarDays, isCalendarDate, academyDate } from './dates';
import { STUDENT_NOTICE_CATEGORIES } from './lms-contract';

export const eventTypeValues = ['holiday', 'competition', 'workshop', 'maintenance', 'academy', 'class_change'] as const;
const date = z.string().refine(isCalendarDate, 'Use a valid calendar date.');
const timezone = z.string().min(1).max(80).refine(value => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
}, 'Choose a valid timezone.');
export const eventAudienceSchema = z.object({
  mode: z.enum(['all', 'branches', 'classes', 'students', 'staff']),
  branchIds: z.array(z.number().int().positive()).max(200).default([]),
  classIds: z.array(z.number().int().positive()).max(500).default([]),
  studentIds: z.array(z.string().min(1).max(50)).max(2000).default([]),
}).strict().superRefine((value, ctx) => {
  const selected = value.mode === 'branches' ? value.branchIds : value.mode === 'classes' ? value.classIds : value.mode === 'students' ? value.studentIds : null;
  if (selected && !selected.length) ctx.addIssue({ code: 'custom', path: ['mode'], message: 'Select at least one audience member.' });
}).transform(value => ({ mode: value.mode,
  branchIds: value.mode === 'branches' ? [...new Set(value.branchIds)] : [],
  classIds: value.mode === 'classes' ? [...new Set(value.classIds)] : [],
  studentIds: value.mode === 'students' ? [...new Set(value.studentIds)] : [],
}));
const attachment = z.object({ id: z.string().uuid().optional(), label: z.string().trim().min(1).max(120), url: z.string().url().max(2048).refine(value => {
  try { const parsed = new URL(value); return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.port && !/^(localhost|127\.|0\.|\[)/i.test(parsed.hostname); } catch { return false; }
}, 'Use an approved HTTPS file link without credentials.') }).strict();
const draftObject = z.object({
  title: z.string().trim().min(1).max(200), type: z.enum(eventTypeValues),
  lifecycle: z.enum(['scheduled', 'postponed', 'cancelled', 'completed']),
  startDate: date, endDate: date, startsAt: z.string().datetime({ offset: true }).nullable(), endsAt: z.string().datetime({ offset: true }).nullable(),
  timezone, location: z.string().trim().max(240), description: z.string().max(8000), internalNotes: z.string().max(5000),
  audience: eventAudienceSchema, attachments: z.array(attachment).max(10), changeReason: z.string().trim().max(1000),
});
function validateDraft(value: z.infer<typeof draftObject>, ctx: z.RefinementCtx) {
  if (value.endDate < value.startDate || Date.parse(value.endDate) - Date.parse(value.startDate) > 366 * 86400000) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Choose an end date within one year of the first day.' });
  if (Boolean(value.startsAt) !== Boolean(value.endsAt) || (value.startsAt && value.endsAt && Date.parse(value.endsAt) <= Date.parse(value.startsAt))) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'The end time must follow the start time.' });
  if (['cancelled', 'postponed'].includes(value.lifecycle) && value.changeReason.length < 5) ctx.addIssue({ code: 'custom', path: ['changeReason'], message: 'Explain the cancellation or postponement.' });
  const dateInZone = (stamp: number) => { try { const parts=new Intl.DateTimeFormat('en-CA',{timeZone:value.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(stamp));return ['year','month','day'].map(type=>parts.find(part=>part.type===type)?.value).join('-'); } catch { return null; } };
  const today = dateInZone(Date.now()) || academyDate();
  if (value.lifecycle === 'completed' && (value.endsAt ? Date.parse(value.endsAt) > Date.now() : value.endDate > today)) ctx.addIssue({ code: 'custom', path: ['lifecycle'], message: 'A future event cannot be marked completed.' });
  if (value.startsAt && value.endsAt) {
    const start = dateInZone(Date.parse(value.startsAt)), end = dateInZone(Date.parse(value.endsAt) - 1);
    if (start && end && (start !== value.startDate || end !== value.endDate)) ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Dates must match the timed occurrence in its venue timezone.' });
  }
}
export const eventDraftSchema = draftObject.strict().superRefine(validateDraft);
export const eventCreateSchema = draftObject.extend({ requestKey: z.string().uuid() }).strict().superRefine(validateDraft);
export const eventUpdateSchema = draftObject.extend({ expectedRevision: z.number().int().positive(), requestKey: z.string().uuid() }).strict().superRefine(validateDraft);
export const eventPublicationSchema = z.object({ expectedRevision: z.number().int().positive(), requestKey: z.string().uuid(), notifyStudents: z.boolean().default(false) }).strict();
export const eventNoticeSchema = z.object({ expectedRevision: z.number().int().positive(), requestKey: z.string().uuid() }).strict();
export const eventArchiveSchema = z.object({ expectedRevision: z.number().int().positive(), reason: z.string().trim().min(5).max(1000), requestKey: z.string().uuid() }).strict();
export type CalendarDraft = z.infer<typeof eventDraftSchema>;
export type StoredAttachment = CalendarDraft['attachments'][number] & { id: string; mimeType?: string; bytes?: number; checksum?: string; studentAvailable?: boolean };
export function occurrence(value: Pick<CalendarDraft, 'startsAt' | 'endsAt' | 'startDate' | 'endDate'>) {
  return value.startsAt && value.endsAt ? { allDay: false as const, startsAt: value.startsAt, endsAt: value.endsAt }
    : { allDay: true as const, startDate: value.startDate, endDate: addCalendarDays(value.endDate, 1) };
}
export const portalPreferenceSchema = z.object({
  // 'events' plus the LMS notice categories; muting is per account.
  pushEnabled: z.boolean(), mutedCategories: z.array(z.enum(STUDENT_NOTICE_CATEGORIES)).max(STUDENT_NOTICE_CATEGORIES.length).refine(list => new Set(list).size === list.length, 'List each category once.'),
  quietStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(), quietEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
}).strict().refine(value => Boolean(value.quietStart) === Boolean(value.quietEnd) && (!value.quietStart || value.quietStart !== value.quietEnd), 'Choose distinct quiet-hour start/end times, or neither.');
export const portalNoticeMutation = z.union([
  z.object({ notificationId: z.string().uuid() }).strict(),
  z.object({ notificationId: z.string().uuid(), dismiss: z.literal(true) }).strict(),
  z.object({ markAll: z.literal(true) }).strict(),
]);
