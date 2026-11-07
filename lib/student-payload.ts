/** Keep form state and imported CSV columns outside the student API contract. */
const studentFields = [
  'englishName', 'khmerName', 'gender', 'dob', 'phone', 'email', 'telegramUsername',
  'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation',
  'medicalNotes', 'allergies', 'scholarshipId', 'heightCm', 'weightKg',
  'homeBranchId', 'currentBelt', 'studentStatus', 'profilePicturePath', 'esignPath',
  'kukkiwonId', 'nationality', 'registrationDate', 'notes',
] as const;
const addressFields = ['line1', 'line2', 'city', 'stateProvince', 'postalCode', 'country'] as const;

function pick(input: Record<string, unknown>, fields: readonly string[]) {
  return Object.fromEntries(fields.filter(key => input[key] !== undefined).map(key => [key, input[key]]));
}

function studentPayload(input: Record<string, unknown>, fields: readonly string[]) {
  const payload = pick(input, fields);
  for (const key of ['heightCm', 'weightKg']) {
    if (key in payload) {
      const value = payload[key];
      // The existing forms use zero for an unrecorded optional measurement.
      // Preserve invalid negative or malformed values for server validation.
      const numeric = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      payload[key] = value === 0 || value === '0' || value === '' ? null
        : typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : value;
    }
  }
  if (input.address && typeof input.address === 'object' && !Array.isArray(input.address)) {
    const address = pick(input.address as Record<string, unknown>, addressFields);
    const entered = ['line1', 'line2', 'city', 'stateProvince', 'postalCode']
      .some(key => typeof address[key] === 'string' && (address[key] as string).trim() !== '');
    if (entered) payload.address = address;
  }
  return payload;
}

export function createStudentPayload(input: Record<string, unknown>) {
  return studentPayload(input, [...studentFields, 'initialClassId']);
}

export function updateStudentPayload(input: Record<string, unknown>) {
  return studentPayload(input, [...studentFields, 'statusReason', 'pauseEndDate', 'classEnrollmentDate', 'enrollmentId']);
}
