import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaller, callerHasPermission, formatServerErrorResponse } from '@/lib/backend-security';
import { staffRoles } from '@/lib/staff-summaries';
import { accountSummaryFields, accountMemberFields, accountSourceRow, projectAccountSummary } from '@/lib/account-summaries';

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
      return NextResponse.json({ success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'Choose a supported account page.' } }, { status: 422, headers: privateHeaders });
    }
    const [settingsAllowed, managementAllowed] = await Promise.all([
      callerHasPermission(access.adminSupabase, access.context, 'page:settings'),
      callerHasPermission(access.adminSupabase, access.context, 'action:staff_manage'),
    ]);
    if (!settingsAllowed || !managementAllowed) {
      return NextResponse.json({ success: false, data: null, error: { code: 'AUTH_FORBIDDEN_ROLE', message: 'Account management is not available to your account.' } }, { status: 403, headers: privateHeaders });
    }
    const { limit, offset } = parsed.data;
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(15000)]);
    const profiles = await access.adminSupabase.from('profiles').select(accountSummaryFields.join(','))
      .order('id', { ascending: true }).range(offset, offset + limit - 1).abortSignal(signal);
    if (profiles.error) throw profiles.error;
    const rows = (profiles.data || []).map(accountSourceRow);
    const ids = rows.map(row => row.id).filter((id): id is string => typeof id === 'string');
    const members = ids.length ? await access.adminSupabase.from('members').select(accountMemberFields.join(',')).in('id', ids).abortSignal(signal) : { data: [], error: null };
    if (members.error) throw members.error;
    const memberRows = (members.data || []).map(accountSourceRow);
    const byId = new Map(memberRows.map(row => [row.id, row]));
    return NextResponse.json({ success: true, data: rows.map(row => projectAccountSummary(row, byId.get(row.id))), error: null }, { headers: privateHeaders });
  } catch (error) {
    return privateResponse(formatServerErrorResponse(error));
  }
}
