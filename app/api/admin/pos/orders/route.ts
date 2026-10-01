import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  verifyCaller,
  validateRequestBody,
  logSecurityAuditEvent,
  formatServerErrorResponse,
} from '@/lib/backend-security';

const STAFF_ROLES = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];

// Zod Schema for Direct POS Counter Sale
const PosSaleItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().uuid().nullable().optional(),
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  size: z.string().max(50).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
  price: z.number().nonnegative(),
  qty: z.number().int().positive(),
});

const DirectPosSaleSchema = z.object({
  studentId: z.string().max(50).nullable().optional(),
  customerName: z.string().min(1).max(100),
  branchId: z.number().int().positive().nullable().optional(),
  subtotal: z.number().nonnegative(),
  discountPercentage: z.number().min(0).max(100).default(0),
  paymentMethod: z.enum(['ABA Bank KHQR', 'Cash', 'Credit Card', 'Bank Transfer', 'Pay at Counter']),
  adminNotes: z.string().max(500).optional(),
  items: z.array(PosSaleItemSchema).min(1, 'Cart cannot be empty'),
});

// Zod Schema for Confirming / Updating Order Status
const UpdateOrderStatusSchema = z.object({
  orderId: z.string().uuid('Invalid order UUID'),
  newOrderStatus: z.enum(['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED']),
  paymentStatus: z.enum(['PENDING', 'PAID', 'REFUNDED', 'VOID']).optional(),
  adminNotes: z.string().max(500).optional(),
});

/**
 * GET /api/admin/pos/orders
 * List orders with optional filters: status, channel, search, limit, offset.
 */
export async function GET(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, STAFF_ROLES);
    if (authErr || !adminSupabase || !context) return authErr!;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const channel = searchParams.get('channel');
    const search = searchParams.get('search')?.trim();
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

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
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'All') {
      query = query.eq('order_status', status);
    }
    if (channel && channel !== 'All') {
      query = query.eq('order_channel', channel);
    }
    if (search) {
      query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
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
 * POST /api/admin/pos/orders
 * Execute immediate walk-in Counter POS Sale.
 */
export async function POST(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, STAFF_ROLES);
    if (authErr || !adminSupabase || !context) return authErr!;

    const { data: body, errorResponse: valErr } = await validateRequestBody(DirectPosSaleSchema, req);
    if (valErr || !body) return valErr!;

    // Format items payload for PostgreSQL stored procedure
    const rpcItemsPayload = body.items.map((it) => ({
      product_id: it.productId,
      variant_id: it.variantId || null,
      sku: it.sku,
      name: it.name,
      size: it.size || null,
      color: it.color || null,
      price: it.price,
      qty: it.qty,
    }));

    let result: any = null;
    const { data: rpcResult, error: rpcError } = await adminSupabase.rpc('process_admin_pos_sale', {
      p_student_id: body.studentId || null,
      p_customer_name: body.customerName,
      p_branch_id: body.branchId || null,
      p_subtotal: body.subtotal,
      p_discount_percentage: body.discountPercentage,
      p_payment_method: body.paymentMethod,
      p_admin_notes: body.adminNotes || null,
      p_items: rpcItemsPayload,
    });

    if (!rpcError && rpcResult) {
      result = rpcResult;
    } else {
      // Fallback: Direct table operations
      const orderNumber = `POS-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const discountUsd = Number(((body.subtotal * (body.discountPercentage || 0)) / 100).toFixed(2));
      const totalUsd = Number((body.subtotal - discountUsd).toFixed(2));

      const { data: newOrder, error: orderErr } = await adminSupabase
        .from('pos_orders')
        .insert({
          order_number: orderNumber,
          order_channel: 'ADMIN_POS',
          student_id: body.studentId || null,
          customer_name: body.customerName,
          branch_id: body.branchId || null,
          subtotal_usd: body.subtotal,
          discount_percentage: body.discountPercentage || 0,
          discount_usd: discountUsd,
          total_usd: totalUsd,
          payment_method: body.paymentMethod,
          payment_status: 'PAID',
          order_status: 'COMPLETED',
          admin_notes: body.adminNotes || null,
          recorded_by: context.userId,
        })
        .select()
        .single();

      if (orderErr || !newOrder) {
        return formatServerErrorResponse(orderErr || new Error('Failed to record POS order'));
      }

      // Insert line items
      const orderItems = body.items.map((it) => ({
        order_id: newOrder.id,
        product_id: it.productId,
        variant_id: it.variantId || null,
        sku: it.sku,
        product_name: it.name,
        size: it.size || null,
        color: it.color || null,
        unit_price_usd: it.price,
        quantity: it.qty,
        total_price_usd: Number((it.price * it.qty).toFixed(2)),
      }));

      const { error: itemsErr } = await adminSupabase
        .from('pos_order_items')
        .insert(orderItems);

      if (itemsErr) {
        console.error('Failed to insert POS order items:', itemsErr);
      }

      // Decrement stock for each item in the products and variants ledger
      for (const it of body.items) {
        if (it.variantId) {
          const { data: v } = await adminSupabase
            .from('product_variants')
            .select('id, stock')
            .eq('id', it.variantId)
            .single();
          if (v) {
            const nextVStock = Math.max(0, (v.stock || 0) - it.qty);
            await adminSupabase
              .from('product_variants')
              .update({ stock: nextVStock, updated_at: new Date().toISOString() })
              .eq('id', it.variantId);
          }
        }
        const { data: p } = await adminSupabase
          .from('products')
          .select('id, stock')
          .eq('id', it.productId)
          .single();
        if (p) {
          const nextStock = Math.max(0, (p.stock || 0) - it.qty);
          await adminSupabase
            .from('products')
            .update({ stock: nextStock, updated_at: new Date().toISOString() })
            .eq('id', it.productId);
        }
      }

      result = {
        order_id: newOrder.id,
        order_number: newOrder.order_number,
        total_usd: newOrder.total_usd,
        status: newOrder.order_status,
      };
    }

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
      data: result,
      error: null,
    });
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

    const { data: result, error: rpcError } = await adminSupabase.rpc('confirm_student_order', {
      p_order_id: body.orderId,
      p_new_order_status: body.newOrderStatus,
      p_payment_status: body.paymentStatus || null,
      p_admin_notes: body.adminNotes || null,
    });

    if (rpcError) {
      return formatServerErrorResponse(rpcError);
    }

    await logSecurityAuditEvent({
      action: 'POS_ORDER_CONFIRMED',
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
    });
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}
