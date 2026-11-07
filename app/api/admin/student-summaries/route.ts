import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaller, callerHasPermission, formatServerErrorResponse } from '@/lib/backend-security';
import { studentSummaryPurpose, studentSummaryPages, studentSummaryFields, projectStudentSummary } from '@/lib/student-summaries';

export const dynamic = 'force-dynamic';
const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' };
const querySchema = z.object({
  purpose: studentSummaryPurpose,
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).strict();

function privateResponse(response: Response) {
  for (const [key, value] of Object.entries(privateHeaders)) response.headers.set(key, value);
  return response;
}

export async function GET(req: Request) {
  try {
    const access = await verifyCaller(req, ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach']);
    if (access.errorResponse || !access.adminSupabase || !access.context) return privateResponse(access.errorResponse!);
    const params = new URL(req.url).searchParams;
    const parsed = querySchema.safeParse(Object.fromEntries(params));
    if (!parsed.success || [...params.keys()].some(key => params.getAll(key).length !== 1)) {
      return NextResponse.json({ success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'Choose a supported student summary purpose and page.' } }, { status: 422, headers: privateHeaders });
    }
    const { purpose, limit, offset } = parsed.data;
    if (!await callerHasPermission(access.adminSupabase, access.context, studentSummaryPages[purpose])) {
      return NextResponse.json({ success: false, data: null, error: { code: 'AUTH_FORBIDDEN_ROLE', message: 'This student summary is not available to your account.' } }, { status: 403, headers: privateHeaders });
    }
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(15000)]);
    const result = await access.adminSupabase.from('students').select(studentSummaryFields(purpose).join(','))
      .is('deleted_at', null).order('id', { ascending: true }).range(offset, offset + limit - 1).abortSignal(signal);
    if (result.error) throw result.error;
    return NextResponse.json({ success: true, data: (result.data || []).map(row => projectStudentSummary(row, purpose)), error: null }, { headers: privateHeaders });
  } catch (error) {
    return privateResponse(formatServerErrorResponse(error));
  }
}
