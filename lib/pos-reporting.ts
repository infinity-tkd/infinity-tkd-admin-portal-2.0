/** Pending, voided and refunded orders are records, but not collected revenue. */
/** Mirrors portal_refund_order: paid (or refund-pending) orders, including paid orders cancelled later. Unknown legacy states are left to the server. */
export function isRefundableSale(order: { paymentStatus?: string }): boolean {
  return order.paymentStatus === undefined || order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUND_PENDING';
}
export function isCollectedSale(order: { paymentStatus?: string; orderStatus?: string }): boolean {
  return order.paymentStatus === 'PAID' && order.orderStatus !== 'CANCELLED';
}
import {academyDate,addCalendarDays,isCalendarDate} from './dates';


/** Staff recording time is not order creation time or bank settlement time. */
export function collectionTimestamp(order: {payment_recorded_at?: string|null}): number|null {
  const value=order.payment_recorded_at;
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !isCalendarDate(value.slice(0,10)))return null;
  // PostgreSQL returns microseconds; normalize to JavaScript's millisecond ISO
  // precision rather than relying on a browser-specific Date.parse extension.
  const normalized=value.replace(/\.(\d{1,6})(?=Z|[+-]\d{2}:\d{2}$)/,(_,fraction:string)=>'.'+fraction.padEnd(3,'0').slice(0,3));
  const timestamp=Date.parse(normalized);
  return Number.isFinite(timestamp)?timestamp:null;
}

/** Dated sales reports follow academy calendar periods, not rolling day windows. */
export function saleWithinPeriod(sale: {timestamp?:number},period:'ALL'|'TODAY'|'WEEK'|'MONTH',now:Date=new Date()):boolean {
  if(period==='ALL')return true;
  const current=now.getTime(),timestamp=sale.timestamp;
  if(typeof timestamp!=='number' || !Number.isFinite(timestamp) || !Number.isFinite(current) || timestamp>current)return false;
  const day=academyDate(now);
  const weekday=new Date(day+'T00:00:00Z').getUTCDay();
  const first=period==='WEEK'?addCalendarDays(day,-((weekday+6)%7)):period==='MONTH'?day.slice(0,7)+'-01':day;
  const start=Date.parse(first+'T00:00:00+07:00');
  return timestamp>=start;
}
