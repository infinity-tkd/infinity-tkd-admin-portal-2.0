/** Pending, voided and refunded orders are records, but not collected revenue. */
export function isCollectedSale(order: { paymentStatus?: string; orderStatus?: string }): boolean {
  return order.paymentStatus === 'PAID' && order.orderStatus !== 'CANCELLED';
}
