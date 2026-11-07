import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaller, callerHasAnyPermission, formatServerErrorResponse } from '@/lib/backend-security';
import { staffRoles, staffSummaryFields, staffSummaryPages, projectStaffSummary } from '@/lib/staff-summaries';

export const dynamic = 'force-dynamic';
const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' };
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).strict();

function privateResponse(response: Response) {
  for (const [key, value] of Object.entries(privateHeaders)) response.headers.set(key, value);
  return response;
}

export async function GET(req: Request) {
  try {
    const access = await verifyCaller(req, staffRoles);
    if (access.errorResponse || !access.adminSupabase || !access.context) return privateResponse(access.errorResponse!);
    const params = new URL(req.url).searchParams;
    const parsed = querySchema.safeParse(Object.fromEntries(params));
    if (!parsed.success || [...params.keys()].some(key => params.getAll(key).length !== 1)) {
      return NextResponse.json({ success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'Choose a supported staff summary page.' } }, { status: 422, headers: privateHeaders });
    }
    if (!await callerHasAnyPermission(access.adminSupabase, access.context, staffSummaryPages)) {
      return NextResponse.json({ success: false, data: null, error: { code: 'AUTH_FORBIDDEN_ROLE', message: 'Staff labels are not available to your account.' } }, { status: 403, headers: privateHeaders });
    }
    const { limit, offset } = parsed.data;
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(15000)]);
    const result = await access.adminSupabase.from('profiles').select(staffSummaryFields.join(','))
      .in('role', staffRoles).order('id', { ascending: true }).range(offset, offset + limit - 1).abortSignal(signal);
    if (result.error) throw result.error;
    return NextResponse.json({ success: true, data: (result.data || []).map(projectStaffSummary), error: null }, { headers: privateHeaders });
  } catch (error) {
    return privateResponse(formatServerErrorResponse(error));
  }
}
