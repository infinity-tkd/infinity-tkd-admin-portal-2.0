import { academyDate, calendarDate, daysBetween, isCalendarDate } from './dates';
import { discountedUsd } from './money';

export interface TuitionSettings { earlyGroupTuitionUsd?:number; standardTuitionUsd?:number; tuitionGracePeriodDays?:number; renewalReminderDays?:number; latePaymentGraceDays?:number }
type Scholarship = {id:number;typeName:string;discountPercentage:number};
export interface BillingScheduleChange { id: string; day: number; effectiveMonth: string; previousDay?: number; reason: string; changedBy: string; changedAt: string }
export interface BillingInvoiceSummary { cycleMonth:string; amount:number; balance:number; waiver?:number }
export interface BillingPauseSummary { startDate:string; resumeDate:string; voidedAt?:string|null }
export interface BillingStudent { id:string; registrationDate:string; scholarshipId:number; membershipStartDate?:string; billingSchedule?: BillingScheduleChange[]; billingInvoices?:BillingInvoiceSummary[]; membershipPauses?:BillingPauseSummary[] }
// Per-list lookups. App state replaces these lists instead of editing them, so an index cached
// against the list object stays valid; it turns roster-wide billing from N×M scans into N lookups.
type EnrollmentRow = {studentId:string;enrollmentDate?:string};
type PaymentRow = {studentId:string;year:number;month:string;status:string};
const enrollmentStarts=new WeakMap<readonly EnrollmentRow[],Map<string,string>>();
const settledCycles=new WeakMap<readonly PaymentRow[],Map<string,Set<string>>>();
function firstEnrollmentDate(studentId:string,enrollments:readonly EnrollmentRow[]):string|undefined {
 let index=enrollmentStarts.get(enrollments);
 if(!index){
  index=new Map();
  for(const row of enrollments){
   const date=row.enrollmentDate?.slice(0,10);
   if(!date||!isCalendarDate(date))continue;
   const known=index.get(row.studentId);
   if(!known||date<known)index.set(row.studentId,date);
  }
  enrollmentStarts.set(enrollments,index);
 }
 return index.get(studentId);
}
function settledPaymentCycles(studentId:string,payments:readonly PaymentRow[]):Set<string> {
 let index=settledCycles.get(payments);
 if(!index){
  index=new Map();
  for(const row of payments)if(row.status==='Paid'||row.status==='Waived'){
   const cycles=index.get(row.studentId)??new Set<string>();cycles.add(`${row.year}-${row.month}`);index.set(row.studentId,cycles);
  }
  settledCycles.set(payments,index);
 }
 return index.get(studentId)??new Set();
}
export function billingBaseDate(student: Pick<BillingStudent,'id'|'registrationDate'|'membershipStartDate'>, enrollments:EnrollmentRow[]) {
 if(student.membershipStartDate && isCalendarDate(student.membershipStartDate))return student.membershipStartDate;
 return firstEnrollmentDate(student.id,enrollments) || student.registrationDate?.slice(0,10);
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
/** Same wording as invoice timing (lib/invoice-status.ts): a cycle is "Overdue" only after the late-payment grace. */
export type MembershipBillingStatus='Current'|'Due Soon'|'Due today'|'Within grace'|'Overdue';
export interface MembershipBillingSummary {status:MembershipBillingStatus;nextRenewalDate:string;daysRemaining:number;amountOwed:number}
/** Short timing text for a billing summary, e.g. "Due in 3d", "Due today", "2d late, within grace", "9d overdue". */
export function membershipDueText(billing:Pick<MembershipBillingSummary,'status'|'daysRemaining'>):string {
 const late=Math.max(0,-billing.daysRemaining);
 if(billing.status==='Overdue')return `${late}d overdue`;
 if(billing.status==='Within grace')return `${late}d late, within grace`;
 if(billing.status==='Due today')return 'Due today';
 return `Due in ${billing.daysRemaining}d`;
}
export function membershipBilling(
 student:BillingStudent,
 payments:{studentId:string;year:number;month:string;status:string}[],
 scholarships:Scholarship[],enrollments:{studentId:string;enrollmentDate?:string}[],config:TuitionSettings={},now=new Date()
):MembershipBillingSummary {
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
 const settled=settledPaymentCycles(student.id,payments);
 const [baseYear,baseMonth]=base.split('-').map(Number);
 if(amount>0||student.billingInvoices?.some(invoice=>invoice.balance>0)) for(let index=baseYear*12+baseMonth-1;index<=Number(cycle.slice(0,4))*12+Number(cycle.slice(5,7))-1;index++) {
   const due=billingDueDate(student,enrollments,calendarDate(Math.floor(index/12),index%12,1).slice(0,7));
   const cycleMonth=calendarDate(Math.floor(index/12),index%12,1);
   const invoice=student.billingInvoices?.find(row=>row.cycleMonth===cycleMonth);
   if(!invoice&&amount<=0)continue;
   const cycleEnd=billingDueDate(student,enrollments,calendarDate(Math.floor((index+1)/12),(index+1)%12,1).slice(0,7));
   const paused=student.membershipPauses?.some(pause=>!pause.voidedAt&&pause.startDate<=due&&pause.resumeDate>=cycleEnd);
   if(invoice?.balance===0||(!invoice&&paused))continue;
   if(!settled.has(`${Math.floor(index/12)}-${names[index%12]}`)){
    const late=daysBetween(due,today),grace=Math.max(0,config.latePaymentGraceDays??0);
    return {status:late<=0?'Due today':late<=grace?'Within grace':'Overdue',nextRenewalDate:due,daysRemaining:0-late,amountOwed:invoice?.balance??amount};
   }
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
