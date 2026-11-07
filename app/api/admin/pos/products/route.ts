import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseProductQuery, shopPrivateHeaders } from '@/lib/pos-query';
import { fetchAllRows } from '@/lib/data-access';
import { validInventoryChange } from '@/lib/pos-catalog';
import {
  verifyCaller,
  validateRequestBody,
  logSecurityAuditEvent,
  formatServerErrorResponse,
} from '@/lib/backend-security';

const STAFF_ROLES = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];
const CATALOG_ADMIN_ROLES = ['Root', 'Super Root', 'Admin', 'Head Coach'];
const CATALOG_DESTRUCTIVE_ROLES = ['Root', 'Super Root', 'Admin'];
const imageUrlSchema=z.string().max(2048).url().or(z.literal('')).refine(value=>{
  if(!value)return true;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}
},'Use an HTTPS image URL without embedded credentials.');

const AdjustStockSchema = z.object({
  action: z.literal('ADJUST_STOCK'),
  productId: z.string().uuid('Invalid product ID'),
  variantId: z.string().uuid().nullable().optional(),
  changeQty: z.number().int().refine((val) => val !== 0, 'Change quantity cannot be zero'),
  reason: z.enum(['RESTOCK', 'DAMAGE_WRITE_OFF', 'AUDIT_ADJUSTMENT']),
  notes: z.string().max(500).optional(),
  requestKey: z.string().uuid().optional(),
}).refine(value=>validInventoryChange(value.reason,value.changeQty), {message:'Restocks must add stock, write-offs must subtract stock, and audits require a non-zero whole change up to 100000 units.',path:['changeQty']});

const VariantInputSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().trim().min(1).max(50),
  size: z.string().trim().max(50).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
  stock: z.number().int().nonnegative().max(100000).optional(),
  priceOverride: z.number().nonnegative().nullable().optional(),
  minStockThreshold: z.number().int().nonnegative().max(100000).optional(),
  isActive: z.boolean().optional(),
}).strict();

const CreateProductSchema = z.object({
  action: z.literal('CREATE_PRODUCT'),
  sku: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(150),
  categoryId: z.number().int().positive().nullable().optional(),
  categoryName: z.string().trim().min(1).max(50),
  priceUsd: z.number().nonnegative(),
  costUsd: z.number().nonnegative().default(0),
  stock: z.number().int().nonnegative().default(0),
  minStockThreshold: z.number().int().nonnegative().default(5),
  sizes: z.array(z.string()).optional(),
  hasVariants: z.boolean().default(false),
  imageUrl: imageUrlSchema.nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  variants: z.array(VariantInputSchema).max(200).optional(),
  isActive: z.boolean().default(true),
  allowStudentOrders: z.boolean().default(true),
});

const UpdateProductSchema = z.object({
  action: z.literal('UPDATE_PRODUCT'),
  productId: z.string().uuid('Invalid product ID'),
  sku: z.string().trim().min(1).max(50).optional(),
  name: z.string().trim().min(1).max(150).optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  categoryName: z.string().trim().min(1).max(50).optional(),
  priceUsd: z.number().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional(),
  minStockThreshold: z.number().int().nonnegative().optional(),
  sizes: z.array(z.string()).optional(),
  hasVariants: z.boolean().optional(),
  imageUrl: imageUrlSchema.nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
  allowStudentOrders: z.boolean().optional(),
  expectedUpdatedAt: z.string().datetime({offset:true}).optional(),
  variants: z.array(VariantInputSchema).max(200).optional(),
});

const DeleteProductSchema = z.object({
  action: z.literal('DELETE_PRODUCT'),
  productId: z.string().uuid('Invalid product ID'),
});

const ProductPayloadSchema = z.discriminatedUnion('action', [
  AdjustStockSchema,
  CreateProductSchema,
  UpdateProductSchema,
  DeleteProductSchema,
]);

/**
 * GET /api/admin/pos/products
 * Fetch all products, variants, and categories with live inventory balances directly from database.
 */
export async function GET(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, STAFF_ROLES);
    if (authErr || !adminSupabase || !context) return authErr!;

    const parsed=parseProductQuery(new URL(req.url).searchParams);
    if(!parsed.success)return NextResponse.json({success:false,data:null,error:{code:'VALIDATION_ERROR',message:'Choose valid catalog filters and pagination.'}},{status:422,headers:shopPrivateHeaders});
    const {category,search,include_inactive:includeInactive,limit,offset=0}=parsed.data;
    const paginated=limit!==undefined || parsed.data.offset!==undefined;

    let query = adminSupabase
      .from('products')
      .select(`
        id,
        sku,
        name,
        category_id,
        category_name,
        price_usd,
        cost_usd,
        stock,
        min_stock_threshold,
        sizes,
        has_variants,
        image_url,
        description,
        is_active,
        allow_student_orders,
        created_at,
        updated_at,
        variants:product_variants (
          id,
          sku,
          size,
          color,
          price_override,
          stock,
          min_stock_threshold,
          is_active
        )
      `,{count:paginated?'exact':undefined})
      .order('name', { ascending: true });

    if (includeInactive !== 'true') {
      query = query.eq('is_active', true);
    }
    if (category && category !== 'All') {
      query = query.eq('category_name', category);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const result=paginated ? await query.order('id',{ascending:true}).range(offset,offset+(limit ?? 100)-1).abortSignal(AbortSignal.any([req.signal,AbortSignal.timeout(15000)])) : await fetchAllRows(query.abortSignal(req.signal));
    const {data:products,error}=result;
    const count='count' in result?result.count:null;
    if (error) {
      return formatServerErrorResponse(error);
    }

    return NextResponse.json({
      success: true,
      data: products || [],
      error: null,
      ...(paginated?{meta:{contractVersion:'shop-admin-v1',limit:limit ?? 100,offset,total:count,hasMore:typeof count==='number'?offset+(products?.length ?? 0)<count:(products?.length ?? 0)===(limit ?? 100)}}:{}),
    },{headers:shopPrivateHeaders});
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}

/**
 * POST /api/admin/pos/products
 * Handles product creation, inventory stock adjustment, product updates, and product deletion.
 */
export async function POST(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, STAFF_ROLES);
    if (authErr || !adminSupabase || !context) return authErr!;

    const { data: body, errorResponse: valErr } = await validateRequestBody(ProductPayloadSchema, req);
    if (valErr || !body) return valErr!;

    if (body.action === 'ADJUST_STOCK') {
      const { data: result, error: rpcError } = await adminSupabase.rpc(body.requestKey?'portal_adjust_inventory_once':'portal_adjust_inventory', {
        p_actor: context.userId, p_product_id: body.productId, p_variant_id: body.variantId || null,
        p_change_qty: body.changeQty, p_reason: body.reason, p_notes: body.notes || null,
        ...(body.requestKey?{p_request_key:body.requestKey}:{}),
      });
      if (rpcError || !result) return formatServerErrorResponse(rpcError || new Error('Stock adjustment failed'));

      if(result.replayed!==true)await logSecurityAuditEvent({
        action: 'INVENTORY_STOCK_ADJUSTED',
        performedBy: context.userId,
        targetId: body.productId,
        details: {
          variantId: body.variantId,
          changeQty: body.changeQty,
          reason: body.reason,
        },
        status: 'SUCCESS',
      });

      return NextResponse.json({
        success: true,
        data: result,
        error: null,
      },{headers:shopPrivateHeaders});
    }

    const { data: product, error } = await adminSupabase.rpc('portal_save_product', { p_actor: context.userId, p_payload: body });
    if (error || !product) return formatServerErrorResponse(error || new Error('The catalog change was not confirmed.'));
    return NextResponse.json({success:true,data:product,error:null},{headers:shopPrivateHeaders});
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}

/**
 * PUT /api/admin/pos/products
 * Standard REST endpoint for updating a product.
 */
export async function PUT(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, CATALOG_ADMIN_ROLES);
    if (authErr || !adminSupabase || !context) return authErr!;

    const PutSchema = UpdateProductSchema.omit({ action: true });
    const { data: body, errorResponse: valErr } = await validateRequestBody(PutSchema, req);
    if (valErr || !body) return valErr!;

    const { data: updatedProd, error: updateError } = await adminSupabase.rpc('portal_save_product', {
      p_actor: context.userId, p_payload: { ...body, action: 'UPDATE_PRODUCT' },
    });
    if (updateError || !updatedProd) return formatServerErrorResponse(updateError || new Error('Product update was not confirmed.'));

    return NextResponse.json({
      success: true,
      data: updatedProd,
      error: null,
    },{headers:shopPrivateHeaders});
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}

/**
 * DELETE /api/admin/pos/products
 * Standard REST endpoint for deactivating a product.
 */
export async function DELETE(req: Request) {
  try {
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, CATALOG_DESTRUCTIVE_ROLES);
    if (authErr || !adminSupabase || !context) return authErr!;

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('id');
    if (!productId || !z.string().uuid().safeParse(productId).success) {
      return NextResponse.json({ success: false, data: null, error: { message: 'A valid product ID is required.' } }, { status: 422 });
    }

    const {data:deletedProduct,error:deleteError}=await adminSupabase.rpc('portal_save_product',{
      p_actor:context.userId,p_payload:{action:'DELETE_PRODUCT',productId},
    });

    if (deleteError) {
      return formatServerErrorResponse(deleteError);
    }
    if (!deletedProduct) return NextResponse.json({success:false,error:{message:'Product not found.'}},{status:404});

    await logSecurityAuditEvent({
      action: 'PRODUCT_ARCHIVED',
      performedBy: context.userId,
      targetId: productId,
      details: { softDelete: true },
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      data: { id: productId, is_active: false },
      error: null,
    },{headers:shopPrivateHeaders});
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}
