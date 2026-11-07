import { z } from 'zod';

export const studentSummaryPurpose = z.enum(['dashboard','attendance','schedule','financials','lms','pos']);
export type StudentSummaryPurpose = z.infer<typeof studentSummaryPurpose>;
export const studentSummaryPages: Record<StudentSummaryPurpose,string> = {
  dashboard:'page:dashboard',attendance:'page:attendance',schedule:'page:schedule',
  financials:'page:financials',lms:'page:lms',pos:'page:pos',
};
const identityFields = ['id','khmer_name','english_name','gender','dob','registration_date','scholarship_id','home_branch_id','current_belt','student_status','profile_picture_path','membership_start_date','pause_end_date'];

/** Staff roster/billing reads are deliberately smaller than directory records. */
export function studentSummaryFields(purpose: StudentSummaryPurpose): string[] {
  return [...identityFields,
    ...(purpose==='financials'?['email','phone','telegram_username','billing_schedule']:[]),
    ...(purpose==='lms'?['height_cm','weight_kg']:[]),
  ];
}
export function projectStudentSummary(row: unknown,purpose: StudentSummaryPurpose) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return {};
  const record = row as Record<string, unknown>;
  return Object.fromEntries(studentSummaryFields(purpose).filter(key=>Object.hasOwn(record,key)).map(key=>[key,record[key]]));
}
