import { NextResponse } from 'next/server';
import { verifyCaller } from '@/lib/backend-security';
import { operationsError } from '@/lib/operations-errors';
import { lmsErrorResponse, signedSubmissionUrl } from '@/lib/lms-server';

export const dynamic = 'force-dynamic';
// Only reviewers (action:curriculum_edit) watch student videos; the link lasts 10 minutes.
const roles = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach'];
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' };

export async function GET(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const id = new URL(req.url).searchParams.get('submission') ?? '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ success: false, error: { message: 'Choose a submission.' } }, { status: 422, headers });
    const row = await adminSupabase.from('student_submissions').select('video_path,status').eq('id', id).maybeSingle();
    if (row.error) throw row.error;
    if (!row.data?.video_path || !['submitted', 'reviewed', 'returned'].includes(row.data.status)) return NextResponse.json({ success: false, error: { message: 'This video is no longer available.' } }, { status: 404, headers });
    const url = await signedSubmissionUrl(adminSupabase, row.data.video_path);
    if (!url) return NextResponse.json({ success: false, error: { message: 'The video could not be opened. Try again in a moment.' } }, { status: 503, headers });
    await adminSupabase.from('audit_logs').insert({ action: 'LMS_VIDEO_VIEW', performed_by: context.userId, target_id: id, details: {} });
    return NextResponse.json({ success: true, data: { url, expiresInSeconds: 600 } }, { headers });
  } catch (error) { return lmsErrorResponse(error, operationsError); }
}
