import type { SupabaseClient } from '@supabase/supabase-js';

export class StudentOwnershipError extends Error {
  readonly code = '42501';
  constructor() {
    super('Student access is unavailable. Ask the academy to review the account link.');
  }
}

/** Resolve one explicit student link; never union contradictory identity records. */
export async function resolveOwnedStudentIds(client: SupabaseClient, userId: string): Promise<string[]> {
  const [profileResult, reverseResult] = await Promise.all([
    client.from('profiles').select('id,role,is_active,must_change_password,student_id').eq('id', userId).maybeSingle(),
    client.from('students').select('id,profile_id,deleted_at,student_status').eq('profile_id', userId).limit(2),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (reverseResult.error) throw reverseResult.error;
  const profile = profileResult.data;
  const reverse = reverseResult.data ?? [];
  if (!profile || profile.role !== 'Student' || profile.is_active !== true || profile.must_change_password || reverse.length > 1) {
    throw new StudentOwnershipError();
  }
  let student = reverse[0];
  if (profile.student_id) {
    const forwardResult = await client.from('students').select('id,profile_id,deleted_at,student_status').eq('id', profile.student_id).maybeSingle();
    if (forwardResult.error) throw forwardResult.error;
    const forward = forwardResult.data;
    if (!forward || (student && student.id !== forward.id) || (forward.profile_id && forward.profile_id !== userId)) {
      throw new StudentOwnershipError();
    }
    student = forward;
  }
  if (!student) return [];
  if (student.deleted_at || !['Active', 'Paused', 'Inactive', 'Graduated'].includes(student.student_status)) {
    throw new StudentOwnershipError();
  }
  const claimants = await client.from('profiles').select('id').eq('student_id', student.id).limit(2);
  if (claimants.error) throw claimants.error;
  if ((claimants.data ?? []).some(row => row.id !== userId) || (claimants.data?.length ?? 0) > 1) {
    throw new StudentOwnershipError();
  }
  return [student.id];
}
