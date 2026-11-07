import { daysBetween } from './dates';
export function invoiceStatus(dueDate: string, balance: number, today: string, reminderDays: number, graceDays: number) {
  if (balance <= 0) return 'Settled';
  const days = daysBetween(today, dueDate);
  if (days === 0) return 'Due today';
  if (days < 0) return -days <= graceDays ? 'Within grace' : 'Overdue';
  return days <= reminderDays ? 'Due soon' : 'Upcoming';
}
