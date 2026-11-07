import { addCalendarDays, isCalendarDate } from '@/lib/dates';
import type { EventRecord } from './types';

export function monthDays(month: string): string[] {
  const first = `${month}-01`;
  if (!isCalendarDate(first)) return [];
  const weekday = new Date(`${first}T00:00:00Z`).getUTCDay();
  const start = addCalendarDays(first, -(weekday + 6) % 7);
  return Array.from({ length: 42 }, (_, index) => addCalendarDays(start, index));
}
export function shiftMonth(month: string, delta: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}
export function dateLabel(date: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  if (!isCalendarDate(date)) return date;
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options }).format(new Date(`${date}T00:00:00Z`));
}
export function eventDates(event: EventRecord): string {
  return `${dateLabel(event.startDate)}${event.endDate !== event.startDate ? ` – ${dateLabel(event.endDate)}` : ''}`;
}
export function eventTime(event: EventRecord): string {
  if (!event.startsAt || !event.endsAt) return 'All day';
  try {
    const format = new Intl.DateTimeFormat('en-GB', { timeZone: event.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const endpoint = venueDate(event.endsAt, event.timezone);
    return `${format.format(new Date(event.startsAt))} – ${format.format(new Date(event.endsAt))}${endpoint !== event.endDate ? ` on ${dateLabel(endpoint)}` : ''}`;
  } catch { return 'Time unavailable'; }
}
export function inputTime(value: string | null, timezone: string): string {
  if (!value) return '09:00';
  try { return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)); }
  catch { return ''; }
}
export function venueDate(value: string | number, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const get = (kind: string) => parts.find(part => part.type === kind)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
/** Resolve venue-local time without using the staff device's timezone or guessing a repeated DST hour. */
export function venueTimestamp(date: string, time: string, timezone: string): string {
  if (!isCalendarDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Enter a valid date and time.');
  const target = Date.parse(`${date}T${time}:00Z`);
  const format = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const wallTime = (value: number) => {
    const parts = format.formatToParts(new Date(value));
    const get = (kind: string) => parts.find(part => part.type === kind)!.value;
    return Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:00Z`);
  };
  const offsets = new Set([-36, 0, 36].map(hours => { const sample = target + hours * 3600000; return wallTime(sample) - sample; }));
  const matches = [...offsets].map(offset => target - offset).filter(candidate => wallTime(candidate) === target);
  if (matches.length !== 1) throw new Error(matches.length ? 'This time occurs twice during a timezone change. Choose an unambiguous time.' : 'This local time does not exist during a timezone change. Choose another time.');
  return new Date(matches[0]).toISOString();
}
