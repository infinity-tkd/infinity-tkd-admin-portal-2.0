import { z } from 'zod';

/**
 * LMS contracts (docs/STUDENT_PORTAL_LMS_DESIGN_2026-11-12.md, docs/STUDENT_PORTAL_LMS_HANDOFF.md).
 * Staff requests are strict (they come from this portal); the student feeds are
 * parsed without .strict(), so a later field never breaks a reader.
 */
export const COACH_GRADES = ['Needs Work', 'Developing', 'Proficient', 'Outstanding'] as const;
export const STUDENT_NOTICE_CATEGORIES = ['events', 'class_reminder', 'exam_reminder', 'assignment_due', 'practice_reminder', 'streak_reminder',
  'new_material', 'feedback', 'missed_class', 'achievement', 'announcement'] as const;
export const LMS_ACTIVITY_KINDS = ['step_check', 'self_assessment', 'quiz_attempt', 'form_practice', 'form_ready', 'assignment_progress', 'goal'] as const;
export const QUIZ_SCOPES = ['form', 'lesson', 'belt', 'terminology'] as const;
export const QUIZ_KINDS = ['next_movement', 'direction', 'stance', 'term', 'choice'] as const;
export const ASSIGNMENT_KINDS = ['practice', 'video', 'written', 'quiz', 'form'] as const;
export const CHALLENGE_GOALS = ['reps', 'sessions', 'streak_days', 'minutes', 'quiz_pass', 'form_mastered'] as const;
export const ACHIEVEMENT_RULES = ['lessons_completed', 'streak_days', 'forms_mastered', 'category_completed', 'sessions_total', 'attendance_month', 'quiz_passed', 'challenges_completed', 'manual'] as const;
export const ACHIEVEMENT_ICONS = ['BookOpen', 'Lightning', 'Fire', 'Shield', 'Stack', 'Sparkle', 'Medal', 'Scroll', 'Target', 'Barbell', 'MusicNotes', 'Hand', 'Footprints', 'Brain', 'Users', 'Star'] as const;

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1).max(max);
const revision = z.number().int().positive();
const studentId = z.string().regex(/^[A-Za-z0-9-]{1,40}$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-16');
const lessonRef = z.string().regex(/^\d{1,9}$/);
const translation = <T extends z.ZodRawShape>(shape: T) => z.object({ km: z.object(shape).partial().strict().optional(), zh: z.object(shape).partial().strict().optional() }).strict().default({});

// ---------------------------------------------------------------------------
// Staff requests (POST /api/admin/lms) — every one is checked again in SQL.
// ---------------------------------------------------------------------------
export const poomsaeFormInput = z.object({
  curriculumId: z.number().int().positive(), name: required(120), koreanName: text(120).nullable().optional(), series: required(60),
  beltId: z.number().int().positive().nullable(), movementCount: z.number().int().min(1).max(200), published: z.boolean(),
  translations: translation({ name: text(120) }),
}).strict();

export const quizQuestionInput = z.object({
  scope: z.enum(QUIZ_SCOPES), scopeRef: required(80), kind: z.enum(QUIZ_KINDS), prompt: required(500),
  choices: z.array(required(200)).min(2).max(8), answer: z.union([z.number().int().min(0), z.array(z.number().int().min(0)).min(2).max(8)]),
  explanation: text(1000).nullable().optional(), published: z.boolean(),
  translations: translation({ prompt: text(500), choices: z.array(text(200)).max(8), explanation: text(1000) }),
}).strict().superRefine((value, ctx) => {
  const n = value.choices.length;
  if (typeof value.answer === 'number' ? value.answer >= n : value.answer.length !== n || new Set(value.answer).size !== n || value.answer.some(i => i >= n))
    ctx.addIssue({ code: 'custom', path: ['answer'], message: typeof value.answer === 'number' ? 'Mark the right answer.' : 'Give the right order using every choice once.' });
});

export const planItemInput = z.object({
  type: z.enum(['lesson', 'form', 'quiz', 'custom']), ref: text(80).optional(), title: text(120).optional(), target: text(60).optional(),
  day: z.number().int().min(1).max(7).nullable().optional(), note: text(200).optional(),
}).strict().superRefine((item, ctx) => {
  if (item.type === 'lesson' && !lessonRef.safeParse(item.ref ?? '').success) ctx.addIssue({ code: 'custom', path: ['ref'], message: 'Choose a lesson.' });
  if (item.type === 'form' && !uuid.safeParse(item.ref ?? '').success) ctx.addIssue({ code: 'custom', path: ['ref'], message: 'Choose a form.' });
  if (item.type === 'custom' && !item.title?.trim()) ctx.addIssue({ code: 'custom', path: ['title'], message: 'Give the item a title.' });
});

export const goalInput = z.object({
  kind: z.enum(['weekly_days', 'weekly_minutes', 'lesson', 'form', 'belt_exam', 'custom']), target: z.number().int().min(1).max(100000).nullable().optional(),
  subjectRef: text(80).nullable().optional(), title: text(200).nullable().optional(), endsOn: date.nullable().optional(),
}).strict();

const assignmentTarget = z.object({ type: z.enum(['student', 'class', 'belt', 'branch', 'all']), ref: text(80) }).strict()
  .refine(t => (t.type === 'all') === (t.ref === ''), 'Everyone needs no reference; other targets need one.');
export const assignmentInput = z.object({
  title: required(160), instructions: required(4000), kind: z.enum(ASSIGNMENT_KINDS),
  subjectType: z.enum(['lesson', 'form']).nullable(), subjectRef: text(80).nullable(),
  target: z.object({ reps: z.number().int().min(1).max(100000).optional(), sessions: z.number().int().min(1).max(100).optional(),
    scope: z.enum(QUIZ_SCOPES).optional(), scopeRef: text(80).optional(), passPercent: z.number().int().min(1).max(100).optional() }).strict(),
  dueAt: z.string().datetime({ offset: true }).nullable(), points: z.number().int().min(0).max(1000),
  rubric: z.array(z.object({ item: required(120) }).strict()).max(20), targets: z.array(assignmentTarget).min(1).max(100),
  translations: translation({ title: text(160), instructions: text(4000) }),
}).strict().superRefine((value, ctx) => {
  if ((value.subjectType === null) !== (value.subjectRef === null)) ctx.addIssue({ code: 'custom', path: ['subjectRef'], message: 'Choose the lesson or form.' });
  if (value.kind === 'practice' && !value.target.reps && !value.target.sessions) ctx.addIssue({ code: 'custom', path: ['target'], message: 'Set the reps or sessions to reach.' });
  if (value.kind === 'quiz' && (!value.target.scope || !value.target.scopeRef)) ctx.addIssue({ code: 'custom', path: ['target'], message: 'Choose the quiz.' });
  if (value.kind === 'form' && value.subjectType !== 'form') ctx.addIssue({ code: 'custom', path: ['subjectType'], message: 'Choose the form to perform.' });
});

const audience = z.object({ all: z.literal(true).optional(), belts: z.array(text(60)).max(30).optional(), branches: z.array(text(9)).max(30).optional(),
  classes: z.array(text(9)).max(100).optional(), students: z.array(studentId).max(500).optional() }).strict()
  .refine(a => a.all || [a.belts, a.branches, a.classes, a.students].some(list => list && list.length), 'Choose who takes part.');
export type LmsAudience = z.infer<typeof audience>;
export const audienceInput = audience;

export const challengeInput = z.object({
  title: required(160), description: text(2000).nullable(), goalKind: z.enum(CHALLENGE_GOALS), goalTarget: z.number().int().min(1).max(100000),
  subjectType: z.enum(['lesson', 'form', 'quiz']).nullable(), subjectRef: text(120).nullable(), startsOn: date, endsOn: date, audience,
  points: z.number().int().min(0).max(1000), badgeCode: z.string().regex(/^[a-z][a-z0-9_]{1,59}$/).nullable(),
  translations: translation({ title: text(160), description: text(2000) }),
}).strict().superRefine((value, ctx) => {
  if (value.endsOn < value.startsOn) ctx.addIssue({ code: 'custom', path: ['endsOn'], message: 'End on or after the start.' });
  if ((value.subjectType === null) !== (value.subjectRef === null)) ctx.addIssue({ code: 'custom', path: ['subjectRef'], message: 'Choose the subject.' });
});

export const submissionReviewInput = z.object({
  decision: z.enum(['accepted', 'returned']), grade: z.enum(COACH_GRADES).nullable(), feedback: text(4000).nullable(),
  rubric: z.array(z.object({ item: required(120), grade: z.enum(COACH_GRADES).nullable(), note: text(500) }).strict()).max(20),
  moments: z.array(z.object({ second: z.number().min(0).max(600), note: required(500) }).strict()).max(50), visibleToStudent: z.boolean(),
}).strict();

export const formReviewInput = z.object({ decision: z.enum(['mastered', 'practising', 'learning']), note: text(1000).nullable() }).strict();

export const achievementDefinitionInput = z.object({
  title: required(120), description: required(500), icon: z.enum(ACHIEVEMENT_ICONS),
  rule: z.object({ kind: z.enum(ACHIEVEMENT_RULES), min: z.number().int().min(1).max(100000).optional(), percent: z.number().int().min(1).max(100).optional(),
    categories: z.array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)).min(1).max(20).optional() }).strict()
    .refine(r => r.kind !== 'category_completed' || Boolean(r.categories?.length), 'Choose the library categories.'),
  points: z.number().int().min(0).max(1000), repeats: z.enum(['once', 'monthly', 'per_belt']), active: z.boolean(),
  translations: translation({ title: text(120), description: text(500) }),
}).strict().refine(d => d.rule.kind !== 'attendance_month' || d.repeats === 'monthly', 'Perfect attendance repeats monthly.');

export const announcementInput = z.object({ title: required(160), body: required(2000), audience, translations: translation({ title: text(160), body: text(2000) }) }).strict();
export const consentInput = z.union([
  z.object({ guardianName: z.string().trim().min(2).max(120), relationship: z.enum(['parent', 'guardian', 'self']) }).strict(),
  z.object({ revoke: z.literal(true) }).strict(),
]);

export const lmsRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('form.save'), id: uuid.optional(), expectedRevision: revision.optional(), form: poomsaeFormInput }).strict(),
  z.object({ action: z.literal('form.delete'), id: uuid, expectedRevision: revision }).strict(),
  z.object({ action: z.literal('form.reorder'), order: z.array(uuid).min(1).max(500) }).strict(),
  z.object({ action: z.literal('quiz.save'), id: uuid.optional(), expectedRevision: revision.optional(), question: quizQuestionInput }).strict(),
  z.object({ action: z.literal('quiz.delete'), id: uuid, expectedRevision: revision }).strict(),
  z.object({ action: z.literal('plan.save'), studentId, weekStart: date, expectedRevision: revision.optional(), items: z.array(planItemInput).max(30), note: text(1000).nullable() }).strict(),
  z.object({ action: z.enum(['plan.publish', 'plan.unpublish', 'plan.delete']), studentId, weekStart: date, expectedRevision: revision }).strict(),
  z.object({ action: z.literal('goal.set'), studentId, goal: goalInput }).strict(),
  z.object({ action: z.enum(['goal.done', 'goal.drop']), studentId, goalId: uuid }).strict(),
  z.object({ action: z.literal('assignment.save'), id: uuid.optional(), expectedRevision: revision.optional(), assignment: assignmentInput }).strict(),
  z.object({ action: z.enum(['assignment.publish', 'assignment.close', 'assignment.reopen', 'assignment.delete']), id: uuid, expectedRevision: revision }).strict(),
  z.object({ action: z.literal('assignment.student'), id: uuid, studentId, status: z.enum(['done', 'excused', 'open']), note: text(500).nullable() }).strict(),
  z.object({ action: z.literal('challenge.save'), id: uuid.optional(), expectedRevision: revision.optional(), challenge: challengeInput }).strict(),
  z.object({ action: z.enum(['challenge.publish', 'challenge.close', 'challenge.delete']), id: uuid, expectedRevision: revision }).strict(),
  z.object({ action: z.literal('submission.review'), id: uuid, review: submissionReviewInput }).strict(),
  z.object({ action: z.literal('form.review'), studentId, formId: uuid, review: formReviewInput }).strict(),
  z.object({ action: z.literal('achievement.save'), code: z.string().regex(/^[a-z][a-z0-9_]{1,59}$/), create: z.boolean(), expectedRevision: revision.optional(), definition: achievementDefinitionInput }).strict(),
  z.object({ action: z.literal('achievement.delete'), code: z.string().regex(/^[a-z][a-z0-9_]{1,59}$/), expectedRevision: revision }).strict(),
  z.object({ action: z.enum(['achievement.award', 'achievement.revoke']), studentId, code: z.string().regex(/^[a-z][a-z0-9_]{1,59}$/), period: text(40).nullable(), note: text(500).nullable() }).strict(),
  z.object({ action: z.literal('consent.record'), studentId, consent: consentInput }).strict(),
  z.object({ action: z.literal('announcement.send'), requestKey: uuid, announcement: announcementInput }).strict(),
  z.object({ action: z.literal('settings.push'), studentLmsPushEnabled: z.boolean() }).strict(),
]);
export type LmsRequest = z.infer<typeof lmsRequestSchema>;

// ---------------------------------------------------------------------------
// Student feeds (server-only SQL functions the student portal calls)
// ---------------------------------------------------------------------------
const ts = z.string().min(10);
const nullableTs = ts.nullable();
const translations = z.record(z.string(), z.unknown()).default({});

export const formsV1 = z.object({
  contractVersion: z.literal('forms-v1'), studentId: z.string(), currentBelt: z.string(),
  forms: z.array(z.object({
    id: uuid, lessonId: z.number().int(), name: z.string(), koreanName: z.string().nullable(), series: z.string(), belt: z.string().nullable(), beltOrder: z.number().nullable(),
    isCurrentBelt: z.boolean(), movementCount: z.number().int(), sortOrder: z.number().int(), translations, quizQuestions: z.number().int(),
    progress: z.object({ status: z.enum(['learning', 'practising', 'ready_for_review', 'mastered']), practiceCount: z.number().int(), practiceSeconds: z.number().int(),
      bestQuizPercent: z.number().int().nullable(), lastPractisedAt: nullableTs, reviewRequestedAt: nullableTs, reviewedAt: nullableTs, reviewNote: z.string().nullable(), masteredAt: nullableTs }),
  })),
});

export const quizV1 = z.object({
  contractVersion: z.literal('quiz-v1'), studentId: z.string(), scope: z.enum(QUIZ_SCOPES), scopeRef: z.string(),
  questions: z.array(z.object({ id: uuid, kind: z.enum(QUIZ_KINDS), prompt: z.string(), choices: z.array(z.string()).min(2),
    answer: z.union([z.number().int(), z.array(z.number().int())]), explanation: z.string().nullable(), translations })).max(100),
});

export const learningStateV1 = z.object({
  contractVersion: z.literal('learning-state-v1'), studentId: z.string(), weekStart: z.string(),
  goals: z.array(z.object({ id: uuid, kind: z.string(), target: z.number().int().nullable(), subjectRef: z.string().nullable(), title: z.string().nullable(),
    setBy: z.enum(['student', 'coach']), startsOn: z.string(), endsOn: z.string().nullable(), status: z.enum(['active', 'done', 'dropped']), createdAt: ts })),
  plans: z.array(z.object({ id: uuid, weekStart: z.string(), items: z.array(z.record(z.string(), z.unknown())), note: z.string().nullable(), publishedAt: ts })),
  stepChecks: z.array(z.object({ lessonId: z.number().int(), stepId: z.string(), checked: z.array(z.number().int()), updatedAt: ts })),
  selfAssessments: z.array(z.object({ subjectType: z.enum(['lesson', 'step', 'form', 'movement']), subjectRef: z.string(), rating: z.number().int().min(1).max(4), note: z.string().nullable(), createdAt: ts })),
  quizBest: z.array(z.object({ scope: z.string(), scopeRef: z.string(), bestPercent: z.number().int(), attempts: z.number().int(), lastAt: ts })),
});

export const tasksV1 = z.object({
  contractVersion: z.literal('tasks-v1'), studentId: z.string(),
  assignments: z.array(z.object({ id: uuid, title: z.string(), instructions: z.string(), kind: z.enum(ASSIGNMENT_KINDS), subjectType: z.string().nullable(), subjectRef: z.string().nullable(),
    target: z.record(z.string(), z.unknown()), dueAt: nullableTs, points: z.number().int(), rubric: z.array(z.object({ item: z.string() })), translations,
    assignmentStatus: z.enum(['published', 'closed']), status: z.enum(['open', 'in_progress', 'submitted', 'reviewed', 'done', 'excused']), progress: z.record(z.string(), z.unknown()),
    assignedAt: ts, doneAt: nullableTs, lastSubmission: z.object({ id: uuid, kind: z.string(), status: z.string(), submittedAt: nullableTs }).nullable() })),
  challenges: z.array(z.object({ id: uuid, title: z.string(), description: z.string().nullable(), goalKind: z.enum(CHALLENGE_GOALS), goalTarget: z.number().int(),
    subjectType: z.string().nullable(), subjectRef: z.string().nullable(), startsOn: z.string(), endsOn: z.string(), points: z.number().int(), badgeCode: z.string().nullable(),
    translations, status: z.enum(['published', 'closed']), progress: z.number().int(), completedAt: nullableTs })),
});

export const submissionsV1 = z.object({
  contractVersion: z.literal('submissions-v1'), studentId: z.string(),
  consent: z.object({ consented: z.boolean(), guardianName: z.string(), relationship: z.string(), source: z.string(), consentedAt: ts }).nullable(),
  submissions: z.array(z.object({ id: uuid, assignmentId: uuid.nullable(), assignmentTitle: z.string().nullable(), subjectType: z.string().nullable(), subjectRef: z.string().nullable(),
    kind: z.enum(['video', 'text', 'practice']), textAnswer: z.string().nullable(), hasVideo: z.boolean(), videoSeconds: z.number().int().nullable(),
    status: z.enum(['submitted', 'reviewed', 'returned', 'withdrawn', 'expired']), createdAt: ts, submittedAt: nullableTs, reviewedAt: nullableTs, videoDeletesOn: z.string().nullable(),
    reviews: z.array(z.object({ id: uuid, decision: z.enum(['accepted', 'returned']), grade: z.enum(COACH_GRADES).nullable(), rubric: z.array(z.record(z.string(), z.unknown())),
      feedback: z.string().nullable(), moments: z.array(z.object({ second: z.number(), note: z.string() })), coach: z.string().nullable(), createdAt: ts })) })).max(100),
});

export const achievementsV1 = z.object({
  contractVersion: z.literal('achievements-v1'), studentId: z.string(),
  catalogue: z.array(z.object({ code: z.string(), title: z.string(), description: z.string(), icon: z.string(), points: z.number().int(), repeats: z.enum(['once', 'monthly', 'per_belt']),
    ruleKind: z.enum(ACHIEVEMENT_RULES), target: z.number().int().nullable(), translations })),
  earned: z.array(z.object({ code: z.string(), period: z.string(), earnedAt: ts, seenAt: nullableTs, signedOff: z.boolean() })),
  points: z.object({ total: z.number().int(), recent: z.array(z.object({ delta: z.number().int(), reason: z.string(), ref: z.string(), createdAt: ts })) }),
});

// ---------------------------------------------------------------------------
// Student activity payloads (student_portal_record_event p_kind / p_payload)
// ---------------------------------------------------------------------------
export const lmsActivityPayloads = {
  step_check: z.object({ lessonId: z.number().int().positive(), stepId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,59}$/), checked: z.array(z.number().int().min(0).max(49)).max(50) }),
  self_assessment: z.object({ subjectType: z.enum(['lesson', 'step', 'form', 'movement']), subjectRef: z.string().min(1).max(120), rating: z.number().int().min(1).max(4), note: z.string().max(500).optional() }),
  quiz_attempt: z.object({ scope: z.enum(QUIZ_SCOPES), scopeRef: z.string().min(1).max(80), score: z.number().int().min(0), total: z.number().int().min(1).max(200), missed: z.array(uuid).max(200).optional() }),
  form_practice: z.object({ formId: uuid, mode: z.enum(['guided', 'free']), movements: z.number().int().min(0).max(200).optional(), durationSeconds: z.number().int().min(0).max(7200).optional() }),
  form_ready: z.object({ formId: uuid }),
  assignment_progress: z.object({ assignmentId: uuid, reps: z.number().int().min(0).max(10000) }),
  goal: z.union([goalInput, z.object({ goalId: uuid, status: z.enum(['done', 'dropped']) })]),
} as const;
