-- =========================================================================================
-- Infinity TKD Pro-Shop — Product Variants & Matrix Inventory Migration
-- Version: 20260930_proshop_product_variants_and_matrix.sql
-- Enables multi-size uniforms, collar styles (White / Black-Red / Black V-Neck), 
-- color variations, and per-variant stock tracking with zero-trust audit logs.
-- =========================================================================================

-- 1. Ensure product_variants table and columns exist
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku VARCHAR(50) UNIQUE NOT NULL,
    size VARCHAR(50),
    color VARCHAR(50), -- Collar style or color: 'White V-Neck', 'Black/Red V-Neck (Poom)', 'Black V-Neck (Dan)', etc.
    price_override NUMERIC(10, 2) CHECK (price_override IS NULL OR price_override >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    min_stock_threshold INT NOT NULL DEFAULT 3,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure indexes on variants
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON public.product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON public.product_variants(is_active);

-- 2. Ensure pos_order_items has variant_id and color columns
ALTER TABLE public.pos_order_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;
ALTER TABLE public.pos_order_items ADD COLUMN IF NOT EXISTS color VARCHAR(50);
ALTER TABLE public.pos_order_items ADD COLUMN IF NOT EXISTS size VARCHAR(50);

-- 3. Stored Procedure: Atomic Inventory Stock Adjustment (Supports Parent & Variant)
CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(
  p_product_id UUID,
  p_change_qty INTEGER,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL,
  p_variant_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_stock INTEGER;
  v_new_stock INTEGER;
  v_prod_name TEXT;
  v_variant_sku TEXT;
  v_variant_size TEXT;
  v_variant_color TEXT;
BEGIN
  -- If variant_id is provided, adjust specific variant
  IF p_variant_id IS NOT NULL THEN
    SELECT v.stock, v.sku, v.size, v.color, p.name 
    INTO v_old_stock, v_variant_sku, v_variant_size, v_variant_color, v_prod_name
    FROM public.product_variants v
    JOIN public.products p ON p.id = v.product_id
    WHERE v.id = p_variant_id AND v.product_id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant ID % not found for product ID %.', p_variant_id, p_product_id;
    END IF;

    v_new_stock := GREATEST(0, v_old_stock + p_change_qty);

    UPDATE public.product_variants
    SET stock = v_new_stock,
        updated_at = NOW()
    WHERE id = p_variant_id;

    -- Update parent product stock to reflect total variant sum
    UPDATE public.products
    SET stock = (SELECT COALESCE(SUM(stock), 0) FROM public.product_variants WHERE product_id = p_product_id AND is_active = true),
        updated_at = NOW()
    WHERE id = p_product_id;

    -- Record audit log
    INSERT INTO public.inventory_logs (
      product_id, variant_id, change_quantity, balance_after, reason, notes, logged_by
    ) VALUES (
      p_product_id, p_variant_id, p_change_qty, v_new_stock, p_reason, p_notes, auth.uid()
    );

    RETURN jsonb_build_object(
      'product_id', p_product_id,
      'variant_id', p_variant_id,
      'product_name', v_prod_name,
      'variant_sku', v_variant_sku,
      'size', v_variant_size,
      'color', v_variant_color,
      'previous_balance', v_old_stock,
      'change_qty', p_change_qty,
      'new_balance', v_new_stock,
      'reason', p_reason
    );
  ELSE
    -- Parent product direct stock adjustment
    SELECT stock, name INTO v_old_stock, v_prod_name
    FROM public.products
    WHERE id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product with ID % not found.', p_product_id;
    END IF;

    v_new_stock := GREATEST(0, v_old_stock + p_change_qty);

    UPDATE public.products
    SET stock = v_new_stock,
        updated_at = NOW()
    WHERE id = p_product_id;

    -- Record audit log
    INSERT INTO public.inventory_logs (
      product_id, change_quantity, balance_after, reason, notes, logged_by
    ) VALUES (
      p_product_id, p_change_qty, v_new_stock, p_reason, p_notes, auth.uid()
    );

    RETURN jsonb_build_object(
      'product_id', p_product_id,
      'product_name', v_prod_name,
      'previous_balance', v_old_stock,
      'change_qty', p_change_qty,
      'new_balance', v_new_stock,
      'reason', p_reason
    );
  END IF;
END;
$$;

-- 4. Stored Procedure: Process Admin POS Sale (Supports Both Variants & Flat Products)
CREATE OR REPLACE FUNCTION public.process_admin_pos_sale(
  p_customer_name TEXT,
  p_subtotal NUMERIC,
  p_discount_percentage NUMERIC,
  p_payment_method TEXT,
  p_items JSONB,
  p_student_id TEXT DEFAULT NULL,
  p_branch_id INTEGER DEFAULT NULL,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_discount_usd NUMERIC;
  v_total_usd NUMERIC;
  v_item RECORD;
  v_prod_id UUID;
  v_var_id UUID;
  v_qty INTEGER;
  v_price NUMERIC;
BEGIN
  v_order_number := 'POS-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)) || '-' || TO_CHAR(NOW(), 'YYMMDD');
  v_discount_usd := ROUND((p_subtotal * COALESCE(p_discount_percentage, 0) / 100)::NUMERIC, 2);
  v_total_usd := ROUND((p_subtotal - v_discount_usd)::NUMERIC, 2);

  -- 1. Insert order header
  INSERT INTO public.pos_orders (
    order_number,
    order_channel,
    student_id,
    customer_name,
    branch_id,
    subtotal_usd,
    discount_percentage,
    discount_usd,
    total_usd,
    payment_method,
    payment_status,
    order_status,
    admin_notes,
    recorded_by,
    created_at,
    updated_at
  )
  VALUES (
    v_order_number,
    'ADMIN_POS',
    p_student_id,
    p_customer_name,
    p_branch_id,
    p_subtotal,
    COALESCE(p_discount_percentage, 0),
    v_discount_usd,
    v_total_usd,
    p_payment_method,
    'PAID',
    'COMPLETED',
    p_admin_notes,
    auth.uid(),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_order_id;

  -- 2. Process line items and decrement stock
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    product_id UUID,
    variant_id UUID,
    sku TEXT,
    name TEXT,
    size TEXT,
    color TEXT,
    price NUMERIC,
    qty INTEGER
  )
  LOOP
    v_prod_id := v_item.product_id;
    v_var_id := v_item.variant_id;
    v_qty := v_item.qty;
    v_price := v_item.price;

    -- Insert order line item with size and collar/color
    INSERT INTO public.pos_order_items (
      order_id,
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
    VALUES (
      v_order_id,
      v_prod_id,
      v_var_id,
      v_item.sku,
      v_item.name,
      v_item.size,
      v_item.color,
      v_price,
      v_qty,
      ROUND((v_price * v_qty)::NUMERIC, 2)
    );

    -- If line item is a variant, decrement variant stock
    IF v_var_id IS NOT NULL THEN
      UPDATE public.product_variants
      SET stock = GREATEST(0, stock - v_qty),
          updated_at = NOW()
      WHERE id = v_var_id;

      INSERT INTO public.inventory_logs (
        product_id, variant_id, change_quantity, balance_after, reason, reference_id, logged_by, notes
      ) VALUES (
        v_prod_id, v_var_id, -v_qty, 
        (SELECT stock FROM public.product_variants WHERE id = v_var_id),
        'POS_SALE', v_order_id, auth.uid(), 'Counter Walk-in Sale'
      );
    END IF;

    -- Always decrement parent product stock
    UPDATE public.products
    SET stock = GREATEST(0, stock - v_qty),
        updated_at = NOW()
    WHERE id = v_prod_id;

    IF v_var_id IS NULL THEN
      INSERT INTO public.inventory_logs (
        product_id, change_quantity, balance_after, reason, reference_id, logged_by, notes
      ) VALUES (
        v_prod_id, -v_qty,
        (SELECT stock FROM public.products WHERE id = v_prod_id),
        'POS_SALE', v_order_id, auth.uid(), 'Counter Walk-in Sale'
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal_usd', p_subtotal,
    'discount_usd', v_discount_usd,
    'total_usd', v_total_usd,
    'order_status', 'COMPLETED',
    'payment_status', 'PAID'
  );
END;
$$;

-- 5. Stored Procedure: Student Portal Order Placement (Supports Variants)
CREATE OR REPLACE FUNCTION public.place_student_order(
  p_student_id TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_payment_method TEXT,
  p_items JSONB,
  p_branch_id INTEGER DEFAULT NULL,
  p_student_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_subtotal NUMERIC := 0.00;
  v_item RECORD;
  v_item_total NUMERIC;
BEGIN
  v_order_number := 'ORD-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)) || '-' || TO_CHAR(NOW(), 'YYMMDD');

  -- Pre-calculate subtotal
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    price NUMERIC,
    qty INTEGER
  )
  LOOP
    v_subtotal := v_subtotal + ROUND((v_item.price * v_item.qty)::NUMERIC, 2);
  END LOOP;

  -- Insert order header (Pending fulfillment)
  INSERT INTO public.pos_orders (
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
    created_at,
    updated_at
  )
  VALUES (
    v_order_number,
    'STUDENT_PORTAL',
    p_student_id,
    p_customer_name,
    p_customer_phone,
    p_branch_id,
    v_subtotal,
    0.00,
    0.00,
    v_subtotal,
    p_payment_method,
    'PENDING',
    'PENDING_CONFIRMATION',
    p_student_notes,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_order_id;

  -- Insert line items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    product_id UUID,
    variant_id UUID,
    sku TEXT,
    name TEXT,
    size TEXT,
    color TEXT,
    price NUMERIC,
    qty INTEGER
  )
  LOOP
    v_item_total := ROUND((v_item.price * v_item.qty)::NUMERIC, 2);

    INSERT INTO public.pos_order_items (
      order_id,
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
    VALUES (
      v_order_id,
      v_item.product_id,
      v_item.variant_id,
      v_item.sku,
      v_item.name,
      v_item.size,
      v_item.color,
      v_item.price,
      v_item.qty,
      v_item_total
    );
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal_usd', v_subtotal,
    'total_usd', v_subtotal,
    'order_status', 'PENDING_CONFIRMATION',
    'payment_status', 'PENDING'
  );
END;
$$;
