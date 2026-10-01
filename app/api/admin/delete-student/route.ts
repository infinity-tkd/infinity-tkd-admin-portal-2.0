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

    // 2. Clean up child dependencies safely using service role
    // A. Student Addresses
    await adminSupabase.from('student_addresses').delete().eq('student_id', id);
    // B. Class Enrollments
    await adminSupabase.from('class_enrollments').delete().eq('student_id', id);
    // C. Belt Histories
    await adminSupabase.from('belt_histories').delete().eq('student_id', id);
    // D. Achievements
    await adminSupabase.from('achievements').delete().eq('student_id', id);
    // E. Physical Evaluations & Biometrics
    await adminSupabase.from('student_physical_evaluations').delete().eq('student_id', id);
    await adminSupabase.from('student_body_compositions').delete().eq('student_id', id);

    // 3. Deactivate or unlink linked profile if present
    if (currentStudent.profile_id) {
      await adminSupabase.from('profiles').update({ is_active: false, student_id: null }).eq('id', currentStudent.profile_id);
    }

    // 4. Delete the student record
    const { error: deleteErr } = await adminSupabase.from('students').delete().eq('id', id);
    if (deleteErr) {
      console.error('[delete-student API] Error deleting student:', deleteErr);
      return formatServerErrorResponse(deleteErr);
    }

    // 5. Audit Log
    await logSecurityAuditEvent({
      action: 'STUDENT_DELETED',
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
