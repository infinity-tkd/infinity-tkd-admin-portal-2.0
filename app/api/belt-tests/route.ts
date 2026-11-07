import { NextResponse } from 'next/server';
import { verifyCaller, validateRequestBody } from '@/lib/backend-security';
import { beltTestRequestSchema, beltTestViewSchema } from '@/lib/belt-test-contract';
import { readBeltTests } from '@/lib/belt-tests-read';
import { operationsError } from '@/lib/operations-errors';

export const dynamic = 'force-dynamic';
// Grading permission is checked by verifyCaller; head coach/admin-only actions are enforced in SQL.
const roles = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' };
const statuses: Record<string, number> = { '22023': 422, '40001': 409, '23505': 409, '42501': 403, P0002: 404 };
/** portal_belt_tests_mutate raises user-facing messages for these codes; anything else uses the shared handler. */
function beltTestError(error: unknown) {
  const issue = error as { code?: string; message?: string };
  if (issue?.code && statuses[issue.code] && typeof issue.message === 'string' && issue.message.length <= 300) {
    return NextResponse.json({ success: false, error: { code: issue.code, message: issue.message } }, { status: statuses[issue.code], headers });
  }
  return operationsError(error);
}

export async function GET(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const params = new URL(req.url).searchParams;
    const view = beltTestViewSchema.safeParse(Object.fromEntries(params));
    if (!view.success || [...params.keys()].some(key => params.getAll(key).length !== 1)) {
      return NextResponse.json({ success: false, error: { message: 'Choose a belt test view.' } }, { status: 422, headers });
    }
    const data = await readBeltTests(adminSupabase, view.data);
    return NextResponse.json({ success: true, data }, { headers });
  } catch (error) { return beltTestError(error); }
}

export async function POST(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const { data, errorResponse: invalid } = await validateRequestBody(beltTestRequestSchema, req);
    if (invalid || !data) return invalid!;
    const { action, requestKey, ...payload } = data;
    const result = await adminSupabase.rpc('portal_belt_tests_mutate', { p_actor: context.userId, p_action: action, p_data: payload, p_request_key: requestKey }).abortSignal(AbortSignal.timeout(20000));
    if (result.error) throw result.error;
    return NextResponse.json({ success: true, data: result.data }, { headers });
  } catch (error) { return beltTestError(error); }
}
