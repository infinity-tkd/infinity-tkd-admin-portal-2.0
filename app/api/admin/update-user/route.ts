import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isCalendarDate } from '@/lib/dates';
import { 
  verifyCaller,
  callerHasPermission,
  validateRequestBody,
  sanitizeString, 
  logSecurityAuditEvent, 
  formatServerErrorResponse 
} from '@/lib/backend-security';

const UserUpdatePayloadSchema = z
  .object({
    displayName: z.string().max(100).optional().nullable(),
    email: z.string().email().optional(),
    password: z.string().min(12, 'Password must be at least 12 characters long').max(256).optional(),
    username: z.string().min(3).max(50).optional(),
    studentId: z.string().max(50).optional().nullable(),
    role: z.enum([
      'Root',
      'Super Root',
      'Admin',
      'Head Coach',
      'Coach',
      'Assistant Coach',
      'Student',
    ]).optional(),
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
    kukkiwonId: z.string().max(50).optional().nullable(),
    currentDan: z.number().int().min(1).max(9).optional().nullable(),
    danIssueDate: z.string().refine(isCalendarDate, 'Invalid certificate date').optional().nullable(),
    danCertificateUrl: z.string().max(500).optional().nullable(),
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
  .passthrough();

const UpdateUserRequestSchema = z
  .object({
    id: z.string().uuid('Invalid target user id'),
    data: UserUpdatePayloadSchema,
  })
  .passthrough();

export async function POST(req: Request) {
  try {
    // 1. Verify Auth & RBAC Authorization
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, [
      'Root',
      'Super Root',
      'Admin',
      'Head Coach',
      'Coach',
      'Assistant Coach',
      'Student',
    ]);
    if (authErr || !adminSupabase || !context) return authErr!;

    // 2. Strict Zod Payload Validation
    const { data: body, errorResponse: valErr } = await validateRequestBody(UpdateUserRequestSchema, req);
    if (valErr || !body) return valErr!;

    const { id, data } = body;

    // Auth credentials cannot participate in a PostgreSQL transaction. Keep password
    // changes independent so a failed profile edit cannot silently reset a password.
    if (data.password && Object.entries(data).some(([key, value]) => key !== 'password' && value !== undefined && value !== '' && value !== null)) {
      return NextResponse.json({ success: false, error: { message: 'Save profile changes first, then change the password separately.' } }, { status: 400 });
    }

    const isPrivilegedAdmin = await callerHasPermission(adminSupabase,context,'action:staff_manage');
    const isSelf = context.userId === id;

    if (!isPrivilegedAdmin && !isSelf) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'AUTH_FORBIDDEN_USER_MUTATION',
            message: 'Forbidden: You do not have permissions to modify this user account.',
          },
        },
        { status: 403 }
      );
    }

    // Guard against non-admin BOLA/IDOR: non-privileged users updating self cannot mutate administrative or martial credentials
    if (!isPrivilegedAdmin) {
      const hasPrivilegedField =
        data.role !== undefined ||
        data.isActive !== undefined ||
        data.studentId !== undefined ||
        data.kukkiwonId !== undefined ||
        data.currentDan !== undefined ||
        data.danIssueDate !== undefined ||
        data.danCertificateUrl !== undefined;

      if (hasPrivilegedField) {
        await logSecurityAuditEvent({
          action: 'PRIVILEGE_VIOLATION_BLOCKED',
          performedBy: context.userId,
          targetId: id,
          details: { attemptedFields: Object.keys(data) },
          status: 'BLOCKED',
        });
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'AUTH_FORBIDDEN_FIELD_MUTATION',
              message: 'Forbidden: You do not have permission to modify administrative fields (role, active status, student ID, or martial credentials).',
            },
          },
          { status: 403 }
        );
      }
    }

    // Role Escalation Check: Admin cannot elevate any user to Root or Super Root
    if (!['Root','Super Root'].includes(context.role) && (data.role === 'Root' || data.role === 'Super Root')) {
      await logSecurityAuditEvent({
        action: 'ROLE_ESCALATION_BLOCKED',
        performedBy: context.userId,
        targetId: id,
        details: { attemptedRole: data.role },
        status: 'BLOCKED',
      });
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'AUTH_FORBIDDEN_ESCALATION',
            message: 'Forbidden: Admins cannot assign Root privileges.',
          },
        },
        { status: 403 }
      );
    }

    // Protection Check: Non-Root users cannot modify Root accounts
    const targetProfileRes = await adminSupabase.from('profiles').select('role').eq('id', id).single();
    if (targetProfileRes.error) return formatServerErrorResponse(targetProfileRes.error);
    if (
      (targetProfileRes.data?.role === 'Root' || targetProfileRes.data?.role === 'Super Root') &&
      context.role !== 'Root' &&
      context.role !== 'Super Root'
    ) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'AUTH_FORBIDDEN_ROOT_MODIFICATION',
            message: 'Forbidden: Insufficient privileges to modify Root accounts.',
          },
        },
        { status: 403 }
      );
    }

    // 3. Handle Auth-Level Mutations (Direct Password Update / Email Sync)
    if (data.password) {
      const { error: pwdErr } = await adminSupabase.auth.admin.updateUserById(id, {
        password: data.password,
      });
      if (pwdErr) return formatServerErrorResponse(pwdErr);

      await logSecurityAuditEvent({
        action: 'USER_PASSWORD_RESET_BY_ADMIN',
        performedBy: context.userId,
        targetId: id,
        details: { reason: isSelf ? 'User self password reset' : 'Direct admin password update' },
        status: 'SUCCESS',
      });
    }

    let previousEmail: string | undefined;
    if (data.email) {
      const previous = await adminSupabase.auth.admin.getUserById(id);
      if (previous.error || !previous.data.user) return formatServerErrorResponse(previous.error || new Error('Account not found.'));
      previousEmail = previous.data.user.email;
      const {error:emailError}=await adminSupabase.auth.admin.updateUserById(id,{email:sanitizeString(data.email)});
      if(emailError)return formatServerErrorResponse(emailError);
    }

    // 4. Allowlisted Field Extraction & Input Sanitization
    const profilePayload: any = {};
    if (data.password) profilePayload.must_change_password = !isSelf;
    if (data.displayName !== undefined) profilePayload.display_name = sanitizeString(data.displayName || '');
    if (data.email !== undefined) profilePayload.email = sanitizeString(data.email);
    if (data.username !== undefined) profilePayload.username = sanitizeString(data.username);

    // Administrative fields: only privileged admins can mutate these
    if (isPrivilegedAdmin) {
      if (data.studentId !== undefined) {
        profilePayload.student_id = data.studentId ? sanitizeString(data.studentId) : null;

      }
      if (data.kukkiwonId !== undefined) profilePayload.kukkiwon_id = data.kukkiwonId ? sanitizeString(data.kukkiwonId) : null;
      if (data.currentDan !== undefined) profilePayload.current_dan = data.currentDan !== null ? Number(data.currentDan) : null;
      if (data.danIssueDate !== undefined) profilePayload.dan_issue_date = data.danIssueDate ? sanitizeString(data.danIssueDate) : null;
      if (data.danCertificateUrl !== undefined) profilePayload.dan_certificate_url = data.danCertificateUrl ? sanitizeString(data.danCertificateUrl) : null;

      if (data.role !== undefined) {
        profilePayload.role = data.role;
      }
      if (data.isActive !== undefined) {
        profilePayload.is_active = Boolean(data.isActive);
      }
    }



    const memberPayload: any = {};
    if (data.khmerName !== undefined) memberPayload.khmer_name = sanitizeString(data.khmerName || '');
    if (data.englishName !== undefined) memberPayload.english_name = sanitizeString(data.englishName || '');
    if (data.gender !== undefined) memberPayload.gender = data.gender;
    if (data.dob !== undefined) memberPayload.dob = data.dob;
    if (data.phone !== undefined) memberPayload.phone = sanitizeString(data.phone || '');
    if (data.emergencyContactName !== undefined) memberPayload.emergency_contact_name = sanitizeString(data.emergencyContactName || '');
    if (data.emergencyContactPhone !== undefined) memberPayload.emergency_contact_phone = sanitizeString(data.emergencyContactPhone || '');
    if (data.emergencyContactRelation !== undefined) memberPayload.emergency_contact_relation = sanitizeString(data.emergencyContactRelation || '');
    if (data.medicalNotes !== undefined) memberPayload.medical_notes = sanitizeString(data.medicalNotes || '');
    if (data.allergies !== undefined) memberPayload.allergies = sanitizeString(data.allergies || '');
    if (data.profilePicturePath !== undefined) memberPayload.profile_picture_path = data.profilePicturePath;
    if (data.nationality !== undefined) memberPayload.nationality = sanitizeString(data.nationality || '');

    const address=data.address;
    const {error:saveError}=await adminSupabase.rpc('portal_update_user',{
      p_actor:context.userId,p_target:id,p_profile:profilePayload,p_member:memberPayload,
      p_address:address ? {address_line1:sanitizeString(address.line1 || ''),address_line2:sanitizeString(address.line2 || ''),district_commune:sanitizeString(address.city || ''),state_province_city:sanitizeString(address.stateProvince || ''),postal_code:sanitizeString(address.postalCode || ''),country:sanitizeString(address.country || 'Cambodia')} : null,
    });
    if(saveError) {
      if (data.email && previousEmail) {
        const restored = await adminSupabase.auth.admin.updateUserById(id, {email:previousEmail});
        if (restored.error) {
          console.error('[AUTH_EMAIL_RECONCILIATION_REQUIRED]', id, restored.error.code);
          return NextResponse.json({success:false,error:{code:'ACCOUNT_RECONCILIATION_REQUIRED',message:'The profile save failed and the login email could not be restored. An administrator must reconcile this account before retrying.'}},{status:503});
        }
      }
      return formatServerErrorResponse(saveError);
    }

    // Log Audit Event
    await logSecurityAuditEvent({
      action: 'USER_ACCOUNT_UPDATED',
      performedBy: context.userId,
      targetId: id,
      details: { 
        updatedFields: Object.keys({ ...profilePayload, ...memberPayload }),
        passwordReset: Boolean(data.password)
      },
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      data: { id },
      error: null,
    });
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}
