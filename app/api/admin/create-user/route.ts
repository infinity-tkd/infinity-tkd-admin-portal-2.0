import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isCalendarDate } from '@/lib/dates';
import { 
  verifyCaller, 
  validateRequestBody,
  sanitizeString, 
  logSecurityAuditEvent, 
  formatServerErrorResponse 
} from '@/lib/backend-security';

const CreateUserRequestSchema = z
  .object({
    email: z.string().email('Invalid email address').optional().nullable(),
    studentId: z.string().max(50).optional().nullable(),
    password: z.string().min(12, 'Password must be at least 12 characters long').max(256).optional(),
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, 'Use letters, numbers, dots, underscores or hyphens.'),
    displayName: z.string().max(100).optional().nullable(),
    role: z.enum([
      'Root',
      'Super Root',
      'Admin',
      'Head Coach',
      'Coach',
      'Assistant Coach',
      'Student',
    ]),
    isActive: z.boolean().optional(),
    khmerName: z.string().max(100).optional().nullable(),
    englishName: z.string().max(100).optional().nullable(),
    gender: z.enum(['Male', 'Female', 'Other']).optional().nullable(),
    dob: z.string().refine(isCalendarDate, 'Invalid date of birth').optional().nullable(),
    phone: z.string().max(30).optional().nullable(),
    emergencyContactName: z.string().max(100).optional().nullable(),
    emergencyContactPhone: z.string().max(30).optional().nullable(),
    emergencyContactRelation: z.string().max(50).optional().nullable(),
    medicalNotes: z.string().max(1000).optional().nullable(),
    allergies: z.string().max(500).optional().nullable(),
    profilePicturePath: z.string().max(500).optional().nullable(),
    nationality: z.string().max(50).optional().nullable(),
    address: z
      .object({
        line1: z.string().max(100).optional().nullable(),
        line2: z.string().max(100).optional().nullable(),
        city: z.string().max(50).optional().nullable(),
        stateProvince: z.string().max(50).optional().nullable(),
        postalCode: z.string().max(20).optional().nullable(),
        country: z.string().max(50).optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .strict();

export async function POST(req: Request) {
  try {
    // 1. Verify Authentication & RBAC Authorization
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, [
      'Root',
      'Super Root',
      'Admin',
    ]);
    if (authErr || !adminSupabase || !context) return authErr!;

    // 2. Strict Zod Payload Validation
    const { data: body, errorResponse: valErr } = await validateRequestBody(CreateUserRequestSchema, req);
    if (valErr || !body) return valErr!;

    const studentId = body.studentId ? sanitizeString(body.studentId) : null;
    const role = body.role;
    let email = body.email ? sanitizeString(body.email) : '';

    if (!email) {
      if (role === 'Student' || studentId) {
        const seed = (studentId || body.username).toLowerCase().replace(/[^a-z0-9]/g, '');
        email = `${seed}@portal.infinitytkd.com`;
      } else {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Email address is required for staff system accounts.',
            },
          },
          { status: 400 }
        );
      }
    }

    const temporaryPassword = body.password ? undefined : randomBytes(24).toString('base64url');
    const password = body.password || temporaryPassword;
    const username = sanitizeString(body.username);
    const displayName = sanitizeString(body.displayName || '');

    // Role escalation guard: Admins cannot provision Root / Super Root accounts
    if (context.role === 'Admin' && (role === 'Root' || role === 'Super Root')) {
      await logSecurityAuditEvent({
        action: 'PRIVILEGE_ESCALATION_BLOCKED',
        performedBy: context.userId,
        details: { targetRole: role, email },
        status: 'BLOCKED',
      });
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'AUTH_FORBIDDEN_ESCALATION',
            message: 'Forbidden: Admin role cannot provision Root or Super Root accounts.',
          },
        },
        { status: 403 }
      );
    }

    if (role === 'Student' && !studentId) return NextResponse.json({ success:false, error:{message:'Choose the student record explicitly.'} }, {status:400});
    if (role !== 'Student' && studentId) return NextResponse.json({ success:false, error:{message:'Only Student accounts can link a student record.'} }, {status:400});
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { username, display_name: displayName },
      app_metadata: { role, is_active: body.isActive ?? true, student_id: studentId },
    });
    if (authError || !authData.user) return formatServerErrorResponse(authError || new Error('Account creation failed'));
    const newUserId = authData.user.id;

    const profilePayload: any = {
      id: newUserId,
      email,
      display_name: displayName || '',
      username: username || '',
      role,
      student_id: studentId,
      is_active: body.isActive !== undefined ? Boolean(body.isActive) : true,
    };

    const memberPayload = {
      id: newUserId,
      khmer_name: sanitizeString(body.khmerName || '') || null,
      english_name: sanitizeString(body.englishName || '') || null,
      gender: body.gender || null,
      dob: body.dob || null,
      phone: sanitizeString(body.phone || '') || null,
      emergency_contact_name: sanitizeString(body.emergencyContactName || '') || null,
      emergency_contact_phone: sanitizeString(body.emergencyContactPhone || '') || null,
      emergency_contact_relation: sanitizeString(body.emergencyContactRelation || '') || null,
      medical_notes: sanitizeString(body.medicalNotes || '') || null,
      allergies: sanitizeString(body.allergies || '') || null,
      profile_picture_path: body.profilePicturePath || null,
      nationality: sanitizeString(body.nationality || '') || null,
    };

    const { error: provisionError } = await adminSupabase.rpc('portal_provision_user', {
      p_actor: context.userId, p_profile: profilePayload, p_member: memberPayload, p_address: body.address || null,
    });
    if (provisionError) {
      const cleanup = await adminSupabase.auth.admin.deleteUser(newUserId);
      if (cleanup.error) {
        console.error('[ACCOUNT_COMPENSATION_FAILED]', { userId: newUserId, code: cleanup.error.code });
        return NextResponse.json({success:false,error:{code:'ACCOUNT_RECONCILIATION_REQUIRED',message:'Account setup failed and the new login could not be removed. An administrator must reconcile this account before retrying.',accountId:newUserId}},{status:503});
      }
      return formatServerErrorResponse(provisionError);
    }

    // 6. Audit Event Logging
    await logSecurityAuditEvent({
      action: 'USER_ACCOUNT_CREATED',
      performedBy: context.userId,
      targetId: newUserId,
      details: { email, role, studentId },
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      data: {
        id: authData.user?.id || newUserId,
        email: authData.user?.email || email,
        role,
        studentId: studentId || undefined,
        temporaryPassword,
      },
      user: {
        id: authData.user?.id || newUserId,
        email: authData.user?.email || email,
        role,
        studentId: studentId || undefined,
      },
      error: null,
    });
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}
