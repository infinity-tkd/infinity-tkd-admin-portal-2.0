import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCaller, validateRequestBody } from '@/lib/backend-security';
import { operationsError } from '@/lib/operations-errors';
import { lmsErrorResponse } from '@/lib/lms-server';

export const dynamic = 'force-dynamic';
// Changing the academy-wide LMS phone-alert switch needs action:staff_manage.
const roles = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' };
const schema = z.object({ studentLmsPushEnabled: z.boolean() }).strict();

/**
 * Student phone alerts for LMS notices. Switch on only after the student portal's
 * service worker accepts sourceType 'lms' (docs/STUDENT_PORTAL_LMS_HANDOFF.md);
 * until then the notices still reach the notices-v2 inbox.
 */
export async function POST(req: Request) {
  try {
    const { context, adminSupabase, errorResponse } = await verifyCaller(req, roles);
    if (errorResponse || !context || !adminSupabase) return errorResponse!;
    const { data, errorResponse: invalid } = await validateRequestBody(schema, req);
    if (invalid || !data) return invalid!;
    const saved = await adminSupabase.from('academy_profile').update({ student_lms_push_enabled: data.studentLmsPushEnabled, updated_by: context.userId, updated_at: new Date().toISOString() })
      .eq('id', 'default').select('student_lms_push_enabled').single();
    if (saved.error) throw saved.error;
    const audit = await adminSupabase.from('audit_logs').insert({ action: 'LMS_STUDENT_PUSH', performed_by: context.userId, target_id: 'default', details: { enabled: data.studentLmsPushEnabled } });
    if (audit.error) throw audit.error;
    return NextResponse.json({ success: true, data: { studentLmsPushEnabled: saved.data.student_lms_push_enabled === true } }, { headers });
  } catch (error) { return lmsErrorResponse(error, operationsError); }
}
