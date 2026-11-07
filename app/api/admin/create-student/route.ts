
import { academyDate, isCalendarDate } from '@/lib/dates';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { telegramUsernameSchema } from '@/lib/contact-validation';
import {
  verifyCaller,
  validateRequestBody,
  sanitizeString,
  logSecurityAuditEvent,
  formatServerErrorResponse,
} from '@/lib/backend-security';

const AddressSchema = z
  .object({
    line1: z.string().trim().min(1).max(255),
    line2: z.string().max(255).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    stateProvince: z.string().max(100).optional().nullable(),
    postalCode: z.string().max(20).optional().nullable(),
    country: z.string().max(100).optional().nullable(),
  })
  .strict();

const StudentDataSchema = z
  .object({
    khmerName: z.string().trim().min(1, 'Khmer name is required').max(100),
    englishName: z.string().trim().min(1, 'English name is required').max(100),
    gender: z.enum(['Male', 'Female']),
    dob: z.string().refine(d => isCalendarDate(d) && d >= '1900-01-01' && d <= academyDate(), 'Enter a valid birth date that is not in the future'),
    email: z.string().email('Invalid email').or(z.literal('')).optional().nullable(),
    phone: z.string().max(30).optional().nullable(),
    telegramUsername: telegramUsernameSchema,
    emergencyContactName: z.string().max(100).optional().nullable(),
    emergencyContactPhone: z.string().max(30).optional().nullable(),
    emergencyContactRelation: z.string().max(50).optional().nullable(),
    medicalNotes: z.string().max(1000).optional().nullable(),
    allergies: z.string().max(500).optional().nullable(),
    nationality: z.string().max(50).optional().nullable(),
    currentBelt: z.string().max(50).optional().nullable(),
    studentStatus: z.enum(['Active', 'Paused', 'Inactive', 'Suspended', 'Graduated']).optional(),
    profilePicturePath: z.string().max(500).optional().nullable(),
    esignPath: z.string().max(500).optional().nullable(),
    kukkiwonId: z.string().max(50).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    heightCm: z.number().finite().positive().max(300).optional().nullable(),
    weightKg: z.number().finite().positive().max(600).optional().nullable(),
    homeBranchId: z.number().int().positive().max(2147483647).optional(),
    scholarshipId: z.number().int().positive().max(2147483647).optional(),
    registrationDate: z.string().refine(d => isCalendarDate(d) && d >= '1900-01-01' && d <= academyDate(), 'Enter a valid registration date that is not in the future').optional(),
    address: AddressSchema.optional().nullable(),
    initialClassId: z.number().int().positive().optional().nullable(),
  })
  .strict();

const CreateStudentRequestSchema = z
  .object({
    studentData: StudentDataSchema,
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

    const { data: body, errorResponse: valErr } = await validateRequestBody(CreateStudentRequestSchema, req);
    if (valErr || !body) return valErr!;

    const { studentData } = body;

    const khmerName = sanitizeString(studentData.khmerName || '');
    const englishName = sanitizeString(studentData.englishName);
    const dob = sanitizeString(studentData.dob || '');
    const email = sanitizeString(studentData.email || '');
    const phone = sanitizeString(studentData.phone || '');
    const emergencyContactName = sanitizeString(studentData.emergencyContactName || '');
    const emergencyContactPhone = sanitizeString(studentData.emergencyContactPhone || '');
    const emergencyContactRelation = sanitizeString(studentData.emergencyContactRelation || '');
    const medicalNotes = sanitizeString(studentData.medicalNotes || '');
    const allergies = sanitizeString(studentData.allergies || '');
    const nationality = sanitizeString(studentData.nationality || '');
    const currentBelt = sanitizeString(studentData.currentBelt || 'White');
    const studentStatus = sanitizeString(studentData.studentStatus || 'Active');
    const esignPath = studentData.esignPath ? sanitizeString(studentData.esignPath) : null;

    const heightCm = studentData.heightCm ?? null;
    const weightKg = studentData.weightKg ?? null;
    const homeBranchId = studentData.homeBranchId ?? 1;
    const scholarshipId = studentData.scholarshipId ?? 1;


    const registrationDate = studentData.registrationDate
      ? sanitizeString(studentData.registrationDate)
      : academyDate();
    const notes = studentData.notes ? sanitizeString(studentData.notes) : null;

    // The transaction checks duplicates under a lock and ignores archived records.
    // A separate preflight query can race or incorrectly block re-registration.
    if (!englishName || !khmerName) return NextResponse.json({success:false,error:{code:'VALIDATION_FAILED',message:'Invalid input. Student names are required.'}},{status:422});

    const address = studentData.address;
    const { data: saved, error: saveError } = await adminSupabase.rpc('portal_create_student', {
      p_actor: context.userId, p_student: {
      khmer_name: khmerName,
      english_name: englishName,
      gender: studentData.gender || null,
      dob: dob || null,
      registration_date: registrationDate,
      scholarship_id: scholarshipId,
      height_cm: heightCm,
      weight_kg: weightKg,
      home_branch_id: homeBranchId,
      current_belt: currentBelt,
      student_status: studentStatus,
      email,
      phone,
      telegram_username: studentData.telegramUsername ?? null,
      emergency_contact_name: emergencyContactName,
      emergency_contact_phone: emergencyContactPhone,
      emergency_contact_relation: emergencyContactRelation,
      medical_notes: medicalNotes,
      allergies,
      nationality,
      profile_picture_path: studentData.profilePicturePath ? sanitizeString(studentData.profilePicturePath) : null,
      esign_path: esignPath,
      kukkiwon_id: studentData.kukkiwonId ? sanitizeString(studentData.kukkiwonId) : null,
      notes,
      },
      p_address: address?.line1 ? { address_line1: sanitizeString(address.line1), address_line2: sanitizeString(address.line2 || ''), district_commune: sanitizeString(address.city || ''), state_province_city: sanitizeString(address.stateProvince || ''), postal_code: sanitizeString(address.postalCode || ''), country: sanitizeString(address.country || 'Cambodia') } : null,
      p_class_id: studentData.initialClassId || null,
    });
    if (saveError || !saved) return formatServerErrorResponse(saveError || new Error('Registration failed'));
    const id = saved.id;
    const enrollmentId = saved.enrollmentId;

    await logSecurityAuditEvent({
      action: 'STUDENT_REGISTERED',
      performedBy: context.userId,
      targetId: id,
      details: { englishName, homeBranchId },
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      data: {
        id,
        registrationDate,
        khmerName,
        englishName,
        dob,
        email,
        phone,
        telegramUsername: studentData.telegramUsername ?? null,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelation,
        medicalNotes,
        allergies,
        currentBelt,
        enrollmentId,
      },
      error: null,
    });
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}
