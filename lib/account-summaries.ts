/** Fields used by Settings account management, without staff dossiers or credentials. */
export const accountSummaryFields = ['id', 'username', 'email', 'display_name', 'role', 'is_active', 'student_id', 'must_change_password'] as const;
export const accountMemberFields = ['id', 'khmer_name', 'phone', 'profile_picture_path'] as const;

export function accountSourceRow(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Account summary returned an invalid row.');
  return value as Record<string, unknown>;
}

export function projectAccountSummary(profile: unknown, member?: unknown) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return {};
  const row = profile as Record<string, unknown>;
  const details = member && typeof member === 'object' && !Array.isArray(member) ? member as Record<string, unknown> : {};
  return {
    ...Object.fromEntries(accountSummaryFields.filter(key => Object.hasOwn(row, key)).map(key => [key, row[key]])),
    member_summary: Object.fromEntries(accountMemberFields.filter(key => key !== 'id' && Object.hasOwn(details, key)).map(key => [key, details[key]])),
  };
}
