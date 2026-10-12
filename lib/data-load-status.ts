export interface DataLoadIssue {
  dataset: string;
  label: string;
  code: string;
  reason: 'setup' | 'permission' | 'session' | 'temporary';
}

const datasets: Record<string, { label: string; fields: string[] }> = {
  profiles: { label: 'Staff accounts', fields: ['users'] },
  members: { label: 'Staff details', fields: ['users'] },
  students: { label: 'Students', fields: ['students'] },
  branches: { label: 'Branches', fields: ['branches'] },
  class_sessions: { label: 'Classes', fields: ['classSessions'] },
  class_enrollments: { label: 'Class enrollments', fields: ['classEnrollments'] },
  scholarships: { label: 'Scholarships', fields: ['scholarships'] },
  attendance: { label: 'Attendance', fields: ['attendanceRecords'] },
  payments: { label: 'Monthly payments', fields: ['payments'] },
  payment_transactions: { label: 'Payment receipts and methods', fields: [] },
  belt_histories: { label: 'Belt history', fields: ['beltHistories'] },
  achievements: { label: 'Achievements', fields: ['achievements'] },
  library_assets: { label: 'Library', fields: ['curriculumVideos'] },
  lms_progress: { label: 'Learning progress', fields: ['videoProgress'] },
  workout_templates: { label: 'Workouts', fields: ['workoutTemplates'] },
  student_physical_evaluations: { label: 'Physical evaluations', fields: ['physicalEvaluations'] },
  belt_techniques: { label: 'Belt techniques', fields: ['beltTechniques'] },
  muscles: { label: 'Anatomy', fields: ['muscles'] },
  library_asset_muscles: { label: 'Library anatomy links', fields: ['assetMuscleRelations'] },
  student_body_compositions: { label: 'Body measurements', fields: ['bodyCompositions'] },
  academy_profile: { label: 'Academy settings', fields: ['academyProfile'] },
  // Access rules are not cached across failed reloads; the API verifies grants separately.
  role_permissions: { label: 'Role access rules', fields: [] },
  user_permissions: { label: 'Account access rules', fields: [] },
  staff_dan_history: { label: 'Staff Dan history', fields: ['staffDanRecords'] },
  partners: { label: 'Partners', fields: ['partners'] },
};

/** Show safe diagnostics; database error messages can contain private row values. */
export function dataLoadIssue(dataset: string, error: unknown): DataLoadIssue {
  const code = typeof (error as { code?: unknown })?.code === 'string'
    ? (error as { code: string }).code : '';
  const reason = ['PGRST205', 'PGRST204', 'PGRST200', 'PGRST201', '42P01', '42703'].includes(code)
    ? 'setup' : ['42501', '403'].includes(code) ? 'permission'
    : ['PGRST301', 'PGRST302', '401'].includes(code) ? 'session' : 'temporary';
  return { dataset, label: datasets[dataset]?.label || 'Portal records', code, reason };
}

export function financialDataAffected(issues: DataLoadIssue[]): boolean {
  return issues.some(issue => ['payments', 'payment_transactions', 'students', 'scholarships',
    'branches', 'class_sessions', 'class_enrollments', 'academy_profile'].includes(issue.dataset));
}

/** Keep the last complete records during an outage, without treating them as current. */
export function preserveUnavailableData<T extends object>(previous: T, incoming: T, issues: DataLoadIssue[]): T {
  const next = { ...incoming } as Record<string, unknown>;
  const old = previous as Record<string, unknown>;
  for (const issue of issues) {
    for (const field of datasets[issue.dataset]?.fields || []) next[field] = old[field];
  }
  if (issues.some(issue => issue.dataset === 'payment_transactions') &&
      !issues.some(issue => issue.dataset === 'payments') && Array.isArray(next.payments) && Array.isArray(old.payments)) {
    const receipts = new Map(old.payments.map(payment => [payment.id, payment]));
    next.payments = next.payments.map(payment => ({ ...payment,
      receiptNumber: receipts.get(payment.id)?.receiptNumber,
      paymentMethod: receipts.get(payment.id)?.paymentMethod,
    }));
  }
  return next as T;
}
