import { NextResponse } from 'next/server';
import { achievementBatchSchema } from '@/lib/achievements';
import { verifyCaller, validateRequestBody, formatServerErrorResponse } from '@/lib/backend-security';

export async function POST(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach']);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const { data, errorResponse: invalid } = await validateRequestBody(achievementBatchSchema, req);
    if (invalid || !data) return invalid!;
    const { data: result, error } = await adminSupabase.rpc('portal_save_achievements', {
      p_actor: context.userId, p_student: data.studentId, p_entries: data.entries,
      p_deleted_ids: data.deletedIds, p_request_key: data.requestKey,
    });
    if (error) return formatServerErrorResponse(error);
    if (!Array.isArray(result?.records) || result.records.length !== data.entries.length || !Array.isArray(result.deletedIds) || result.deletedIds.length !== data.deletedIds.length) {
      throw new Error('Achievement save was not confirmed.');
    }
    return NextResponse.json({ success: true, data: result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return formatServerErrorResponse(error); }
}
