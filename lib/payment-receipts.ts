export function invoiceKey(studentId: string, year: number, month: string): string {
  return JSON.stringify([studentId, year, month]);
}

/** Index once instead of searching the entire receipt history for every invoice. */
export function indexPaymentReceipts(rows: any[]) {
  return new Map(rows.map(row => [invoiceKey(row.student_id, row.year, row.for_month), row]));
}
