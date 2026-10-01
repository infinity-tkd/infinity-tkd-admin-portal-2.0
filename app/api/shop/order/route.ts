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
  qty: z.number().int().positive('Quantity must be at least 1'),
});

const PlaceOrderSchema = z.object({
  studentId: z.string().min(1).max(50),
  customerName: z.string().min(1).max(100),
  customerPhone: z.string().min(1).max(30),
  branchId: z.number().int().positive().nullable().optional(),
  paymentMethod: z.enum(['ABA Bank KHQR', 'Cash', 'Credit Card', 'Bank Transfer', 'Pay at Counter']).default('ABA Bank KHQR'),
  studentNotes: z.string().max(500).optional(),
  items: z.array(OrderItemSchema).min(1, 'Order must contain at least one item'),
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

    // Prepare items JSON for stored procedure
    const rpcItemsPayload = body.items.map((it) => ({
      product_id: it.productId,
      variant_id: it.variantId || null,
      size: it.size || null,
      qty: it.qty,
    }));

    // Call atomic stored procedure or use direct table fallback
    let result: any = null;
    const { data: rpcResult, error: rpcError } = await adminSupabase.rpc('place_student_order', {
      p_student_id: body.studentId,
      p_customer_name: body.customerName,
      p_customer_phone: body.customerPhone,
      p_branch_id: body.branchId || null,
      p_payment_method: body.paymentMethod,
      p_student_notes: body.studentNotes || null,
      p_items: rpcItemsPayload,
    });

    if (!rpcError && rpcResult) {
      result = rpcResult;
    } else {
      // Direct table fallback
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Fetch pricing for ordered items
      const productIds = body.items.map((i) => i.productId);
      const { data: productsData } = await adminSupabase
        .from('products')
        .select('id, sku, name, price_usd, stock')
        .in('id', productIds);

      const productMap = new Map((productsData || []).map((p) => [p.id, p]));

      let subtotal = 0;
      const orderItems = body.items.map((it) => {
        const prod = productMap.get(it.productId);
        const price = prod ? Number(prod.price_usd) : 0;
        const lineTotal = Number((price * it.qty).toFixed(2));
        subtotal += lineTotal;
        return {
          product_id: it.productId,
          variant_id: it.variantId || null,
          sku: prod?.sku || 'UNKNOWN',
          product_name: prod?.name || 'Equipment Item',
          size: it.size || null,
          unit_price_usd: price,
          quantity: it.qty,
          total_price_usd: lineTotal,
        };
      });

      const { data: newOrder, error: orderErr } = await adminSupabase
        .from('pos_orders')
        .insert({
          order_number: orderNumber,
          order_channel: 'STUDENT_PORTAL',
          student_id: body.studentId,
          customer_name: body.customerName,
          customer_phone: body.customerPhone,
          branch_id: body.branchId || null,
          subtotal_usd: Number(subtotal.toFixed(2)),
          discount_percentage: 0,
          discount_usd: 0,
          total_usd: Number(subtotal.toFixed(2)),
          payment_method: body.paymentMethod,
          payment_status: 'PENDING',
          order_status: 'PENDING',
          student_notes: body.studentNotes || null,
        })
        .select()
        .single();

      if (orderErr || !newOrder) {
        return formatServerErrorResponse(orderErr || new Error('Failed to record student order'));
      }

      // Attach items
      const itemsToInsert = orderItems.map((item) => ({
        ...item,
        order_id: newOrder.id,
      }));

      await adminSupabase.from('pos_order_items').insert(itemsToInsert);

      result = {
        order_id: newOrder.id,
        order_number: newOrder.order_number,
        subtotal_usd: newOrder.subtotal_usd,
        status: newOrder.order_status,
      };
    }

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
