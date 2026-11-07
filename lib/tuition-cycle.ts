import { billingBaseDate, billingDueDate, tuitionAmount, type BillingStudent, type TuitionSettings } from './billing';
import { calendarDate } from './dates';
interface Payment {status:string;amountUsd?:number;verifiedCollection?:boolean}
interface Scholarship {id:number;typeName:string;discountPercentage:number}
const cents=(value:number)=>Math.round(value*100)/100;
/** An invoice is authoritative; a current tariff is only an unbilled-cycle estimate. */
export function tuitionCycle(student:BillingStudent,month:string,payment:Payment|undefined,scholarship:Scholarship|undefined,enrollments:{studentId:string;enrollmentDate?:string}[],settings:TuitionSettings={}) {
 const base=billingBaseDate(student,enrollments), invoice=student.billingInvoices?.find(row=>row.cycleMonth.slice(0,7)===month);
 const early=scholarship?.typeName==='Early Group Student';
 const tariff=early?settings.earlyGroupTuitionUsd??25:settings.standardTuitionUsd??45;
 const cash=payment&&(payment.status==='Paid'||payment.verifiedCollection)?cents(payment.amountUsd??tuitionAmount(scholarship,settings)):0;
 const legacyPaid=payment?.status==='Paid';
 const amount=invoice?.amount??(legacyPaid?cash:tuitionAmount(scholarship,settings));
 const [year,number]=month.split('-').map(Number),due=billingDueDate(student,enrollments,month),end=billingDueDate(student,enrollments,calendarDate(year,number,1).slice(0,7));
 const covered=student.membershipPauses?.some(pause=>!pause.voidedAt&&pause.startDate<=due&&pause.resumeDate>=end);
 const waived=invoice?Number(invoice.waiver??0)>=amount&&Number(invoice.waiver??0)>0||amount===0:!legacyPaid&&(covered||payment?.status==='Waived'||amount===0);
 const before=!!base&&month<base.slice(0,7);
 const balance=before?0:invoice?Math.max(0,invoice.balance):legacyPaid||waived?0:amount;
 const net=before||waived?0:amount;
 const gross=invoice||legacyPaid?net:before?0:tariff;
 return {amount:net,gross,discount:cents(Math.max(0,gross-net)),balance:cents(balance),cash:before?0:cash,settled:balance===0,waived:Boolean(waived),invoice:Boolean(invoice)};
}
