import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaller, validateRequestBody } from '@/lib/backend-security';
import { operationsError } from '@/lib/operations-errors';

export const dynamic = 'force-dynamic';
// action:student_edit is required by verifyCaller and again in public.portal_set_ranking_opt_out.
const roles = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];
const schema = z.object({ studentId: z.string().regex(/^STU-[MF]-[0-9]+$/), optOut: z.boolean() }).strict();

/** Hide or show a student on the student portal's public leaderboards. */
export async function POST(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const { data, errorResponse: invalid } = await validateRequestBody(schema, req);
    if (invalid || !data) return invalid!;
    const result = await adminSupabase.rpc('portal_set_ranking_opt_out', { p_actor: context.userId, p_student: data.studentId, p_opt_out: data.optOut }).abortSignal(AbortSignal.timeout(15000));
    if (result.error) throw result.error;
    return NextResponse.json({ success: true, data: result.data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return operationsError(error); }
}
