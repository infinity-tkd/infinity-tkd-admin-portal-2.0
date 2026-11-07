import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { callerHasPermission, formatServerErrorResponse, validateRequestBody, verifyCaller } from '@/lib/backend-security';
import { workoutStructureSchema } from '@/lib/workout-structure';

const roles = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];
const adminRoles = new Set(['Root', 'Super Root', 'Admin', 'Head Coach']);
const common = {
  studentId: z.string().trim().min(1).max(50),
  expectedActivePlanId: z.string().uuid().nullable(),
  reason: z.string().trim().min(5).max(500),
  requestKey: z.string().uuid(),
};
const schema = z.discriminatedUnion('action', [
  z.object({ ...common, action: z.literal('ASSIGN'), templateId: z.string().uuid() }).strict(),
  z.object({ ...common, action: z.literal('WITHDRAW') }).strict(),
]);
const headers = { 'Cache-Control': 'no-store' };
const fail = (message: string, status: number) => NextResponse.json({ success: false, error: { message } }, { status, headers });

async function studentAccess(client: SupabaseClient, userId: string, role: string, studentId: string) {
  const student = await client.from('students').select('id').eq('id', studentId).is('deleted_at', null).maybeSingle();
  if (student.error) throw student.error;
  if (!student.data) return false;
  if (adminRoles.has(role)) return true;
  const enrollments = await client.from('class_enrollments').select('class_id').eq('student_id', studentId).limit(200);
  if (enrollments.error) throw enrollments.error;
  const ids = (enrollments.data ?? []).map(row => row.class_id);
  if (!ids.length) return false;
  const classes = await client.from('class_sessions').select('id').in('id', ids).or(`coach_id.eq.${userId},head_coach_id.eq.${userId}`).limit(1);
  if (classes.error) throw classes.error;
  return Boolean(classes.data?.length);
}

export async function GET(req: Request) {
  try {
    const { context, adminSupabase: client, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !client) return errorResponse!;
    const params = new URL(req.url).searchParams;
    const studentId = params.get('studentId') ?? '', search = params.get('search') ?? '';
    if (!studentId || studentId.length > 50 || search.length > 100 || [...params.keys()].some(key => !['studentId', 'search'].includes(key) || params.getAll(key).length !== 1)) return fail('Review the student or template search.', 422);
    if (!await callerHasPermission(client, context, 'page:lms') || !await studentAccess(client, context.userId, context.role, studentId)) return fail('This student is not available for training review.', 403);
    let templates = client.from('workout_templates').select('id,title,duration_mins,structure').order('title').order('id').limit(50);
    if (search) templates = templates.ilike('title', `%${search.replace(/[\\%_]/g, '\\$&')}%`);
    const [plans, catalog] = await Promise.all([
      client.from('student_training_plans').select('id,template_id,customized_structure,is_active,created_at,ended_at,end_reason,workout_templates:template_id(title)').eq('student_id', studentId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50),
      templates,
    ]);
    if (plans.error) throw plans.error;
    if (catalog.error) throw catalog.error;
    return NextResponse.json({ success: true, data: {
      studentId,
      plans: (plans.data ?? []).map(row => ({ id: row.id, templateId: row.template_id, title: row.customized_structure?.templateSnapshot?.title ?? (row.workout_templates as unknown as { title?: string })?.title ?? 'Retained training plan', active: row.is_active === true, createdAt: row.created_at, endedAt: row.ended_at, endReason: row.end_reason })),
      templates: (catalog.data ?? []).map(row => ({ id: row.id, title: row.title, durationMins: row.duration_mins, assignable: workoutStructureSchema.safeParse(row.structure).success })),
      hasMorePlans: plans.data?.length === 50, hasMoreTemplates: catalog.data?.length === 50,
      canManage: await callerHasPermission(client, context, 'action:evaluations_grade'),
    } }, { headers });
  } catch (error) { return formatServerErrorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const { context, adminSupabase: client, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !client) return errorResponse!;
    const { data, errorResponse: invalid } = await validateRequestBody(schema, req);
    if (invalid || !data) return invalid!;
    if (!await callerHasPermission(client, context, 'action:evaluations_grade') || !await studentAccess(client, context.userId, context.role, data.studentId)) return fail('You cannot change this student’s training assignment.', 403);
    const result = await client.rpc('portal_assign_training_plan', {
      p_actor: context.userId, p_student: data.studentId, p_action: data.action,
      p_template: data.action === 'ASSIGN' ? data.templateId : null,
      p_expected_plan: data.expectedActivePlanId, p_reason: data.reason, p_request_key: data.requestKey,
    });
    if (result.error) return formatServerErrorResponse(result.error);
    if (result.data?.saved !== true) throw new Error('The training assignment could not be confirmed. Refresh before retrying.');
    return NextResponse.json({ success: true, data: result.data }, { headers });
  } catch (error) { return formatServerErrorResponse(error); }
}
