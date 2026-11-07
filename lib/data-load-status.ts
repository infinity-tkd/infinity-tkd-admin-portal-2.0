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
  academy_operations_policy: {label:'Renewal and grace policy',fields:['academyProfile']},
  membership_invoices: {label:'Invoice balances',fields:[]},
  membership_pauses: {label:'Approved membership pauses',fields:[]},
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
    'branches', 'class_sessions', 'class_enrollments', 'academy_profile','academy_operations_policy','membership_invoices','membership_pauses'].includes(issue.dataset));
}

/** Keep the last complete records during an outage, without treating them as current. */
export function restrictPortalData<T extends object>(state: T, denied: string[], accountManagementAllowed = false): T {
  const next = { ...state } as Record<string, unknown>;
  for (const dataset of denied) for (const field of datasets[dataset]?.fields || []) if (dataset !== 'members') next[field] = [];
  if (denied.includes('members') && !denied.includes('profiles') && Array.isArray(next.users)) {
    const allowed = ['id', 'displayName', 'role', 'isActive'];
    if (accountManagementAllowed) allowed.push('username', 'email', 'studentId', 'mustChangePassword', 'khmerName', 'phone', 'profilePicturePath');
    next.users = next.users.map(user => Object.fromEntries(allowed.filter(key => Object.hasOwn(user, key)).map(key => [key, user[key]])));
  }
  if (Array.isArray(next.students) && (denied.includes('membership_invoices') || denied.includes('membership_pauses'))) {
    next.students = next.students.map(student => ({ ...student,
      ...(denied.includes('membership_invoices') ? {billingInvoices: undefined} : {}),
      ...(denied.includes('membership_pauses') ? {membershipPauses: undefined} : {}),
    }));
  }
  if (denied.includes('student_directory_details') && Array.isArray(next.students)) {
    const allowed = ['id','khmerName','englishName','gender','dob','registrationDate','scholarshipId','homeBranchId','currentBelt','studentStatus','profilePicturePath','membershipStartDate','pauseEndDate','membershipPauses','billingInvoices'];
    if (!denied.includes('student_contact_details')) allowed.push('email','phone','telegramUsername','billingSchedule');
    if (!denied.includes('student_body_details')) allowed.push('heightCm','weightKg');
    next.students = next.students.map(student => Object.fromEntries(allowed.filter(key => Object.hasOwn(student,key)).map(key => [key,student[key]])));
  }
  return next as T;
}

export function preserveUnavailableData<T extends object>(previous: T, incoming: T, issues: DataLoadIssue[], unrequested: string[] = [], denied: string[] = [], accountManagementAllowed = false): T {
  const next = { ...incoming } as Record<string, unknown>;
  const old = previous as Record<string, unknown>;
  // Profiles own the account list. Members only enrich those accounts; a
  // skipped member read must not replace fresh account or staff-label rows.
  for(const dataset of unrequested)if(dataset!=='members')for(const field of datasets[dataset]?.fields||[])next[field]=old[field];
  for (const issue of issues) {
    if (issue.dataset !== 'members' && issue.reason !== 'permission' && issue.reason !== 'session') for (const field of datasets[issue.dataset]?.fields || []) next[field] = old[field];
  }
  const unavailable = new Set([...unrequested, ...issues.filter(issue => issue.reason !== 'permission' && issue.reason !== 'session').map(issue => issue.dataset)]);
  const restrictions = [...new Set([...denied, ...issues.filter(issue => issue.reason === 'permission' || issue.reason === 'session').map(issue => issue.dataset)])];
  if (unavailable.has('members') && !restrictions.includes('members') && Array.isArray(next.users) && Array.isArray(old.users)) {
    const memberFields = ['khmerName','englishName','gender','dob','phone','telegramUsername','emergencyContactName','emergencyContactPhone','emergencyContactRelation','medicalNotes','allergies','profilePicturePath','nationality','address'];
    const cached = new Map(old.users.map(user => [user.id, user]));
    next.users = next.users.map(user => {
      const member = cached.get(user.id);
      return member ? {...user, ...Object.fromEntries(memberFields.filter(key => Object.hasOwn(member, key)).map(key => [key, member[key]]))} : user;
    });
  }
  if (Array.isArray(next.students) && Array.isArray(old.students) && (unavailable.has('membership_invoices') || unavailable.has('membership_pauses'))) {
    const cached = new Map(old.students.map(student => [student.id, student]));
    next.students = next.students.map(student => ({ ...student,
      ...(unavailable.has('membership_invoices') ? { billingInvoices: cached.get(student.id)?.billingInvoices } : {}),
      ...(unavailable.has('membership_pauses') ? { membershipPauses: cached.get(student.id)?.membershipPauses } : {}),
    }));
  }
  if (issues.some(issue => issue.dataset === 'payment_transactions' && issue.reason !== 'permission' && issue.reason !== 'session') &&
      !issues.some(issue => issue.dataset === 'payments') && Array.isArray(next.payments) && Array.isArray(old.payments)) {
    const receipts = new Map(old.payments.map(payment => [payment.id, payment]));
    next.payments = next.payments.map(payment => ({ ...payment,
      receiptNumber: receipts.get(payment.id)?.receiptNumber,
      paymentMethod: receipts.get(payment.id)?.paymentMethod,
    }));
  }
  return restrictPortalData(next as T, restrictions, accountManagementAllowed);
}
