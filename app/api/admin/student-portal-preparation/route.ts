import { NextResponse } from 'next/server';
import { callerHasPermission, validateRequestBody, verifyCaller } from '@/lib/backend-security';
import { studentPortalAdminSchema } from '@/lib/student-portal-admin-contract';
import { confirmationRoles, preparationRoles, readStudentLessonConfirmations, readStudentPortalPreparation, studentPortalAdminError, validateLessonPolicyContract } from '@/lib/student-portal-admin-server';

export const runtime = 'nodejs';
const denied = () => NextResponse.json({ success: false, error: { message: 'You do not have permission to use this preparation workflow.' } }, { status: 403, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, confirmationRoles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    if (!await callerHasPermission(adminSupabase, context, 'page:lms')) return denied();
    const query = new URL(req.url).searchParams;
    const view = query.get('view') ?? 'overview';
    let data;
    if (view === 'overview') {
      if (!preparationRoles.includes(context.role)) return denied();
      data = await readStudentPortalPreparation(adminSupabase);
    } else if (view === 'confirmations' && /^STU-[MF]-[0-9]+$/.test(query.get('studentId') ?? '')) {
      data = await readStudentLessonConfirmations(adminSupabase, query.get('studentId')!);
    } else return NextResponse.json({ success: false, error: { message: 'Choose a valid preparation view and student.' } }, { status: 422, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return studentPortalAdminError(error); }
}

export async function POST(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, confirmationRoles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    if (!await callerHasPermission(adminSupabase, context, 'page:lms') || !await callerHasPermission(adminSupabase, context, 'action:evaluations_grade')) return denied();
    const { data, errorResponse: invalid } = await validateRequestBody(studentPortalAdminSchema, req);
    if (invalid || !data) return invalid!;
    if (['save_draft', 'archive_draft'].includes(data.action) && !preparationRoles.includes(context.role)) return denied();
    if (data.action === 'confirm_lesson') await validateLessonPolicyContract(adminSupabase, data.policyId);
    const { action, requestKey, ...payload } = data;
    const result = await adminSupabase.rpc('portal_student_publication_admin', { p_actor: context.userId, p_action: action, p_data: payload, p_request_key: requestKey }).abortSignal(AbortSignal.timeout(20000));
    if (result.error) throw result.error;
    if (!result.data?.id) throw new Error('Preparation save was not confirmed.');
    return NextResponse.json({ success: true, data: result.data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return studentPortalAdminError(error); }
}
