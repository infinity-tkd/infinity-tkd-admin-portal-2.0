import { NextResponse } from 'next/server';
import { verifyCaller, validateRequestBody } from '@/lib/backend-security';
import { operationsError } from '@/lib/operations-errors';
import { lessonLayoutRequestSchema, lessonLayoutRows } from '@/lib/lesson-layout';

export const dynamic = 'force-dynamic';
// Reads need page:library; writes need action:curriculum_edit (checked again in SQL).
const roles = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' };

/** Each library lesson's position in its belt syllabus and its video length. */
export async function GET(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const signal = AbortSignal.timeout(15000);
    const [assets, lessons] = await Promise.all([
      adminSupabase.from('library_assets').select('id,title,library_type,target_level,student_curriculum_id').order('id').limit(2000).abortSignal(signal),
      adminSupabase.from('curriculum').select('id,title,is_active,sort_order,duration_seconds').order('id').limit(2000).abortSignal(signal),
    ]);
    if (assets.error) throw assets.error;
    if (lessons.error) throw lessons.error;
    return NextResponse.json({ success: true, data: { lessons: lessonLayoutRows(assets.data ?? [], lessons.data ?? []) } }, { headers });
  } catch (error) { return operationsError(error); }
}

export async function POST(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const { data, errorResponse: invalid } = await validateRequestBody(lessonLayoutRequestSchema, req);
    if (invalid || !data) return invalid!;
    const result = await adminSupabase.rpc('portal_set_lesson_layout', { p_actor: context.userId, p_lessons: data.lessons }).abortSignal(AbortSignal.timeout(20000));
    if (result.error) throw result.error;
    return NextResponse.json({ success: true, data: result.data }, { headers });
  } catch (error) { return operationsError(error); }
}
