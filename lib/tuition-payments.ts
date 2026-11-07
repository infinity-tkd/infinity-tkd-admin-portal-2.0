import { isCalendarDate } from './dates';
import { roundUsd } from './money';

export const TUITION_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function tuitionMonth(month: string, year: number) {
  const index = TUITION_MONTHS.indexOf(month);
  if (index < 0 || !Number.isSafeInteger(year) || year < 2020 || year > 2100) throw new Error('Choose a valid billing month between 2020 and 2100.');
  return `${year}-${String(index + 1).padStart(2,'0')}`;
}

export function isMonthBeforeEnrollment(month: string, year: number, enrollmentDate: string | null | undefined) {
  return !enrollmentDate || !isCalendarDate(enrollmentDate.slice(0,10)) || tuitionMonth(month,year) < enrollmentDate.slice(0,7);
}

/** Allocate integer cents, never floating divisions of a combined amount. */
export function prepaymentSchedule(month: string, year: number, count: number, monthlyFee: number, requestedTotal = '') {
  tuitionMonth(month,year);
  if (!Number.isSafeInteger(count) || count < 1 || count > 24) throw new Error('Choose between 1 and 24 prepaid months.');
  if (!Number.isFinite(monthlyFee) || monthlyFee < 0 || monthlyFee > 100000) throw new Error('The monthly tuition is invalid. Review the tuition settings.');
  const cents = Math.round(roundUsd(monthlyFee) * 100);
  const totalCents = cents * count;
  if (requestedTotal.trim()) {
    const value = Number(requestedTotal);
    if (!Number.isFinite(value) || Math.abs(value*100-totalCents) > 0.00001) throw new Error(`Each prepaid month requires its full tuition. The total must be $${(totalCents/100).toFixed(2)}.`);
  }
  const offset = TUITION_MONTHS.indexOf(month);
  const entries = Array.from({length:count},(_,index)=>{
    const next = offset + index, nextYear = year + Math.floor(next/12), nextMonth = TUITION_MONTHS[next%12];
    tuitionMonth(nextMonth,nextYear);
    return {year:nextYear,month:nextMonth,amount:cents/100};
  });
  return {entries,total:totalCents/100};
}
