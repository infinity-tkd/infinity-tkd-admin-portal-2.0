/** Shared staff labels never include contact, medical or credential details. */
export const staffSummaryFields = ['id', 'display_name', 'role', 'is_active'] as const;
export const staffSummaryPages = [
  'page:dashboard', 'page:directory', 'page:attendance', 'page:schedule',
  'page:financials', 'page:library', 'page:lms', 'page:staff',
  'page:partners', 'page:calendar', 'page:settings', 'page:pos',
] as const;
export const staffRoles = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];

export function projectStaffSummary(row: unknown) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return {};
  const record = row as Record<string, unknown>;
  return Object.fromEntries(staffSummaryFields.filter(key => Object.hasOwn(record, key)).map(key => [key, record[key]]));
}
