/** Open invoices and pending collections cannot contribute to cash collected. */
export function tuitionCollectionStats(payments: Array<{ status: string; amountUsd: number }>) {
  const settled = payments.filter(payment => payment.status === 'Paid');
  const totalCollected = settled.reduce((sum, payment) => sum + payment.amountUsd, 0);
  return {
    count: payments.length, paidCount: settled.length, totalCollected,
    avgVal: settled.length ? totalCollected / settled.length : 0,
    maxVal: settled.reduce((max, payment) => Math.max(max, payment.amountUsd), 0),
  };
}
