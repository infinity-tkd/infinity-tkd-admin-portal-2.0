import { tuitionCycle } from './tuition-cycle';
import type { BillingStudent, TuitionSettings } from './billing';

interface ReceiptPayment {
  id: number; status: string; amountUsd?: number; verifiedCollection?: boolean;
  invoiceProjection?: boolean; receiptNumber?: string; paymentMethod?: string;
}
interface Scholarship { id: number; typeName: string; discountPercentage: number }

/** A preview is not proof of collection; invoice projections are not individual receipts. */
export function tuitionReceiptRecord(student: BillingStudent, cycle: string, payment: ReceiptPayment | undefined,
  scholarship: Scholarship | undefined, enrollments: {studentId: string; enrollmentDate?: string}[], settings: TuitionSettings) {
  const invoice = tuitionCycle(student, cycle, payment, scholarship, enrollments, settings);
  const recorded = payment?.status === 'Paid' || payment?.verifiedCollection === true;
  const hasAmount = typeof payment?.amountUsd === 'number' && Number.isFinite(payment.amountUsd) && payment.amountUsd >= 0;
  const collected = recorded && hasAmount ? Math.round(payment!.amountUsd! * 100) / 100 : 0;
  const summary = payment?.invoiceProjection === true;
  const unknownAmount = recorded && !hasAmount;
  const label = unknownAmount ? 'LEGACY AMOUNT UNAVAILABLE' : collected > 0 ? (invoice.balance > 0 ? 'PARTIAL COLLECTION' : 'PAYMENT RECEIVED')
    : invoice.settled && (payment || invoice.invoice) ? 'SETTLED WITHOUT CASH' : 'UNPAID PREVIEW';
  return {
    title: summary ? 'TUITION SUMMARY' : collected > 0 ? 'E-RECEIPT' : 'PAYMENT PREVIEW',
    label, collected:unknownAmount?null:collected, billed:unknownAmount&&!invoice.invoice?null:invoice.amount, outstanding: invoice.balance, summary,
    reference: summary ? `INVOICE-${student.id}-${cycle}` : collected > 0 && payment
      ? payment.receiptNumber || `LEGACY-PAYMENT-${payment.id}` : 'PREVIEW-UNPAID',
    method: collected > 0 ? payment?.paymentMethod || 'Not recorded (legacy)' : 'No cash collection',
  };
}
