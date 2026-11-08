/** Academy calendar dates are independent of the staff device timezone. */
export const ACADEMY_TIME_ZONE = 'Asia/Phnom_Penh';
// Building an Intl formatter is far slower than using one; billing screens call this per student and month.
let academyFormatter: Intl.DateTimeFormat | undefined;
export function academyDate(value: Date = new Date()): string {
  academyFormatter ??= new Intl.DateTimeFormat('en-CA', {
    timeZone: ACADEMY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = academyFormatter.formatToParts(value);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export const MONTH_NAMES: readonly string[] = Object.freeze([
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]);
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Days in a month (1-12) of the proleptic Gregorian calendar, as JavaScript dates use. */
function daysInMonth(year: number, month: number): number {
  return month === 2 && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : MONTH_DAYS[month - 1];
}
export function isCalendarDate(value: string): boolean {
  // Arithmetic instead of Date parsing: same answer for every YYYY-MM-DD string, without allocations.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}
export function calendarDate(year: number, monthIndex: number, day: number): string {
  const normalizedYear = year + Math.floor(monthIndex / 12), month = ((monthIndex % 12) + 12) % 12 + 1;
  // Fast path for ordinary dates; anything unusual keeps the Date-based rules (Date.UTC maps years 0-99 to 1900s).
  if (Number.isInteger(year) && Number.isInteger(monthIndex) && Number.isInteger(day) && day >= 1
    && year >= 100 && normalizedYear >= 100 && normalizedYear <= 9999) {
    const date = Math.min(day, daysInMonth(normalizedYear, month));
    return `${String(normalizedYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
  }
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(day, days))).toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}
export function addCalendarDays(date: string, days: number): string {
  if (!isCalendarDate(date) || !Number.isSafeInteger(days)) throw new Error('Invalid calendar date or day offset.');
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
