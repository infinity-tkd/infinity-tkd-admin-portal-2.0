import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  verifyCaller,
  validateRequestBody,
  logSecurityAuditEvent,
  formatServerErrorResponse,
} from '@/lib/backend-security';

const DeleteStudentRequestSchema = z
  .object({
    id: z.string().min(1, 'Student ID is required').max(50),
  })
  .strict();

export async function POST(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, [
      'Root',
      'Super Root',
      'Admin',
      'Head Coach',
    ]);
    if (authErr || !adminSupabase || !context) return authErr!;

    const { data: body, errorResponse: valErr } = await validateRequestBody(DeleteStudentRequestSchema, req);
    if (valErr || !body) return valErr!;

    const { id } = body;

    // 1. Verify student exists
    const { data: currentStudent, error: fetchErr } = await adminSupabase
      .from('students')
      .select('id, english_name, email, profile_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !currentStudent) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'STUDENT_NOT_FOUND',
            message: 'Student record not found.',
          },
        },
        { status: 404 }
      );
    }

    const { error: archiveError } = await adminSupabase.rpc('portal_archive_student', { p_actor: context.userId, p_id: id });
    if (archiveError) return formatServerErrorResponse(archiveError);

    // 5. Audit Log
    await logSecurityAuditEvent({
      action: 'STUDENT_ARCHIVED',
      performedBy: context.userId,
      targetId: id,
      details: {
        englishName: currentStudent.english_name,
        profileId: currentStudent.profile_id || null,
      },
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      data: { id, englishName: currentStudent.english_name },
      error: null,
    });
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}
