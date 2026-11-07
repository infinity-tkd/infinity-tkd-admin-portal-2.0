import { academyDate, calendarDate, daysBetween, isCalendarDate } from './dates';
import { discountedUsd } from './money';

export interface TuitionSettings { earlyGroupTuitionUsd?:number; standardTuitionUsd?:number; tuitionGracePeriodDays?:number; renewalReminderDays?:number; latePaymentGraceDays?:number }
type Scholarship = {id:number;typeName:string;discountPercentage:number};
export interface BillingScheduleChange { id: string; day: number; effectiveMonth: string; previousDay?: number; reason: string; changedBy: string; changedAt: string }
export interface BillingInvoiceSummary { cycleMonth:string; amount:number; balance:number; waiver?:number }
export interface BillingPauseSummary { startDate:string; resumeDate:string; voidedAt?:string|null }
export interface BillingStudent { id:string; registrationDate:string; scholarshipId:number; membershipStartDate?:string; billingSchedule?: BillingScheduleChange[]; billingInvoices?:BillingInvoiceSummary[]; membershipPauses?:BillingPauseSummary[] }
export function billingBaseDate(student: Pick<BillingStudent,'id'|'registrationDate'|'membershipStartDate'>, enrollments:{studentId:string;enrollmentDate?:string}[]) {
 if(student.membershipStartDate && isCalendarDate(student.membershipStartDate))return student.membershipStartDate;
 return enrollments.filter(e=>e.studentId===student.id).map(e=>e.enrollmentDate?.slice(0,10)).filter((d):d is string=>!!d&&isCalendarDate(d)).sort()[0] || student.registrationDate?.slice(0,10);
}
export function billingDueDate(student: BillingStudent, enrollments:{studentId:string;enrollmentDate?:string}[], month: string) {
 const base=billingBaseDate(student,enrollments);
 if(!isCalendarDate(base || '') || !isCalendarDate(`${month}-01`)) return '-';
 const changes=(student.billingSchedule ?? []).filter(change=>change.effectiveMonth.slice(0,7)<=month && Number.isInteger(change.day) && change.day>=1 && change.day<=31).sort((a,b)=>b.effectiveMonth.localeCompare(a.effectiveMonth)||b.changedAt.localeCompare(a.changedAt));
 const [year,number]=month.split('-').map(Number);
 const due=calendarDate(year,number-1,changes[0]?.day ?? Number(base.slice(8,10)));
 return month===base.slice(0,7)&&due<base?base:due;
}
/** Display the academy billing day without converting a date into device-local time. */
export function billingDueDay(student: BillingStudent, enrollments:{studentId:string;enrollmentDate?:string}[], month: string): number|null {
 const due=billingDueDate(student,enrollments,month);
 return isCalendarDate(due)?Number(due.slice(8,10)):null;
}
export function tuitionAmount(scholarship:Scholarship|undefined,config:TuitionSettings={}) {
  const early=scholarship?.typeName==='Early Group Student';
  const base=early ? config.earlyGroupTuitionUsd ?? 25 : config.standardTuitionUsd ?? 45;
  const discount=early ? 0 : Math.max(0,Math.min(100,scholarship?.discountPercentage || 0));
  return discountedUsd(base,discount);
}
export function membershipBilling(
 student:BillingStudent,
 payments:{studentId:string;year:number;month:string;status:string}[],
 scholarships:Scholarship[],enrollments:{studentId:string;enrollmentDate?:string}[],config:TuitionSettings={},now=new Date()
):{status:'Current'|'Due Soon'|'Overdue';nextRenewalDate:string;daysRemaining:number;amountOwed:number} {
 const base=billingBaseDate(student,enrollments);
 const amount=tuitionAmount(scholarships.find(s=>s.id===student.scholarshipId),config);
 if(!base || !isCalendarDate(base))return {status:'Overdue',nextRenewalDate:'-',daysRemaining:0,amountOwed:amount};
 const today=academyDate(now);const [year,month]=today.split('-').map(Number);
 const current=billingDueDate(student,enrollments,calendarDate(year,month-1,1).slice(0,7));
 const cycle=today<current ? calendarDate(year,month-2,1) : current;
 const next=today<current ? current : billingDueDate(student,enrollments,calendarDate(year,month,1).slice(0,7));
 const names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 if(today<base)return {status:'Current',nextRenewalDate:base,daysRemaining:daysBetween(today,base),amountOwed:amount};
 // Keep unpaid earlier cycles visible even when a later month was paid.
 const settled=new Set(payments.filter(p=>p.studentId===student.id&&['Paid','Waived'].includes(p.status)).map(p=>`${p.year}-${p.month}`));
 const [baseYear,baseMonth]=base.split('-').map(Number);
 if(amount>0||student.billingInvoices?.some(invoice=>invoice.balance>0)) for(let index=baseYear*12+baseMonth-1;index<=Number(cycle.slice(0,4))*12+Number(cycle.slice(5,7))-1;index++) {
   const due=billingDueDate(student,enrollments,calendarDate(Math.floor(index/12),index%12,1).slice(0,7));
   const cycleMonth=calendarDate(Math.floor(index/12),index%12,1);
   const invoice=student.billingInvoices?.find(row=>row.cycleMonth===cycleMonth);
   if(!invoice&&amount<=0)continue;
   const cycleEnd=billingDueDate(student,enrollments,calendarDate(Math.floor((index+1)/12),(index+1)%12,1).slice(0,7));
   const paused=student.membershipPauses?.some(pause=>!pause.voidedAt&&pause.startDate<=due&&pause.resumeDate>=cycleEnd);
   if(invoice?.balance===0||(!invoice&&paused))continue;
   if(!settled.has(`${Math.floor(index/12)}-${names[index%12]}`))return {status:'Overdue',nextRenewalDate:due,daysRemaining:0-daysBetween(due,today),amountOwed:invoice?.balance??amount};
 }
 const remaining=daysBetween(today,next);
 return {status:remaining<=(config.renewalReminderDays??5)?'Due Soon':'Current',nextRenewalDate:next,daysRemaining:remaining,amountOwed:amount};
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
