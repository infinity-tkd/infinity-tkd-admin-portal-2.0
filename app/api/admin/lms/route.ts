import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyCaller, validateRequestBody } from '@/lib/backend-security';
import { operationsError } from '@/lib/operations-errors';
import { lmsRequestSchema, type LmsRequest } from '@/lib/lms-contract';
import { lmsErrorResponse } from '@/lib/lms-server';

export const dynamic = 'force-dynamic';
// Reads need page:lms; changes need action:curriculum_edit (Coaches and above), checked again in SQL.
const roles = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' };
const fail = (message: string, status = 422) => NextResponse.json({ success: false, error: { message } }, { status, headers });
// Code deployed before the LMS migrations: say so instead of showing a database error.
const lmsError = (error: unknown) => lmsErrorResponse(error, operationsError);
const VIEWS = ['overview', 'review', 'forms', 'quiz', 'assignments', 'assignment', 'challenges', 'achievements', 'student', 'attention', 'consents'] as const;
type View = typeof VIEWS[number];

async function rows<T = Record<string, any>>(query: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const result = await query;
  if (result.error) throw result.error;
  return result.data ?? [];
}

async function read(client: SupabaseClient, view: View, params: URLSearchParams) {
  switch (view) {
    case 'overview': {
      // Pickers for every editor, plus the counts shown on the tabs.
      const [students, lessons, belts, classes, branches, categories, forms, achievements, academy, submissions, ready] = await Promise.all([
        rows(client.from('students').select('id,english_name,current_belt,student_status,home_branch_id').is('deleted_at', null).in('student_status', ['Active', 'Paused']).order('english_name').limit(2000)),
        rows(client.from('curriculum').select('id,title,target_belt,category,content_type').eq('is_active', true).order('title').limit(2000)),
        rows(client.from('belts').select('id,belt_name,belt_order').order('belt_order').limit(100)),
        rows(client.from('class_sessions').select('id,class_name,branch_id').order('class_name').limit(500)),
        rows(client.from('branches').select('id,branch_name').order('id').limit(100)),
        rows(client.from('library_categories').select('slug,title').order('sort_order').limit(500)),
        rows(client.from('poomsae_forms').select('id,name,curriculum_id,published,movement_count').order('sort_order').limit(500)),
        rows(client.from('achievement_definitions').select('code,title,repeats,active,rule').order('sort_order').limit(500)),
        client.from('academy_profile').select('student_lms_push_enabled').eq('id', 'default').maybeSingle(),
        client.from('student_submissions').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
        client.from('student_form_progress').select('student_id', { count: 'exact', head: true }).eq('status', 'ready_for_review'),
      ]);
      for (const result of [academy, submissions, ready]) if (result.error) throw result.error;
      return { students, lessons, belts, classes, branches, categories, forms, achievements, studentLmsPushEnabled: academy.data?.student_lms_push_enabled === true,
        waiting: { submissions: submissions.count ?? 0, forms: ready.count ?? 0 } };
    }
    case 'review': {
      const [submissions, forms] = await Promise.all([
        rows(client.from('student_submissions').select('id,student_id,assignment_id,subject_type,subject_ref,kind,text_answer,video_seconds,status,submitted_at,video_path,students(english_name,current_belt),assignments(title,rubric)')
          .in('status', ['submitted', 'returned', 'reviewed']).order('submitted_at', { ascending: false }).limit(200)),
        rows(client.from('student_form_progress').select('student_id,form_id,status,practice_count,best_quiz_percent,review_requested_at,reviewed_at,review_note,students(english_name,current_belt),poomsae_forms(name)')
          .in('status', ['ready_for_review', 'practising', 'mastered']).order('review_requested_at', { ascending: false, nullsFirst: false }).limit(300)),
      ]);
      const ids = submissions.map(s => s.id);
      const reviews = ids.length ? await rows(client.from('submission_reviews').select('id,submission_id,decision,grade,rubric,feedback,moments,visible_to_student,created_at,profiles(display_name)').in('submission_id', ids).order('created_at')) : [];
      return { submissions: submissions.map(({ video_path, ...s }) => ({ ...s, hasVideo: Boolean(video_path), reviews: reviews.filter(r => r.submission_id === s.id) })), forms };
    }
    case 'forms': {
      const [forms, questions] = await Promise.all([
        rows(client.from('poomsae_forms').select('*').order('sort_order').limit(500)),
        rows(client.from('quiz_questions').select('scope,scope_ref,published').limit(5000)),
      ]);
      const counts = new Map<string, number>();
      for (const q of questions) counts.set(`${q.scope}:${q.scope_ref}`, (counts.get(`${q.scope}:${q.scope_ref}`) ?? 0) + 1);
      return { forms, questionCounts: Object.fromEntries(counts) };
    }
    case 'quiz': {
      const scope = params.get('scope') ?? '', ref = params.get('ref') ?? '';
      if (!['form', 'lesson', 'belt', 'terminology'].includes(scope) || !ref || ref.length > 80) throw Object.assign(new Error('Choose a quiz.'), { code: '22023' });
      return { questions: await rows(client.from('quiz_questions').select('*').eq('scope', scope).eq('scope_ref', ref).order('sort_order').limit(200)) };
    }
    case 'assignments': {
      const [assignments, statuses] = await Promise.all([
        rows(client.from('assignments').select('*,assignment_targets(target_type,target_ref)').order('created_at', { ascending: false }).limit(300)),
        rows(client.from('student_assignments').select('assignment_id,status').limit(20000)),
      ]);
      const tally = new Map<string, Record<string, number>>();
      for (const s of statuses) { const t = tally.get(s.assignment_id) ?? {}; t[s.status] = (t[s.status] ?? 0) + 1; tally.set(s.assignment_id, t); }
      return { assignments: assignments.map(a => ({ ...a, statusCounts: tally.get(a.id) ?? {} })) };
    }
    case 'assignment': {
      const id = params.get('id') ?? '';
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw Object.assign(new Error('Choose an assignment.'), { code: '22023' });
      return { students: await rows(client.from('student_assignments').select('student_id,status,progress,done_at,note,students(english_name,current_belt)').eq('assignment_id', id).order('student_id').limit(2000)) };
    }
    case 'challenges': {
      const [challenges, progress] = await Promise.all([
        rows(client.from('challenges').select('*').order('starts_on', { ascending: false }).limit(300)),
        rows(client.from('student_challenge_progress').select('challenge_id,completed_at').limit(20000)),
      ]);
      const tally = new Map<string, { joined: number; completed: number }>();
      for (const p of progress) { const t = tally.get(p.challenge_id) ?? { joined: 0, completed: 0 }; t.joined++; if (p.completed_at) t.completed++; tally.set(p.challenge_id, t); }
      return { challenges: challenges.map(c => ({ ...c, tally: tally.get(c.id) ?? { joined: 0, completed: 0 } })) };
    }
    case 'achievements': {
      const [definitions, awards] = await Promise.all([
        rows(client.from('achievement_definitions').select('*').order('sort_order').limit(500)),
        rows(client.from('student_achievements').select('student_id,code,period,earned_at,awarded_by,students(english_name)').order('earned_at', { ascending: false }).limit(200)),
      ]);
      return { definitions, awards };
    }
    case 'student': {
      const id = params.get('id') ?? '';
      if (!/^[A-Za-z0-9-]{1,40}$/.test(id)) throw Object.assign(new Error('Choose a student.'), { code: '22023' });
      const [goals, plans, forms, assignments, achievements, points, consent] = await Promise.all([
        rows(client.from('student_goals').select('*').eq('student_id', id).order('created_at', { ascending: false }).limit(100)),
        rows(client.from('student_learning_plans').select('*').eq('student_id', id).order('week_start', { ascending: false }).limit(12)),
        rows(client.from('student_form_progress').select('*,poomsae_forms(name)').eq('student_id', id).limit(200)),
        rows(client.from('student_assignments').select('assignment_id,status,progress,done_at,assignments(title,kind,due_at,status)').eq('student_id', id).limit(300)),
        rows(client.from('student_achievements').select('code,period,earned_at,awarded_by').eq('student_id', id).order('earned_at', { ascending: false }).limit(200)),
        rows(client.from('student_points').select('delta').eq('student_id', id).limit(20000)),
        client.from('student_video_consents').select('*').eq('student_id', id).maybeSingle(),
      ]);
      if (consent.error) throw consent.error;
      return { goals, plans, forms, assignments, achievements, points: points.reduce((sum, p) => sum + Number(p.delta), 0), consent: consent.data };
    }
    case 'attention':
      return { items: await rows(client.from('coach_attention_items').select('*').order('last_at', { ascending: false }).limit(500)) };
    case 'consents':
      return { consents: await rows(client.from('student_video_consents').select('*,students(english_name)').order('consented_at', { ascending: false }).limit(1000)) };
  }
}

/** LMS coaching data for one tab of the Coaching hub. */
export async function GET(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const params = new URL(req.url).searchParams;
    const view = params.get('view') as View;
    if (!VIEWS.includes(view)) return fail('Choose a coaching view.');
    return NextResponse.json({ success: true, data: await read(adminSupabase, view, params) }, { headers });
  } catch (error) { return lmsError(error); }
}

function rpcFor(actor: string, data: LmsRequest): [string, Record<string, unknown>] {
  const withRevision = <T extends object>(payload: T, expectedRevision?: number) => expectedRevision ? { ...payload, expectedRevision } : payload;
  switch (data.action) {
    case 'form.save': return ['portal_save_poomsae_form', { p_actor: actor, p_action: data.id ? 'UPDATE' : 'CREATE', p_id: data.id ?? null, p_payload: withRevision(data.form, data.expectedRevision) }];
    case 'form.delete': return ['portal_save_poomsae_form', { p_actor: actor, p_action: 'DELETE', p_id: data.id, p_payload: { expectedRevision: data.expectedRevision } }];
    case 'form.reorder': return ['portal_save_poomsae_form', { p_actor: actor, p_action: 'REORDER', p_id: null, p_payload: { order: data.order } }];
    case 'quiz.save': return ['portal_save_quiz_question', { p_actor: actor, p_action: data.id ? 'UPDATE' : 'CREATE', p_id: data.id ?? null, p_payload: withRevision(data.question, data.expectedRevision) }];
    case 'quiz.delete': return ['portal_save_quiz_question', { p_actor: actor, p_action: 'DELETE', p_id: data.id, p_payload: { expectedRevision: data.expectedRevision } }];
    case 'plan.save': return ['portal_save_learning_plan', { p_actor: actor, p_action: 'SAVE', p_student: data.studentId, p_week: data.weekStart, p_payload: withRevision({ items: data.items, note: data.note }, data.expectedRevision) }];
    case 'plan.publish': case 'plan.unpublish': case 'plan.delete':
      return ['portal_save_learning_plan', { p_actor: actor, p_action: data.action.split('.')[1].toUpperCase(), p_student: data.studentId, p_week: data.weekStart, p_payload: { expectedRevision: data.expectedRevision } }];
    case 'goal.set': return ['portal_save_student_goal', { p_actor: actor, p_action: 'SET', p_student: data.studentId, p_payload: data.goal }];
    case 'goal.done': case 'goal.drop': return ['portal_save_student_goal', { p_actor: actor, p_action: data.action === 'goal.done' ? 'DONE' : 'DROP', p_student: data.studentId, p_payload: { goalId: data.goalId } }];
    case 'assignment.save': return ['portal_save_assignment', { p_actor: actor, p_action: data.id ? 'UPDATE' : 'CREATE', p_id: data.id ?? null, p_payload: withRevision(data.assignment, data.expectedRevision) }];
    case 'assignment.publish': case 'assignment.close': case 'assignment.reopen': case 'assignment.delete':
      return ['portal_save_assignment', { p_actor: actor, p_action: data.action.split('.')[1].toUpperCase(), p_id: data.id, p_payload: { expectedRevision: data.expectedRevision } }];
    case 'assignment.student': return ['portal_set_student_assignment', { p_actor: actor, p_assignment: data.id, p_student: data.studentId, p_payload: { status: data.status, note: data.note } }];
    case 'challenge.save': return ['portal_save_challenge', { p_actor: actor, p_action: data.id ? 'UPDATE' : 'CREATE', p_id: data.id ?? null, p_payload: withRevision(data.challenge, data.expectedRevision) }];
    case 'challenge.publish': case 'challenge.close': case 'challenge.delete':
      return ['portal_save_challenge', { p_actor: actor, p_action: data.action.split('.')[1].toUpperCase(), p_id: data.id, p_payload: { expectedRevision: data.expectedRevision } }];
    case 'submission.review': return ['portal_review_submission', { p_actor: actor, p_submission: data.id, p_payload: data.review }];
    case 'form.review': return ['portal_review_form', { p_actor: actor, p_student: data.studentId, p_form: data.formId, p_payload: data.review }];
    case 'achievement.save': return ['portal_save_achievement_definition', { p_actor: actor, p_action: data.create ? 'CREATE' : 'UPDATE', p_code: data.code, p_payload: withRevision(data.definition, data.expectedRevision) }];
    case 'achievement.delete': return ['portal_save_achievement_definition', { p_actor: actor, p_action: 'DELETE', p_code: data.code, p_payload: { expectedRevision: data.expectedRevision } }];
    case 'achievement.award': case 'achievement.revoke':
      return ['portal_award_achievement', { p_actor: actor, p_action: data.action === 'achievement.award' ? 'AWARD' : 'REVOKE', p_student: data.studentId, p_payload: { code: data.code, period: data.period, note: data.note } }];
    case 'consent.record': return ['portal_record_video_consent', { p_actor: actor, p_student: data.studentId, p_payload: data.consent }];
    case 'announcement.send': case 'settings.push': throw Object.assign(new Error('Use the announcements or settings endpoint.'), { code: '22023' });
  }
}

export async function POST(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const { data, errorResponse: invalid } = await validateRequestBody(lmsRequestSchema, req);
    if (invalid || !data) return invalid!;
    if (data.action === 'announcement.send' || data.action === 'settings.push') return fail('Use the announcements or settings endpoint.');
    const [fn, args] = rpcFor(context.userId, data);
    const result = await adminSupabase.rpc(fn, args).abortSignal(AbortSignal.timeout(20000));
    // A new achievement whose code exists already: the only raw duplicate an LMS write can hit.
    if (result.error?.code === '23505' && data.action === 'achievement.save' && data.create) return fail(`The code "${data.code}" is already used. Choose another code.`, 409);
    if (result.error) throw result.error;
    return NextResponse.json({ success: true, data: result.data }, { headers });
  } catch (error) { return lmsError(error); }
}
