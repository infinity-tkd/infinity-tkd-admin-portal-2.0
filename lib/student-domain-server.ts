import { NextResponse } from 'next/server';
import { verifyCaller, formatServerErrorResponse } from './backend-security';
import { resolveOwnedStudentIds } from './student-ownership';
import { domainFailure } from './domain-cursor';

export const domainHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie, X-Portal-Contract' };
export function domainResponse(contract: string, data: Record<string, unknown>) {
  return NextResponse.json({ success: true, data: { ...data, contractVersion: contract }, error: null },
    { headers: { ...domainHeaders, 'X-Portal-Contract': contract } });
}
export function domainError(error: unknown) {
  const issue = error as { code?: string; message?: string };
  const statuses: Record<string, number> = { '22023': 422, '40001': 409, '42501': 403, P0002: 404, DATA_INTEGRITY: 503 };
  if (issue?.code && statuses[issue.code]) return NextResponse.json({ success: false, data: null, error: { code: issue.code, message: issue.message } }, { status: statuses[issue.code], headers: domainHeaders });
  const response = formatServerErrorResponse(error);
  for (const [key, value] of Object.entries(domainHeaders)) response.headers.set(key, value);
  return response;
}
/** Student bearer identity and explicit ownership are checked for every resource page. */
export async function studentDomain(req: Request, contract: 'shop-v1' | 'learning-v1' | 'library-v2') {
  if (req.headers.get('x-portal-contract') !== contract) domainFailure('Use the supported ' + contract + ' student gateway.', '42501');
  const access = await verifyCaller(req, ['Student']);
  if (access.errorResponse || !access.adminSupabase || !access.context) {
    if (access.errorResponse) for (const [key, value] of Object.entries(domainHeaders)) access.errorResponse.headers.set(key, value);
    return { ...access, student: null };
  }
  if (access.context.role !== 'Student') domainFailure('A student account is required.', '42501');
  const client = access.adminSupabase;
  const [ids, settings] = await Promise.all([
    resolveOwnedStudentIds(client, access.context.userId),
    client.from('academy_profile').select('allow_student_portal_login').eq('id', 'default').maybeSingle(),
  ]);
  if (settings.error) throw settings.error;
  if (!settings.data?.allow_student_portal_login) domainFailure('Student access is temporarily disabled by the academy.', '42501');
  if (ids.length !== 1) domainFailure('Ask the academy to review your student account link.', '42501');
  const result = await client.from('students').select('id,current_belt,student_status').eq('id', ids[0]).is('deleted_at', null).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) domainFailure('Your student record is unavailable.', '42501');
  return { ...access, student: result.data };
}

