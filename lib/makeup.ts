import { academyDate, addCalendarDays, daysBetween, isCalendarDate } from './dates';

export interface MakeupStudent { id: string; englishName: string; registrationDate: string; studentStatus: string }
export interface MakeupClass { id: number; name: string; daysOfWeek: string[]; startTime: string; endTime: string; coachId?: string; branchId?:number }
export interface MakeupOccurrence {id:string;class_id:number;source_date:string;starts_at:string;ends_at:string;class_name:string;coach_id?:string;status:string}
export interface MakeupRecord { id: string; student_id: string; source_class_id: number; source_date: string; attended_date: string; target_class_id?: number | null; status: 'Present'|'Late'; reason: string; voided_at?: string | null }
export interface MakeupCandidate { occurrenceId?: string; key: string; studentId: string; studentName: string; classId: number; className: string; sourceDate: string; sourceStatus: 'Absent'|'Unmarked'; coachId?: string }
export function makeupCandidates(data: { students: MakeupStudent[]; classes: MakeupClass[]; enrollments: { studentId:string;classId:number;enrollmentDate?:string }[]; attendance: {studentId:string;classId?:number;date:string;status:string}[]; makeups: MakeupRecord[];occurrences?:MakeupOccurrence[];roster?:{occurrence_id:string;student_id:string}[];holidays?:{start_date:string;end_date:string;branch_id?:number|null}[];pauses?:{student_id:string;start_date:string;resume_date:string;voided_at?:string|null}[] }, from: string, to: string, now = new Date()): MakeupCandidate[] {
 if(!isCalendarDate(from)||!isCalendarDate(to)||from>to||daysBetween(from,to)>93) throw new Error('Choose a valid date range of up to 93 days.');
 const marks=new Map(data.attendance.map(row=>[`${row.studentId}:${row.classId}:${row.date}`,row.status]));
 const used=new Set(data.makeups.filter(row=>!row.voided_at).map(row=>`${row.student_id}:${row.source_class_id}:${row.source_date}`));
 const students=new Map(data.students.filter(row=>row.studentStatus==='Active').map(row=>[row.id,row]));
 const classes=new Map(data.classes.map(row=>[row.id,row]));const result:MakeupCandidate[]=[];
 const dated=new Set((data.occurrences??[]).flatMap(row=>[`${row.class_id}:${row.source_date}`,`${row.class_id}:${academyDate(new Date(row.starts_at))}`]));
 const paused=(student:string,date:string)=>(data.pauses??[]).some(row=>row.student_id===student&&!row.voided_at&&row.start_date<=date&&row.resume_date>date);
 for(const occurrence of data.occurrences??[]){const date=academyDate(new Date(occurrence.starts_at));if(date<from||date>to||occurrence.status==='cancelled'||Date.parse(occurrence.ends_at)+30*60000>now.getTime())continue;
  for(const member of (data.roster??[]).filter(row=>row.occurrence_id===occurrence.id)){const student=students.get(member.student_id);if(!student||paused(student.id,date)||date<student.registrationDate)continue;const key=`${student.id}:${occurrence.class_id}:${date}`,status=marks.get(key);if(used.has(key)||status==='Present'||status==='Late')continue;result.push({occurrenceId:occurrence.id,key,studentId:student.id,studentName:student.englishName,classId:occurrence.class_id,className:occurrence.class_name,sourceDate:date,sourceStatus:status==='Absent'?'Absent':'Unmarked',coachId:occurrence.coach_id});}
 }
 for(const enrollment of data.enrollments){
  const student=students.get(enrollment.studentId),lesson=classes.get(enrollment.classId);if(!student||!lesson)continue;
  const base=[student.registrationDate,enrollment.enrollmentDate].filter(Boolean).sort().at(-1)!;
  for(let date=from;date<=to && date<=academyDate(now);date=addCalendarDays(date,1)){
   if(date<base)continue;
   if(dated.has(`${lesson.id}:${date}`)||paused(student.id,date)||(data.holidays??[]).some(row=>row.start_date<=date&&row.end_date>=date&&(row.branch_id==null||row.branch_id===lesson.branchId)))continue;
   const weekday=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(date+'T00:00:00Z').getUTCDay()];
   if(!lesson.daysOfWeek.includes(weekday)||!/^\d{2}:\d{2}/.test(lesson.endTime))continue;
   const endDate=lesson.endTime<=lesson.startTime?addCalendarDays(date,1):date;
   const end=new Date(`${endDate}T${lesson.endTime.slice(0,8).length===5?lesson.endTime.slice(0,5)+':00':lesson.endTime.slice(0,8)}+07:00`).getTime();
   if(!Number.isFinite(end)||end+30*60000>now.getTime())continue;
   const key=`${student.id}:${lesson.id}:${date}`;const status=marks.get(key);
   if(used.has(key)||status==='Present'||status==='Late')continue;
   result.push({key,studentId:student.id,studentName:student.englishName,classId:lesson.id,className:lesson.name,sourceDate:date,sourceStatus:status==='Absent'?'Absent':'Unmarked',coachId:lesson.coachId});
  }
 }
 return result.sort((a,b)=>b.sourceDate.localeCompare(a.sourceDate)||a.studentName.localeCompare(b.studentName));
}

