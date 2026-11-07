import { NextResponse } from 'next/server';
import { featureError } from './operations-server';
const safeMessages = new Set([
  'Operation access denied.', 'Administrator access required.', 'Choose a student.', 'Choose a range up to 93 days.',
  'Student unavailable', 'Administrator approval required', 'Request key mismatch',
  'Choose a billing cycle within the next 24 months','A verified historical fee and administrator approval reason are required',
  'Confirm received funds, date and a positive two-decimal amount', 'Choose invoice allocations', 'Duplicate invoice allocation',
  'This external reference is already recorded', 'Invoice does not belong to this student', 'Allocation exceeds the outstanding invoice balance', 'Allocations exceed received funds',
  'Invalid credit amount', 'Credit does not belong to this student', 'Credit allocation exceeds available balances',
  'Invoice unavailable', 'Pause unavailable', 'Correct or void the approved pause before changing membership status',
  'Choose a valid pause period and reason', 'Pause periods overlap', 'Review partially collected cycles before approving this pause',
  'A correction reason is required', 'A return reason is required', 'Correct or void the active pause before an early return',
  'New holidays must start today or later', 'Review existing attendance before cancelling these sessions',
  'Session changed. Reload before saving', 'A change reason is required', 'A marked session cannot be moved or cancelled',
  'Choose a future session with a valid end time', 'The class date or coach time conflicts with another session',
  'Choose a started, non-cancelled session', 'Student is not in the session roster', 'Student membership is paused on this date',
  'Task access denied', 'Task changed. Reload before saving', 'Record the follow-up outcome',
  'A bank record cannot be future-dated', 'An imported bank reference has conflicting values', 'Bank record unavailable or already matched',
  'Match the exact bank reference and amount to a non-cash receipt', 'Choose a completed examination date',
  'A promoted assessment is immutable', 'Assessment changed. Reload before saving', 'Assessment unavailable or already promoted',
  'Exam or attendance requirements are not met. An administrator override reason is required', 'Target belt must advance the current rank',
]);
export function operationsError(error: unknown) {
  const value = error as { code?: string; message?: string };
  if (safeMessages.has(value?.message ?? '')) return NextResponse.json({ success: false, error: { code: value.code, message: value.message } }, { status: value.code === '42501' ? 403 : value.code === '40001' || value.code === '23505' ? 409 : value.code === 'P0002' ? 404 : 400, headers: { 'Cache-Control': 'no-store' } });
  if (value?.code === '23505') return NextResponse.json({ success: false, error: { code: value.code, message: 'This record or reference already exists. Refresh before creating another.' } }, { status: 409 });
  return featureError(error);
}
