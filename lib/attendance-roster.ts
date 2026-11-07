import { academyDate, isCalendarDate } from './dates';
import type { AttendanceDraft } from './attendance-write';

/** Current active enrollment totals shared by schedule selectors and roster cards. */
export function activeClassEnrollmentCounts(
  students: readonly {id:string;studentStatus:string}[],
  enrollments: readonly {studentId:string;classId:number}[],
): Map<number,number> {
  const active=new Set(students.filter(student=>student.studentStatus==='Active').map(student=>student.id));
  const rosters=new Map<number,Set<string>>();
  for(const enrollment of enrollments){
    if(!active.has(enrollment.studentId))continue;
    const roster=rosters.get(enrollment.classId)??new Set<string>();
    roster.add(enrollment.studentId);rosters.set(enrollment.classId,roster);
  }
  return new Map([...rosters].map(([id,roster])=>[id,roster.size]));
}

export interface SavedSessionRoster {
  sessions: {id:string;class_id:number;branch_id:number;starts_at:string;status:string}[];
  roster: {occurrence_id:string;student_id:string}[];
  attendance: {student_id:string;class_id:number|null;date:string}[];
}

/** Commit actual session snapshots, including moved sessions and former enrollments. */
export function unmarkedSessionRoster(data: SavedSessionRoster, date: string, branch: number|'all', lesson: number|'all'): AttendanceDraft[] {
  if (!isCalendarDate(date)) throw new Error('Choose a valid attendance date.');
  if (!Array.isArray(data.sessions)||!Array.isArray(data.roster)||!Array.isArray(data.attendance)) throw new Error('Saved session rosters could not be verified. Reload before committing attendance.');
  if (data.sessions.length>=200) throw new Error('Too many sessions were returned. Mark attendance from the individual session instead.');
  const sessions=new Map(data.sessions.filter(row=>row.status!=='cancelled'&&(branch==='all'||row.branch_id===branch)&&(lesson==='all'||row.class_id===lesson)&&academyDate(new Date(row.starts_at))===date).map(row=>[row.id,row]));
  if (!sessions.size) throw new Error('No saved session is available for this date and class. Review holidays, rescheduled dates and generated sessions in Schedule operations.');
  const marked=new Set(data.attendance.filter(row=>row.date===date).map(row=>`${row.student_id}/${row.class_id??'daily'}`));
  const result: AttendanceDraft[]=[];
  const included=new Set<string>();
  for(const member of data.roster){
    const session=sessions.get(member.occurrence_id);
    if(!session)continue;
    const key=`${member.student_id}/${session.class_id}`;
    if(marked.has(key)||included.has(key))continue;
    included.add(key);
    result.push({studentId:member.student_id,date,classId:session.class_id,status:'Absent'});
  }
  return result;
}
