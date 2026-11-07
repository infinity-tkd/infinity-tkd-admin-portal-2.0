import { z } from 'zod';
import { isCalendarDate } from './dates';

const label = z.object({ en: z.string().trim().max(200), kh: z.string().trim().max(200), zh: z.string().trim().max(200) }).strict();
const key = z.string().regex(/^[a-z0-9_-]{1,60}$/);
const studentId = z.string().regex(/^STU-[MF]-[0-9]+$/);
const date = z.string().refine(isCalendarDate, 'Choose a valid date');
const approvedLabel = z.object({ en: z.string().trim().min(1).max(200), kh: z.string().trim().min(1).max(200), zh: z.string().trim().min(1).max(200) }).strict();
export const publishedReadinessRequirementsSchema = z.object({
  minimumDays: z.number().int().min(0).max(10000), minimumAverageGrade: z.number().min(0).max(4),
  attendance: z.object({ minimum: z.number().int().min(0).max(10000), basis: z.enum(['unique_days', 'class_records', 'dated_sessions']) }).strict(),
  lessons: z.array(z.object({ id: key, curriculumId: z.number().int().positive(), label: approvedLabel }).strict()).max(100),
  skills: z.array(z.object({ id: key, skillName: z.string().trim().min(1).max(150), minimumGrade: z.number().int().min(1).max(4), label: approvedLabel }).strict()).max(100),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.lessons.map(item => item.id)).size !== value.lessons.length || new Set(value.skills.map(item => item.id)).size !== value.skills.length || new Set(value.lessons.map(item => item.curriculumId)).size !== value.lessons.length) ctx.addIssue({ code: 'custom', message: 'Published requirement mappings must be unique.' });
  if (new Set(value.skills.map(item => item.skillName)).size !== value.skills.length) ctx.addIssue({ code: 'custom', message: 'Each physical skill can be required only once.' });
  if (value.minimumAverageGrade > 0 && !value.skills.length) ctx.addIssue({ code: 'custom', message: 'A physical-average threshold requires named skills.' });
});

export const readinessDraftSchema = z.object({
  targetBelt: z.string().trim().min(1).max(80), version: z.string().trim().min(1).max(60),
  minimumDays: z.number().int().min(0).max(10000), minimumAverageGrade: z.number().min(0).max(4),
  attendance: z.object({ minimum: z.number().int().min(0).max(10000), basis: z.enum(['unique_days', 'class_records', 'dated_sessions']).nullable() }).strict(),
  lessons: z.array(z.object({ id: key, curriculumId: z.number().int().positive(), label }).strict()).max(100),
  skills: z.array(z.object({ id: key, skillName: z.string().trim().min(1).max(150), minimumGrade: z.number().int().min(1).max(4), label }).strict()).max(100),
  mappingReviewed: z.boolean(), reviewNotes: z.string().max(2000),
}).strict().superRefine((value, ctx) => {
  for (const field of ['lessons', 'skills'] as const) {
    if (new Set(value[field].map(item => item.id)).size !== value[field].length) ctx.addIssue({ code: 'custom', path: [field], message: 'Requirement keys must be unique within the list.' });
  }
  if (new Set(value.lessons.map(item => item.curriculumId)).size !== value.lessons.length) ctx.addIssue({ code: 'custom', path: ['lessons'], message: 'Each lesson can be required only once.' });
  if (new Set(value.skills.map(item => item.skillName)).size !== value.skills.length) ctx.addIssue({ code: 'custom', path: ['skills'], message: 'Each physical skill can be required only once.' });
});

export const rankingDraftSchema = z.object({
  seasonStart: date, seasonEnd: date, methodology: z.literal('medal_order'),
  entries: z.array(z.object({ student_id: studentId, display_name: z.string().trim().min(1).max(120), consent_reference: z.string().trim().max(200), gold: z.number().int().min(0).max(10000), silver: z.number().int().min(0).max(10000), bronze: z.number().int().min(0).max(10000) }).strict()).max(1000),
  reviewNotes: z.string().max(2000),
}).strict().superRefine((value, ctx) => {
  if (value.seasonEnd < value.seasonStart) ctx.addIssue({ code: 'custom', path: ['seasonEnd'], message: 'Season end must follow its start.' });
  if (new Set(value.entries.map(item => item.student_id)).size !== value.entries.length) ctx.addIssue({ code: 'custom', path: ['entries'], message: 'A student can appear only once in this draft.' });
});

const base = { requestKey: z.string().uuid() };
const draftFields = { ...base, action: z.literal('save_draft'), id: z.string().uuid().optional(), revision: z.number().int().min(0), title: z.string().trim().min(2).max(120) };
export const studentPortalAdminSchema = z.union([
  z.object({ ...draftFields, kind: z.literal('readiness'), payload: readinessDraftSchema }).strict(),
  z.object({ ...draftFields, kind: z.literal('ranking'), payload: rankingDraftSchema }).strict(),
  z.object({ ...base, action: z.literal('archive_draft'), id: z.string().uuid(), revision: z.number().int().positive(), reason: z.string().trim().min(5).max(500) }).strict(),
  z.object({ ...base, action: z.literal('confirm_lesson'), studentId, policyId: z.string().uuid(), requirementKey: key, result: z.enum(['passed', 'needs_work']), reference: z.string().trim().min(1).max(200), observedNow: z.literal(true) }).strict(),
  z.object({ ...base, action: z.literal('withdraw_confirmation'), id: z.string().uuid(), reason: z.string().trim().min(5).max(500) }).strict(),
]);
export type ReadinessDraft = z.infer<typeof readinessDraftSchema>;
export type RankingDraft = z.infer<typeof rankingDraftSchema>;
export type StudentPortalAdminInput = z.infer<typeof studentPortalAdminSchema>;

export function readinessReviewIssues(draft: ReadinessDraft): string[] {
  const issues: string[] = [];
  if (draft.attendance.basis === null) issues.push('Attendance counting basis needs academy approval.');
  if (!draft.mappingReviewed) issues.push('The required lesson/skill list, including any intentional empty lists, needs review.');
  if (draft.minimumAverageGrade > 0 && !draft.skills.length) issues.push('A physical-average threshold requires named skills.');
  if ([...draft.lessons, ...draft.skills].some(item => !item.label.en || !item.label.kh || !item.label.zh)) issues.push('Requirement labels need approved English, Khmer and Chinese text.');
  return issues;
}

export function rankingReviewIssues(draft: RankingDraft): string[] {
  return [...(!draft.entries.length ? ['Add the reviewed athletes before requesting publication approval.'] : []), ...(draft.entries.some(entry => !entry.consent_reference) ? ['Every athlete needs a genuine consent/evidence reference before publication.'] : [])];
}
