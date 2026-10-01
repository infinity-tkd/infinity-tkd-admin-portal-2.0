import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  verifyCaller,
  validateRequestBody,
  logSecurityAuditEvent,
  formatServerErrorResponse,
} from '@/lib/backend-security';

const STAFF_ROLES = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach'];

const CancelOrderSchema = z.object({
  orderId: z.string().uuid('Invalid order UUID'),
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
});

/**
 * POST /api/admin/pos/orders/cancel
 * Cancel order and automatically restore stock into inventory ledger.
 */
export async function POST(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, STAFF_ROLES);
    if (authErr || !adminSupabase || !context) return authErr!;

    const { data: body, errorResponse: valErr } = await validateRequestBody(CancelOrderSchema, req);
    if (valErr || !body) return valErr!;

    const { data: result, error: rpcError } = await adminSupabase.rpc('cancel_or_refund_order', {
      p_order_id: body.orderId,
      p_reason: body.reason,
    });

    if (rpcError) {
      return formatServerErrorResponse(rpcError);
    }

    await logSecurityAuditEvent({
      action: 'POS_ORDER_CANCELLED',
      performedBy: context.userId,
      targetId: body.orderId,
      details: { reason: body.reason },
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      data: result,
      error: null,
    });
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}
