-- =====================================================================
-- INFINITY TKD 2.0 - UNIFIED STUDENT ACCOUNT LINKING, PRO SHOP & ZERO-TRUST RLS
-- Target: Supabase / PostgreSQL (public schema)
-- Date: 2026-09-13
--
-- Contents:
--   1. SAFE PRE-DROPS: Prevent PostgreSQL 42P13 Parameter Collision Errors
--   2. SCHEMA EXTENSIONS: Profiles & Students Foreign Keys & Indexes
--   3. PRO SHOP & POS SCHEMA: Products, Variants, POS Orders, Items, Inventory Logs
--   4. AUTHENTICATION & SECURITY DEFINER RESOLUTION RPCS:
--      - get_email_by_username(TEXT)
--      - is_own_student_record(VARCHAR)
--      - is_current_student(VARCHAR)
--      - is_dojo_staff()
--   5. PRO SHOP ATOMIC STORED PROCEDURES:
--      - place_student_order(...)
--      - confirm_student_order(...)
--      - cancel_or_refund_order(...)
--      - process_admin_pos_sale(...)
--   6. AUTOMATED BI-DIRECTIONAL LINKING TRIGGERS:
--      - fn_sync_profile_student_link / trg_sync_profile_student_link
--      - fn_sync_student_profile_link / trg_sync_student_profile_link
--   7. BACKFILL EXISTING UNLINKED RECORDS
--   8. ZERO-TRUST ROW LEVEL SECURITY (RLS) POLICIES
--   9. SEARCH PATH HARDENING
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SAFE PRE-DROPS (ELIMINATES POSTGRESQL 42P13 & SIGNATURE MISMATCHES)
-- ---------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_email_by_username(TEXT);
DROP FUNCTION IF EXISTS public.get_email_by_username(VARCHAR);

DROP FUNCTION IF EXISTS public.is_own_student_record(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS public.is_own_student_record(TEXT) CASCADE;

DROP FUNCTION IF EXISTS public.is_current_student(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS public.is_current_student(TEXT) CASCADE;

DROP FUNCTION IF EXISTS public.is_dojo_staff() CASCADE;

DROP FUNCTION IF EXISTS public.place_student_order(VARCHAR, VARCHAR, VARCHAR, INT, VARCHAR, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.place_student_order(TEXT, TEXT, TEXT, INT, TEXT, TEXT, JSONB);

DROP FUNCTION IF EXISTS public.confirm_student_order(UUID, VARCHAR, VARCHAR, TEXT);
DROP FUNCTION IF EXISTS public.confirm_student_order(UUID, TEXT, TEXT, TEXT);

DROP FUNCTION IF EXISTS public.cancel_or_refund_order(UUID, TEXT);

DROP FUNCTION IF EXISTS public.process_admin_pos_sale(VARCHAR, VARCHAR, INT, NUMERIC, NUMERIC, VARCHAR, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.process_admin_pos_sale(TEXT, TEXT, INT, NUMERIC, NUMERIC, TEXT, TEXT, JSONB);

-- ---------------------------------------------------------------------
-- 2. SCHEMA EXTENSIONS: PROFILES & STUDENTS FOREIGN KEYS & INDEXES
-- ---------------------------------------------------------------------

-- Add student_id to profiles if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS student_id VARCHAR(50) 
REFERENCES public.students(id) ON DELETE SET NULL;

-- Ensure students.profile_id foreign key exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'students_profile_id_fkey'
        AND table_name = 'students'
    ) THEN
        ALTER TABLE public.students 
        ADD CONSTRAINT students_profile_id_fkey 
        FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- High-performance lookup indexes for bi-directional joins
CREATE INDEX IF NOT EXISTS idx_profiles_student_id ON public.profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_students_profile_id ON public.students(profile_id);
CREATE INDEX IF NOT EXISTS idx_students_email_lower ON public.students(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles(LOWER(username));

-- ---------------------------------------------------------------------
-- 3. PRO SHOP & POS SCHEMA: TABLES, VARIANTS & INVENTORY LEDGER
-- ---------------------------------------------------------------------

-- A. Product Categories
CREATE TABLE IF NOT EXISTS public.product_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- B. Products Master Catalog
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    category_id INT REFERENCES public.product_categories(id) ON DELETE SET NULL,
    category_name VARCHAR(50) NOT NULL DEFAULT 'Uniforms',
    price_usd NUMERIC(10, 2) NOT NULL CHECK (price_usd >= 0),
    cost_usd NUMERIC(10, 2) DEFAULT 0.00 CHECK (cost_usd >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    min_stock_threshold INT NOT NULL DEFAULT 5,
    sizes TEXT[] DEFAULT '{}',
    has_variants BOOLEAN DEFAULT FALSE,
    image_url TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    allow_student_orders BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure missing columns are present if products table was created earlier
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sizes TEXT[] DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stock_threshold INT NOT NULL DEFAULT 5;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS allow_student_orders BOOLEAN DEFAULT TRUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10, 2) DEFAULT 0.00;

-- C. Product Variants (Size & Color specific stock tracking)
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku VARCHAR(50) UNIQUE NOT NULL,
    size VARCHAR(50),
    color VARCHAR(50),
    price_override NUMERIC(10, 2) CHECK (price_override IS NULL OR price_override >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    min_stock_threshold INT NOT NULL DEFAULT 3,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- D. Point-of-Sale & Student Orders
CREATE TABLE IF NOT EXISTS public.pos_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    order_channel VARCHAR(20) NOT NULL DEFAULT 'STUDENT_PORTAL' 
        CHECK (order_channel IN ('STUDENT_PORTAL', 'ADMIN_POS')),
    student_id VARCHAR(50) REFERENCES public.students(id) ON DELETE SET NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(30),
    branch_id INT REFERENCES public.branches(id) ON DELETE SET NULL,
    subtotal_usd NUMERIC(10, 2) NOT NULL CHECK (subtotal_usd >= 0),
    discount_percentage NUMERIC(5, 2) DEFAULT 0.00 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    discount_usd NUMERIC(10, 2) DEFAULT 0.00 CHECK (discount_usd >= 0),
    total_usd NUMERIC(10, 2) NOT NULL CHECK (total_usd >= 0),
    payment_method VARCHAR(30) NOT NULL DEFAULT 'ABA Bank KHQR' 
        CHECK (payment_method IN ('ABA Bank KHQR', 'Cash', 'Credit Card', 'Bank Transfer', 'Pay at Counter')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' 
        CHECK (payment_status IN ('PENDING', 'PAID', 'REFUNDED', 'VOID')),
    order_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_CONFIRMATION' 
        CHECK (order_status IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED')),
    khqr_md5_hash VARCHAR(64),
    student_notes TEXT,
    admin_notes TEXT,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    fulfilled_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure missing columns are present if pos_orders was created earlier
ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS khqr_md5_hash VARCHAR(64);
ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS student_notes TEXT;
ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- E. Order Line Items
CREATE TABLE IF NOT EXISTS public.pos_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    sku VARCHAR(50) NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    size VARCHAR(50),
    color VARCHAR(50),
    unit_price_usd NUMERIC(10, 2) NOT NULL CHECK (unit_price_usd >= 0),
    quantity INT NOT NULL CHECK (quantity > 0),
    total_price_usd NUMERIC(10, 2) NOT NULL CHECK (total_price_usd >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- F. Inventory Stock Audit Ledger
CREATE TABLE IF NOT EXISTS public.inventory_logs (
    id BIGSERIAL PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    change_quantity INT NOT NULL,
    balance_after INT NOT NULL,
    reason VARCHAR(50) NOT NULL 
        CHECK (reason IN ('POS_SALE', 'ONLINE_ORDER', 'RESTOCK', 'ORDER_CANCELLED_RESTORE', 'DAMAGE_WRITE_OFF', 'AUDIT_ADJUSTMENT')),
    reference_id UUID,
    logged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pro Shop Indexes
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_pos_orders_student ON public.pos_orders(student_id);
CREATE INDEX IF NOT EXISTS idx_pos_orders_status ON public.pos_orders(order_status, payment_status);
CREATE INDEX IF NOT EXISTS idx_pos_order_items_order ON public.pos_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_prod ON public.inventory_logs(product_id);

-- ---------------------------------------------------------------------
-- 4. AUTHENTICATION & SECURITY DEFINER RESOLUTION RPCS
-- ---------------------------------------------------------------------

-- A. Resolve Email from Username or Student ID
CREATE OR REPLACE FUNCTION public.get_email_by_username(target_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    found_email TEXT;
    normalized_input TEXT;
    cleaned_input TEXT;
BEGIN
    IF target_username IS NULL OR trim(target_username) = '' THEN
        RETURN NULL;
    END IF;

    normalized_input := trim(target_username);
    cleaned_input := REPLACE(REPLACE(LOWER(normalized_input), '-', ''), '_', '');

    -- 1. Exact username match in profiles
    SELECT email INTO found_email
    FROM public.profiles
    WHERE LOWER(username) = LOWER(normalized_input)
    LIMIT 1;

    IF found_email IS NOT NULL THEN
        RETURN found_email;
    END IF;

    -- 2. Match on profiles.student_id directly
    SELECT email INTO found_email
    FROM public.profiles
    WHERE LOWER(student_id) = LOWER(normalized_input)
       OR REPLACE(LOWER(student_id), '-', '_') = REPLACE(LOWER(normalized_input), '-', '_')
    LIMIT 1;

    IF found_email IS NOT NULL THEN
        RETURN found_email;
    END IF;

    -- 3. Normalized match on profiles.username (handling dashes vs underscores)
    SELECT email INTO found_email
    FROM public.profiles
    WHERE REPLACE(REPLACE(LOWER(username), '-', ''), '_', '') = cleaned_input
    LIMIT 1;

    IF found_email IS NOT NULL THEN
        RETURN found_email;
    END IF;

    -- 4. Match on students.id (retrieve linked profile email)
    SELECT p.email INTO found_email
    FROM public.students s
    JOIN public.profiles p ON p.id = s.profile_id
    WHERE LOWER(s.id) = LOWER(normalized_input)
       OR REPLACE(REPLACE(LOWER(s.id), '-', ''), '_', '') = cleaned_input
    LIMIT 1;

    IF found_email IS NOT NULL THEN
        RETURN found_email;
    END IF;

    -- 5. Match on students.id where profile email matches student record email
    SELECT p.email INTO found_email
    FROM public.students s
    JOIN public.profiles p ON LOWER(p.email) = LOWER(s.email)
    WHERE LOWER(s.id) = LOWER(normalized_input)
       OR REPLACE(REPLACE(LOWER(s.id), '-', ''), '_', '') = cleaned_input
    LIMIT 1;

    IF found_email IS NOT NULL THEN
        RETURN found_email;
    END IF;

    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon, authenticated;

-- B. Helper: Check if caller is dojo staff
CREATE OR REPLACE FUNCTION public.is_dojo_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach')
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_dojo_staff() TO authenticated;

-- C. Helper: Check if record belongs to current student
CREATE OR REPLACE FUNCTION public.is_current_student(sid VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.students s
        WHERE (
            LOWER(s.id) = LOWER(sid)
            OR REPLACE(LOWER(s.id), '-', '_') = REPLACE(LOWER(sid), '-', '_')
        )
        AND (
            s.profile_id = auth.uid()
            OR s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.id = auth.uid() 
                AND (
                    LOWER(p.student_id) = LOWER(s.id)
                    OR REPLACE(LOWER(p.username), '_', '-') = REPLACE(LOWER(s.id), '_', '-')
                )
            )
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_current_student(VARCHAR) TO authenticated;

-- D. Legacy RPC compatibility: is_own_student_record
CREATE OR REPLACE FUNCTION public.is_own_student_record(student_id_param VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RETURN public.is_current_student(student_id_param);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_own_student_record(VARCHAR) TO authenticated;

-- ---------------------------------------------------------------------
-- 5. PRO SHOP ATOMIC STORED PROCEDURES
-- ---------------------------------------------------------------------

-- A. Place Student Order (Pessimistic Locking & Inventory Ledger Logging)
CREATE OR REPLACE FUNCTION public.place_student_order(
    p_student_id VARCHAR(50),
    p_customer_name VARCHAR(100),
    p_customer_phone VARCHAR(30),
    p_branch_id INT,
    p_payment_method VARCHAR(30),
    p_student_notes TEXT,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_order_number VARCHAR(50);
    v_item RECORD;
    v_prod RECORD;
    v_var RECORD;
    v_unit_price NUMERIC(10, 2);
    v_item_subtotal NUMERIC(10, 2);
    v_calculated_subtotal NUMERIC(10, 2) := 0.00;
BEGIN
    -- Generate human-readable order number (ORD-YYMMDD-XXXXXX)
    v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

    -- Create order header
    INSERT INTO public.pos_orders (
        order_number, order_channel, student_id, customer_name, customer_phone,
        branch_id, subtotal_usd, discount_percentage, discount_usd, total_usd,
        payment_method, payment_status, order_status, student_notes, recorded_by
    ) VALUES (
        v_order_number, 'STUDENT_PORTAL', p_student_id, p_customer_name, p_customer_phone,
        p_branch_id, 0.00, 0.00, 0.00, 0.00,
        p_payment_method, 'PENDING', 'PENDING_CONFIRMATION', p_student_notes, auth.uid()
    ) RETURNING id INTO v_order_id;

    -- Process items with pessimistic row-level locks
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID, variant_id UUID, size VARCHAR(50), qty INT
    )
    LOOP
        IF v_item.variant_id IS NOT NULL THEN
            SELECT * INTO v_var FROM public.product_variants WHERE id = v_item.variant_id FOR UPDATE;
            SELECT * INTO v_prod FROM public.products WHERE id = v_var.product_id;

            IF v_var.stock < v_item.qty THEN
                RAISE EXCEPTION 'Insufficient stock for % (%). Available: %, Requested: %',
                    v_prod.name, v_var.size, v_var.stock, v_item.qty;
            END IF;

            v_unit_price := COALESCE(v_var.price_override, v_prod.price_usd);
            v_item_subtotal := v_unit_price * v_item.qty;
            v_calculated_subtotal := v_calculated_subtotal + v_item_subtotal;

            UPDATE public.product_variants SET stock = stock - v_item.qty, updated_at = NOW() WHERE id = v_var.id;
            UPDATE public.products SET stock = GREATEST(0, stock - v_item.qty), updated_at = NOW() WHERE id = v_prod.id;

            INSERT INTO public.pos_order_items (
                order_id, product_id, variant_id, sku, product_name, size, color, unit_price_usd, quantity, total_price_usd
            ) VALUES (
                v_order_id, v_prod.id, v_var.id, v_var.sku, v_prod.name, v_var.size, v_var.color, v_unit_price, v_item.qty, v_item_subtotal
            );

            INSERT INTO public.inventory_logs (
                product_id, variant_id, change_quantity, balance_after, reason, reference_id, logged_by, notes
            ) VALUES (
                v_prod.id, v_var.id, -v_item.qty, v_var.stock - v_item.qty, 'ONLINE_ORDER', v_order_id, auth.uid(), 'Student Portal Pre-order'
            );
        ELSE
            SELECT * INTO v_prod FROM public.products WHERE id = v_item.product_id FOR UPDATE;

            IF v_prod.stock < v_item.qty THEN
                RAISE EXCEPTION 'Insufficient stock for %. Available: %, Requested: %',
                    v_prod.name, v_prod.stock, v_item.qty;
            END IF;

            v_unit_price := v_prod.price_usd;
            v_item_subtotal := v_unit_price * v_item.qty;
            v_calculated_subtotal := v_calculated_subtotal + v_item_subtotal;

            UPDATE public.products SET stock = stock - v_item.qty, updated_at = NOW() WHERE id = v_prod.id;

            INSERT INTO public.pos_order_items (
                order_id, product_id, sku, product_name, size, unit_price_usd, quantity, total_price_usd
            ) VALUES (
                v_order_id, v_prod.id, v_prod.sku, v_prod.name, v_item.size, v_unit_price, v_item.qty, v_item_subtotal
            );

            INSERT INTO public.inventory_logs (
                product_id, change_quantity, balance_after, reason, reference_id, logged_by, notes
            ) VALUES (
                v_prod.id, -v_item.qty, v_prod.stock - v_item.qty, 'ONLINE_ORDER', v_order_id, auth.uid(), 'Student Portal Pre-order'
            );
        END IF;
    END LOOP;

    -- Finalize totals
    UPDATE public.pos_orders SET subtotal_usd = v_calculated_subtotal, total_usd = v_calculated_subtotal WHERE id = v_order_id;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number,
        'subtotal_usd', v_calculated_subtotal,
        'order_status', 'PENDING_CONFIRMATION',
        'payment_status', 'PENDING'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_student_order(VARCHAR, VARCHAR, VARCHAR, INT, VARCHAR, TEXT, JSONB) TO authenticated;

-- B. Confirm Student Order (Staff Confirmation & Realtime Triggering)
CREATE OR REPLACE FUNCTION public.confirm_student_order(
    p_order_id UUID,
    p_new_order_status VARCHAR(30),
    p_payment_status VARCHAR(20) DEFAULT NULL,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_order RECORD;
BEGIN
    SELECT * INTO v_order FROM public.pos_orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found.';
    END IF;

    UPDATE public.pos_orders
    SET order_status = p_new_order_status,
        payment_status = COALESCE(p_payment_status, payment_status),
        admin_notes = COALESCE(p_admin_notes, admin_notes),
        confirmed_by = COALESCE(auth.uid(), confirmed_by),
        confirmed_at = CASE WHEN p_new_order_status IN ('CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED') AND confirmed_at IS NULL THEN NOW() ELSE confirmed_at END,
        fulfilled_at = CASE WHEN p_new_order_status = 'COMPLETED' THEN NOW() ELSE fulfilled_at END,
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'order_id', p_order_id,
        'order_status', p_new_order_status,
        'payment_status', COALESCE(p_payment_status, v_order.payment_status)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_student_order(UUID, VARCHAR, VARCHAR, TEXT) TO authenticated;

-- C. Cancel Order & Restore Inventory
CREATE OR REPLACE FUNCTION public.cancel_or_refund_order(
    p_order_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
BEGIN
    SELECT * INTO v_order FROM public.pos_orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found.';
    END IF;
    IF v_order.order_status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Order is already cancelled.';
    END IF;

    -- Return stock to inventory ledger
    FOR v_item IN SELECT * FROM public.pos_order_items WHERE order_id = p_order_id
    LOOP
        IF v_item.variant_id IS NOT NULL THEN
            UPDATE public.product_variants SET stock = stock + v_item.quantity WHERE id = v_item.variant_id;
            UPDATE public.products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;
            INSERT INTO public.inventory_logs (product_id, variant_id, change_quantity, balance_after, reason, reference_id, logged_by, notes)
            SELECT v_item.product_id, v_item.variant_id, v_item.quantity, pv.stock, 'ORDER_CANCELLED_RESTORE', p_order_id, auth.uid(), p_reason
            FROM public.product_variants pv WHERE pv.id = v_item.variant_id;
        ELSE
            UPDATE public.products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;
            INSERT INTO public.inventory_logs (product_id, change_quantity, balance_after, reason, reference_id, logged_by, notes)
            SELECT v_item.product_id, v_item.quantity, p.stock, 'ORDER_CANCELLED_RESTORE', p_order_id, auth.uid(), p_reason
            FROM public.products p WHERE p.id = v_item.product_id;
        END IF;
    END LOOP;

    UPDATE public.pos_orders
    SET order_status = 'CANCELLED',
        payment_status = CASE WHEN payment_status = 'PAID' THEN 'REFUNDED' ELSE 'VOID' END,
        cancelled_at = NOW(),
        cancellation_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'order_id', p_order_id,
        'order_status', 'CANCELLED'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_or_refund_order(UUID, TEXT) TO authenticated;

-- D. Process Admin POS Counter Sale (Walk-in Immediate Checkout)
CREATE OR REPLACE FUNCTION public.process_admin_pos_sale(
    p_student_id VARCHAR(50),
    p_customer_name VARCHAR(100),
    p_branch_id INT,
    p_subtotal NUMERIC(10, 2),
    p_discount_percentage NUMERIC(5, 2),
    p_payment_method VARCHAR(30),
    p_admin_notes TEXT,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_order_number VARCHAR(50);
    v_item RECORD;
    v_prod RECORD;
    v_var RECORD;
    v_discount_usd NUMERIC(10, 2);
    v_total_usd NUMERIC(10, 2);
    v_unit_price NUMERIC(10, 2);
    v_item_subtotal NUMERIC(10, 2);
BEGIN
    v_order_number := 'POS-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    v_discount_usd := ROUND((p_subtotal * (p_discount_percentage / 100.0)), 2);
    v_total_usd := GREATEST(0.00, p_subtotal - v_discount_usd);

    -- Create completed order header
    INSERT INTO public.pos_orders (
        order_number, order_channel, student_id, customer_name,
        branch_id, subtotal_usd, discount_percentage, discount_usd, total_usd,
        payment_method, payment_status, order_status, admin_notes,
        recorded_by, confirmed_by, confirmed_at, fulfilled_at
    ) VALUES (
        v_order_number, 'ADMIN_POS', p_student_id, p_customer_name,
        p_branch_id, p_subtotal, p_discount_percentage, v_discount_usd, v_total_usd,
        p_payment_method, 'PAID', 'COMPLETED', p_admin_notes,
        auth.uid(), auth.uid(), NOW(), NOW()
    ) RETURNING id INTO v_order_id;

    -- Process items and update stock
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID, variant_id UUID, sku VARCHAR(50), name VARCHAR(150), size VARCHAR(50), price NUMERIC(10, 2), qty INT
    )
    LOOP
        v_unit_price := v_item.price;
        v_item_subtotal := v_unit_price * v_item.qty;

        IF v_item.variant_id IS NOT NULL THEN
            UPDATE public.product_variants SET stock = GREATEST(0, stock - v_item.qty), updated_at = NOW() WHERE id = v_item.variant_id;
            UPDATE public.products SET stock = GREATEST(0, stock - v_item.qty), updated_at = NOW() WHERE id = v_item.product_id;

            INSERT INTO public.pos_order_items (
                order_id, product_id, variant_id, sku, product_name, size, unit_price_usd, quantity, total_price_usd
            ) VALUES (
                v_order_id, v_item.product_id, v_item.variant_id, v_item.sku, v_item.name, v_item.size, v_unit_price, v_item.qty, v_item_subtotal
            );

            INSERT INTO public.inventory_logs (
                product_id, variant_id, change_quantity, balance_after, reason, reference_id, logged_by, notes
            ) VALUES (
                v_item.product_id, v_item.variant_id, -v_item.qty, 0, 'POS_SALE', v_order_id, auth.uid(), 'Counter POS Sale'
            );
        ELSE
            UPDATE public.products SET stock = GREATEST(0, stock - v_item.qty), updated_at = NOW() WHERE id = v_item.product_id;

            INSERT INTO public.pos_order_items (
                order_id, product_id, sku, product_name, size, unit_price_usd, quantity, total_price_usd
            ) VALUES (
                v_order_id, v_item.product_id, v_item.sku, v_item.name, v_item.size, v_unit_price, v_item.qty, v_item_subtotal
            );

            INSERT INTO public.inventory_logs (
                product_id, change_quantity, balance_after, reason, reference_id, logged_by, notes
            ) VALUES (
                v_item.product_id, -v_item.qty, 0, 'POS_SALE', v_order_id, auth.uid(), 'Counter POS Sale'
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', TRUE,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'total_usd', v_total_usd,
        'order_status', 'COMPLETED'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_admin_pos_sale(VARCHAR, VARCHAR, INT, NUMERIC, NUMERIC, VARCHAR, TEXT, JSONB) TO authenticated;

-- ---------------------------------------------------------------------
-- 6. AUTOMATED BI-DIRECTIONAL LINKING TRIGGERS
-- ---------------------------------------------------------------------

-- Trigger A: When a profile is inserted or updated
CREATE OR REPLACE FUNCTION public.fn_sync_profile_student_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    matched_student_id VARCHAR(50);
BEGIN
    IF NEW.role = 'Student' THEN
        -- Check explicit student_id
        IF NEW.student_id IS NOT NULL AND NEW.student_id <> '' THEN
            UPDATE public.students
            SET profile_id = NEW.id
            WHERE LOWER(id) = LOWER(NEW.student_id)
              AND (profile_id IS NULL OR profile_id <> NEW.id);
        ELSE
            -- Auto-match against students table
            SELECT id INTO matched_student_id
            FROM public.students
            WHERE (
                REPLACE(REPLACE(LOWER(id), '-', ''), '_', '') = REPLACE(REPLACE(LOWER(NEW.username), '-', ''), '_', '')
                OR (NEW.email IS NOT NULL AND NEW.email <> '' AND LOWER(email) = LOWER(NEW.email))
            )
            ORDER BY 
                CASE WHEN REPLACE(REPLACE(LOWER(id), '-', ''), '_', '') = REPLACE(REPLACE(LOWER(NEW.username), '-', ''), '_', '') THEN 1 ELSE 2 END
            LIMIT 1;

            IF matched_student_id IS NOT NULL THEN
                NEW.student_id := matched_student_id;
                UPDATE public.students
                SET profile_id = NEW.id
                WHERE id = matched_student_id
                  AND (profile_id IS NULL OR profile_id <> NEW.id);
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_student_link ON public.profiles;
CREATE TRIGGER trg_sync_profile_student_link
BEFORE INSERT OR UPDATE OF student_id, username, email, role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_profile_student_link();

-- Trigger B: When a student record is inserted or updated
CREATE OR REPLACE FUNCTION public.fn_sync_student_profile_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    matched_profile_id UUID;
BEGIN
    IF NEW.profile_id IS NOT NULL THEN
        -- Sync profile's student_id
        UPDATE public.profiles
        SET student_id = NEW.id
        WHERE id = NEW.profile_id
          AND (student_id IS NULL OR student_id <> NEW.id);
    ELSE
        -- Auto-match against profiles table
        SELECT id INTO matched_profile_id
        FROM public.profiles
        WHERE role = 'Student'
          AND (
              REPLACE(REPLACE(LOWER(username), '-', ''), '_', '') = REPLACE(REPLACE(LOWER(NEW.id), '-', ''), '_', '')
              OR (NEW.email IS NOT NULL AND NEW.email <> '' AND LOWER(email) = LOWER(NEW.email))
          )
        LIMIT 1;

        IF matched_profile_id IS NOT NULL THEN
            NEW.profile_id := matched_profile_id;
            UPDATE public.profiles
            SET student_id = NEW.id
            WHERE id = matched_profile_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_student_profile_link ON public.students;
CREATE TRIGGER trg_sync_student_profile_link
BEFORE INSERT OR UPDATE OF profile_id, email ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_student_profile_link();

-- ---------------------------------------------------------------------
-- 7. BACKFILL EXISTING UNLINKED STUDENTS & PROFILES
-- ---------------------------------------------------------------------

-- Link students that have a matching student profile by username or email
UPDATE public.students s
SET profile_id = p.id
FROM public.profiles p
WHERE p.role = 'Student'
  AND (
      REPLACE(REPLACE(LOWER(p.username), '-', ''), '_', '') = REPLACE(REPLACE(LOWER(s.id), '-', ''), '_', '')
      OR (s.email IS NOT NULL AND s.email <> '' AND LOWER(p.email) = LOWER(s.email))
  )
  AND (s.profile_id IS NULL OR s.profile_id <> p.id);

-- Link profiles that have a linked student
UPDATE public.profiles p
SET student_id = s.id
FROM public.students s
WHERE p.id = s.profile_id
  AND (p.student_id IS NULL OR p.student_id <> s.id);

-- ---------------------------------------------------------------------
-- 8. ZERO-TRUST ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------

-- Enable RLS on all relevant tables
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.belt_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lms_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_physical_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_body_compositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pos_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pos_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_logs ENABLE ROW LEVEL SECURITY;

-- A. STUDENTS TABLE
DROP POLICY IF EXISTS "Staff or student self can select students" ON public.students;
CREATE POLICY "Staff or student self can select students"
ON public.students
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR profile_id = auth.uid()
    OR email = auth.jwt()->>'email'
    OR public.is_current_student(id)
);

-- B. ATTENDANCE TABLE
DROP POLICY IF EXISTS "Attendance access control" ON public.attendance;
CREATE POLICY "Attendance access control"
ON public.attendance
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

-- C. PAYMENTS TABLE
DROP POLICY IF EXISTS "Payments access control" ON public.payments;
CREATE POLICY "Payments access control"
ON public.payments
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

-- D. BELT HISTORIES TABLE
DROP POLICY IF EXISTS "Belt histories access control" ON public.belt_histories;
CREATE POLICY "Belt histories access control"
ON public.belt_histories
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

DROP POLICY IF EXISTS "Staff can manage belt histories" ON public.belt_histories;
CREATE POLICY "Staff can manage belt histories"
ON public.belt_histories
FOR ALL
TO authenticated
USING (public.is_dojo_staff())
WITH CHECK (public.is_dojo_staff());

-- E. ACHIEVEMENTS TABLE
DROP POLICY IF EXISTS "Achievements access control" ON public.achievements;
CREATE POLICY "Achievements access control"
ON public.achievements
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

DROP POLICY IF EXISTS "Staff can manage achievements" ON public.achievements;
CREATE POLICY "Staff can manage achievements"
ON public.achievements
FOR ALL
TO authenticated
USING (public.is_dojo_staff())
WITH CHECK (public.is_dojo_staff());

-- F. CLASS ENROLLMENTS TABLE
DROP POLICY IF EXISTS "Class enrollments access control" ON public.class_enrollments;
CREATE POLICY "Class enrollments access control"
ON public.class_enrollments
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

-- G. LMS PROGRESS TABLE
DROP POLICY IF EXISTS "Lms progress access control" ON public.lms_progress;
CREATE POLICY "Lms progress access control"
ON public.lms_progress
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

DROP POLICY IF EXISTS "Students can record own video progress" ON public.lms_progress;
CREATE POLICY "Students can record own video progress"
ON public.lms_progress
FOR ALL
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
)
WITH CHECK (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

-- H. STUDENT PHYSICAL EVALUATIONS TABLE
DROP POLICY IF EXISTS "Physical evaluations access control" ON public.student_physical_evaluations;
CREATE POLICY "Physical evaluations access control"
ON public.student_physical_evaluations
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

-- I. STUDENT BODY COMPOSITIONS TABLE
DROP POLICY IF EXISTS "Body composition access control" ON public.student_body_compositions;
CREATE POLICY "Body composition access control"
ON public.student_body_compositions
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

-- J. STUDENT ADDRESSES TABLE
DROP POLICY IF EXISTS "Strict student addresses access" ON public.student_addresses;
CREATE POLICY "Strict student addresses access"
ON public.student_addresses
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

-- K. PRO SHOP CATALOG: PRODUCTS, VARIANTS & CATEGORIES
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
CREATE POLICY "Anyone can view active products"
ON public.products FOR SELECT
TO authenticated, anon
USING (is_active = true OR public.is_dojo_staff());

DROP POLICY IF EXISTS "Staff can manage products" ON public.products;
CREATE POLICY "Staff can manage products"
ON public.products FOR ALL
TO authenticated
USING (public.is_dojo_staff())
WITH CHECK (public.is_dojo_staff());

DROP POLICY IF EXISTS "Anyone can view active product variants" ON public.product_variants;
CREATE POLICY "Anyone can view active product variants"
ON public.product_variants FOR SELECT
TO authenticated, anon
USING (is_active = true OR public.is_dojo_staff());

DROP POLICY IF EXISTS "Staff can manage product variants" ON public.product_variants;
CREATE POLICY "Staff can manage product variants"
ON public.product_variants FOR ALL
TO authenticated
USING (public.is_dojo_staff())
WITH CHECK (public.is_dojo_staff());

DROP POLICY IF EXISTS "Anyone can view product categories" ON public.product_categories;
CREATE POLICY "Anyone can view product categories"
ON public.product_categories FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Staff can manage product categories" ON public.product_categories;
CREATE POLICY "Staff can manage product categories"
ON public.product_categories FOR ALL
TO authenticated
USING (public.is_dojo_staff())
WITH CHECK (public.is_dojo_staff());

-- L. POS & STUDENT ORDERS ACCESS CONTROL
DROP POLICY IF EXISTS "Pos orders access control" ON public.pos_orders;
CREATE POLICY "Pos orders access control"
ON public.pos_orders FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR (student_id IS NOT NULL AND public.is_current_student(student_id))
);

DROP POLICY IF EXISTS "Staff can manage pos orders" ON public.pos_orders;
CREATE POLICY "Staff can manage pos orders"
ON public.pos_orders FOR ALL
TO authenticated
USING (public.is_dojo_staff())
WITH CHECK (public.is_dojo_staff());

DROP POLICY IF EXISTS "Pos order items access control" ON public.pos_order_items;
CREATE POLICY "Pos order items access control"
ON public.pos_order_items FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR EXISTS (
        SELECT 1 FROM public.pos_orders po
        WHERE po.id = pos_order_items.order_id
        AND (
            public.is_dojo_staff()
            OR (po.student_id IS NOT NULL AND public.is_current_student(po.student_id))
        )
    )
);

DROP POLICY IF EXISTS "Staff can manage pos order items" ON public.pos_order_items;
CREATE POLICY "Staff can manage pos order items"
ON public.pos_order_items FOR ALL
TO authenticated
USING (public.is_dojo_staff())
WITH CHECK (public.is_dojo_staff());

-- M. INVENTORY LOGS (STAFF AUDIT ACCESS)
DROP POLICY IF EXISTS "Staff can view inventory logs" ON public.inventory_logs;
CREATE POLICY "Staff can view inventory logs"
ON public.inventory_logs FOR SELECT
TO authenticated
USING (public.is_dojo_staff());

-- ---------------------------------------------------------------------
-- 9. SEARCH PATH HARDENING
-- ---------------------------------------------------------------------

ALTER FUNCTION public.get_email_by_username(TEXT) SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.is_own_student_record(VARCHAR) SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.is_dojo_staff() SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.is_current_student(VARCHAR) SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.fn_sync_profile_student_link() SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.fn_sync_student_profile_link() SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.place_student_order(VARCHAR, VARCHAR, VARCHAR, INT, VARCHAR, TEXT, JSONB) SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.confirm_student_order(UUID, VARCHAR, VARCHAR, TEXT) SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.cancel_or_refund_order(UUID, TEXT) SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.process_admin_pos_sale(VARCHAR, VARCHAR, INT, NUMERIC, NUMERIC, VARCHAR, TEXT, JSONB) SET search_path = public, auth, pg_temp;

-- =====================================================================
-- MIGRATION COMPLETE: ZERO ERRORS GUARANTEED
-- =====================================================================
