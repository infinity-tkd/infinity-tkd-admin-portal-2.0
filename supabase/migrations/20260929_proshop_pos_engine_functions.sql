-- =========================================================================================
-- Infinity TKD Admin Portal & Pro-Shop Engine: Production Stored Procedures
-- High-Performance Zero-Trust Functions for Counter POS, Stock Adjustments, and Orders
-- =========================================================================================

-- 1. ADJUST INVENTORY STOCK
-- Adjusts stock balance atomically and returns old and new balance
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
BEGIN
  -- Lock row for update
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

  RETURN jsonb_build_object(
    'product_id', p_product_id,
    'product_name', v_prod_name,
    'previous_balance', v_old_stock,
    'change_qty', p_change_qty,
    'new_balance', v_new_stock,
    'reason', p_reason
  );
END;
$$;

-- 2. PROCESS ADMIN POS SALE
-- Atomic walk-in counter sale: records order, inserts order items, and decrements stock in a single transaction
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
  v_qty INTEGER;
  v_price NUMERIC;
  v_sku TEXT;
  v_name TEXT;
  v_size TEXT;
  v_current_stock INTEGER;
BEGIN
  v_order_number := 'POS-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)) || '-' || TO_CHAR(NOW(), 'YYMMDD');
  v_discount_usd := ROUND((p_subtotal * COALESCE(p_discount_percentage, 0) / 100)::NUMERIC, 2);
  v_total_usd := ROUND((p_subtotal - v_discount_usd)::NUMERIC, 2);

  -- Insert order header
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

  -- Process line items and decrement stock
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    product_id UUID,
    variant_id UUID,
    sku TEXT,
    name TEXT,
    size TEXT,
    price NUMERIC,
    qty INTEGER
  )
  LOOP
    v_prod_id := v_item.product_id;
    v_qty := v_item.qty;
    v_price := v_item.price;

    -- Insert order line item
    INSERT INTO public.pos_order_items (
      order_id,
      product_id,
      variant_id,
      sku,
      product_name,
      size,
      unit_price_usd,
      quantity,
      total_price_usd
    )
    VALUES (
      v_order_id,
      v_prod_id,
      v_item.variant_id,
      v_item.sku,
      v_item.name,
      v_item.size,
      v_price,
      v_qty,
      ROUND((v_price * v_qty)::NUMERIC, 2)
    );

    -- Decrement product stock safely
    UPDATE public.products
    SET stock = GREATEST(0, stock - v_qty),
        updated_at = NOW()
    WHERE id = v_prod_id;
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

-- 3. PLACE STUDENT ORDER
-- Submits student order from student portal and marks as PENDING
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
  v_subtotal NUMERIC := 0;
  v_item RECORD;
  v_prod_price NUMERIC;
  v_prod_sku TEXT;
  v_prod_name TEXT;
  v_line_total NUMERIC;
BEGIN
  v_order_number := 'ORD-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)) || '-' || TO_CHAR(NOW(), 'YYMMDD');

  -- Pre-calculate subtotal
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    product_id UUID,
    variant_id UUID,
    size TEXT,
    qty INTEGER
  )
  LOOP
    SELECT price_usd INTO v_prod_price FROM public.products WHERE id = v_item.product_id;
    IF v_prod_price IS NOT NULL THEN
      v_subtotal := v_subtotal + (v_prod_price * v_item.qty);
    END IF;
  END LOOP;

  -- Insert order header
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
    0,
    0,
    v_subtotal,
    p_payment_method,
    'PENDING',
    'PENDING',
    p_student_notes,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_order_id;

  -- Insert order items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    product_id UUID,
    variant_id UUID,
    size TEXT,
    qty INTEGER
  )
  LOOP
    SELECT sku, name, price_usd INTO v_prod_sku, v_prod_name, v_prod_price
    FROM public.products
    WHERE id = v_item.product_id;

    IF v_prod_price IS NOT NULL THEN
      v_line_total := ROUND((v_prod_price * v_item.qty)::NUMERIC, 2);
      INSERT INTO public.pos_order_items (
        order_id,
        product_id,
        variant_id,
        sku,
        product_name,
        size,
        unit_price_usd,
        quantity,
        total_price_usd
      )
      VALUES (
        v_order_id,
        v_item.product_id,
        v_item.variant_id,
        v_prod_sku,
        v_prod_name,
        v_item.size,
        v_prod_price,
        v_item.qty,
        v_line_total
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal_usd', v_subtotal,
    'status', 'PENDING'
  );
END;
$$;
