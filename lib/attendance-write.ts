import type { SupabaseClient } from '@supabase/supabase-js';
import { academyDate, isCalendarDate } from './dates';

export interface AttendanceDraft {studentId:string;date:string;status:'Present'|'Late'|'Absent';classId?:number}
interface SavedAttendance {id:number;student_id:string;date:string;status:AttendanceDraft['status'];class_id:number|null}

/** An omitted class means the daily check-in, matching the write operation. */
export function attendanceRemovalIds(records:{id:number;studentId:string;date:string;classId?:number}[],date:string,studentIds:string[],classId?:number) {
  const students=new Set(studentIds);
  return records.filter(row=>row.date===date&&students.has(row.studentId)&&(row.classId??undefined)===classId).map(row=>row.id);
}

export function attendanceBatchPayload(rows: AttendanceDraft[], actor: string, today = academyDate()) {
  if (!actor) throw new Error('Please sign in again before marking attendance.');
  if (!rows.length || rows.length>1000) throw new Error('Choose between 1 and 1000 attendance marks. Narrow the roster for larger groups.');
  const keys=new Set<string>();
  return rows.map(row=>{
    if (!row.studentId || row.studentId.length>50 || !isCalendarDate(row.date) || row.date<'1900-01-01' || row.date>'2100-12-31' || row.date>today || !['Present','Late','Absent'].includes(row.status) || (row.classId!==undefined&&(!Number.isSafeInteger(row.classId)||row.classId<1))) throw new Error('Choose a valid student, class and attendance date. Future attendance cannot be marked.');
    const key=`${row.studentId}/${row.date}/${row.classId??'daily'}`;
    if (keys.has(key)) throw new Error('The attendance batch contains duplicate student sessions.');
    keys.add(key);
    return {student_id:row.studentId,date:row.date,status:row.status,class_id:row.classId??null,marked_by:actor};
  });
}

/** One statement: any rejected mark rolls back the entire roster change. */
export async function saveAttendanceBatch(client: Pick<SupabaseClient,'from'>, rows: AttendanceDraft[], actor: string, ignoreDuplicates = false) {
  const payload=attendanceBatchPayload(rows,actor);
  const {data,error}=await client.from('attendance').upsert(payload,{onConflict:'student_id,date,class_id',ignoreDuplicates}).select().abortSignal(AbortSignal.timeout(15000));
  if (error) {
    if (!error.code || error.code.startsWith('08')) throw new Error('The attendance save could not be confirmed. It may have completed; reload the roster before retrying.');
    throw new Error('Attendance was rejected and this batch was not saved. Check session dates, cancellations, membership pauses and roster access before retrying.');
  }
  if (!Array.isArray(data) || (!ignoreDuplicates && data.length!==rows.length)) throw new Error('The attendance result could not be verified. Reload the roster before retrying.');
  return (data as SavedAttendance[]).map(row=>({id:row.id,studentId:row.student_id,date:row.date,status:row.status,classId:row.class_id??undefined}));
}

/** Return only confirmed deletions; RLS-filtered rows must stay in local state. */
export async function clearAttendanceBatch(client: Pick<SupabaseClient,'from'>, ids: number[]) {
  const unique=[...new Set(ids)];
  if (!unique.length || unique.length>1000 || unique.some(id=>!Number.isSafeInteger(id)||id<1)) throw new Error('Choose between 1 and 1000 attendance records to clear.');
  const {data,error}=await client.from('attendance').delete().in('id',unique).select('id').abortSignal(AbortSignal.timeout(15000));
  if (error || !Array.isArray(data)) throw new Error('The attendance clear could not be confirmed. Reload the roster before retrying.');
  const allowed=new Set(unique);
  return data.map((row:{id:number})=>row.id).filter(id=>allowed.has(id));
}

/** Clear one occurrence, not every class that the student attended that day. */
export async function clearAttendanceMark(client: Pick<SupabaseClient, 'from'>, id: number, studentId: string): Promise<void> {
  if (!Number.isSafeInteger(id) || id < 1 || !studentId || studentId.length > 50) throw new Error('Invalid attendance record.');
  const { data, error } = await client.from('attendance').delete().eq('id', id).eq('student_id', studentId).select('id').abortSignal(AbortSignal.timeout(15000)).maybeSingle();
  if (error) throw new Error('The attendance mark could not be cleared. Reload records to check whether it completed before trying again.');
  if (!data || data.id !== id) throw new Error('No attendance mark was cleared. It may have changed or your access may be restricted. Reload the records.');
}
