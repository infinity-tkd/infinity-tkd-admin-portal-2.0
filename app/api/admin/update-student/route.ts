import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  verifyCaller,
  validateRequestBody,
  sanitizeString,
  logSecurityAuditEvent,
  formatServerErrorResponse,
} from '@/lib/backend-security';

const AddressUpdateSchema = z
  .object({
    line1: z.string().max(255).optional(),
    line2: z.string().max(255).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    stateProvince: z.string().max(100).optional().nullable(),
    postalCode: z.string().max(20).optional().nullable(),
    country: z.string().max(100).optional().nullable(),
  })
  .passthrough();

const StudentUpdatePayloadSchema = z
  .object({
    englishName: z.string().min(1).max(100).optional(),
    khmerName: z.string().max(100).optional().nullable(),
    gender: z.enum(['Male', 'Female', 'Other']).optional().nullable(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    email: z.string().max(100).optional().nullable(),
    emergencyContactName: z.string().max(100).optional().nullable(),
    emergencyContactPhone: z.string().max(50).optional().nullable(),
    emergencyContactRelation: z.string().max(50).optional().nullable(),
    medicalNotes: z.string().max(2000).optional().nullable(),
    allergies: z.string().max(1000).optional().nullable(),
    scholarshipId: z.number().int().positive().optional().nullable(),
    heightCm: z.number().positive().optional().nullable(),
    weightKg: z.number().positive().optional().nullable(),
    homeBranchId: z.number().int().positive().optional().nullable(),
    currentBelt: z.string().max(50).optional(),
    studentStatus: z.string().max(30).optional(),
    statusReason: z.string().max(255).optional().nullable(),
    statusChangedAt: z.string().optional().nullable(),
    pauseEndDate: z.string().optional().nullable(),
    profilePicturePath: z.string().max(500).optional().nullable(),
    esignPath: z.string().max(500).optional().nullable(),
    kukkiwonId: z.string().max(50).optional().nullable(),
    nationality: z.string().max(50).optional().nullable(),
    registrationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes: z.string().max(2000).optional().nullable(),
    address: AddressUpdateSchema.optional().nullable(),
  })
  .passthrough();

const UpdateStudentRequestSchema = z
  .object({
    id: z.string().min(1, 'Target student id is required').max(50),
    data: StudentUpdatePayloadSchema,
  })
  .passthrough();

export async function POST(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, [
      'Root',
      'Super Root',
      'Admin',
      'Head Coach',
      'Coach',
    ]);
    if (authErr || !adminSupabase || !context) return authErr!;

    const { data: body, errorResponse: valErr } = await validateRequestBody(UpdateStudentRequestSchema, req);
    if (valErr || !body) return valErr!;

    const { id, data } = body;

    // Verify student exists and check tenancy
    const { data: currentStudent, error: fetchErr } = await adminSupabase
      .from('students')
      .select('id, home_branch_id, english_name, profile_id')
      .eq('id', id)
      .single();

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

    const memberPayload: any = {};
    if (data.englishName !== undefined) memberPayload.english_name = sanitizeString(data.englishName);
    if (data.khmerName !== undefined) memberPayload.khmer_name = sanitizeString(data.khmerName);
    if (data.gender !== undefined) memberPayload.gender = data.gender;
    if (data.dob !== undefined) memberPayload.dob = data.dob;
    if (data.phone !== undefined) memberPayload.phone = sanitizeString(data.phone);
    if (data.email !== undefined) memberPayload.email = sanitizeString(data.email);
    if (data.emergencyContactName !== undefined) memberPayload.emergency_contact_name = sanitizeString(data.emergencyContactName);
    if (data.emergencyContactPhone !== undefined) memberPayload.emergency_contact_phone = sanitizeString(data.emergencyContactPhone);
    if (data.emergencyContactRelation !== undefined) memberPayload.emergency_contact_relation = sanitizeString(data.emergencyContactRelation);
    if (data.medicalNotes !== undefined) memberPayload.medical_notes = sanitizeString(data.medicalNotes);
    if (data.allergies !== undefined) memberPayload.allergies = sanitizeString(data.allergies);
    if (data.scholarshipId !== undefined) memberPayload.scholarship_id = data.scholarshipId;
    if (data.heightCm !== undefined) memberPayload.height_cm = data.heightCm;
    if (data.weightKg !== undefined) memberPayload.weight_kg = data.weightKg;
    if (data.homeBranchId !== undefined) memberPayload.home_branch_id = data.homeBranchId;
    if (data.currentBelt !== undefined) memberPayload.current_belt = data.currentBelt;
    if (data.studentStatus !== undefined) {
      memberPayload.student_status = data.studentStatus;
      memberPayload.status_changed_at = new Date().toISOString();
    }
    if (data.statusReason !== undefined) memberPayload.status_reason = data.statusReason;
    if (data.statusChangedAt !== undefined) memberPayload.status_changed_at = data.statusChangedAt;
    if (data.pauseEndDate !== undefined) memberPayload.pause_end_date = data.pauseEndDate;
    if (data.profilePicturePath !== undefined) memberPayload.profile_picture_path = data.profilePicturePath;
    if (data.esignPath !== undefined) memberPayload.esign_path = data.esignPath;
    if (data.kukkiwonId !== undefined) memberPayload.kukkiwon_id = data.kukkiwonId;
    if (data.nationality !== undefined) memberPayload.nationality = sanitizeString(data.nationality);
    if (data.registrationDate !== undefined) memberPayload.registration_date = data.registrationDate;
    if (data.notes !== undefined) memberPayload.notes = sanitizeString(data.notes);

    if (Object.keys(memberPayload).length > 0) {
      const { error } = await adminSupabase.from('students').update(memberPayload).eq('id', id);
      if (error) return formatServerErrorResponse(error);
    }

    // Synchronize linked profile if present
    if (currentStudent.profile_id) {
      const profileSync: any = {};
      if (data.englishName !== undefined) profileSync.display_name = sanitizeString(data.englishName);
      if (data.email !== undefined) profileSync.email = sanitizeString(data.email);
      if (data.studentStatus !== undefined) profileSync.is_active = data.studentStatus === 'Active';
      if (Object.keys(profileSync).length > 0) {
        await adminSupabase.from('profiles').update(profileSync).eq('id', currentStudent.profile_id);
      }
    }

    if (data.address) {
      const { data: existingAddr } = await adminSupabase
        .from('student_addresses')
        .select('address_id')
        .eq('student_id', id)
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
        await adminSupabase.from('student_addresses').update(addrFields).eq('address_id', existingAddr.address_id);
      } else {
        await adminSupabase.from('student_addresses').insert({
          student_id: id,
          ...addrFields,
          is_primary: true,
        });
      }
    }

    await logSecurityAuditEvent({
      action: 'STUDENT_UPDATED',
      performedBy: context.userId,
      targetId: id,
      details: { updatedFields: Object.keys(memberPayload) },
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
