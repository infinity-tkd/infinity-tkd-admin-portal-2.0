import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  verifyCaller,
  validateRequestBody,
  logSecurityAuditEvent,
  formatServerErrorResponse,
} from '@/lib/backend-security';

// Allowed roles include Student and all Staff
const ALL_ROLES = ['Student', 'Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];

const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  size: z.string().max(50).nullable().optional(),
  qty: z.number().int().positive('Quantity must be at least 1').max(1000),
});

const PlaceOrderSchema = z.object({
  studentId: z.string().min(1).max(50),
  customerName: z.string().min(1).max(100),
  customerPhone: z.string().min(1).max(30),
  branchId: z.number().int().positive().nullable().optional(),
  paymentMethod: z.enum(['ABA Bank KHQR', 'Cash', 'Credit Card', 'Bank Transfer', 'Pay at Counter']).default('ABA Bank KHQR'),
  studentNotes: z.string().max(500).optional(),
  items: z.array(OrderItemSchema).min(1, 'Order must contain at least one item').max(100),
  requestKey: z.string().uuid(),
});

/**
 * GET /api/shop/order
 * Fetches the order history for the currently logged-in student.
 */
export async function GET(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, ALL_ROLES);
    if (authErr || !adminSupabase || !context) return authErr!;

    // Resolve student_id associated with this auth user profile
    const { data: profileRecord } = await adminSupabase
      .from('profiles')
      .select('student_id')
      .eq('id', context.userId)
      .maybeSingle();

    const { data: studentRecord } = await adminSupabase
      .from('students')
      .select('id')
      .or(`profile_id.eq.${context.userId},id.eq.${profileRecord?.student_id || 'NONE'}`)
      .maybeSingle();

    const resolvedStudentId = profileRecord?.student_id || studentRecord?.id;

    let query = adminSupabase
      .from('pos_orders')
      .select(`
        id,
        order_number,
        order_channel,
        customer_name,
        customer_phone,
        subtotal_usd,
        discount_usd,
        total_usd,
        payment_method,
        payment_status,
        order_status,
        student_notes,
        admin_notes,
        confirmed_at,
        fulfilled_at,
        created_at,
        branches:branch_id ( branch_name ),
        items:pos_order_items (
          id,
          product_id,
          variant_id,
          sku,
          product_name,
          size,
          unit_price_usd,
          quantity,
          total_price_usd
        )
      `)
      .order('created_at', { ascending: false });

    if (context.role === 'Student') {
      if (!resolvedStudentId) {
        return NextResponse.json({ success: true, data: [] });
      }
      query = query.eq('student_id', resolvedStudentId);
    }

    const { data: orders, error } = await query;
    if (error) {
      return formatServerErrorResponse(error);
    }

    return NextResponse.json({
      success: true,
      data: orders || [],
      error: null,
    });
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}

/**
 * POST /api/shop/order
 * Submits a new equipment order from the Student Portal.
 * Atomically reserves inventory using place_student_order RPC.
 */
export async function POST(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, ALL_ROLES);
    if (authErr || !adminSupabase || !context) return authErr!;

    const { data: body, errorResponse: valErr } = await validateRequestBody(PlaceOrderSchema, req);
    if (valErr || !body) return valErr!;

    // Security check: ensure student callers cannot order on behalf of another student
    if (context.role === 'Student') {
      const { data: profileRecord } = await adminSupabase
        .from('profiles')
        .select('student_id')
        .eq('id', context.userId)
        .maybeSingle();

      const { data: validStudent, error: studentCheckErr } = await adminSupabase
        .from('students')
        .select('id')
        .eq('id', body.studentId)
        .or(`profile_id.eq.${context.userId},id.eq.${profileRecord?.student_id || 'NONE'}`)
        .maybeSingle();

      if (studentCheckErr || !validStudent) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'FORBIDDEN_STUDENT_MISMATCH',
              message: 'Forbidden: You can only place orders for your linked student account.',
            },
          },
          { status: 403 }
        );
      }
    }

    const { data: result, error: rpcError } = await adminSupabase.rpc('portal_place_order', {
      p_actor: context.userId, p_channel: 'STUDENT_PORTAL', p_payload: body,
      p_request_key: body.requestKey || null,
    });
    if (rpcError || !result) return formatServerErrorResponse(rpcError || new Error('Order failed'));

    await logSecurityAuditEvent({
      action: 'STUDENT_ORDER_PLACED',
      performedBy: context.userId,
      targetId: result?.order_id || 'UNKNOWN',
      details: {
        orderNumber: result?.order_number,
        studentId: body.studentId,
        total: result?.subtotal_usd,
      },
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
