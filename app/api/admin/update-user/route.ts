import { NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  verifyCaller, 
  validateRequestBody,
  sanitizeString, 
  logSecurityAuditEvent, 
  formatServerErrorResponse 
} from '@/lib/backend-security';

const UserUpdatePayloadSchema = z
  .object({
    displayName: z.string().max(100).optional().nullable(),
    email: z.string().email().optional(),
    password: z.string().min(6, 'Password must be at least 6 characters long').optional(),
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
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
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
    danIssueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
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
    id: z.string().min(1, 'Missing target user id'),
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

    const isPrivilegedAdmin = ['Root', 'Super Root', 'Admin'].includes(context.role);
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

    // Role Escalation Check: Admin cannot elevate any user to Root or Super Root
    if (context.role === 'Admin' && (data.role === 'Root' || data.role === 'Super Root')) {
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
        details: { reason: 'Direct admin password update' },
        status: 'SUCCESS',
      });
    }

    if (data.email) {
      await adminSupabase.auth.admin.updateUserById(id, {
        email: sanitizeString(data.email),
      });
    }

    // 4. Allowlisted Field Extraction & Input Sanitization
    const profilePayload: any = {};
    if (data.displayName !== undefined) profilePayload.display_name = sanitizeString(data.displayName || '');
    if (data.email !== undefined) profilePayload.email = sanitizeString(data.email);
    if (data.username !== undefined) profilePayload.username = sanitizeString(data.username);
    if (data.studentId !== undefined) {
      profilePayload.student_id = data.studentId ? sanitizeString(data.studentId) : null;
      if (data.studentId) {
        await adminSupabase.from('students').update({ profile_id: id }).eq('id', sanitizeString(data.studentId));
      }
    }
    if (data.kukkiwonId !== undefined) profilePayload.kukkiwon_id = data.kukkiwonId ? sanitizeString(data.kukkiwonId) : null;
    if (data.currentDan !== undefined) profilePayload.current_dan = data.currentDan !== null ? Number(data.currentDan) : null;
    if (data.danIssueDate !== undefined) profilePayload.dan_issue_date = data.danIssueDate ? sanitizeString(data.danIssueDate) : null;
    if (data.danCertificateUrl !== undefined) profilePayload.dan_certificate_url = data.danCertificateUrl ? sanitizeString(data.danCertificateUrl) : null;
    const appMetadataUpdates: Record<string, any> = {};
    if (data.role !== undefined && (context.role === 'Root' || context.role === 'Super Root' || context.role === 'Admin')) {
      profilePayload.role = data.role;
      appMetadataUpdates.role = data.role;
    }
    if (data.isActive !== undefined) {
      profilePayload.is_active = Boolean(data.isActive);
      appMetadataUpdates.is_active = Boolean(data.isActive);
    }
    if (data.studentId !== undefined) {
      appMetadataUpdates.student_id = data.studentId ? sanitizeString(data.studentId) : null;
    }

    if (Object.keys(appMetadataUpdates).length > 0) {
      await adminSupabase.auth.admin.updateUserById(id, {
        app_metadata: appMetadataUpdates,
      });
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

    // Execute Server-Side Mutations
    if (Object.keys(profilePayload).length > 0) {
      const { error } = await adminSupabase.from('profiles').update(profilePayload).eq('id', id);
      if (error) return formatServerErrorResponse(error);
    }

    if (Object.keys(memberPayload).length > 0) {
      const { data: memberExists } = await adminSupabase.from('members').select('id').eq('id', id).maybeSingle();
      if (memberExists) {
        const { error } = await adminSupabase.from('members').update(memberPayload).eq('id', id);
        if (error) return formatServerErrorResponse(error);
      }
    }

    if (data.address) {
      const { data: existingAddr } = await adminSupabase
        .from('member_addresses')
        .select('address_id')
        .eq('member_id', id)
        .eq('is_primary', true)
        .maybeSingle();

      const addrFields = {
        address_line1: sanitizeString(data.address.line1 || ''),
        address_line2: sanitizeString(data.address.line2 || ''),
        district_commune: sanitizeString(data.address.city || ''),
        state_province_city: sanitizeString(data.address.stateProvince || ''),
        postal_code: sanitizeString(data.address.postalCode || ''),
        country: sanitizeString(data.address.country || 'Cambodia'),
      };

      if (existingAddr) {
        await adminSupabase.from('member_addresses').update(addrFields).eq('address_id', existingAddr.address_id);
      } else {
        await adminSupabase.from('member_addresses').insert({
          member_id: id,
          ...addrFields,
          is_primary: true,
        });
      }
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
