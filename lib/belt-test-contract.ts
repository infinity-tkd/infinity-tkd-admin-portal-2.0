import { z } from 'zod';
import { isCalendarDate } from './dates';

/** Requests to POST /api/belt-tests → public.portal_belt_tests_mutate. */
const uuid = z.string().uuid();
const date = z.string().refine(isCalendarDate, 'Choose a valid date');
const studentId = z.string().regex(/^STU-[MF]-[0-9]+$/);
const revision = z.number().int().min(0);
const reason = z.string().trim().min(5).max(500);
const time = z.union([z.literal(''), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time such as 09:30')]);
const base = { requestKey: uuid };

export const beltTestEligibilityRulesSchema = z.object({
  minimumDays: z.number().int().min(0).max(3650), minimumClasses: z.number().int().min(0).max(1000),
  minimumSkillAverage: z.number().min(0).max(4), requireLessons: z.boolean(),
}).strict();
/** {"reps": 50, "timesPerWeek": 3}: shown to students as the home-practice target for a syllabus item. */
export const beltTestPracticeTargetSchema = z.object({
  reps: z.number().int().min(1).max(100000).optional(), timesPerWeek: z.number().int().min(1).max(14).optional(), minutes: z.number().int().min(1).max(600).optional(),
}).strict().refine(target => Object.keys(target).length > 0, 'Set reps, times per week or minutes.');
export type BeltTestPracticeTarget = z.infer<typeof beltTestPracticeTargetSchema>;
const item = z.object({
  title: z.string().trim().min(1).max(150), libraryAssetId: z.number().int().positive().nullable().optional(),
  weight: z.number().gt(0).max(100).optional(), critical: z.boolean().optional(), guide: z.string().max(500).optional(),
  // LMS: what to practise at home for this item, and the poomsae form it is (forms-v1).
  practiceTarget: beltTestPracticeTargetSchema.nullable().optional(), formId: uuid.nullable().optional(),
}).strict();
const section = z.object({
  kind: z.enum(['physical', 'skill', 'poomsae', 'acrobatics', 'custom']), title: z.string().trim().min(2).max(120),
  weight: z.number().min(0).max(100).nullable().optional(), minimum: z.number().min(0).max(100).nullable().optional(),
  items: z.array(item).min(1).max(40),
}).strict();
const percent = z.number().min(0).max(100);
/** US dollars, 0–10000 with at most 2 decimals. */
const money = z.number().min(0).max(10000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, 'Use at most 2 decimals');
const event = { title: z.string().trim().min(3).max(160), examDate: date, startTime: time, location: z.string().trim().max(160), branchId: z.number().int().positive().nullable(),
  capacity: z.number().int().min(1).max(500).nullable().optional(), acceptsRequests: z.boolean().optional() };

export const beltTestRequestSchema = z.discriminatedUnion('action', [
  z.object({ ...base, action: z.literal('syllabus_save'), id: uuid.optional(), revision: revision.optional(), targetBeltId: z.number().int().positive(), title: z.string().trim().min(3).max(160),
    passMark: percent.nullable().optional(), distinctionMark: percent.nullable().optional(), sectionMinimum: percent.nullable().optional(),
    criticalMinimum: z.number().min(0).max(10).nullable().optional(), retestDays: z.number().int().min(0).max(365).nullable().optional(),
    feeUsd: money.optional(), eligibility: beltTestEligibilityRulesSchema, notes: z.string().max(2000), sections: z.array(section).min(1).max(12) }).strict(),
  z.object({ ...base, action: z.literal('syllabus_publish'), id: uuid, revision }).strict(),
  z.object({ ...base, action: z.literal('syllabus_retire'), id: uuid }).strict(),
  z.object({ ...base, action: z.literal('syllabus_discard'), id: uuid }).strict(),
  z.object({ ...base, action: z.literal('event_create'), syllabusId: uuid, ...event }).strict(),
  z.object({ ...base, action: z.literal('event_update'), id: uuid, ...event }).strict(),
  z.object({ ...base, action: z.literal('event_publish'), id: uuid }).strict(),
  z.object({ ...base, action: z.literal('event_cancel'), id: uuid, reason }).strict(),
  z.object({ ...base, action: z.literal('register'), eventId: uuid, studentId, overrideReason: reason.optional() }).strict(),
  z.object({ ...base, action: z.literal('withdraw'), id: uuid, reason }).strict(),
  // Student requests (made in the student portal) are approved or declined here.
  z.object({ ...base, action: z.literal('approve_request'), id: uuid, overrideReason: reason.optional() }).strict(),
  z.object({ ...base, action: z.literal('decline_request'), id: uuid, reason }).strict(),
  // Test fees are tracked for the office; they never block testing or promotion.
  z.object({ ...base, action: z.literal('fee_update'), candidateId: uuid, revision, status: z.enum(['unpaid', 'paid', 'waived']), amountUsd: money.optional(),
    method: z.string().trim().min(1).max(40).optional(), reference: z.string().trim().max(120).optional(), paidOn: date.optional(), waiverReason: reason.optional() }).strict(),
  // 0 examiners = any coach may score; 1–5 = only the panel scores and items use its average.
  z.object({ ...base, action: z.literal('examiners_set'), eventId: uuid, examiners: z.array(uuid).max(5) }).strict(),
  z.object({ ...base, action: z.literal('score'), candidateId: uuid, itemId: uuid, score: z.number().min(0).max(10).refine(value => Math.abs(value * 10 - Math.round(value * 10)) < 1e-9, 'Use one decimal place'), note: z.string().max(500), revision }).strict(),
  z.object({ ...base, action: z.literal('feedback'), candidateId: uuid, feedback: z.string().max(1000) }).strict(),
  z.object({ ...base, action: z.literal('finalize'), candidateId: uuid, revision }).strict(),
  z.object({ ...base, action: z.literal('start_retest'), candidateId: uuid, revision }).strict(),
  z.object({ ...base, action: z.literal('publish_results'), eventId: uuid }).strict(),
  z.object({ ...base, action: z.literal('promote'), candidateId: uuid, revision }).strict(),
  z.object({ ...base, action: z.literal('kukkiwon_update'), candidateId: uuid, revision, legalNameEn: z.string().trim().max(150), legalNameKh: z.string().trim().max(150), previousCertificateNo: z.string().trim().max(60) }).strict(),
  z.object({ ...base, action: z.literal('kukkiwon_submit'), eventId: uuid, submittedOn: date, reference: z.string().trim().min(1).max(120) }).strict(),
  z.object({ ...base, action: z.literal('kukkiwon_result'), candidateId: uuid, revision, result: z.enum(['passed', 'failed']) }).strict(),
  z.object({ ...base, action: z.literal('kukkiwon_certificate'), candidateId: uuid, revision, certificateNo: z.string().trim().min(1).max(60), certificateDate: date }).strict(),
]);
export type BeltTestRequest = z.infer<typeof beltTestRequestSchema>;
type Distribute<T> = T extends unknown ? Omit<T, 'requestKey'> : never;
export type BeltTestAction = Distribute<BeltTestRequest>;

export const beltTestViewSchema = z.discriminatedUnion('view', [
  z.object({ view: z.literal('overview') }).strict(),
  z.object({ view: z.literal('syllabus'), id: uuid }).strict(),
  z.object({ view: z.literal('event'), id: uuid }).strict(),
  z.object({ view: z.literal('eligibility'), syllabusId: uuid }).strict(),
  z.object({ view: z.literal('eligibility_all') }).strict(),
  z.object({ view: z.literal('library_usage') }).strict(),
  z.object({ view: z.literal('student_tests'), studentId }).strict(),
]);

/** Shapes returned by GET /api/belt-tests (snake_case rows as stored). */
export interface BeltRow { id: number; belt_name: string; belt_order: number; belt_type: string }
export interface SyllabusRow { id: string; target_belt_id: number; track: 'color' | 'kukkiwon'; version: number; title: string; status: 'draft' | 'published' | 'retired'; revision: number;
  pass_mark: number | null; distinction_mark: number | null; section_minimum: number | null; critical_minimum: number | null; retest_days: number | null; fee_usd: number;
  eligibility: z.infer<typeof beltTestEligibilityRulesSchema>; notes: string; published_at: string | null; updated_at: string }
export interface SectionRow { id: string; syllabus_id: string; kind: 'physical' | 'skill' | 'poomsae' | 'acrobatics' | 'custom'; title: string; weight: number | null; minimum: number | null; position: number }
export interface ItemRow { id: string; section_id: string; title: string; library_asset_id: number | null; weight: number; critical: boolean; guide: string; position: number; practice_target?: BeltTestPracticeTarget | null; form_id?: string | null }
export interface EventRow { id: string; title: string; kind: 'color' | 'kukkiwon'; exam_date: string; start_time: string | null; location: string | null; branch_id: number | null; target_belt_id: number; syllabus_id: string;
  published_at: string | null; cancelled_at: string | null; results_published_at: string | null; capacity: number | null; accepts_requests: boolean; counts?: Record<string, number> }
export type FeeStatus = 'none' | 'unpaid' | 'paid' | 'waived';
export interface CandidateRow { id: string; event_id: string; student_id: string; status: string; revision: number; result: string | null; overall_percent: number | null; section_results: unknown;
  retest_sections: string[]; retest_count: number; public_feedback: string; registration_override_reason: string | null; eligibility_snapshot: unknown; withdrawn_reason: string | null;
  poom_or_dan: 'Poom' | 'Dan' | null; legal_name_en: string | null; legal_name_kh: string | null; dob: string | null; gender: string | null; previous_certificate_no: string | null;
  ctf_submitted_on: string | null; ctf_reference: string | null; external_result: string | null; certificate_no: string | null; certificate_date: string | null;
  requested_at: string | null; registered_at: string | null; decided_at: string | null; decline_reason: string | null;
  fee_usd: number | null; fee_status: FeeStatus; fee_method: string | null; fee_reference: string | null; fee_paid_on: string | null; fee_waiver_reason: string | null; fee_recorded_at: string | null;
  student?: { english_name: string; khmer_name: string; current_belt: string } }
export interface ScoreRow { id: string; candidate_id: string; item_id: string; score: number; note: string; revision: number; scored_by: string; updated_at: string }
export interface EligibilityRule { key: string; met: boolean; current: unknown; required: unknown; since?: string; graded?: number; total?: number }
export interface Eligibility { status: 'eligible' | 'not_yet'; syllabusId: string; targetBelt: string; track: 'color' | 'kukkiwon'; evaluatedOn: string; since: string; rules: EligibilityRule[] }
export interface EligibilityEntry { studentId: string; englishName: string; khmerName: string; currentBelt: string; homeBranchId: number; eligibility: Eligibility }
/** Every student covered by a published syllabus for their next belt, keyed by student id. */
export interface EligibilityAll { entries: Record<string, Eligibility> }
/** Where a library lesson is used in a draft or published belt test syllabus. */
export interface LibraryUsage { libraryAssetId: number; syllabusId: string; targetBelt: string; track: 'color' | 'kukkiwon'; status: 'draft' | 'published'; version: number; section: string; item: string }
export interface LibraryUsageView { usage: LibraryUsage[] }
/** One student's belt tests, newest first (staff view). */
export interface StudentTestRow { candidateId: string; eventId: string; title: string; kind: 'color' | 'kukkiwon'; examDate: string; targetBelt: string; status: string; result: string | null;
  overallPercent: number | null; sections: { title: string; percent: number; grade: string; met: boolean }[]; resultsPublished: boolean; poomOrDan: 'Poom' | 'Dan' | null; certificateNo: string | null; cancelled: boolean }
export interface StudentTestsView { tests: StudentTestRow[] }
export interface BeltTestOverview { belts: BeltRow[]; syllabi: SyllabusRow[]; events: EventRow[] }
export interface SyllabusDetail { syllabus: SyllabusRow; sections: SectionRow[]; items: ItemRow[] }
/**
 * One test day. `scores` holds every examiner's rows for a head coach or admin,
 * and only the viewer's own rows for other examiners. `panel` lists the assigned
 * examiners (empty = any coach may score); `examiners` names panel members and scorers.
 */
export interface EventDetail extends SyllabusDetail { event: EventRow; targetBelt: string; candidates: CandidateRow[]; scores: ScoreRow[]; examiners: Record<string, string>;
  panel: string[]; viewer: { userId: string; manages: boolean } }
