import { NextResponse } from 'next/server';
import { z } from 'zod';
import { academyDate,isCalendarDate } from '@/lib/dates';
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
    dob: z.string().refine(d=>isCalendarDate(d)&&d>='1900-01-01'&&d<=academyDate(),'Invalid birth date').optional(),
    phone: z.string().max(50).optional().nullable(),
    email: z.string().max(100).email().or(z.literal('')).optional().nullable(),
    emergencyContactName: z.string().max(100).optional().nullable(),
    emergencyContactPhone: z.string().max(50).optional().nullable(),
    emergencyContactRelation: z.string().max(50).optional().nullable(),
    medicalNotes: z.string().max(2000).optional().nullable(),
    allergies: z.string().max(1000).optional().nullable(),
    scholarshipId: z.number().int().positive().optional().nullable(),
    heightCm: z.number().finite().positive().max(300).optional().nullable(),
    weightKg: z.number().finite().positive().max(600).optional().nullable(),
    homeBranchId: z.number().int().positive().optional().nullable(),
    currentBelt: z.string().max(50).optional(),
    studentStatus: z.enum(['Active','Paused','Inactive','Suspended','Graduated']).optional(),
    statusReason: z.string().max(255).optional().nullable(),
    statusChangedAt: z.string().optional().nullable(),
    pauseEndDate: z.string().refine(d=>d==='' || isCalendarDate(d),'Invalid pause end date').optional().nullable(),
    profilePicturePath: z.string().max(500).optional().nullable(),
    esignPath: z.string().max(500).optional().nullable(),
    kukkiwonId: z.string().max(50).optional().nullable(),
    nationality: z.string().max(50).optional().nullable(),
    registrationDate: z.string().refine(d=>isCalendarDate(d)&&d>='1900-01-01'&&d<=academyDate(),'Invalid registration date').optional(),
    notes: z.string().max(2000).optional().nullable(),
    address: AddressUpdateSchema.optional().nullable(),
    classEnrollmentDate: z.string().refine(d=>d==='' || isCalendarDate(d)&&d>='1900-01-01'&&d<=academyDate(),'Invalid enrollment date').optional(),
    enrollmentId: z.number().int().positive().optional(),
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
      'Assistant Coach',
    ]);
    if (authErr || !adminSupabase || !context) return authErr!;

    const { data: body, errorResponse: valErr } = await validateRequestBody(UpdateStudentRequestSchema, req);
    if (valErr || !body) return valErr!;

    const { id, data } = body;

    // Verify student exists and check tenancy
    const { data: currentStudent, error: fetchErr } = await adminSupabase
      .from('students')
      .select('id, home_branch_id, english_name, profile_id, student_status')
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
      if(data.studentStatus!==currentStudent.student_status)memberPayload.status_changed_at = new Date().toISOString();
    }
    if (data.statusReason !== undefined) memberPayload.status_reason = data.statusReason;
    if (data.pauseEndDate !== undefined) memberPayload.pause_end_date = data.pauseEndDate || null;
    if (data.profilePicturePath !== undefined) memberPayload.profile_picture_path = data.profilePicturePath;
    if (data.esignPath !== undefined) memberPayload.esign_path = data.esignPath;
    if (data.kukkiwonId !== undefined) memberPayload.kukkiwon_id = data.kukkiwonId;
    if (data.nationality !== undefined) memberPayload.nationality = sanitizeString(data.nationality);
    if (data.registrationDate !== undefined) memberPayload.registration_date = data.registrationDate;
    if (data.notes !== undefined) memberPayload.notes = sanitizeString(data.notes);

    const address = data.address;
    const { error: updateError } = await adminSupabase.rpc('portal_update_student_with_enrollment', {
      p_actor: context.userId, p_id: id, p_changes: memberPayload,
      p_enrollment:data.enrollmentId || null,p_enrollment_date:data.classEnrollmentDate || null,
      p_address: address ? { address_line1: sanitizeString(address.line1 || ''), address_line2: sanitizeString(address.line2 || ''), district_commune: sanitizeString(address.city || ''), state_province_city: sanitizeString(address.stateProvince || ''), postal_code: sanitizeString(address.postalCode || ''), country: sanitizeString(address.country || 'Cambodia') } : null,
    });
    if (updateError) return formatServerErrorResponse(updateError);

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
