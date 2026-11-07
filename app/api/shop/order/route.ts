import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  verifyCaller,
  callerHasPermission,
  validateRequestBody,
  logSecurityAuditEvent,
  formatServerErrorResponse,
} from '@/lib/backend-security';
import { fetchAllRows } from '@/lib/data-access';
import { resolveOwnedStudentIds, StudentOwnershipError } from '@/lib/student-ownership';
import { parseOrderQuery, shopPrivateHeaders } from '@/lib/pos-query';
const orderHeaders={...shopPrivateHeaders,'X-Portal-Contract':'shop-orders-v1'};

async function linkedShopStudents(client: import('@supabase/supabase-js').SupabaseClient, actor: string) {
  const [ids, settings] = await Promise.all([resolveOwnedStudentIds(client,actor),client.from('academy_profile').select('allow_student_portal_login').eq('id','default').maybeSingle()]);
  if(settings.error)throw settings.error;
  if(settings.data?.allow_student_portal_login!==true)throw new StudentOwnershipError();
  return ids;
}

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
    if (context.role !== 'Student' && !await callerHasPermission(adminSupabase, context, 'page:pos')) {
      return NextResponse.json({success:false,error:{message:'You do not have permission to view orders.'}},{status:403});
    }

    const parsed=parseOrderQuery(new URL(req.url).searchParams);
    if(!parsed.success)return NextResponse.json({success:false,data:null,error:{code:'VALIDATION_ERROR',message:'Choose valid order filters and pagination.'}},{status:422,headers:orderHeaders});
    const owned=context.role==='Student'?await linkedShopStudents(adminSupabase,context.userId):[];
    const resolvedStudentId=owned[0];

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
          color,
          unit_price_usd,
          quantity,
          total_price_usd
        )
      `)
      .order('created_at', { ascending: false });

    if (context.role === 'Student') {
      if (!resolvedStudentId) {
        return NextResponse.json({ success: true, data: [], error:null },{headers:orderHeaders});
      }
      query = query.eq('student_id', resolvedStudentId);
    }

    if(parsed.data.status && parsed.data.status!=='All')query=query.eq('order_status',parsed.data.status);
    if(parsed.data.channel && parsed.data.channel!=='All')query=query.eq('order_channel',parsed.data.channel);
    if(parsed.data.payment && parsed.data.payment!=='All')query=query.eq('payment_status',parsed.data.payment);
    if(parsed.data.from)query=query.gte('created_at',parsed.data.from+'T00:00:00+07:00');
    if(parsed.data.to)query=query.lte('created_at',parsed.data.to+'T23:59:59.999999+07:00');
    if(parsed.data.search)query=query.or(`order_number.ilike.%${parsed.data.search}%,customer_name.ilike.%${parsed.data.search}%`);
    const paginated=new URL(req.url).searchParams.has('limit')||new URL(req.url).searchParams.has('offset');
    const result=paginated?await query.order('id',{ascending:false}).range(parsed.data.offset,parsed.data.offset+parsed.data.limit-1).abortSignal(AbortSignal.any([req.signal,AbortSignal.timeout(15000)])):await fetchAllRows(query.abortSignal(req.signal));
    const {data:orders,error}=result;
    if (error) {
      return formatServerErrorResponse(error);
    }

    return NextResponse.json({
      success: true,
      data: context.role === 'Student' ? (orders || []).map(order => { const visible = { ...order }; delete visible.admin_notes; return visible; }) : orders || [],
      error: null,
    },{headers:orderHeaders});
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
    if (context.role !== 'Student' && !await callerHasPermission(adminSupabase, context, 'action:pos_create_order')) {
      return NextResponse.json({success:false,error:{message:'You do not have permission to place orders.'}},{status:403});
    }

    const { data: body, errorResponse: valErr } = await validateRequestBody(PlaceOrderSchema, req);
    if (valErr || !body) return valErr!;

    if(context.role==='Student') {
      const owned=await linkedShopStudents(adminSupabase,context.userId);
      if(!owned.includes(body.studentId))return NextResponse.json({success:false,data:null,error:{code:'FORBIDDEN_STUDENT_MISMATCH',message:'You can only place orders for your linked student account.'}},{status:403,headers:orderHeaders});
      const membership=await adminSupabase.from('students').select('student_status,deleted_at').eq('id',body.studentId).maybeSingle();
      if(membership.error)throw membership.error;
      if(!membership.data || membership.data.deleted_at || membership.data.student_status!=='Active')return NextResponse.json({success:false,data:null,error:{code:'SHOP_MEMBERSHIP_REQUIRED',message:'An active training membership is required to place a shop order.'}},{status:403,headers:orderHeaders});
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
    },{headers:orderHeaders});
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}
