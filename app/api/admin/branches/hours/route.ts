import { NextResponse } from 'next/server';
import { verifyCaller, validateRequestBody, logSecurityAuditEvent, formatServerErrorResponse } from '@/lib/backend-security';
import { branchHoursRequestSchema } from '@/lib/branch-hours';

export const dynamic = 'force-dynamic';
const roles = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' };
const fail = (message: string, status: number) => NextResponse.json({ success: false, error: { message } }, { status, headers });
/** PostgREST reports an unknown column before the opening-hours migration is applied. */
const missingColumn = (error: { code?: string; message?: string } | null) => !!error && (error.code === '42703' || error.code === 'PGRST204' || /opening_hours/.test(error.message || ''));

export async function GET(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const { data, error } = await adminSupabase.from('branches').select('*').order('id').limit(50);
    if (error) return formatServerErrorResponse(error);
    const rows = data || [];
    return NextResponse.json({ success: true, data: {
      available: rows.length === 0 || Object.hasOwn(rows[0], 'opening_hours'),
      branches: rows.map(row => ({ id: row.id, name: row.branch_name, isActive: row.is_active !== false, openingHours: row.opening_hours ?? null })),
    } }, { headers });
  } catch (error) { return formatServerErrorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const { data, errorResponse: invalid } = await validateRequestBody(branchHoursRequestSchema, req);
    if (invalid || !data) return invalid!;
    const { data: saved, error } = await adminSupabase.from('branches').update({ opening_hours: data.openingHours }).eq('id', data.branchId).select('id,opening_hours').maybeSingle();
    if (missingColumn(error)) return fail('Opening hours need a database update before they can be saved.', 503);
    if (error) return formatServerErrorResponse(error);
    if (!saved) return fail('The branch was not found. Refresh and try again.', 404);
    await logSecurityAuditEvent({ action: 'UPDATE_BRANCH_OPENING_HOURS', performedBy: context.email, targetId: String(data.branchId), status: 'SUCCESS', details: { openingHours: data.openingHours } });
    return NextResponse.json({ success: true, data: { id: saved.id, openingHours: saved.opening_hours ?? null } }, { headers });
  } catch (error) { return formatServerErrorResponse(error); }
}
