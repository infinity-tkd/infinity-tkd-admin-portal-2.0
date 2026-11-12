import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaller, validateRequestBody } from '@/lib/backend-security';
import { operationsError } from '@/lib/operations-errors';
import { lmsErrorResponse } from '@/lib/lms-server';
import { announcementInput } from '@/lib/lms-contract';

export const dynamic = 'force-dynamic';
// Reads need page:lms; sending needs action:announcements_send (checked again in SQL).
const roles = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' };
const schema = z.object({ requestKey: z.string().uuid(), announcement: announcementInput }).strict();

/** Staff announcements already sent, newest first. */
export async function GET(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const result = await adminSupabase.from('lms_announcements').select('id,title,body,translations,audience,recipients,sent_at,profiles(display_name)').order('sent_at', { ascending: false }).limit(100).abortSignal(AbortSignal.timeout(15000));
    if (result.error) throw result.error;
    return NextResponse.json({ success: true, data: { announcements: result.data ?? [] } }, { headers });
  } catch (error) { return lmsErrorResponse(error, operationsError); }
}

/** Sends one announcement to the chosen students' portal inboxes (once per request key). */
export async function POST(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const { data, errorResponse: invalid } = await validateRequestBody(schema, req);
    if (invalid || !data) return invalid!;
    const result = await adminSupabase.rpc('portal_send_announcement', { p_actor: context.userId, p_request: data.requestKey, p_payload: data.announcement }).abortSignal(AbortSignal.timeout(20000));
    if (result.error) throw result.error;
    return NextResponse.json({ success: true, data: result.data }, { headers });
  } catch (error) { return lmsErrorResponse(error, operationsError); }
}
