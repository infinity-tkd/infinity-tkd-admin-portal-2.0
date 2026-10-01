import { NextResponse } from 'next/server';
import { z } from 'zod';
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
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    username: z.string().min(3, 'Username must be at least 3 characters long').max(50),
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
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
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

    const password = body.password;
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

    // 3. Create Auth User or Recover Orphaned Auth User via Service Role Client
    let newUserId: string | null = null;

    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        display_name: displayName,
        role,
      },
      app_metadata: {
        role,
        is_active: true,
        student_id: studentId,
      },
    });

    if (authError) {
      // Handle case where user already exists in auth.users
      if (authError.code === 'email_exists' || (authError as any).status === 422) {
        // A. Check if user already exists in public.profiles
        const { data: existingProfile } = await adminSupabase
          .from('profiles')
          .select('id, email, username, role')
          .eq('email', email)
          .maybeSingle();

        if (existingProfile) {
          return NextResponse.json(
            {
              success: false,
              data: null,
              error: {
                code: 'EMAIL_ALREADY_EXISTS',
                message: `A user with email "${email}" is already registered with role "${existingProfile.role}".`,
              },
            },
            { status: 409 }
          );
        }

        // B. Orphaned auth user recovery: user exists in auth.users but has no profile
        const { data: listData } = await adminSupabase.auth.admin.listUsers();
        const existingAuthUser = listData?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );

        if (existingAuthUser) {
          newUserId = existingAuthUser.id;
          // Sync password and metadata for the recovered user
          await adminSupabase.auth.admin.updateUserById(newUserId, {
            password,
            user_metadata: {
              username,
              display_name: displayName,
              role,
            },
            app_metadata: {
              role,
              is_active: true,
              student_id: studentId,
            },
          });
        } else {
          return formatServerErrorResponse(authError);
        }
      } else {
        return formatServerErrorResponse(authError);
      }
    } else {
      newUserId = authData.user?.id || null;
    }

    if (!newUserId) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'AUTH_USER_CREATION_FAILED',
            message: 'Auth creation succeeded but no User ID was returned.',
          },
        },
        { status: 500 }
      );
    }

    // 4. Server-Side Upserts to Profiles & Members
    const profilePayload: any = {
      id: newUserId,
      email,
      display_name: displayName || '',
      username: username || '',
      role,
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

    const profileRes = await adminSupabase.from('profiles').upsert(profilePayload, { onConflict: 'id' });
    if (profileRes.error) {
      return formatServerErrorResponse(profileRes.error);
    }

    // 4b. Staff profiles are registered in members table; Student accounts are strictly linked to students table
    if (role !== 'Student') {
      const memberRes = await adminSupabase.from('members').upsert(memberPayload, { onConflict: 'id' });
      if (memberRes.error) {
        return formatServerErrorResponse(memberRes.error);
      }

      if (body.address) {
        await adminSupabase.from('member_addresses').insert({
          member_id: newUserId,
          address_line1: sanitizeString(body.address.line1 || ''),
          address_line2: sanitizeString(body.address.line2 || ''),
          district_commune: sanitizeString(body.address.city || ''),
          state_province_city: sanitizeString(body.address.stateProvince || ''),
          postal_code: sanitizeString(body.address.postalCode || ''),
          country: sanitizeString(body.address.country || 'Cambodia'),
          is_primary: true,
        });
      }
    }

    // 5. Explicitly link student record and profile bi-directionally
    if (studentId) {
      await adminSupabase
        .from('students')
        .update({ profile_id: newUserId })
        .eq('id', studentId);
      await adminSupabase
        .from('profiles')
        .update({ student_id: studentId })
        .eq('id', newUserId);
    } else if (role === 'Student') {
      const studentIdPattern = username.replace(/_/g, '-');
      const { data: matchedStudents } = await adminSupabase
        .from('students')
        .update({ profile_id: newUserId })
        .or(`id.ilike.${username},id.ilike.${studentIdPattern}`)
        .select('id');
      if (matchedStudents && matchedStudents.length > 0) {
        await adminSupabase
          .from('profiles')
          .update({ student_id: matchedStudents[0].id })
          .eq('id', newUserId);
      }
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
