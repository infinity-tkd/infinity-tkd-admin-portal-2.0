import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { membershipBilling, membershipDueText } = loadTs('lib/billing.ts');
const { invoiceStatus } = loadTs('lib/invoice-status.ts');

const student = { id: 'A', registrationDate: '2026-01-15', membershipStartDate: '2026-01-15', scholarshipId: 1 };
const paidThroughOctober = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map(month => ({ studentId: 'A', year: 2026, month, status: 'Paid' }));
const on = date => new Date(`${date}T03:00:00Z`); // 10:00 in Phnom Penh
const status = (date, config) => membershipBilling(student, paidThroughOctober, [], [], config, on(date));

test('membership status uses the invoice wording: due today, within grace, then overdue', () => {
  const grace = { latePaymentGraceDays: 5, renewalReminderDays: 5 };
  assert.equal(status('2026-11-12', grace).status, 'Due Soon');
  assert.deepEqual(status('2026-11-15', grace), { status: 'Due today', nextRenewalDate: '2026-11-15', daysRemaining: 0, amountOwed: 45 });
  assert.equal(status('2026-11-18', grace).status, 'Within grace');
  assert.equal(status('2026-11-20', grace).status, 'Within grace', 'the last grace day is still within grace');
  assert.equal(status('2026-11-21', grace).status, 'Overdue');
  for (const date of ['2026-11-15', '2026-11-18', '2026-11-21']) {
    const invoice = invoiceStatus('2026-11-15', 45, date, 5, 5);
    assert.equal(status(date, grace).status.toLowerCase(), invoice.toLowerCase(), `${date} matches the invoice timing`);
  }
});

test('without a grace setting a cycle is overdue the day after it is due', () => {
  assert.equal(status('2026-11-15').status, 'Due today');
  assert.equal(status('2026-11-16').status, 'Overdue');
});

test('due text explains the timing in each state', () => {
  const grace = { latePaymentGraceDays: 5 };
  assert.equal(membershipDueText(status('2026-11-12', grace)), 'Due in 3d');
  assert.equal(membershipDueText(status('2026-11-15', grace)), 'Due today');
  assert.equal(membershipDueText(status('2026-11-18', grace)), '3d late, within grace');
  assert.equal(membershipDueText(status('2026-11-24', grace)), '9d overdue');
});
