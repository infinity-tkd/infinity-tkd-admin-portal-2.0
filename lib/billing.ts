import { academyDate, calendarDate, daysBetween, isCalendarDate } from './dates';

export interface TuitionSettings { earlyGroupTuitionUsd?:number; standardTuitionUsd?:number; tuitionGracePeriodDays?:number }
type Scholarship = {id:number;typeName:string;discountPercentage:number};
export function tuitionAmount(scholarship:Scholarship|undefined,config:TuitionSettings={}) {
  const early=scholarship?.typeName==='Early Group Student';
  const base=early ? config.earlyGroupTuitionUsd ?? 25 : config.standardTuitionUsd ?? 45;
  const discount=early ? 0 : Math.max(0,Math.min(100,scholarship?.discountPercentage || 0));
  return Math.round(base*(100-discount))/100;
}
export function membershipBilling(
 student:{id:string;registrationDate:string;scholarshipId:number},
 payments:{studentId:string;year:number;month:string;status:string}[],
 scholarships:Scholarship[],enrollments:{studentId:string;enrollmentDate?:string}[],config:TuitionSettings={},now=new Date()
):{status:'Current'|'Due Soon'|'Overdue';nextRenewalDate:string;daysRemaining:number;amountOwed:number} {
 const base=enrollments.filter(e=>e.studentId===student.id).map(e=>e.enrollmentDate?.slice(0,10)).filter((d):d is string=>!!d&&isCalendarDate(d)).sort()[0] || student.registrationDate?.slice(0,10);
 const amount=tuitionAmount(scholarships.find(s=>s.id===student.scholarshipId),config);
 if(!base || !isCalendarDate(base))return {status:'Overdue',nextRenewalDate:'-',daysRemaining:0,amountOwed:amount};
 const today=academyDate(now);const [year,month]=today.split('-').map(Number);const anchor=Number(base.slice(8,10));
 const current=calendarDate(year,month-1,anchor);
 const cycle=today<current ? calendarDate(year,month-2,anchor) : current;
 const next=today<current ? current : calendarDate(year,month,anchor);
 const names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 if(today<base)return {status:'Current',nextRenewalDate:base,daysRemaining:daysBetween(today,base),amountOwed:amount};
 // Keep unpaid earlier cycles visible even when a later month was paid.
 const settled=new Set(payments.filter(p=>p.studentId===student.id&&['Paid','Waived'].includes(p.status)).map(p=>`${p.year}-${p.month}`));
 const [baseYear,baseMonth]=base.split('-').map(Number);
 if(amount>0) for(let index=baseYear*12+baseMonth-1;index<=Number(cycle.slice(0,4))*12+Number(cycle.slice(5,7))-1;index++) {
   const due=calendarDate(Math.floor(index/12),index%12,anchor);
   if(!settled.has(`${Math.floor(index/12)}-${names[index%12]}`))return {status:'Overdue',nextRenewalDate:due,daysRemaining:0-daysBetween(due,today),amountOwed:amount};
 }
 const remaining=daysBetween(today,next);
 return {status:remaining<=(config.tuitionGracePeriodDays??5)?'Due Soon':'Current',nextRenewalDate:next,daysRemaining:remaining,amountOwed:amount};
}

// Collect one outstanding cycle per active sibling; never infer unpaid status
// from missing placeholder rows or charge inactive students.
export function householdTuitionEntries(
 students:{id:string;englishName:string;studentStatus:string;registrationDate:string;scholarshipId:number}[],
 payments:{studentId:string;year:number;month:string;status:string}[],scholarships:Scholarship[],
 enrollments:{studentId:string;enrollmentDate?:string}[],config:TuitionSettings={},now=new Date()
) {
 const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 return students.filter(s=>s.studentStatus==='Active').flatMap(s=>{
  const billing=membershipBilling(s,payments,scholarships,enrollments,config,now);
  if(billing.status==='Current'||billing.amountOwed<=0||!isCalendarDate(billing.nextRenewalDate))return [];
  return [{studentId:s.id,name:s.englishName,year:Number(billing.nextRenewalDate.slice(0,4)),month:months[Number(billing.nextRenewalDate.slice(5,7))-1],amount:billing.amountOwed}];
 });
}
