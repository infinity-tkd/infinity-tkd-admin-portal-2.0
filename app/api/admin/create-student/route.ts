import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  verifyCaller,
  validateRequestBody,
  sanitizeString,
  logSecurityAuditEvent,
  formatServerErrorResponse,
} from '@/lib/backend-security';

const AddressSchema = z
  .object({
    line1: z.string().min(1).max(255),
    line2: z.string().max(255).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    stateProvince: z.string().max(100).optional().nullable(),
    postalCode: z.string().max(20).optional().nullable(),
    country: z.string().max(100).optional().nullable(),
  })
  .strict();

const StudentDataSchema = z
  .object({
    id: z.string().min(1, 'Student ID is required').max(50),
    khmerName: z.string().max(100).optional().nullable(),
    englishName: z.string().min(1, 'English name is required').max(100),
    gender: z.enum(['Male', 'Female', 'Other']).optional().nullable(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be YYYY-MM-DD').optional().nullable(),
    email: z.string().email('Invalid email').or(z.literal('')).optional().nullable(),
    phone: z.string().max(30).optional().nullable(),
    emergencyContactName: z.string().max(100).optional().nullable(),
    emergencyContactPhone: z.string().max(30).optional().nullable(),
    emergencyContactRelation: z.string().max(50).optional().nullable(),
    medicalNotes: z.string().max(1000).optional().nullable(),
    allergies: z.string().max(500).optional().nullable(),
    nationality: z.string().max(50).optional().nullable(),
    currentBelt: z.string().max(50).optional().nullable(),
    studentStatus: z.string().max(30).optional().nullable(),
    profilePicturePath: z.string().max(500).optional().nullable(),
    esignPath: z.string().max(500).optional().nullable(),
    kukkiwonId: z.string().max(50).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    heightCm: z.union([z.number().positive(), z.string()]).optional().nullable(),
    weightKg: z.union([z.number().positive(), z.string()]).optional().nullable(),
    homeBranchId: z.union([z.number().int().positive(), z.string()]).optional().nullable(),
    scholarshipId: z.union([z.number().int().positive(), z.string()]).optional().nullable(),
    registrationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
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

    const rawHeight = typeof studentData.heightCm === 'number' ? studentData.heightCm : parseFloat(String(studentData.heightCm));
    const heightCm = rawHeight && rawHeight > 0 ? rawHeight : null;

    const rawWeight = typeof studentData.weightKg === 'number' ? studentData.weightKg : parseFloat(String(studentData.weightKg));
    const weightKg = rawWeight && rawWeight > 0 ? rawWeight : null;

    const homeBranchId =
      typeof studentData.homeBranchId === 'number'
        ? studentData.homeBranchId
        : parseInt(String(studentData.homeBranchId || '1'), 10) || 1;

    const scholarshipId =
      typeof studentData.scholarshipId === 'number'
        ? studentData.scholarshipId
        : parseInt(String(studentData.scholarshipId || '1'), 10) || 1;

    const id = sanitizeString(studentData.id);
    const registrationDate = studentData.registrationDate
      ? sanitizeString(studentData.registrationDate)
      : new Date().toISOString().split('T')[0];
    const notes = studentData.notes ? sanitizeString(studentData.notes) : null;

    // Duplicate detection check
    const { data: existingStudent, error: checkError } = await adminSupabase
      .from('students')
      .select('id')
      .eq('khmer_name', khmerName)
      .eq('english_name', englishName)
      .eq('dob', dob)
      .eq('gender', studentData.gender)
      .maybeSingle();

    if (checkError) {
      console.error('[create-student API] Error checking duplicate student:', checkError.message);
    }

    if (existingStudent) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'DUPLICATE_STUDENT',
            message: `Duplicate Student: A record with Name '${englishName}', DOB '${dob}', and Gender '${studentData.gender}' already exists (ID: ${existingStudent.id}).`,
          },
        },
        { status: 400 }
      );
    }

    // 1. Insert Student Record
    const { error: sError } = await adminSupabase.from('students').insert({
      id,
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
    });

    if (sError) {
      return formatServerErrorResponse(sError);
    }

    // 2. Insert Address if provided
    const address = studentData.address;
    if (address && address.line1) {
      await adminSupabase.from('student_addresses').insert({
        student_id: id,
        address_line1: sanitizeString(address.line1),
        address_line2: sanitizeString(address.line2 || ''),
        district_commune: sanitizeString(address.city || ''),
        state_province_city: sanitizeString(address.stateProvince || ''),
        postal_code: sanitizeString(address.postalCode || ''),
        country: sanitizeString(address.country || 'Cambodia'),
        is_primary: true,
      });
    }

    // 3. Insert class enrollment if provided
    let enrollmentId: number | undefined;
    if (studentData.initialClassId) {
      const { data: enrData } = await adminSupabase
        .from('class_enrollments')
        .insert({
          student_id: id,
          class_id: studentData.initialClassId,
          enrollment_date: registrationDate,
        })
        .select()
        .single();
      if (enrData) enrollmentId = enrData.id;
    }

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
