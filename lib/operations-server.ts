import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from './data-access';
import { NextResponse } from 'next/server';
import { formatServerErrorResponse } from './backend-security';
import { resolveOwnedStudentIds } from './student-ownership';
export async function featureRows(query: any): Promise<any[]> { const result=await fetchAllRows(query);if(result.error)throw result.error;return result.data ?? []; }
export async function ownedStudentIds(client:SupabaseClient,userId:string):Promise<string[]> {
 return resolveOwnedStudentIds(client,userId);
}
export function featureError(error: unknown) {
 const code=(error as {code?:string})?.code;
 if(['42P01','42703','PGRST202','PGRST204','PGRST205'].includes(code ?? ''))return NextResponse.json({success:false,error:{code:'DATABASE_FEATURE_SETUP_REQUIRED',message:'Membership, makeup and notification setup is incomplete. Apply the feature SQL migration and retry.'}},{status:503,headers:{'Cache-Control':'no-store'}});
 return formatServerErrorResponse(error);
}
export async function loadMakeupData(client:SupabaseClient,from:string,to:string,studentId?:string){
 let students=client.from('students').select('id,english_name,registration_date,student_status').is('deleted_at',null);
 if(studentId)students=students.eq('id',studentId);
 const studentRows=await featureRows(students);
 if(!studentRows.length)return {students:[],classes:[],enrollments:[],attendance:[],makeups:[]};
 const ids=studentRows.map(row=>row.id);
 const [classes,enrollments,attendance,makeups,occurrences,holidays,pauses]=await Promise.all([
  featureRows(client.from('class_sessions').select('id,class_name,days_of_week,day_of_week,start_time,end_time,coach_id,head_coach_id,branch_id')),
  featureRows(client.from('class_enrollments').select('id,student_id,class_id,enrollment_date').in('student_id',ids)),
  featureRows(client.from('attendance').select('id,student_id,class_id,date,status').in('student_id',ids).gte('date',from).lte('date',to)),
  featureRows(client.from('makeup_attendance').select('*').in('student_id',ids).gte('source_date',from).lte('source_date',to)),
  featureRows(client.from('class_occurrences').select('*').or(`and(source_date.gte.${from},source_date.lte.${to}),and(starts_at.gte.${from}T00:00:00+07:00,starts_at.lte.${to}T23:59:59+07:00)`)),
  featureRows(client.from('academy_holidays').select('id,start_date,end_date,branch_id').is('voided_at',null).lte('start_date',to).gte('end_date',from)),
  featureRows(client.from('membership_pauses').select('id,student_id,start_date,resume_date,voided_at').in('student_id',ids).is('voided_at',null).lte('start_date',to).gte('resume_date',from)),
 ]);
 const occurrenceIds=occurrences.map(row=>row.id);const roster=occurrenceIds.length?await featureRows(client.from('class_occurrence_roster').select('occurrence_id,student_id').in('occurrence_id',occurrenceIds).in('student_id',ids)):[];
 return {occurrences,roster,holidays,pauses,students:studentRows.map(row=>({id:row.id,englishName:row.english_name,registrationDate:row.registration_date,studentStatus:row.student_status})),classes:classes.map(row=>({id:row.id,name:row.class_name,branchId:row.branch_id,daysOfWeek:row.days_of_week?.length?row.days_of_week:[row.day_of_week],startTime:row.start_time,endTime:row.end_time,coachId:row.coach_id||row.head_coach_id})),enrollments:enrollments.map(row=>({studentId:row.student_id,classId:row.class_id,enrollmentDate:row.enrollment_date})),attendance:attendance.map(row=>({studentId:row.student_id,classId:row.class_id ?? undefined,date:row.date,status:row.status})),makeups};
}
