import { NextResponse } from 'next/server';
import { verifyCaller, callerHasPermission, validateRequestBody } from '@/lib/backend-security';
import { operationsSchema, operationPermission } from '@/lib/operations-contract';
import { operationsError } from '@/lib/operations-errors';
import { readOperations } from '@/lib/operations-read';

const roles = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];
const deny = () => NextResponse.json({ success: false, error: { message: 'You do not have permission to access this operation.' } }, { status: 403 });
export async function GET(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const data = await readOperations(adminSupabase, context, new URL(req.url).searchParams);
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return operationsError(error); }
}
export async function POST(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const { data, errorResponse: invalid } = await validateRequestBody(operationsSchema, req);
    if (invalid || !data) return invalid!;
    if (!await callerHasPermission(adminSupabase, context, operationPermission(data.action))) return deny();
    const { action, requestKey, ...payload } = data;
    const result = await adminSupabase.rpc('portal_operations_mutate', { p_actor: context.userId, p_action: action, p_data: payload, p_request_key: requestKey }).abortSignal(AbortSignal.timeout(20000));
    if (result.error) throw result.error;
    return NextResponse.json({ success: true, data: result.data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return operationsError(error); }
}
