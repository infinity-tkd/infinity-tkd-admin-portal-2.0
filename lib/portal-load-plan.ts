/** Dataset order matches the canonical store mapper. Add dependencies here, not in page components. */
import { studentSummaryPages, type StudentSummaryPurpose } from './student-summaries';
export const portalDatasets = ['profiles','members','students','branches','class_sessions','class_enrollments','scholarships','attendance','payments','belt_histories','achievements','library_assets','lms_progress','workout_templates','student_physical_evaluations','belt_techniques','muscles','library_asset_muscles','student_body_compositions','academy_profile','role_permissions','user_permissions','staff_dan_history','partners','payment_transactions','academy_operations_policy','membership_invoices','membership_pauses'] as const;
const common = ['profiles','members','branches','academy_profile','role_permissions','user_permissions','academy_operations_policy'];
const student = ['students','class_sessions','class_enrollments','scholarships'];
const finance = ['payments','payment_transactions','membership_invoices','membership_pauses'];
const learning = ['library_assets','lms_progress','workout_templates','student_physical_evaluations','belt_techniques','muscles','library_asset_muscles'];
const access: Record<string, string[]> = {
  members: ['page:staff'],
  students: ['page:directory', 'page:attendance', 'page:schedule', 'page:financials', 'page:lms', 'page:pos', 'page:dashboard'],
  class_sessions: ['page:schedule', 'page:attendance', 'page:lms', 'page:directory', 'page:financials', 'page:pos', 'page:dashboard'],
  class_enrollments: ['page:schedule', 'page:attendance', 'page:lms', 'page:directory', 'page:financials', 'page:pos', 'page:dashboard'],
  scholarships: ['page:directory', 'page:financials', 'page:pos', 'page:dashboard'],
  attendance: ['page:attendance', 'page:directory', 'page:lms', 'page:dashboard'],
  payments: ['page:financials'], payment_transactions: ['page:financials'], membership_invoices: ['page:financials'],
  membership_pauses: ['page:attendance', 'page:directory', 'page:financials'],
  belt_histories: ['page:directory', 'page:lms', 'page:dashboard'], achievements: ['page:directory', 'page:lms', 'page:dashboard'],
  library_assets: ['page:library', 'page:lms', 'page:directory'], workout_templates: ['page:library', 'page:lms', 'page:directory'],
  lms_progress: ['page:lms', 'page:directory'], student_physical_evaluations: ['page:lms', 'page:directory'],
  belt_techniques: ['page:lms', 'page:library', 'page:directory'], muscles: ['page:library', 'page:lms', 'page:directory'],
  library_asset_muscles: ['page:library', 'page:lms', 'page:directory'], student_body_compositions: ['page:directory', 'page:lms'],
  staff_dan_history: ['page:staff'], partners: ['page:partners'],
};
const routeAccess: Record<string, string[]> = {
  dashboard: ['page:dashboard'], students: ['page:directory'], attendance: ['page:attendance'], schedule: ['page:schedule'],
  financials: ['page:financials'], library: ['page:library'], lms: ['page:lms'], members: ['page:staff'],
  partners: ['page:partners'], settings: ['page:settings'], pos: ['page:pos'], 'pro-shop': ['page:pos'], calendar: ['page:calendar'],
};
export function portalDeniedDatasets(can: (key: string) => boolean): string[] {
  const denied = Object.keys(access).filter(dataset => !access[dataset].some(can));
  if (!can('page:directory')) {
    denied.push('student_directory_details');
    if (!can('page:financials')) denied.push('student_contact_details');
    if (!can('page:lms')) denied.push('student_body_details');
  }
  return denied;
}
export function portalStudentSelect(can: (key: string) => boolean): string {
  if (can('page:directory')) return '*, student_addresses(*)';
  const columns = ['id','khmer_name','english_name','gender','dob','registration_date','scholarship_id','home_branch_id','current_belt','student_status','profile_picture_path','membership_start_date','pause_end_date'];
  if (can('page:financials')) columns.push('email','phone','telegram_username','billing_schedule');
  if (can('page:lms')) columns.push('height_cm','weight_kg');
  return columns.join(',');
}
export function portalStudentPurpose(path:string,can:(key:string)=>boolean):StudentSummaryPurpose|null {
  const route=path.split('/')[1];
  const purpose=route==='pro-shop'?'pos':route;
  if(Object.hasOwn(studentSummaryPages,purpose))return can(studentSummaryPages[purpose as StudentSummaryPurpose])?purpose as StudentSummaryPurpose:null;
  return (Object.keys(studentSummaryPages) as StudentSummaryPurpose[]).find(key=>can(studentSummaryPages[key]))||null;
}
export function portalLoadPlan(path: string, can?: (key: string) => boolean): Set<string> {
  const route = path.split('/')[1];
  const dependencies: Record<string,string[]> = {
    dashboard:[...student,...finance,...learning,'attendance','belt_histories','achievements'],
    students:[...student,...finance,...learning,'attendance','belt_histories','achievements','student_body_compositions'],
    attendance:[...student,'attendance','membership_pauses'],
    schedule:[...student,'attendance'],
    financials:[...student,...finance],
    operations:[...student],
    library:learning,
    lms:[...student,...learning,'attendance','belt_histories','student_body_compositions'],
    members:['class_sessions','staff_dan_history'],
    partners:['partners'],
    settings:[...student,...finance,'attendance','staff_dan_history'],
    pos:[...student], 'pro-shop':[...student], profile:[], calendar:[],
  };
  const visible = !can || !routeAccess[route] || routeAccess[route].some(can);
  const denied = can ? new Set(portalDeniedDatasets(can)) : new Set<string>();
  return new Set([...common,...(visible ? dependencies[route] ?? [] : [])].filter(dataset => !denied.has(dataset)));
}
