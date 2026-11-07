/** Order fulfillment and collection are independent states. */
export const POS_ORDER_STATUSES = ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED'] as const;
export const POS_PAYMENT_STATUSES = ['PENDING', 'PAID', 'REFUND_PENDING', 'REFUNDED', 'VOID'] as const;
export type PosOrderStatus = typeof POS_ORDER_STATUSES[number];

/** Mirrors the transactional fulfillment rules; cancellation uses its own workflow. */
export function allowedOrderTransitions(status: string): PosOrderStatus[] {
  const transitions: Record<string, PosOrderStatus[]> = {
    PENDING: ['CONFIRMED'], PENDING_CONFIRMATION: ['CONFIRMED'],
    CONFIRMED: ['PREPARING', 'READY_FOR_PICKUP', 'COMPLETED'],
    PREPARING: ['READY_FOR_PICKUP', 'COMPLETED'], READY_FOR_PICKUP: ['COMPLETED'],
  };
  return transitions[status] ?? [];
}
