import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  verifyCaller,
  validateRequestBody,
  logSecurityAuditEvent,
  formatServerErrorResponse,
} from '@/lib/backend-security';

const STAFF_ROLES = ['Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach'];

const AdjustStockSchema = z.object({
  action: z.literal('ADJUST_STOCK'),
  productId: z.string().uuid('Invalid product ID'),
  variantId: z.string().uuid().nullable().optional(),
  changeQty: z.number().int().refine((val) => val !== 0, 'Change quantity cannot be zero'),
  reason: z.enum(['RESTOCK', 'DAMAGE_WRITE_OFF', 'AUDIT_ADJUSTMENT']),
  notes: z.string().max(500).optional(),
});

const VariantInputSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().min(1).max(50),
  size: z.string().min(1).max(50),
  color: z.string().max(50).nullable().optional(),
  stock: z.number().int().nonnegative().default(0),
  priceOverride: z.number().nonnegative().nullable().optional(),
  minStockThreshold: z.number().int().nonnegative().default(3),
});

const CreateProductSchema = z.object({
  action: z.literal('CREATE_PRODUCT'),
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  categoryId: z.number().int().positive().nullable().optional(),
  categoryName: z.string().min(1).max(50),
  priceUsd: z.number().nonnegative(),
  costUsd: z.number().nonnegative().default(0),
  stock: z.number().int().nonnegative().default(0),
  minStockThreshold: z.number().int().nonnegative().default(5),
  sizes: z.array(z.string()).optional(),
  hasVariants: z.boolean().default(false),
  imageUrl: z.string().url().or(z.literal('')).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  variants: z.array(VariantInputSchema).optional(),
});

const UpdateProductSchema = z.object({
  action: z.literal('UPDATE_PRODUCT'),
  productId: z.string().uuid('Invalid product ID'),
  sku: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(150).optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  categoryName: z.string().min(1).max(50).optional(),
  priceUsd: z.number().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional(),
  minStockThreshold: z.number().int().nonnegative().optional(),
  sizes: z.array(z.string()).optional(),
  hasVariants: z.boolean().optional(),
  imageUrl: z.string().url().or(z.literal('')).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
  allowStudentOrders: z.boolean().optional(),
  variants: z.array(VariantInputSchema).optional(),
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

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search')?.trim();
    const includeInactive = searchParams.get('include_inactive') === 'true';

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
      `)
      .order('name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }
    if (category && category !== 'All') {
      query = query.eq('category_name', category);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const { data: products, error } = await query;
    if (error) {
      return formatServerErrorResponse(error);
    }

    return NextResponse.json({
      success: true,
      data: products || [],
      error: null,
    });
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
      let result: any = null;
      const { data: rpcResult, error: rpcError } = await adminSupabase.rpc('adjust_inventory_stock', {
        p_product_id: body.productId,
        p_variant_id: body.variantId || null,
        p_change_qty: body.changeQty,
        p_reason: body.reason,
        p_notes: body.notes || `Stock adjusted via Admin Portal (${body.reason})`,
      });

      if (!rpcError && rpcResult) {
        result = rpcResult;
      } else {
        // Direct table fallback: update stock in products table
        const { data: currentProduct, error: fetchErr } = await adminSupabase
          .from('products')
          .select('id, stock')
          .eq('id', body.productId)
          .single();

        if (fetchErr || !currentProduct) {
          return formatServerErrorResponse(fetchErr || new Error('Product not found in database'));
        }

        const newStock = Math.max(0, (currentProduct.stock || 0) + body.changeQty);
        const { data: updatedProduct, error: updateErr } = await adminSupabase
          .from('products')
          .update({ stock: newStock, updated_at: new Date().toISOString() })
          .eq('id', body.productId)
          .select('id, stock')
          .single();

        if (updateErr) {
          return formatServerErrorResponse(updateErr);
        }

        result = {
          product_id: body.productId,
          previous_balance: currentProduct.stock,
          change_qty: body.changeQty,
          new_balance: updatedProduct.stock,
          reason: body.reason,
        };
      }

      await logSecurityAuditEvent({
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
      });
    }

    if (body.action === 'CREATE_PRODUCT') {
      const hasVariants = Boolean(body.variants && body.variants.length > 0) || body.hasVariants;
      let calculatedStock = body.stock;
      let finalSizes = body.sizes || [];

      if (body.variants && body.variants.length > 0) {
        calculatedStock = body.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
        const derivedSizes = Array.from(new Set(body.variants.map(v => v.size.trim())));
        finalSizes = derivedSizes;
      }

      const { data: newProd, error: insertError } = await adminSupabase
        .from('products')
        .insert({
          sku: body.sku.toUpperCase().trim(),
          name: body.name.trim(),
          category_id: body.categoryId || null,
          category_name: body.categoryName,
          price_usd: body.priceUsd,
          cost_usd: body.costUsd,
          stock: calculatedStock,
          min_stock_threshold: body.minStockThreshold,
          sizes: finalSizes,
          has_variants: hasVariants,
          image_url: body.imageUrl || null,
          description: body.description || null,
          is_active: true,
          allow_student_orders: true,
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505' || insertError.message?.includes('duplicate key') || insertError.message?.includes('sku')) {
          return NextResponse.json(
            { success: false, data: null, error: { message: `SKU "${body.sku.toUpperCase().trim()}" is already assigned to another product in the catalog.` } },
            { status: 409 }
          );
        }
        return formatServerErrorResponse(insertError);
      }

      // Insert child variants if supplied
      if (body.variants && body.variants.length > 0) {
        const variantRows = body.variants.map(v => ({
          product_id: newProd.id,
          sku: v.sku.toUpperCase().trim(),
          size: v.size.trim(),
          color: v.color?.trim() || null,
          stock: v.stock || 0,
          price_override: v.priceOverride !== undefined && v.priceOverride !== null ? v.priceOverride : null,
          min_stock_threshold: v.minStockThreshold || 3,
          is_active: true
        }));

        const { data: createdVariants, error: variantInsertError } = await adminSupabase
          .from('product_variants')
          .insert(variantRows)
          .select();

        if (variantInsertError) {
          console.error('Failed to insert product variants:', variantInsertError);
        } else {
          newProd.variants = createdVariants;
        }
      }

      await logSecurityAuditEvent({
        action: 'PRODUCT_CREATED',
        performedBy: context.userId,
        targetId: newProd.id,
        details: { sku: newProd.sku, name: newProd.name, variantsCount: body.variants?.length || 0 },
        status: 'SUCCESS',
      });

      return NextResponse.json({
        success: true,
        data: newProd,
        error: null,
      });
    }

    if (body.action === 'UPDATE_PRODUCT') {
      const updateFields: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (body.sku !== undefined) updateFields.sku = body.sku.toUpperCase().trim();
      if (body.name !== undefined) updateFields.name = body.name.trim();
      if (body.categoryId !== undefined) updateFields.category_id = body.categoryId;
      if (body.categoryName !== undefined) updateFields.category_name = body.categoryName;
      if (body.priceUsd !== undefined) updateFields.price_usd = body.priceUsd;
      if (body.costUsd !== undefined) updateFields.cost_usd = body.costUsd;
      if (body.stock !== undefined) updateFields.stock = body.stock;
      if (body.minStockThreshold !== undefined) updateFields.min_stock_threshold = body.minStockThreshold;
      if (body.sizes !== undefined) updateFields.sizes = body.sizes;
      if (body.hasVariants !== undefined) updateFields.has_variants = body.hasVariants;
      if (body.imageUrl !== undefined) updateFields.image_url = body.imageUrl;
      if (body.description !== undefined) updateFields.description = body.description;
      if (body.isActive !== undefined) updateFields.is_active = body.isActive;
      if (body.allowStudentOrders !== undefined) updateFields.allow_student_orders = body.allowStudentOrders;

      if (body.variants && body.variants.length > 0) {
        const variantStockTotal = body.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
        updateFields.stock = variantStockTotal;
        updateFields.has_variants = true;
        updateFields.sizes = Array.from(new Set(body.variants.map(v => v.size.trim())));

        // Clean & sync variants
        await adminSupabase.from('product_variants').delete().eq('product_id', body.productId);
        const variantRows = body.variants.map(v => ({
          product_id: body.productId,
          sku: v.sku.toUpperCase().trim(),
          size: v.size.trim(),
          color: v.color?.trim() || null,
          stock: v.stock || 0,
          price_override: v.priceOverride !== undefined && v.priceOverride !== null ? v.priceOverride : null,
          min_stock_threshold: v.minStockThreshold || 3,
          is_active: true
        }));
        await adminSupabase.from('product_variants').insert(variantRows);
      }

      const { data: updatedProd, error: updateError } = await adminSupabase
        .from('products')
        .update(updateFields)
        .eq('id', body.productId)
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
        `)
        .single();

      if (updateError) {
        if (updateError.code === '23505' || updateError.message?.includes('duplicate key') || updateError.message?.includes('sku')) {
          return NextResponse.json(
            { success: false, data: null, error: { message: `SKU "${body.sku?.toUpperCase().trim()}" is already assigned to another product in the catalog.` } },
            { status: 409 }
          );
        }
        return formatServerErrorResponse(updateError);
      }

      await logSecurityAuditEvent({
        action: 'PRODUCT_UPDATED',
        performedBy: context.userId,
        targetId: body.productId,
        details: { sku: updatedProd.sku, updatedFields: Object.keys(updateFields) },
        status: 'SUCCESS',
      });

      return NextResponse.json({
        success: true,
        data: updatedProd,
        error: null,
      });
    }

    if (body.action === 'DELETE_PRODUCT') {
      const { error: deleteError } = await adminSupabase
        .from('products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', body.productId);

      if (deleteError) {
        return formatServerErrorResponse(deleteError);
      }

      await logSecurityAuditEvent({
        action: 'PRODUCT_DELETED',
        performedBy: context.userId,
        targetId: body.productId,
        details: { softDelete: true },
        status: 'SUCCESS',
      });

      return NextResponse.json({
        success: true,
        data: { id: body.productId, is_active: false },
        error: null,
      });
    }

    return NextResponse.json({ success: false, data: null, error: { message: 'Invalid action' } }, { status: 400 });
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
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, STAFF_ROLES);
    if (authErr || !adminSupabase || !context) return authErr!;

    const PutSchema = UpdateProductSchema.omit({ action: true });
    const { data: body, errorResponse: valErr } = await validateRequestBody(PutSchema, req);
    if (valErr || !body) return valErr!;

    const updateFields: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (body.sku !== undefined) updateFields.sku = body.sku.toUpperCase().trim();
    if (body.name !== undefined) updateFields.name = body.name.trim();
    if (body.categoryId !== undefined) updateFields.category_id = body.categoryId;
    if (body.categoryName !== undefined) updateFields.category_name = body.categoryName;
    if (body.priceUsd !== undefined) updateFields.price_usd = body.priceUsd;
    if (body.costUsd !== undefined) updateFields.cost_usd = body.costUsd;
    if (body.stock !== undefined) updateFields.stock = body.stock;
    if (body.minStockThreshold !== undefined) updateFields.min_stock_threshold = body.minStockThreshold;
    if (body.sizes !== undefined) updateFields.sizes = body.sizes;
    if (body.hasVariants !== undefined) updateFields.has_variants = body.hasVariants;
    if (body.imageUrl !== undefined) updateFields.image_url = body.imageUrl;
    if (body.description !== undefined) updateFields.description = body.description;
    if (body.isActive !== undefined) updateFields.is_active = body.isActive;
    if (body.allowStudentOrders !== undefined) updateFields.allow_student_orders = body.allowStudentOrders;

    const { data: updatedProd, error: updateError } = await adminSupabase
      .from('products')
      .update(updateFields)
      .eq('id', body.productId)
      .select()
      .single();

    if (updateError) {
      return formatServerErrorResponse(updateError);
    }

    await logSecurityAuditEvent({
      action: 'PRODUCT_UPDATED',
      performedBy: context.userId,
      targetId: body.productId,
      details: { sku: updatedProd.sku, updatedFields: Object.keys(updateFields) },
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      data: updatedProd,
      error: null,
    });
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
    const { errorResponse: authErr, context, adminSupabase } = await verifyCaller(req, STAFF_ROLES);
    if (authErr || !adminSupabase || !context) return authErr!;

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('id');
    if (!productId) {
      return NextResponse.json({ success: false, data: null, error: { message: 'Missing product ID parameter' } }, { status: 400 });
    }

    const { error: deleteError } = await adminSupabase
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', productId);

    if (deleteError) {
      return formatServerErrorResponse(deleteError);
    }

    await logSecurityAuditEvent({
      action: 'PRODUCT_DELETED',
      performedBy: context.userId,
      targetId: productId,
      details: { softDelete: true },
      status: 'SUCCESS',
    });

    return NextResponse.json({
      success: true,
      data: { id: productId, is_active: false },
      error: null,
    });
  } catch (error: any) {
    return formatServerErrorResponse(error);
  }
}
