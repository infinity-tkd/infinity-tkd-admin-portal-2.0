import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseOrderQuery, shopPrivateHeaders } from '@/lib/pos-query';
import { POS_MAX_LINE_QUANTITY, POS_MAX_CART_LINES, POS_MAX_ORDER_NOTES } from '@/lib/pos-cart';
import {
  verifyCaller,
  validateRequestBody,
  logSecurityAuditEvent,
  formatServerErrorResponse,
} from '@/lib/backend-security';

const STAFF_ROLES = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];

// Zod Schema for Direct POS Counter Sale
const PosSaleItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  size: z.string().max(50).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
  price: z.number().nonnegative(),
  qty: z.number().int().positive().max(POS_MAX_LINE_QUANTITY),
});

const DirectPosSaleSchema = z.object({
  studentId: z.string().max(50).nullable().optional(),
  customerName: z.string().trim().min(1).max(100),
  branchId: z.number().int().positive().nullable().optional(),
  subtotal: z.number().nonnegative(),
  discountPercentage: z.number().min(0).max(100).default(0),
  paymentMethod: z.enum(['ABA Bank KHQR', 'Cash', 'Credit Card', 'Bank Transfer']),
  adminNotes: z.string().max(POS_MAX_ORDER_NOTES).optional(),
  items: z.array(PosSaleItemSchema).min(1, 'Cart cannot be empty').max(POS_MAX_CART_LINES),
  requestKey: z.string().uuid(),
});

// Zod Schema for Confirming / Updating Order Status
const UpdateOrderStatusSchema = z.object({
  orderId: z.string().uuid('Invalid order UUID'),
  newOrderStatus: z.enum(['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED']),
  paymentStatus: z.enum(['PENDING', 'PAID']).optional(),
  adminNotes: z.string().max(POS_MAX_ORDER_NOTES).optional(),
  expectedUpdatedAt: z.string().datetime({offset:true}).optional(),
  paymentReference: z.string().trim().min(3).max(150).optional(),
}).strict();

/**
 * GET /api/admin/pos/orders
 * List orders with optional filters: status, channel, search, limit, offset.
 */
export async function GET(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, STAFF_ROLES);
    if (authErr || !adminSupabase || !context) return authErr!;

    const parsed=parseOrderQuery(new URL(req.url).searchParams);
    if(!parsed.success)return NextResponse.json({success:false,data:null,error:{code:'VALIDATION_ERROR',message:'Choose valid order filters and pagination.'}},{status:422,headers:shopPrivateHeaders});
    const {status,channel,payment,search,from,to,limit,offset}=parsed.data;

    let query = adminSupabase
      .from('pos_orders')
      .select(`
        id,
        order_number,
        order_channel,
        student_id,
        customer_name,
        customer_phone,
        branch_id,
        subtotal_usd,
        discount_percentage,
        discount_usd,
        total_usd,
        payment_method,
        payment_status,
        payment_recorded_at,
        order_status,
        student_notes,
        admin_notes,
        recorded_by,
        confirmed_by,
        confirmed_at,
        fulfilled_at,
        cancelled_at,
        cancellation_reason,
        created_at,
        updated_at,
        branches:branch_id ( branch_name ),
        students:student_id ( english_name, khmer_name, current_belt, phone ),
        items:pos_order_items (
          id,
          product_id,
          variant_id,
          sku,
          product_name,
          size,
          color,
          unit_price_usd,
          quantity,
          total_price_usd
        )
      `, {count:'exact'})
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'All') {
      query = query.eq('order_status', status);
    }
    if (channel && channel !== 'All') {
      query = query.eq('order_channel', channel);
    }
    if (payment && payment !== 'All') query=query.eq('payment_status',payment);
    if (from) query=query.gte('created_at',from+'T00:00:00+07:00');
    if (to) query=query.lte('created_at',to+'T23:59:59.999999+07:00');
    if (search) {
      query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
    }

    const { data: orders, error, count } = await query.abortSignal(AbortSignal.any([req.signal,AbortSignal.timeout(15000)]));
    if (error) {
      return formatServerErrorResponse(error);
    }

    return NextResponse.json({
      success: true,
      data: orders || [],
      error: null,
      meta:{contractVersion:'shop-admin-v1',limit,offset,total:count ?? null,hasMore:count!==null?offset+(orders?.length ?? 0)<count:(orders?.length ?? 0)===limit},
    },{headers:shopPrivateHeaders});
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}

/**
 * POST /api/admin/pos/orders
 * Execute immediate walk-in Counter POS Sale.
 */
export async function POST(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, STAFF_ROLES);
    if (authErr || !adminSupabase || !context) return authErr!;

    const { data: body, errorResponse: valErr } = await validateRequestBody(DirectPosSaleSchema, req);
    if (valErr || !body) return valErr!;

    const { data: result, error: rpcError } = await adminSupabase.rpc('portal_place_counter_order', {
      p_actor: context.userId, p_payload: body,
      p_request_key: body.requestKey || null,
    });
    if (rpcError?.code === 'P0001' && rpcError.message === 'POS_QUOTE_CHANGED') {
      return NextResponse.json({ success: false, data: null, error: {
        code: 'POS_QUOTE_CHANGED', message: 'Product prices changed. Refresh the catalog and review the total before recording payment.',
      } }, { status: 409 });
    }
    if (rpcError || !result || !z.string().uuid().safeParse(result.order_id).success) return formatServerErrorResponse(rpcError || new Error('Checkout could not be confirmed. Read the order before retrying.'));

    // The order is already confirmed by its atomic RPC. A follow-up metadata
    // outage must not turn that completed sale into an apparent failed write.
    let paymentRecordedAt:string|null=null;
    try{
      const receipt=await adminSupabase.from('pos_orders').select('payment_recorded_at').eq('id',result.order_id)
        .abortSignal(AbortSignal.timeout(3000)).maybeSingle();
      if(receipt.error)console.warn('[POS_COLLECTION_TIME_UNAVAILABLE]',receipt.error.code || 'READ_FAILURE');
      else paymentRecordedAt=receipt.data?.payment_recorded_at ?? null;
    }catch{console.warn('[POS_COLLECTION_TIME_UNAVAILABLE]','READ_FAILURE');}

    await logSecurityAuditEvent({
      action: 'POS_COUNTER_SALE_EXECUTED',
      performedBy: context.userId,
      targetId: result?.order_id || 'UNKNOWN',
      details: {
        orderNumber: result?.order_number,
        total: result?.total_usd,
        itemsCount: body.items.length,
      },
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      data: {...result,payment_recorded_at:paymentRecordedAt},
      error: null,
    },{headers:shopPrivateHeaders});
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}

/**
 * PUT /api/admin/pos/orders
 * Confirm, prepare, or mark an order as ready/completed.
 */
export async function PUT(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, STAFF_ROLES);
    if (authErr || !adminSupabase || !context) return authErr!;

    const { data: body, errorResponse: valErr } = await validateRequestBody(UpdateOrderStatusSchema, req);
    if (valErr || !body) return valErr!;

    const { data: result, error: rpcError } = await adminSupabase.rpc('portal_transition_order', {
      p_actor: context.userId,
      p_order_id: body.orderId,
      p_new_order_status: body.newOrderStatus,
      p_payment_status: body.paymentStatus || null,
      p_admin_notes: body.adminNotes ?? null,
      p_expected_updated_at: body.expectedUpdatedAt ?? null,
      p_payment_reference: body.paymentReference ?? null,
    });

    if(rpcError?.code==='40001')return NextResponse.json({success:false,data:null,error:{code:'ORDER_CHANGED',message:'This order changed. Refresh the queue before updating it.'}},{status:409,headers:shopPrivateHeaders});
    if(rpcError || !result)return formatServerErrorResponse(rpcError || new Error('The order update was not confirmed.'));

    await logSecurityAuditEvent({
      action: 'POS_ORDER_UPDATED',
      performedBy: context.userId,
      targetId: body.orderId,
      details: {
        newStatus: body.newOrderStatus,
        paymentStatus: body.paymentStatus,
      },
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      data: result,
      error: null,
    },{headers:shopPrivateHeaders});
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}
