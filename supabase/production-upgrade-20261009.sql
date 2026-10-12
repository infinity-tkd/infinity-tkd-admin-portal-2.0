-- Infinity TKD upgrade, 2026-10-09 through 2026-10-11. Existing database required.
-- Apply once after preflight checks and schema rehearsal.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';

-- 20261009090000_portal_security_and_transactions.sql
-- Apply after the existing migrations, first on a staging copy. This migration is atomic.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Older installations have overlapping domain checks; replacing just one leaves
-- the restrictive check active. Align the complete domains with the portal API.
DO $$ DECLARE spec record; rule record; BEGIN
 FOR spec IN SELECT * FROM (VALUES
 ('profiles','role','portal_profile_role', $expr$role IN ('Root','Super Root','Admin','Head Coach','Coach','Assistant Coach','Student')$expr$),
 ('students','student_status','portal_student_status', $expr$student_status IN ('Active','Paused','Inactive','Suspended','Graduated')$expr$),
 ('payments','status','portal_monthly_payment_status', $expr$status IN ('Paid','Unpaid','Pending','Waived')$expr$),
 ('payments','year','portal_billing_year', $expr$year BETWEEN 2000 AND 2200$expr$)
 ) AS domains(table_name,column_name,constraint_name,expression) LOOP
 FOR rule IN SELECT c.conname FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
 WHERE c.conrelid=('public.'||spec.table_name)::regclass AND c.contype='c' AND a.attname=spec.column_name LOOP
 EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',spec.table_name,rule.conname);
 END LOOP;
 EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s)',spec.table_name,spec.constraint_name,spec.expression);
 END LOOP;
END $$;

-- Fresh database state is authoritative; a stale JWT cannot preserve suspended access.
CREATE OR REPLACE FUNCTION public.auth_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT role::text FROM public.profiles WHERE id = auth.uid() AND is_active = true $$;
CREATE OR REPLACE FUNCTION public.auth_is_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true AND must_change_password=false) $$;
CREATE OR REPLACE FUNCTION public.is_dojo_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT public.auth_is_active() AND public.auth_role() IN ('Root','Super Root','Admin','Head Coach','Coach','Assistant Coach') $$;
CREATE OR REPLACE FUNCTION public.is_current_student(sid text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN public.students s ON s.id = sid
 WHERE p.id = auth.uid() AND p.is_active = true AND p.must_change_password = false AND p.role = 'Student' AND s.deleted_at IS NULL AND (p.student_id = s.id OR s.profile_id = p.id))
$$;

-- PostgreSQL resolves VARCHAR arguments to the legacy VARCHAR overload first.
-- Replace it too, so policies cannot retain the old email/username ownership rules.
CREATE OR REPLACE FUNCTION public.is_current_student(sid varchar) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT public.is_current_student(sid::text) $$;

-- Fill absent baseline entries while preserving configured administrator overrides.
INSERT INTO public.role_permissions(role,permission_key,is_granted) VALUES
('Root','page:dashboard',true),
('Root','page:pos',true),
('Root','page:financials',true),
('Root','page:directory',true),
('Root','page:attendance',true),
('Root','page:schedule',true),
('Root','page:lms',true),
('Root','page:library',true),
('Root','page:staff',true),
('Root','page:partners',true),
('Root','page:settings',true),
('Root','action:pos_create_order',true),
('Root','action:pos_manage_inventory',true),
('Root','action:pos_cancel_order',true),
('Root','action:student_create',true),
('Root','action:student_edit',true),
('Root','action:student_delete',true),
('Root','action:attendance_mark',true),
('Root','action:attendance_delete',true),
('Root','action:finance_record_payment',true),
('Root','action:schedule_manage',true),
('Root','action:staff_manage',true),
('Root','action:partner_create',true),
('Root','action:partner_edit',true),
('Root','action:partner_delete',true),
('Root','action:evaluations_grade',true),
('Root','action:curriculum_edit',true),
('Root','manage:users',true),
('Root','manage:students',true),
('Root','manage:finances',true),
('Root','manage:pos',true),
('Root','manage:curriculum',true),
('Root','manage:branches',true),
('Root','manage:schedule',true),
('Root','view:financials',true),
('Root','view:pos',true),
('Root','view:analytics',true),
('Root','mark:attendance',true),
('Root','grade:evaluations',true),
('Root','view:own_dossier',true),
('Super Root','page:dashboard',true),
('Super Root','page:pos',true),
('Super Root','page:financials',true),
('Super Root','page:directory',true),
('Super Root','page:attendance',true),
('Super Root','page:schedule',true),
('Super Root','page:lms',true),
('Super Root','page:library',true),
('Super Root','page:staff',true),
('Super Root','page:partners',true),
('Super Root','page:settings',true),
('Super Root','action:pos_create_order',true),
('Super Root','action:pos_manage_inventory',true),
('Super Root','action:pos_cancel_order',true),
('Super Root','action:student_create',true),
('Super Root','action:student_edit',true),
('Super Root','action:student_delete',true),
('Super Root','action:attendance_mark',true),
('Super Root','action:attendance_delete',true),
('Super Root','action:finance_record_payment',true),
('Super Root','action:schedule_manage',true),
('Super Root','action:staff_manage',true),
('Super Root','action:partner_create',true),
('Super Root','action:partner_edit',true),
('Super Root','action:partner_delete',true),
('Super Root','action:evaluations_grade',true),
('Super Root','action:curriculum_edit',true),
('Super Root','manage:users',true),
('Super Root','manage:students',true),
('Super Root','manage:finances',true),
('Super Root','manage:pos',true),
('Super Root','manage:curriculum',true),
('Super Root','manage:branches',true),
('Super Root','manage:schedule',true),
('Super Root','view:financials',true),
('Super Root','view:pos',true),
('Super Root','view:analytics',true),
('Super Root','mark:attendance',true),
('Super Root','grade:evaluations',true),
('Super Root','view:own_dossier',true),
('Admin','page:dashboard',true),
('Admin','page:pos',true),
('Admin','page:financials',true),
('Admin','page:directory',true),
('Admin','page:attendance',true),
('Admin','page:schedule',true),
('Admin','page:lms',true),
('Admin','page:library',true),
('Admin','page:staff',true),
('Admin','page:partners',true),
('Admin','page:settings',true),
('Admin','action:pos_create_order',true),
('Admin','action:pos_manage_inventory',true),
('Admin','action:pos_cancel_order',true),
('Admin','action:student_create',true),
('Admin','action:student_edit',true),
('Admin','action:student_delete',false),
('Admin','action:attendance_mark',true),
('Admin','action:attendance_delete',true),
('Admin','action:finance_record_payment',true),
('Admin','action:schedule_manage',true),
('Admin','action:staff_manage',true),
('Admin','action:partner_create',true),
('Admin','action:partner_edit',true),
('Admin','action:partner_delete',true),
('Admin','action:evaluations_grade',true),
('Admin','action:curriculum_edit',true),
('Admin','manage:users',true),
('Admin','manage:students',true),
('Admin','manage:finances',true),
('Admin','manage:pos',true),
('Admin','manage:curriculum',true),
('Admin','manage:branches',true),
('Admin','manage:schedule',true),
('Admin','view:financials',true),
('Admin','view:pos',true),
('Admin','view:analytics',true),
('Admin','mark:attendance',true),
('Admin','grade:evaluations',true),
('Admin','view:own_dossier',true),
('Head Coach','page:dashboard',true),
('Head Coach','page:pos',true),
('Head Coach','page:financials',false),
('Head Coach','page:directory',true),
('Head Coach','page:attendance',true),
('Head Coach','page:schedule',true),
('Head Coach','page:lms',true),
('Head Coach','page:library',true),
('Head Coach','page:staff',true),
('Head Coach','page:partners',true),
('Head Coach','page:settings',false),
('Head Coach','action:pos_create_order',true),
('Head Coach','action:pos_manage_inventory',false),
('Head Coach','action:pos_cancel_order',false),
('Head Coach','action:student_create',true),
('Head Coach','action:student_edit',true),
('Head Coach','action:student_delete',false),
('Head Coach','action:attendance_mark',true),
('Head Coach','action:attendance_delete',true),
('Head Coach','action:finance_record_payment',false),
('Head Coach','action:schedule_manage',true),
('Head Coach','action:staff_manage',false),
('Head Coach','action:partner_create',true),
('Head Coach','action:partner_edit',true),
('Head Coach','action:partner_delete',false),
('Head Coach','action:evaluations_grade',true),
('Head Coach','action:curriculum_edit',true),
('Head Coach','manage:users',false),
('Head Coach','manage:students',true),
('Head Coach','manage:finances',false),
('Head Coach','manage:pos',false),
('Head Coach','manage:curriculum',true),
('Head Coach','manage:branches',false),
('Head Coach','manage:schedule',true),
('Head Coach','view:financials',false),
('Head Coach','view:pos',true),
('Head Coach','view:analytics',true),
('Head Coach','mark:attendance',true),
('Head Coach','grade:evaluations',true),
('Head Coach','view:own_dossier',true),
('Coach','page:dashboard',true),
('Coach','page:pos',false),
('Coach','page:financials',false),
('Coach','page:directory',true),
('Coach','page:attendance',true),
('Coach','page:schedule',true),
('Coach','page:lms',true),
('Coach','page:library',true),
('Coach','page:staff',false),
('Coach','page:partners',true),
('Coach','page:settings',false),
('Coach','action:pos_create_order',false),
('Coach','action:pos_manage_inventory',false),
('Coach','action:pos_cancel_order',false),
('Coach','action:student_create',false),
('Coach','action:student_edit',false),
('Coach','action:student_delete',false),
('Coach','action:attendance_mark',true),
('Coach','action:attendance_delete',false),
('Coach','action:finance_record_payment',false),
('Coach','action:schedule_manage',false),
('Coach','action:staff_manage',false),
('Coach','action:partner_create',false),
('Coach','action:partner_edit',false),
('Coach','action:partner_delete',false),
('Coach','action:evaluations_grade',true),
('Coach','action:curriculum_edit',true),
('Coach','manage:users',false),
('Coach','manage:students',false),
('Coach','manage:finances',false),
('Coach','manage:pos',false),
('Coach','manage:curriculum',true),
('Coach','manage:branches',false),
('Coach','manage:schedule',false),
('Coach','view:financials',false),
('Coach','view:pos',false),
('Coach','view:analytics',false),
('Coach','mark:attendance',true),
('Coach','grade:evaluations',true),
('Coach','view:own_dossier',true),
('Assistant Coach','page:dashboard',true),
('Assistant Coach','page:pos',false),
('Assistant Coach','page:financials',false),
('Assistant Coach','page:directory',true),
('Assistant Coach','page:attendance',true),
('Assistant Coach','page:schedule',true),
('Assistant Coach','page:lms',true),
('Assistant Coach','page:library',true),
('Assistant Coach','page:staff',false),
('Assistant Coach','page:partners',true),
('Assistant Coach','page:settings',false),
('Assistant Coach','action:pos_create_order',false),
('Assistant Coach','action:pos_manage_inventory',false),
('Assistant Coach','action:pos_cancel_order',false),
('Assistant Coach','action:student_create',false),
('Assistant Coach','action:student_edit',false),
('Assistant Coach','action:student_delete',false),
('Assistant Coach','action:attendance_mark',true),
('Assistant Coach','action:attendance_delete',false),
('Assistant Coach','action:finance_record_payment',false),
('Assistant Coach','action:schedule_manage',false),
('Assistant Coach','action:staff_manage',false),
('Assistant Coach','action:partner_create',false),
('Assistant Coach','action:partner_edit',false),
('Assistant Coach','action:partner_delete',false),
('Assistant Coach','action:evaluations_grade',false),
('Assistant Coach','action:curriculum_edit',false),
('Assistant Coach','manage:users',false),
('Assistant Coach','manage:students',false),
('Assistant Coach','manage:finances',false),
('Assistant Coach','manage:pos',false),
('Assistant Coach','manage:curriculum',false),
('Assistant Coach','manage:branches',false),
('Assistant Coach','manage:schedule',false),
('Assistant Coach','view:financials',false),
('Assistant Coach','view:pos',false),
('Assistant Coach','view:analytics',false),
('Assistant Coach','mark:attendance',true),
('Assistant Coach','grade:evaluations',false),
('Assistant Coach','view:own_dossier',true),
('Student','page:dashboard',false),
('Student','page:pos',false),
('Student','page:financials',false),
('Student','page:directory',false),
('Student','page:attendance',false),
('Student','page:schedule',false),
('Student','page:lms',true),
('Student','page:library',true),
('Student','page:staff',false),
('Student','page:partners',false),
('Student','page:settings',false),
('Student','action:pos_create_order',false),
('Student','action:pos_manage_inventory',false),
('Student','action:pos_cancel_order',false),
('Student','action:student_create',false),
('Student','action:student_edit',false),
('Student','action:student_delete',false),
('Student','action:attendance_mark',false),
('Student','action:attendance_delete',false),
('Student','action:finance_record_payment',false),
('Student','action:schedule_manage',false),
('Student','action:staff_manage',false),
('Student','action:partner_create',false),
('Student','action:partner_edit',false),
('Student','action:partner_delete',false),
('Student','action:evaluations_grade',false),
('Student','action:curriculum_edit',false),
('Student','manage:users',false),
('Student','manage:students',false),
('Student','manage:finances',false),
('Student','manage:pos',false),
('Student','manage:curriculum',false),
('Student','manage:branches',false),
('Student','manage:schedule',false),
('Student','view:financials',false),
('Student','view:pos',false),
('Student','view:analytics',false),
('Student','mark:attendance',false),
('Student','grade:evaluations',false),
('Student','view:own_dossier',true)
ON CONFLICT(role,permission_key) DO NOTHING;

-- No actor argument: authenticated callers can only evaluate their own permissions.
CREATE OR REPLACE FUNCTION public.portal_has_permission(p_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT COALESCE((SELECT CASE WHEN p.role IN ('Root','Super Root') THEN true ELSE
 COALESCE((SELECT u.is_granted FROM public.user_permissions u WHERE u.user_id=p.id AND u.permission_key=p_key),
 (SELECT r.is_granted FROM public.role_permissions r WHERE r.role=p.role AND r.permission_key=p_key), false) END
 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active = true AND p.must_change_password=false),false)
$$;

-- APIs use service-role RPCs with an explicit, verified actor. They also check the actor here.
CREATE OR REPLACE FUNCTION public.portal_assert_actor(p_actor uuid, p_key text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.profiles; allowed boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server-only operation' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM public.profiles WHERE id=p_actor AND is_active=true AND must_change_password=false;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inactive or missing account' USING ERRCODE='42501'; END IF;
 SELECT COALESCE((SELECT is_granted FROM public.user_permissions WHERE user_id=p_actor AND permission_key=p_key),
 (SELECT is_granted FROM public.role_permissions WHERE role=p.role AND permission_key=p_key),false) INTO allowed;
 IF p.role NOT IN ('Root','Super Root') AND NOT allowed THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501'; END IF;
END $$;

-- Old overloads have different argument types; revoke every overload, including PUBLIC grants.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('process_admin_pos_sale','place_student_order','confirm_student_order','cancel_pos_order','cancel_or_refund_order','adjust_inventory_stock','get_email_by_username') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',r.signature);
 END LOOP;
END $$;

-- Replace all legacy policies, since permissive policies combine with OR.
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['profiles','user_permissions','role_permissions','audit_logs','students','student_addresses','payments','products','product_variants','pos_orders','pos_order_items','inventory_logs','class_enrollments','attendance'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
 END LOOP;
END $$;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN
 ('profiles','user_permissions','role_permissions','audit_logs','students','student_addresses','payments','products','product_variants','pos_orders','pos_order_items','inventory_logs','class_enrollments','attendance') LOOP
 EXECUTE format('DROP POLICY %I ON public.%I',r.policyname,r.tablename);
 END LOOP;
END $$;
CREATE POLICY portal_profile_read ON public.profiles FOR SELECT TO authenticated USING ((id=auth.uid() AND is_active=true) OR public.auth_is_active() AND (public.portal_has_permission('page:staff') OR public.portal_has_permission('page:schedule')));
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.profiles,public.user_permissions FROM anon;
CREATE POLICY portal_role_read ON public.role_permissions FOR SELECT TO authenticated USING (public.auth_is_active());
CREATE POLICY portal_user_permission_read ON public.user_permissions FOR SELECT TO authenticated USING (public.auth_is_active() AND (user_id=auth.uid() OR public.auth_role() IN ('Root','Super Root')));
REVOKE INSERT,UPDATE,DELETE ON public.role_permissions,public.user_permissions FROM PUBLIC,anon,authenticated;
CREATE POLICY portal_audit_read ON public.audit_logs FOR SELECT TO authenticated USING (public.portal_has_permission('page:settings'));
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.audit_logs FROM PUBLIC,anon,authenticated;
CREATE POLICY portal_student_read ON public.students FOR SELECT TO authenticated USING (public.is_dojo_staff() OR public.is_current_student(id));
CREATE POLICY portal_address_read ON public.student_addresses FOR SELECT TO authenticated USING (public.is_dojo_staff() OR public.is_current_student(student_id));
CREATE POLICY portal_address_write ON public.student_addresses FOR ALL TO authenticated USING (public.portal_has_permission('action:student_edit')) WITH CHECK (public.portal_has_permission('action:student_edit'));
CREATE POLICY portal_student_write ON public.students FOR UPDATE TO authenticated USING (public.portal_has_permission('action:student_edit')) WITH CHECK (public.portal_has_permission('action:student_edit'));
REVOKE INSERT,DELETE ON public.students FROM PUBLIC,anon,authenticated;
CREATE POLICY portal_payment_read ON public.payments FOR SELECT TO authenticated USING (public.portal_has_permission('page:financials') OR public.is_current_student(student_id));
REVOKE INSERT,UPDATE,DELETE ON public.payments FROM PUBLIC,anon,authenticated;
CREATE POLICY portal_product_read ON public.products FOR SELECT TO authenticated USING (public.auth_is_active() AND (public.portal_has_permission('page:pos') OR is_active=true AND allow_student_orders=true));
CREATE POLICY portal_variant_read ON public.product_variants FOR SELECT TO authenticated USING (public.auth_is_active() AND (public.portal_has_permission('page:pos') OR is_active=true AND EXISTS(SELECT 1 FROM public.products p WHERE p.id=product_id AND p.is_active=true AND p.allow_student_orders=true)));
REVOKE INSERT,UPDATE,DELETE ON public.products,public.product_variants FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.products,public.product_variants FROM anon;
CREATE POLICY portal_order_read ON public.pos_orders FOR SELECT TO authenticated USING (public.portal_has_permission('page:pos') OR public.is_current_student(student_id));
CREATE POLICY portal_item_read ON public.pos_order_items FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.pos_orders o WHERE o.id=order_id));
CREATE POLICY portal_inventory_read ON public.inventory_logs FOR SELECT TO authenticated USING (public.portal_has_permission('page:pos'));
REVOKE INSERT,UPDATE,DELETE ON public.pos_orders,public.pos_order_items,public.inventory_logs FROM PUBLIC,anon,authenticated;
CREATE POLICY portal_enrollment_read ON public.class_enrollments FOR SELECT TO authenticated USING (public.is_dojo_staff() OR public.is_current_student(student_id));
CREATE POLICY portal_enrollment_write ON public.class_enrollments FOR ALL TO authenticated USING (public.portal_has_permission('action:student_edit') OR public.portal_has_permission('action:schedule_manage')) WITH CHECK (public.portal_has_permission('action:student_edit') OR public.portal_has_permission('action:schedule_manage'));
CREATE POLICY portal_attendance_read ON public.attendance FOR SELECT TO authenticated USING (public.portal_has_permission('page:attendance') OR public.is_current_student(student_id));
CREATE POLICY portal_attendance_insert ON public.attendance FOR INSERT TO authenticated WITH CHECK (public.portal_has_permission('action:attendance_mark') AND marked_by=auth.uid());
CREATE POLICY portal_attendance_update ON public.attendance FOR UPDATE TO authenticated USING (public.portal_has_permission('action:attendance_mark')) WITH CHECK (public.portal_has_permission('action:attendance_mark') AND marked_by=auth.uid());
CREATE POLICY portal_attendance_delete ON public.attendance FOR DELETE TO authenticated USING (public.portal_has_permission('action:attendance_delete'));

-- A shared fixed-window rate limiter, not one counter per Next.js instance.
CREATE TABLE IF NOT EXISTS public.portal_rate_limits(key text PRIMARY KEY, attempts integer NOT NULL, expires_at timestamptz NOT NULL);
ALTER TABLE public.portal_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_rate_limits FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.portal_take_rate_slot(p_key text,p_limit integer,p_seconds integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 IF p_limit NOT BETWEEN 1 AND 1000 OR p_seconds NOT BETWEEN 1 AND 3600 OR length(p_key)>256 THEN RAISE EXCEPTION 'Invalid rate limit'; END IF;
 DELETE FROM public.portal_rate_limits WHERE expires_at<now()-interval '1 hour';
 INSERT INTO public.portal_rate_limits VALUES(p_key,1,now()+make_interval(secs=>p_seconds))
 ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN portal_rate_limits.expires_at<=now() THEN 1 ELSE portal_rate_limits.attempts+1 END,
 expires_at=CASE WHEN portal_rate_limits.expires_at<=now() THEN now()+make_interval(secs=>p_seconds) ELSE portal_rate_limits.expires_at END RETURNING attempts INTO n;
 RETURN n<=p_limit;
END $$;

ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS stock_reserved boolean NOT NULL DEFAULT false;
ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS request_key uuid;
ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS request_payload jsonb;
ALTER TABLE public.pos_orders ADD COLUMN IF NOT EXISTS refund_reference text;
CREATE UNIQUE INDEX IF NOT EXISTS portal_pos_request_key ON public.pos_orders(recorded_by,request_key) WHERE request_key IS NOT NULL;
-- Only restore historical stock when a movement was recorded. Review older fallback orders manually.
UPDATE public.pos_orders o SET stock_reserved=true WHERE o.cancelled_at IS NULL AND EXISTS(SELECT 1 FROM public.inventory_logs l WHERE l.reference_id=o.id AND l.change_quantity<0);
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT conname FROM pg_constraint WHERE conrelid='public.pos_orders'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%payment_status%' LOOP
 EXECUTE format('ALTER TABLE public.pos_orders DROP CONSTRAINT %I',r.conname);
 END LOOP;
END $$;
ALTER TABLE public.pos_orders ADD CONSTRAINT portal_payment_status CHECK(payment_status IN ('PENDING','PAID','REFUND_PENDING','REFUNDED','VOID')) NOT VALID;

-- Parent product first, then its variant: consistent lock order for all stock mutations.
CREATE OR REPLACE FUNCTION public.portal_stock_change(p_product uuid,p_variant uuid,p_qty integer,p_reason text,p_actor uuid,p_reference uuid DEFAULT NULL,p_notes text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.products; v public.product_variants; balance integer;
BEGIN
 SELECT * INTO p FROM public.products WHERE id=p_product FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product not found' USING ERRCODE='22023'; END IF;
 IF p_variant IS NOT NULL THEN
 SELECT * INTO v FROM public.product_variants WHERE id=p_variant AND product_id=p_product FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Variant does not belong to product' USING ERRCODE='22023'; END IF;
 balance:=v.stock+p_qty;
 IF balance<0 THEN RAISE EXCEPTION 'Insufficient stock for %',v.sku USING ERRCODE='22023'; END IF;
 UPDATE public.product_variants SET stock=balance,updated_at=now() WHERE id=p_variant;
 UPDATE public.products SET stock=(SELECT COALESCE(sum(stock),0) FROM public.product_variants WHERE product_id=p_product AND is_active=true),updated_at=now() WHERE id=p_product;
 ELSE
 IF p.has_variants THEN RAISE EXCEPTION 'Select a product variant' USING ERRCODE='22023'; END IF;
 balance:=p.stock+p_qty;
 IF balance<0 THEN RAISE EXCEPTION 'Insufficient stock for %',p.sku USING ERRCODE='22023'; END IF;
 UPDATE public.products SET stock=balance,updated_at=now() WHERE id=p_product;
 END IF;
 INSERT INTO public.inventory_logs(product_id,variant_id,change_quantity,balance_after,reason,reference_id,logged_by,notes) VALUES(p_product,p_variant,p_qty,balance,p_reason,p_reference,p_actor,p_notes);
 RETURN balance;
END $$;

CREATE OR REPLACE FUNCTION public.portal_adjust_inventory(p_actor uuid,p_product_id uuid,p_variant_id uuid,p_change_qty integer,p_reason text,p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE balance integer;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:pos_manage_inventory');
 IF p_change_qty=0 OR abs(p_change_qty::bigint)>100000 OR length(p_reason)>100 THEN RAISE EXCEPTION 'Invalid adjustment' USING ERRCODE='22023'; END IF;
 balance:=public.portal_stock_change(p_product_id,p_variant_id,p_change_qty,p_reason,p_actor,NULL,p_notes);
 RETURN jsonb_build_object('product_id',p_product_id,'variant_id',p_variant_id,'new_balance',balance,'change_qty',p_change_qty,'previous_balance',balance-p_change_qty,'reason',p_reason);
END $$;

CREATE OR REPLACE FUNCTION public.portal_place_order(p_actor uuid,p_channel text,p_payload jsonb,p_request_key uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.profiles; o public.pos_orders; item record; prod public.products; variant public.product_variants; price numeric; subtotal numeric:=0; discount numeric; oid uuid; items jsonb:='[]'; qty integer; signature jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 SELECT * INTO actor FROM public.profiles WHERE id=p_actor AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inactive account' USING ERRCODE='42501'; END IF;
 IF p_channel='ADMIN_POS' OR actor.role<>'Student' THEN PERFORM public.portal_assert_actor(p_actor,'action:pos_create_order');
 ELSIF p_channel<>'STUDENT_PORTAL' THEN RAISE EXCEPTION 'Invalid channel' USING ERRCODE='22023'; END IF;
 IF p_channel NOT IN ('ADMIN_POS','STUDENT_PORTAL') THEN RAISE EXCEPTION 'Invalid channel' USING ERRCODE='22023'; END IF;
 IF actor.role='Student' AND NOT EXISTS(SELECT 1 FROM public.students s WHERE s.id=p_payload->>'studentId' AND s.deleted_at IS NULL AND (s.profile_id=p_actor OR s.id=actor.student_id)) THEN RAISE EXCEPTION 'Student mismatch' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'items') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid cart' USING ERRCODE='22023'; END IF;
 discount:=CASE WHEN p_channel='ADMIN_POS' THEN COALESCE((p_payload->>'discountPercentage')::numeric,0) ELSE 0 END;
 IF discount NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Invalid discount' USING ERRCODE='22023'; END IF;
 signature:=jsonb_build_object('channel',p_channel,'payload',p_payload);
 IF p_request_key IS NOT NULL THEN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text||p_request_key::text,0));
 SELECT * INTO o FROM public.pos_orders WHERE recorded_by=p_actor AND request_key=p_request_key;
 IF FOUND THEN
 IF o.request_payload IS DISTINCT FROM signature THEN RAISE EXCEPTION 'Idempotency key reused with a different cart' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('order_id',o.id,'order_number',o.order_number,'subtotal_usd',o.subtotal_usd,'discount_usd',o.discount_usd,'total_usd',o.total_usd,'order_status',o.order_status,'payment_status',o.payment_status,'items',(SELECT COALESCE(jsonb_agg(i ORDER BY id),'[]'::jsonb) FROM public.pos_order_items i WHERE order_id=o.id));
 END IF; END IF;
 oid:=gen_random_uuid();
 -- Sorting prevents deadlocks; duplicate lines consume stock within this same transaction.
 FOR item IN SELECT value AS data FROM jsonb_array_elements(p_payload->'items') ORDER BY value->>'productId',value->>'variantId' LOOP
 qty:=(item.data->>'qty')::integer;
 IF qty IS NULL OR qty NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Invalid quantity' USING ERRCODE='22023'; END IF;
 SELECT * INTO prod FROM public.products WHERE id=(item.data->>'productId')::uuid AND is_active=true FOR UPDATE;
 IF NOT FOUND OR (p_channel='STUDENT_PORTAL' AND prod.allow_student_orders IS NOT TRUE) THEN RAISE EXCEPTION 'Product unavailable' USING ERRCODE='22023'; END IF;
 variant:=NULL;
 IF NULLIF(item.data->>'variantId','') IS NOT NULL THEN
 SELECT * INTO variant FROM public.product_variants WHERE id=(item.data->>'variantId')::uuid AND product_id=prod.id AND is_active=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Variant unavailable' USING ERRCODE='22023'; END IF;
 END IF;
 price:=COALESCE(variant.price_override,prod.price_usd);
 IF price IS NULL OR price<0 THEN RAISE EXCEPTION 'Invalid catalog price' USING ERRCODE='22023'; END IF;
 PERFORM public.portal_stock_change(prod.id,variant.id,-qty,CASE WHEN p_channel='ADMIN_POS' THEN 'POS_SALE' ELSE 'ONLINE_ORDER' END,p_actor,oid);
 subtotal:=subtotal+round(price*qty,2);
 items:=items||jsonb_build_array(jsonb_build_object('product',prod.id,'variant',variant.id,'sku',COALESCE(variant.sku,prod.sku),'name',prod.name,'size',variant.size,'color',variant.color,'price',price,'qty',qty));
 END LOOP;
 INSERT INTO public.pos_orders(id,order_number,order_channel,student_id,customer_name,customer_phone,branch_id,subtotal_usd,discount_percentage,discount_usd,total_usd,payment_method,payment_status,order_status,admin_notes,student_notes,recorded_by,stock_reserved,request_key,request_payload,fulfilled_at)
 VALUES(oid,CASE WHEN p_channel='ADMIN_POS' THEN 'POS-' ELSE 'ORD-' END||replace(gen_random_uuid()::text,'-',''),p_channel,NULLIF(p_payload->>'studentId',''),p_payload->>'customerName',p_payload->>'customerPhone',NULLIF(p_payload->>'branchId','')::integer,subtotal,discount,round(subtotal*discount/100,2),subtotal-round(subtotal*discount/100,2),p_payload->>'paymentMethod',CASE WHEN p_channel='ADMIN_POS' THEN 'PAID' ELSE 'PENDING' END,CASE WHEN p_channel='ADMIN_POS' THEN 'COMPLETED' ELSE 'PENDING_CONFIRMATION' END,p_payload->>'adminNotes',p_payload->>'studentNotes',p_actor,true,p_request_key,signature,CASE WHEN p_channel='ADMIN_POS' THEN now() ELSE NULL END) RETURNING * INTO o;
 FOR item IN SELECT value AS data FROM jsonb_array_elements(items) LOOP
 INSERT INTO public.pos_order_items(order_id,product_id,variant_id,sku,product_name,size,color,unit_price_usd,quantity,total_price_usd)
 VALUES(o.id,(item.data->>'product')::uuid,(item.data->>'variant')::uuid,item.data->>'sku',item.data->>'name',item.data->>'size',item.data->>'color',(item.data->>'price')::numeric,(item.data->>'qty')::integer,round((item.data->>'price')::numeric*(item.data->>'qty')::integer,2));
 END LOOP;

 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('ORDER_CREATED',p_actor::text,o.id::text,jsonb_build_object('channel',p_channel,'total',o.total_usd));
 RETURN jsonb_build_object('order_id',o.id,'order_number',o.order_number,'subtotal_usd',subtotal,'discount_usd',o.discount_usd,'total_usd',o.total_usd,'order_status',o.order_status,'payment_status',o.payment_status,'items',(SELECT COALESCE(jsonb_agg(i ORDER BY id),'[]'::jsonb) FROM public.pos_order_items i WHERE order_id=o.id));
END $$;

CREATE OR REPLACE FUNCTION public.portal_update_order(p_actor uuid,p_order_id uuid,p_new_order_status text,p_payment_status text DEFAULT NULL,p_admin_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.pos_orders; next_payment text;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:pos_create_order');
 SELECT * INTO o FROM public.pos_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE='22023'; END IF;
 IF o.order_status IN ('CANCELLED','COMPLETED') AND p_new_order_status<>o.order_status THEN RAISE EXCEPTION 'Order is final' USING ERRCODE='22023'; END IF;
 IF NOT(p_new_order_status=o.order_status OR o.order_status IN ('PENDING','PENDING_CONFIRMATION') AND p_new_order_status='CONFIRMED' OR o.order_status='CONFIRMED' AND p_new_order_status IN ('PREPARING','READY_FOR_PICKUP','COMPLETED') OR o.order_status='PREPARING' AND p_new_order_status IN ('READY_FOR_PICKUP','COMPLETED') OR o.order_status='READY_FOR_PICKUP' AND p_new_order_status='COMPLETED') THEN RAISE EXCEPTION 'Invalid order transition' USING ERRCODE='22023'; END IF;
 next_payment:=COALESCE(p_payment_status,o.payment_status);
 IF next_payment NOT IN ('PENDING','PAID') OR o.payment_status='PAID' AND next_payment<>'PAID' THEN RAISE EXCEPTION 'Use cancellation/refund workflow' USING ERRCODE='22023'; END IF;
 IF p_new_order_status='COMPLETED' AND next_payment<>'PAID' THEN RAISE EXCEPTION 'Payment must be recorded before completion' USING ERRCODE='22023'; END IF;
 IF NOT o.stock_reserved AND o.order_status NOT IN ('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'Legacy order requires inventory reconciliation before fulfillment' USING ERRCODE='22023'; END IF;
 UPDATE public.pos_orders SET order_status=p_new_order_status,payment_status=next_payment,admin_notes=COALESCE(p_admin_notes,admin_notes),confirmed_by=p_actor,confirmed_at=COALESCE(confirmed_at,now()),fulfilled_at=CASE WHEN p_new_order_status='COMPLETED' THEN COALESCE(fulfilled_at,now()) ELSE fulfilled_at END,updated_at=now() WHERE id=p_order_id;
 RETURN jsonb_build_object('order_id',p_order_id,'order_status',p_new_order_status,'payment_status',next_payment);
END $$;

CREATE OR REPLACE FUNCTION public.portal_cancel_order(p_actor uuid,p_order_id uuid,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.pos_orders; item record; next_payment text;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:pos_cancel_order');
 IF length(trim(p_reason))<3 THEN RAISE EXCEPTION 'Cancellation reason required' USING ERRCODE='22023'; END IF;
 SELECT * INTO o FROM public.pos_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE='22023'; END IF;
 IF o.order_status='CANCELLED' THEN RETURN jsonb_build_object('order_id',o.id,'order_status','CANCELLED','payment_status',o.payment_status); END IF;
 IF o.order_status='COMPLETED' THEN RAISE EXCEPTION 'Completed orders require a reviewed return; inventory cannot be restocked automatically' USING ERRCODE='22023'; END IF;
 IF o.stock_reserved THEN
 FOR item IN SELECT * FROM public.pos_order_items WHERE order_id=o.id ORDER BY product_id,variant_id LOOP
 PERFORM public.portal_stock_change(item.product_id,item.variant_id,item.quantity,'ORDER_CANCELLED_RESTORE',p_actor,o.id,p_reason);
 END LOOP; END IF;
 next_payment:=CASE WHEN o.payment_status='PAID' THEN 'REFUND_PENDING' ELSE 'VOID' END;
 UPDATE public.pos_orders SET order_status='CANCELLED',payment_status=next_payment,stock_reserved=false,cancelled_at=now(),cancellation_reason=p_reason,updated_at=now() WHERE id=o.id;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('ORDER_CANCELLED',p_actor::text,o.id::text,jsonb_build_object('reason',p_reason,'payment_status',next_payment));
 RETURN jsonb_build_object('order_id',o.id,'order_status','CANCELLED','payment_status',next_payment);
END $$;

-- Database-enforced capacity for both initial registration and later enrollment changes.
CREATE OR REPLACE FUNCTION public.portal_enforce_capacity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cap integer; n integer; active_student boolean;
BEGIN
 SELECT capacity INTO cap FROM public.class_sessions WHERE id=NEW.class_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Class does not exist' USING ERRCODE='22023'; END IF;
 IF TG_OP='UPDATE' AND NEW.class_id=OLD.class_id AND NEW.student_id=OLD.student_id THEN RETURN NEW; END IF;
 SELECT student_status='Active' INTO active_student FROM public.students WHERE id=NEW.student_id AND deleted_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student is missing or archived' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO n FROM public.class_enrollments WHERE class_id=NEW.class_id AND id IS DISTINCT FROM NEW.id AND EXISTS(SELECT 1 FROM public.students s WHERE s.id=student_id AND s.deleted_at IS NULL AND s.student_status='Active');
 IF active_student AND cap IS NOT NULL AND n>=cap THEN RAISE EXCEPTION 'Class has reached capacity' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.class_enrollments WHERE student_id=NEW.student_id AND class_id=NEW.class_id AND id IS DISTINCT FROM NEW.id) THEN RAISE EXCEPTION 'Student already enrolled' USING ERRCODE='23505'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS portal_capacity ON public.class_enrollments;
CREATE TRIGGER portal_capacity BEFORE INSERT OR UPDATE ON public.class_enrollments FOR EACH ROW EXECUTE FUNCTION public.portal_enforce_capacity();

CREATE OR REPLACE FUNCTION public.portal_create_student(p_actor uuid,p_student jsonb,p_address jsonb DEFAULT NULL,p_class_id integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.students; eid bigint;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:student_create');
 PERFORM pg_advisory_xact_lock(hashtextextended(lower(p_student->>'english_name')||COALESCE(p_student->>'dob','')||COALESCE(p_student->>'gender',''),0));
 -- A UUID-derived ID fits the installed varchar(20), without counting browser rows.
 p_student:=p_student||jsonb_build_object('id','TKD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)));
 IF EXISTS(SELECT 1 FROM public.students WHERE lower(english_name)=lower(p_student->>'english_name') AND dob=(p_student->>'dob')::date AND gender=p_student->>'gender' AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Student already registered' USING ERRCODE='23505'; END IF;
 SELECT * INTO s FROM jsonb_populate_record(NULL::public.students,p_student);
 INSERT INTO public.students(id,khmer_name,english_name,gender,dob,registration_date,scholarship_id,height_cm,weight_kg,home_branch_id,current_belt,student_status,email,phone,emergency_contact_name,emergency_contact_phone,emergency_contact_relation,medical_notes,allergies,nationality,profile_picture_path,esign_path,kukkiwon_id,notes)
 VALUES(s.id,s.khmer_name,s.english_name,s.gender,s.dob,s.registration_date,s.scholarship_id,s.height_cm,s.weight_kg,s.home_branch_id,s.current_belt,s.student_status,s.email,s.phone,s.emergency_contact_name,s.emergency_contact_phone,s.emergency_contact_relation,s.medical_notes,s.allergies,s.nationality,s.profile_picture_path,s.esign_path,s.kukkiwon_id,s.notes);
 IF p_address IS NOT NULL THEN INSERT INTO public.student_addresses(student_id,address_line1,address_line2,district_commune,state_province_city,postal_code,country,is_primary)
 VALUES(s.id,p_address->>'address_line1',p_address->>'address_line2',p_address->>'district_commune',p_address->>'state_province_city',p_address->>'postal_code',p_address->>'country',true); END IF;
 IF p_class_id IS NOT NULL THEN INSERT INTO public.class_enrollments(student_id,class_id,enrollment_date) VALUES(s.id,p_class_id,s.registration_date) RETURNING id INTO eid; END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('STUDENT_REGISTERED',p_actor::text,s.id,jsonb_build_object('class_id',p_class_id));
 RETURN jsonb_build_object('id',s.id,'enrollmentId',eid);
END $$;

-- Immutable payment transactions plus the existing monthly reporting projection.
CREATE TABLE IF NOT EXISTS public.payment_transactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_key uuid NOT NULL UNIQUE,
 student_id varchar(20) NOT NULL REFERENCES public.students(id), year integer NOT NULL,
 for_month varchar(10) NOT NULL, amount_usd numeric(12,2) NOT NULL CHECK(amount_usd>=0),
 payment_date date NOT NULL, payment_method text NOT NULL, recorded_by uuid NOT NULL REFERENCES public.profiles(id),
 receipt_number text NOT NULL UNIQUE DEFAULT ('TKD-'||replace(gen_random_uuid()::text,'-','')),
 created_at timestamptz NOT NULL DEFAULT now(), CHECK(year BETWEEN 2000 AND 2200)
);
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY portal_transaction_read ON public.payment_transactions FOR SELECT TO authenticated USING(public.portal_has_permission('page:financials') OR public.is_current_student(student_id));
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.payment_transactions FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.portal_record_payment(p_actor uuid,p_student_id text,p_year integer,p_month text,p_amount numeric,p_method text,p_request_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.payment_transactions;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:finance_record_payment');
 IF p_amount IS NULL OR p_amount<0 OR p_amount>100000 OR p_amount<>round(p_amount,2) OR p_year NOT BETWEEN 2000 AND 2200 OR p_month NOT IN ('Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec') OR p_method NOT IN ('Cash','Bank Transfer','Credit Card','ABA Bank KHQR','Waived') OR p_request_key IS NULL THEN RAISE EXCEPTION 'Invalid payment' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_student_id||p_year||p_month,0));
 SELECT * INTO t FROM public.payment_transactions WHERE request_key=p_request_key;
 IF FOUND THEN
 IF t.student_id<>p_student_id OR t.year<>p_year OR t.for_month<>p_month OR t.amount_usd<>p_amount OR t.payment_method<>p_method OR t.recorded_by<>p_actor THEN RAISE EXCEPTION 'Idempotency key mismatch' USING ERRCODE='22023'; END IF;
 RETURN to_jsonb(t); END IF;
 IF EXISTS(SELECT 1 FROM public.payments WHERE student_id=p_student_id AND year=p_year AND for_month=p_month AND status IN ('Paid','Waived')) THEN RAISE EXCEPTION 'This billing month is already settled' USING ERRCODE='23505'; END IF;
 IF p_amount=0 AND p_method<>'Waived' OR p_amount>0 AND p_method='Waived' THEN RAISE EXCEPTION 'Use Waived only for zero-value settlements' USING ERRCODE='22023'; END IF;
 INSERT INTO public.payment_transactions(request_key,student_id,year,for_month,amount_usd,payment_date,payment_method,recorded_by) VALUES(p_request_key,p_student_id,p_year,p_month,p_amount,(now() AT TIME ZONE 'Asia/Phnom_Penh')::date,p_method,p_actor) RETURNING * INTO t;
 INSERT INTO public.payments(student_id,year,for_month,status,payment_date,amount_usd,notes) VALUES(p_student_id,p_year,p_month,CASE WHEN p_amount=0 THEN 'Waived' ELSE 'Paid' END,t.payment_date,p_amount,t.receipt_number)
 ON CONFLICT(student_id,year,for_month) DO UPDATE SET status=EXCLUDED.status,payment_date=EXCLUDED.payment_date,amount_usd=EXCLUDED.amount_usd,notes=EXCLUDED.notes;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('PAYMENT_RECORDED',p_actor::text,t.id::text,jsonb_build_object('receipt',t.receipt_number,'amount',p_amount));
 RETURN to_jsonb(t);
END $$;


CREATE OR REPLACE FUNCTION public.portal_record_payments(p_actor uuid,p_student_id text,p_entries jsonb,p_method text,p_request_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e record; result jsonb:='[]'; key uuid;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:finance_record_payment');
 IF jsonb_typeof(p_entries) IS DISTINCT FROM 'array' OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'Invalid allocations' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_entries))<>(SELECT count(DISTINCT (value->>'year',value->>'month')) FROM jsonb_array_elements(p_entries)) THEN RAISE EXCEPTION 'Duplicate month' USING ERRCODE='22023'; END IF;
 FOR e IN SELECT value AS data FROM jsonb_array_elements(p_entries) ORDER BY value->>'year',value->>'month' LOOP
 key:=md5(p_request_key::text||(e.data->>'year')||(e.data->>'month'))::uuid;
 result:=result||jsonb_build_array(public.portal_record_payment(p_actor,p_student_id,(e.data->>'year')::integer,e.data->>'month',(e.data->>'amount')::numeric,p_method,key));
 END LOOP;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.portal_archive_student(p_actor uuid,p_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:student_delete');
 UPDATE public.students SET deleted_at=COALESCE(deleted_at,now()),student_status='Inactive',updated_at=now() WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student not found' USING ERRCODE='22023'; END IF;
 UPDATE public.profiles SET is_active=false WHERE student_id=p_id OR id IN(SELECT profile_id FROM public.students WHERE id=p_id);
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('STUDENT_ARCHIVED',p_actor::text,p_id,'{}');
END $$;

CREATE OR REPLACE FUNCTION public.portal_update_student(p_actor uuid,p_id text,p_changes jsonb,p_address jsonb DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.students;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:student_edit');
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_changes) k WHERE k NOT IN('khmer_name','english_name','gender','dob','registration_date','scholarship_id','height_cm','weight_kg','home_branch_id','current_belt','student_status','email','phone','emergency_contact_name','emergency_contact_phone','emergency_contact_relation','medical_notes','allergies','nationality','profile_picture_path','esign_path','kukkiwon_id','notes','status_reason','status_changed_at','pause_end_date')) THEN RAISE EXCEPTION 'Unsupported student field' USING ERRCODE='22023'; END IF;
 SELECT * INTO s FROM public.students WHERE id=p_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student not found' USING ERRCODE='22023'; END IF;
 SELECT * INTO s FROM jsonb_populate_record(s,p_changes);
 UPDATE public.students SET khmer_name=s.khmer_name,english_name=s.english_name,gender=s.gender,dob=s.dob,registration_date=s.registration_date,scholarship_id=s.scholarship_id,height_cm=s.height_cm,weight_kg=s.weight_kg,home_branch_id=s.home_branch_id,current_belt=s.current_belt,student_status=s.student_status,email=s.email,phone=s.phone,emergency_contact_name=s.emergency_contact_name,emergency_contact_phone=s.emergency_contact_phone,emergency_contact_relation=s.emergency_contact_relation,medical_notes=s.medical_notes,allergies=s.allergies,nationality=s.nationality,profile_picture_path=s.profile_picture_path,esign_path=s.esign_path,kukkiwon_id=s.kukkiwon_id,notes=s.notes,status_reason=s.status_reason,status_changed_at=s.status_changed_at,pause_end_date=s.pause_end_date,updated_at=now() WHERE id=p_id;
 IF p_changes ? 'english_name' THEN UPDATE public.profiles SET display_name=s.english_name WHERE id=s.profile_id; END IF;
 -- Contact email and login identity are separate. Pausing training does not suspend portal login.
 IF s.student_status='Suspended' THEN UPDATE public.profiles SET is_active=false WHERE id=s.profile_id; END IF;
 IF p_address IS NOT NULL THEN
 UPDATE public.student_addresses SET address_line1=p_address->>'address_line1',address_line2=p_address->>'address_line2',district_commune=p_address->>'district_commune',state_province_city=p_address->>'state_province_city',postal_code=p_address->>'postal_code',country=p_address->>'country' WHERE student_id=p_id AND is_primary=true;
 IF NOT FOUND THEN INSERT INTO public.student_addresses(student_id,address_line1,address_line2,district_commune,state_province_city,postal_code,country,is_primary) VALUES(p_id,p_address->>'address_line1',p_address->>'address_line2',p_address->>'district_commune',p_address->>'state_province_city',p_address->>'postal_code',p_address->>'country',true); END IF; END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('STUDENT_UPDATED',p_actor::text,p_id,jsonb_build_object('fields',ARRAY(SELECT jsonb_object_keys(p_changes))));
END $$;

CREATE OR REPLACE FUNCTION public.portal_provision_user(p_actor uuid,p_profile jsonb,p_member jsonb DEFAULT NULL,p_address jsonb DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.profiles; m public.members; actor_role text;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:staff_manage');
 SELECT role INTO actor_role FROM public.profiles WHERE id=p_actor;
 SELECT * INTO p FROM jsonb_populate_record(NULL::public.profiles,p_profile);
 IF p.role<>'Student' AND p.student_id IS NOT NULL THEN RAISE EXCEPTION 'Only Student accounts can link a student record' USING ERRCODE='22023'; END IF;
 IF p.role IN ('Root','Super Root') AND actor_role NOT IN ('Root','Super Root') THEN RAISE EXCEPTION 'Root role requires Root authority' USING ERRCODE='42501'; END IF;
 IF p.role='Student' THEN
 PERFORM 1 FROM public.students WHERE id=p.student_id AND profile_id IS NULL AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student is absent, archived, or already linked' USING ERRCODE='22023'; END IF;
 END IF;
 INSERT INTO public.profiles(id,username,email,display_name,role,is_active,student_id,must_change_password) VALUES(p.id,p.username,p.email,p.display_name,p.role,p.is_active,p.student_id,p.role<>'Student')
 ON CONFLICT(id) DO UPDATE SET username=EXCLUDED.username,email=EXCLUDED.email,display_name=EXCLUDED.display_name,role=EXCLUDED.role,is_active=EXCLUDED.is_active,student_id=EXCLUDED.student_id,must_change_password=EXCLUDED.must_change_password;
 IF p.role='Student' THEN UPDATE public.students SET profile_id=p.id WHERE id=p.student_id;
 ELSE
 SELECT * INTO m FROM jsonb_populate_record(NULL::public.members,p_member);
 INSERT INTO public.members(id,khmer_name,english_name,gender,dob,phone,emergency_contact_name,emergency_contact_phone,emergency_contact_relation,medical_notes,allergies,profile_picture_path,nationality) VALUES(p.id,m.khmer_name,m.english_name,m.gender,m.dob,m.phone,m.emergency_contact_name,m.emergency_contact_phone,m.emergency_contact_relation,m.medical_notes,m.allergies,m.profile_picture_path,m.nationality)
 ON CONFLICT(id) DO UPDATE SET khmer_name=EXCLUDED.khmer_name,english_name=EXCLUDED.english_name,gender=EXCLUDED.gender,dob=EXCLUDED.dob,phone=EXCLUDED.phone,emergency_contact_name=EXCLUDED.emergency_contact_name,emergency_contact_phone=EXCLUDED.emergency_contact_phone,emergency_contact_relation=EXCLUDED.emergency_contact_relation,medical_notes=EXCLUDED.medical_notes,allergies=EXCLUDED.allergies,profile_picture_path=EXCLUDED.profile_picture_path,nationality=EXCLUDED.nationality;
 IF p_address IS NOT NULL THEN INSERT INTO public.member_addresses(member_id,address_line1,address_line2,district_commune,state_province_city,postal_code,country,is_primary) VALUES(p.id,p_address->>'line1',p_address->>'line2',p_address->>'city',p_address->>'stateProvince',p_address->>'postalCode',COALESCE(p_address->>'country','Cambodia'),true); END IF;
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('USER_PROVISIONED',p_actor::text,p.id::text,jsonb_build_object('role',p.role));
END $$;

-- Explicit grants for every new function; private helper functions stay service-only too.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT p.oid::regprocedure AS signature,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'portal_%' LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',r.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',r.signature);
 IF r.proname='portal_has_permission' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',r.signature); END IF;
 END LOOP;
END $$;
GRANT ALL ON public.payment_transactions,public.portal_rate_limits TO service_role;
GRANT SELECT ON public.payment_transactions TO authenticated;


-- 20261009090100_portal_catalog_and_households.sql

CREATE OR REPLACE FUNCTION public.portal_save_product(p_actor uuid,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.products; v public.product_variants; item record; incoming jsonb; result jsonb; action text; vid uuid;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:pos_manage_inventory');
 action:=p_payload->>'action';
 IF action='CREATE_PRODUCT' THEN
 INSERT INTO public.products(sku,name,category_id,category_name,price_usd,cost_usd,stock,min_stock_threshold,sizes,has_variants,image_url,description)
 VALUES(upper(trim(p_payload->>'sku')),trim(p_payload->>'name'),(p_payload->>'categoryId')::integer,p_payload->>'categoryName',(p_payload->>'priceUsd')::numeric,COALESCE((p_payload->>'costUsd')::numeric,0),COALESCE((p_payload->>'stock')::integer,0),COALESCE((p_payload->>'minStockThreshold')::integer,5),ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'sizes','[]'))),COALESCE((p_payload->>'hasVariants')::boolean,false),p_payload->>'imageUrl',p_payload->>'description') RETURNING * INTO p;
 ELSE
 SELECT * INTO p FROM public.products WHERE id=(p_payload->>'productId')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product not found' USING ERRCODE='22023'; END IF;
 IF action='DELETE_PRODUCT' THEN
 UPDATE public.products SET is_active=false,allow_student_orders=false,updated_at=now() WHERE id=p.id;
 RETURN jsonb_build_object('id',p.id,'archived',true);
 END IF;
 IF action<>'UPDATE_PRODUCT' THEN RAISE EXCEPTION 'Invalid catalog action' USING ERRCODE='22023'; END IF;
 IF p_payload ? 'stock' AND (p_payload->>'stock')::integer<>p.stock THEN RAISE EXCEPTION 'Use Stock Adjustment to change inventory. Refresh the catalog if another sale changed it.' USING ERRCODE='22023'; END IF;
 UPDATE public.products SET sku=COALESCE(upper(trim(p_payload->>'sku')),sku),name=COALESCE(trim(p_payload->>'name'),name),category_id=CASE WHEN p_payload ? 'categoryId' THEN (p_payload->>'categoryId')::integer ELSE category_id END,
 category_name=COALESCE(p_payload->>'categoryName',category_name),price_usd=COALESCE((p_payload->>'priceUsd')::numeric,price_usd),cost_usd=COALESCE((p_payload->>'costUsd')::numeric,cost_usd),min_stock_threshold=COALESCE((p_payload->>'minStockThreshold')::integer,min_stock_threshold),
 image_url=CASE WHEN p_payload ? 'imageUrl' THEN p_payload->>'imageUrl' ELSE image_url END,description=CASE WHEN p_payload ? 'description' THEN p_payload->>'description' ELSE description END,
 is_active=COALESCE((p_payload->>'isActive')::boolean,is_active),allow_student_orders=COALESCE((p_payload->>'allowStudentOrders')::boolean,allow_student_orders),updated_at=now() WHERE id=p.id RETURNING * INTO p;
 END IF;
 IF p_payload ? 'variants' THEN
 incoming:=p_payload->'variants';
 IF jsonb_typeof(incoming)<>'array' OR jsonb_array_length(incoming)>200 THEN RAISE EXCEPTION 'Invalid variants' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.product_variants old WHERE old.product_id=p.id AND old.is_active=true AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(incoming) x WHERE x->>'id'=old.id::text OR upper(x->>'sku')=old.sku) AND (old.stock<>0 OR EXISTS(SELECT 1 FROM public.pos_order_items i JOIN public.pos_orders o ON o.id=i.order_id WHERE i.variant_id=old.id AND o.stock_reserved=true AND o.order_status NOT IN ('COMPLETED','CANCELLED')))) THEN RAISE EXCEPTION 'Cannot remove a variant with stock or reserved orders' USING ERRCODE='22023'; END IF;
 -- Preserve IDs so existing reservations, cart references and receipts remain linked.
 UPDATE public.product_variants old SET is_active=false WHERE product_id=p.id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(incoming) x WHERE x->>'id'=old.id::text OR upper(x->>'sku')=old.sku);
 FOR item IN SELECT value AS data FROM jsonb_array_elements(incoming) ORDER BY value->>'sku' LOOP
 SELECT * INTO v FROM public.product_variants WHERE product_id=p.id AND (id=NULLIF(item.data->>'id','')::uuid OR sku=upper(trim(item.data->>'sku'))) FOR UPDATE;
 IF FOUND THEN
 IF (item.data->>'stock')::integer<>v.stock THEN RAISE EXCEPTION 'Use Stock Adjustment to change variant inventory' USING ERRCODE='22023'; END IF;
 UPDATE public.product_variants SET sku=upper(trim(item.data->>'sku')),size=item.data->>'size',color=item.data->>'color',price_override=(item.data->>'priceOverride')::numeric,min_stock_threshold=COALESCE((item.data->>'minStockThreshold')::integer,3),is_active=true,updated_at=now() WHERE id=v.id;
 ELSE
 INSERT INTO public.product_variants(product_id,sku,size,color,price_override,stock,min_stock_threshold) VALUES(p.id,upper(trim(item.data->>'sku')),item.data->>'size',item.data->>'color',(item.data->>'priceOverride')::numeric,COALESCE((item.data->>'stock')::integer,0),COALESCE((item.data->>'minStockThreshold')::integer,3));
 END IF;
 END LOOP;
 UPDATE public.products SET has_variants=jsonb_array_length(incoming)>0,stock=CASE WHEN jsonb_array_length(incoming)>0 THEN (SELECT COALESCE(sum(stock),0) FROM public.product_variants WHERE product_id=p.id AND is_active=true) ELSE stock END,sizes=ARRAY(SELECT DISTINCT size FROM public.product_variants WHERE product_id=p.id AND is_active=true) WHERE id=p.id;
 ELSIF p.has_variants AND action='CREATE_PRODUCT' THEN RAISE EXCEPTION 'Variant products require variant rows' USING ERRCODE='22023'; END IF;
 SELECT to_jsonb(prod)||jsonb_build_object('variants',COALESCE((SELECT jsonb_agg(vr) FROM public.product_variants vr WHERE vr.product_id=p.id AND vr.is_active=true),'[]')) INTO result FROM public.products prod WHERE prod.id=p.id;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('CATALOG_SAVED',p_actor::text,p.id::text,jsonb_build_object('action',action));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.portal_save_product(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_save_product(uuid,jsonb) TO service_role;

CREATE TABLE IF NOT EXISTS public.households(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),guardian_name text NOT NULL,guardian_phone text NOT NULL,
 guardian_email text NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.household_students(
 household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
 student_id varchar(20) NOT NULL REFERENCES public.students(id),PRIMARY KEY(household_id,student_id),UNIQUE(student_id)
);
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY portal_household_read ON public.households FOR SELECT TO authenticated USING(public.portal_has_permission('page:directory') OR public.portal_has_permission('page:financials'));
CREATE POLICY portal_household_student_read ON public.household_students FOR SELECT TO authenticated USING(public.portal_has_permission('page:directory') OR public.portal_has_permission('page:financials'));
REVOKE ALL ON public.households,public.household_students FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.households,public.household_students TO authenticated;
GRANT ALL ON public.households,public.household_students TO service_role;
CREATE OR REPLACE FUNCTION public.portal_save_household(p_actor uuid,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE hid uuid;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:student_edit');
 hid:=COALESCE(NULLIF(p_payload->>'id','')::uuid,gen_random_uuid());
 PERFORM pg_advisory_xact_lock(hashtextextended(hid::text,0));
 IF length(trim(p_payload->>'guardianName')) NOT BETWEEN 1 AND 150 OR length(trim(p_payload->>'guardianPhone')) NOT BETWEEN 1 AND 50 OR jsonb_array_length(p_payload->'studentIds')>50 THEN RAISE EXCEPTION 'Invalid household' USING ERRCODE='22023'; END IF;
 INSERT INTO public.households(id,guardian_name,guardian_phone,guardian_email) VALUES(hid,trim(p_payload->>'guardianName'),trim(p_payload->>'guardianPhone'),COALESCE(p_payload->>'guardianEmail',''))
 ON CONFLICT(id) DO UPDATE SET guardian_name=EXCLUDED.guardian_name,guardian_phone=EXCLUDED.guardian_phone,guardian_email=EXCLUDED.guardian_email,updated_at=now();
 DELETE FROM public.household_students WHERE household_id=hid;
 INSERT INTO public.household_students(household_id,student_id) SELECT hid,value FROM jsonb_array_elements_text(p_payload->'studentIds');
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('HOUSEHOLD_SAVED',p_actor::text,hid::text,'{}');
 RETURN jsonb_build_object('id',hid);
END $$;
REVOKE ALL ON FUNCTION public.portal_save_household(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_save_household(uuid,jsonb) TO service_role;

-- Views must respect the caller's underlying table policies.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT viewname FROM pg_views WHERE schemaname='public' LOOP
 EXECUTE format('ALTER VIEW public.%I SET (security_invoker=true)',r.viewname);
 END LOOP;
END $$;


-- 20261009090200_portal_billing_attendance_and_rbac.sql

ALTER TABLE public.academy_profile ADD COLUMN IF NOT EXISTS early_group_tuition_usd numeric(10,2) NOT NULL DEFAULT 25 CHECK(early_group_tuition_usd>=0);
ALTER TABLE public.academy_profile ADD COLUMN IF NOT EXISTS standard_tuition_usd numeric(10,2) NOT NULL DEFAULT 45 CHECK(standard_tuition_usd>=0);

-- Payments and audit entries are immutable, including writes through the service role.
CREATE OR REPLACE FUNCTION public.portal_immutable_transaction() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Use a compensating transaction; financial transactions are immutable'; END $$;
DROP TRIGGER IF EXISTS portal_immutable_transaction ON public.payment_transactions;
CREATE TRIGGER portal_immutable_transaction BEFORE UPDATE OR DELETE ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.portal_immutable_transaction();
REVOKE ALL ON FUNCTION public.portal_immutable_transaction() FROM PUBLIC,anon,authenticated;

-- Student linkage and archive flags can only be changed by verified server operations.
CREATE OR REPLACE FUNCTION public.portal_guard_student_identity() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.profile_id IS DISTINCT FROM OLD.profile_id OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) THEN RAISE EXCEPTION 'Student identity fields require server authority' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS portal_student_identity ON public.students;
CREATE TRIGGER portal_student_identity BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.portal_guard_student_identity();
REVOKE ALL ON FUNCTION public.portal_guard_student_identity() FROM PUBLIC,anon,authenticated;

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS class_id integer REFERENCES public.class_sessions(id);
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT conname FROM pg_constraint WHERE conrelid='public.attendance'::regclass AND contype='u' AND pg_get_constraintdef(oid) IN ('UNIQUE (student_id, date)','UNIQUE (student_id, date, class_id)') LOOP EXECUTE format('ALTER TABLE public.attendance DROP CONSTRAINT %I',r.conname); END LOOP;
END $$;
ALTER TABLE public.attendance ADD CONSTRAINT portal_attendance_occurrence UNIQUE NULLS NOT DISTINCT(student_id,date,class_id);
COMMENT ON COLUMN public.attendance.class_id IS 'NULL represents a legacy daily record; new class rosters record each scheduled class separately.';

-- Replace the remaining operational policies rather than layering permissive grants.
DO $$ DECLARE r record; spec record; BEGIN
 FOR spec IN SELECT * FROM (VALUES
 ('class_sessions','page:schedule','action:schedule_manage'),
 ('members','page:staff','action:staff_manage'),('member_addresses','page:staff','action:staff_manage'),
 ('partners','page:partners','action:partner_edit'),('staff_dan_history','page:staff','action:staff_manage'),
 ('academy_profile','page:settings','action:staff_manage'),
 ('student_physical_evaluations','page:lms','action:evaluations_grade'),
 ('student_body_compositions','page:directory','action:student_edit'),
 ('student_training_plans','page:lms','action:evaluations_grade'),
 ('achievements','page:directory','action:student_edit'),('belt_histories','page:directory','action:evaluations_grade'),
 ('lms_progress','page:lms','action:evaluations_grade'),
 ('library_assets','page:library','action:curriculum_edit'),('library_asset_muscles','page:library','action:curriculum_edit'),
 ('curriculum','page:lms','action:curriculum_edit'),('belt_techniques','page:lms','action:curriculum_edit'),
 ('muscles','page:library','action:curriculum_edit'),('biomechanical_skill_linkage','page:library','action:curriculum_edit'),
 ('workout_templates','page:lms','action:curriculum_edit'),
 ('branches','page:schedule','manage:branches'),('belts','page:directory','action:curriculum_edit'),
 ('scholarships','page:financials','action:staff_manage'),('product_categories','page:pos','action:pos_manage_inventory')
 ) AS mapping(table_name,read_key,write_key) LOOP
 IF to_regclass('public.'||spec.table_name) IS NULL THEN CONTINUE; END IF;
 FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=spec.table_name LOOP EXECUTE format('DROP POLICY %I ON public.%I',r.policyname,spec.table_name); END LOOP;
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',spec.table_name);
 EXECUTE format('CREATE POLICY portal_read ON public.%I FOR SELECT TO authenticated USING(public.auth_is_active() AND (public.portal_has_permission(%L) OR public.portal_has_permission(%L)))',spec.table_name,spec.read_key,spec.write_key);
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=spec.table_name AND column_name='student_id') THEN
 EXECUTE format('CREATE POLICY portal_own_read ON public.%I FOR SELECT TO authenticated USING(public.is_current_student(student_id::text))',spec.table_name);
 END IF;
 IF spec.table_name='lms_progress' THEN
 EXECUTE 'CREATE POLICY portal_own_progress ON public.lms_progress FOR ALL TO authenticated USING(public.is_current_student(student_id::text)) WITH CHECK(public.is_current_student(student_id::text))';
 END IF;
 -- Students can read teaching resources and published schedules after signing in.
 IF spec.table_name IN ('class_sessions','branches','belts','curriculum','belt_techniques','library_assets','library_asset_muscles','muscles','biomechanical_skill_linkage','workout_templates','academy_profile','scholarships') THEN
 EXECUTE format('CREATE POLICY portal_reference_read ON public.%I FOR SELECT TO authenticated USING(public.auth_is_active())',spec.table_name);
 END IF;
 IF spec.table_name='members' THEN EXECUTE 'CREATE POLICY portal_self_read ON public.members FOR SELECT TO authenticated USING(id=auth.uid() AND public.auth_is_active())'; END IF;
 IF spec.table_name='member_addresses' THEN EXECUTE 'CREATE POLICY portal_self_read ON public.member_addresses FOR SELECT TO authenticated USING(member_id=auth.uid() AND public.auth_is_active())'; END IF;
 EXECUTE format('CREATE POLICY portal_insert ON public.%I FOR INSERT TO authenticated WITH CHECK(public.portal_has_permission(%L))',spec.table_name,spec.write_key);
 EXECUTE format('CREATE POLICY portal_update ON public.%I FOR UPDATE TO authenticated USING(public.portal_has_permission(%L)) WITH CHECK(public.portal_has_permission(%L))',spec.table_name,spec.write_key,spec.write_key);
 EXECUTE format('CREATE POLICY portal_delete ON public.%I FOR DELETE TO authenticated USING(public.portal_has_permission(%L))',spec.table_name,spec.write_key);
 END LOOP;
END $$;
-- Partner operations have distinct create/edit/delete permissions.
DROP POLICY portal_insert ON public.partners;
DROP POLICY portal_delete ON public.partners;
CREATE POLICY portal_insert ON public.partners FOR INSERT TO authenticated WITH CHECK(public.portal_has_permission('action:partner_create'));
CREATE POLICY portal_delete ON public.partners FOR DELETE TO authenticated USING(public.portal_has_permission('action:partner_delete'));
REVOKE INSERT,UPDATE,DELETE ON public.members,public.member_addresses,public.staff_dan_history FROM authenticated;

CREATE OR REPLACE FUNCTION public.portal_refund_order(p_actor uuid,p_order_id uuid,p_reference text,p_reason text,p_restock boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.pos_orders; item record;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:pos_cancel_order');
 IF length(trim(p_reference))<3 OR length(trim(p_reason))<3 THEN RAISE EXCEPTION 'Verified refund reference and reason required' USING ERRCODE='22023'; END IF;
 SELECT * INTO o FROM public.pos_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE='22023'; END IF;
 IF o.payment_status='REFUNDED' THEN RETURN jsonb_build_object('order_id',o.id,'payment_status','REFUNDED'); END IF;
 IF o.payment_status NOT IN ('PAID','REFUND_PENDING') THEN RAISE EXCEPTION 'Only paid orders can be refunded' USING ERRCODE='22023'; END IF;
 IF p_restock AND o.stock_reserved THEN
 FOR item IN SELECT * FROM public.pos_order_items WHERE order_id=o.id ORDER BY product_id,variant_id LOOP
 PERFORM public.portal_stock_change(item.product_id,item.variant_id,item.quantity,'ORDER_CANCELLED_RESTORE',p_actor,o.id,'Reviewed return: '||p_reason);
 END LOOP; END IF;
 UPDATE public.pos_orders SET order_status='CANCELLED',payment_status='REFUNDED',refund_reference=p_reference,stock_reserved=false,cancelled_at=COALESCE(cancelled_at,now()),cancellation_reason=p_reason,updated_at=now() WHERE id=o.id;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('REFUND_RECORDED',p_actor::text,o.id::text,jsonb_build_object('reference',p_reference,'restocked',p_restock,'reason',p_reason));
 RETURN jsonb_build_object('order_id',o.id,'payment_status','REFUNDED');
END $$;
REVOKE ALL ON FUNCTION public.portal_refund_order(uuid,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_refund_order(uuid,uuid,text,text,boolean) TO service_role;


-- 20261009090300_portal_account_integrity.sql

-- Legacy Auth signup triggers may consume user_metadata. Self-signup never creates staff authority.
CREATE OR REPLACE FUNCTION public.portal_guard_profile_signup() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND session_user NOT IN ('postgres','supabase_admin') THEN
 NEW.role:='Student'; NEW.is_active:=false; NEW.student_id:=NULL; NEW.must_change_password:=false;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS portal_profile_signup ON public.profiles;
CREATE TRIGGER portal_profile_signup BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.portal_guard_profile_signup();
REVOKE ALL ON FUNCTION public.portal_guard_profile_signup() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.portal_archive_user(p_actor uuid,p_target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor_role text; target_role text;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:staff_manage');
 PERFORM pg_advisory_xact_lock(hashtextextended('portal-active-root-authority',0));
 IF p_actor=p_target THEN RAISE EXCEPTION 'Cannot archive your own account' USING ERRCODE='22023'; END IF;
 SELECT role INTO actor_role FROM public.profiles WHERE id=p_actor;
 SELECT role INTO target_role FROM public.profiles WHERE id=p_target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found' USING ERRCODE='22023'; END IF;
 IF target_role IN ('Root','Super Root') AND actor_role NOT IN ('Root','Super Root') THEN RAISE EXCEPTION 'Root account requires Root authority' USING ERRCODE='42501'; END IF;
 IF target_role IN ('Root','Super Root') AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id<>p_target AND is_active AND role IN ('Root','Super Root')) THEN RAISE EXCEPTION 'Keep at least one active Root account' USING ERRCODE='22023'; END IF;
 UPDATE public.profiles SET is_active=false WHERE id=p_target;
 UPDATE public.class_sessions SET coach_id=CASE WHEN coach_id=p_target THEN NULL ELSE coach_id END,head_coach_id=CASE WHEN head_coach_id=p_target THEN NULL ELSE head_coach_id END WHERE coach_id=p_target OR head_coach_id=p_target;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('USER_ARCHIVED',p_actor::text,p_target::text,'{}');
END $$;

CREATE OR REPLACE FUNCTION public.portal_update_user(p_actor uuid,p_target uuid,p_profile jsonb,p_member jsonb,p_address jsonb DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.profiles; target public.profiles; changed public.profiles; m public.members; privileged boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('portal-active-root-authority',0));
 SELECT * INTO actor FROM public.profiles WHERE id=p_actor AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inactive account' USING ERRCODE='42501'; END IF;
 SELECT * INTO target FROM public.profiles WHERE id=p_target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Target missing' USING ERRCODE='22023'; END IF;
 privileged:=actor.role IN ('Root','Super Root') OR COALESCE((SELECT is_granted FROM public.user_permissions WHERE user_id=p_actor AND permission_key='action:staff_manage'),(SELECT is_granted FROM public.role_permissions WHERE role=actor.role AND permission_key='action:staff_manage'),false);
 IF NOT privileged AND p_actor<>p_target THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501'; END IF;
 IF NOT privileged AND p_profile ?| ARRAY['role','is_active','student_id','kukkiwon_id','current_dan','dan_issue_date','dan_certificate_url'] THEN RAISE EXCEPTION 'Protected profile field' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_profile) k WHERE k NOT IN ('email','username','display_name','role','is_active','student_id','kukkiwon_id','current_dan','dan_issue_date','dan_certificate_url','must_change_password')) THEN RAISE EXCEPTION 'Unsupported profile field' USING ERRCODE='22023'; END IF;
 SELECT * INTO changed FROM jsonb_populate_record(target,p_profile);
 IF changed.role<>'Student' AND changed.student_id IS NOT NULL THEN RAISE EXCEPTION 'Clear the student link before changing to a staff role' USING ERRCODE='22023'; END IF;
 IF changed.role='Student' AND changed.student_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.students WHERE profile_id=p_target AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Choose the student record explicitly' USING ERRCODE='22023'; END IF;
 IF (target.role IN ('Root','Super Root') OR changed.role IN ('Root','Super Root')) AND actor.role NOT IN ('Root','Super Root') THEN RAISE EXCEPTION 'Root authority required' USING ERRCODE='42501'; END IF;
 IF target.is_active AND target.role IN ('Root','Super Root') AND (NOT changed.is_active OR changed.role NOT IN ('Root','Super Root')) AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id<>p_target AND is_active AND role IN ('Root','Super Root')) THEN RAISE EXCEPTION 'Keep at least one active Root account' USING ERRCODE='22023'; END IF;
 IF changed.student_id IS DISTINCT FROM target.student_id THEN
 IF changed.role<>'Student' AND changed.student_id IS NOT NULL THEN RAISE EXCEPTION 'Only Student accounts can link a student record' USING ERRCODE='22023'; END IF;
 IF changed.student_id IS NOT NULL THEN
 PERFORM 1 FROM public.students WHERE id=changed.student_id AND (profile_id IS NULL OR profile_id=p_target) AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student is already linked or missing' USING ERRCODE='22023'; END IF;
 END IF;
 UPDATE public.students SET profile_id=NULL WHERE profile_id=p_target;
 UPDATE public.students SET profile_id=p_target WHERE id=changed.student_id;
 END IF;
 UPDATE public.profiles SET email=changed.email,username=changed.username,display_name=changed.display_name,role=changed.role,is_active=changed.is_active,student_id=changed.student_id,kukkiwon_id=changed.kukkiwon_id,current_dan=changed.current_dan,dan_issue_date=changed.dan_issue_date,dan_certificate_url=changed.dan_certificate_url,must_change_password=changed.must_change_password WHERE id=p_target;
 SELECT * INTO m FROM public.members WHERE id=p_target FOR UPDATE;
 IF FOUND THEN
 SELECT * INTO m FROM jsonb_populate_record(m,p_member);
 UPDATE public.members SET khmer_name=m.khmer_name,english_name=m.english_name,gender=m.gender,dob=m.dob,phone=m.phone,emergency_contact_name=m.emergency_contact_name,emergency_contact_phone=m.emergency_contact_phone,emergency_contact_relation=m.emergency_contact_relation,medical_notes=m.medical_notes,allergies=m.allergies,profile_picture_path=m.profile_picture_path,nationality=m.nationality WHERE id=p_target;
 IF p_address IS NOT NULL THEN
 UPDATE public.member_addresses SET address_line1=p_address->>'address_line1',address_line2=p_address->>'address_line2',district_commune=p_address->>'district_commune',state_province_city=p_address->>'state_province_city',postal_code=p_address->>'postal_code',country=p_address->>'country' WHERE member_id=p_target AND is_primary=true;
 IF NOT FOUND THEN INSERT INTO public.member_addresses(member_id,address_line1,address_line2,district_commune,state_province_city,postal_code,country,is_primary) VALUES(p_target,p_address->>'address_line1',p_address->>'address_line2',p_address->>'district_commune',p_address->>'state_province_city',p_address->>'postal_code',p_address->>'country',true); END IF;
 END IF; END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('USER_UPDATED',p_actor::text,p_target::text,jsonb_build_object('fields',ARRAY(SELECT jsonb_object_keys(p_profile))));
END $$;
REVOKE ALL ON FUNCTION public.portal_archive_user(uuid,uuid),public.portal_update_user(uuid,uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_archive_user(uuid,uuid),public.portal_update_user(uuid,uuid,jsonb,jsonb,jsonb) TO service_role;

CREATE TABLE IF NOT EXISTS public.client_telemetry(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),details jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.client_telemetry ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS portal_telemetry_date ON public.client_telemetry(created_at);
REVOKE ALL ON public.client_telemetry FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.client_telemetry TO service_role;


-- 20261009090400_portal_settlement_validation.sql

-- Carry legacy secondary contacts into the modern fields once, before removing read fallbacks.
UPDATE public.partners SET secondary_contact_name=COALESCE(secondary_contact_name,secondary_contacts->0->>'name'),secondary_contact_phone=COALESCE(secondary_contact_phone,secondary_contacts->0->>'phone'),secondary_contact_telegram=COALESCE(secondary_contact_telegram,secondary_contacts->0->>'telegram') WHERE jsonb_typeof(secondary_contacts)='array';
-- Preserve legacy records for reconciliation; all new MOU writes must have coherent dates.
ALTER TABLE public.partners ADD CONSTRAINT portal_partner_dates CHECK(mou_signed_date IS NULL OR mou_expiry_date IS NULL OR mou_expiry_date>=mou_signed_date) NOT VALID;
-- This portal records complete monthly settlements. Partial collections require
-- an allocation ledger and must never masquerade as a fully paid month.
CREATE OR REPLACE FUNCTION public.portal_validate_tuition_settlement() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE student public.students; plan public.scholarships; config public.academy_profile;
 expected numeric; starts date; billing_month integer;
BEGIN
 SELECT * INTO student FROM public.students WHERE id=NEW.student_id AND deleted_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student is missing or archived' USING ERRCODE='22023'; END IF;
 SELECT * INTO plan FROM public.scholarships WHERE id=student.scholarship_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student tuition plan is missing' USING ERRCODE='22023'; END IF;
 SELECT * INTO config FROM public.academy_profile WHERE id='default';
 expected:=CASE WHEN plan.type_name='Early Group Student' THEN COALESCE(config.early_group_tuition_usd,25)
 ELSE round(COALESCE(config.standard_tuition_usd,45)*(100-greatest(0,least(100,plan.discount_percentage)))/100,2) END;
 SELECT min(enrollment_date) INTO starts FROM public.class_enrollments WHERE student_id=student.id;
 starts:=COALESCE(starts,student.registration_date);
 billing_month:=array_position(ARRAY['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],NEW.for_month);
 IF billing_month IS NULL OR make_date(NEW.year,billing_month,1)<date_trunc('month',starts)::date THEN
 RAISE EXCEPTION 'Billing month precedes enrollment or is invalid' USING ERRCODE='22023'; END IF;
 IF NEW.amount_usd>0 AND NEW.amount_usd<>expected THEN
 RAISE EXCEPTION 'Full monthly tuition is % USD; partial or excess settlements are not supported',expected USING ERRCODE='22023'; END IF;
 IF NEW.amount_usd=0 AND NEW.payment_method<>'Waived' THEN RAISE EXCEPTION 'A zero payment requires an explicit waiver' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS portal_tuition_settlement ON public.payment_transactions;
CREATE TRIGGER portal_tuition_settlement BEFORE INSERT ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.portal_validate_tuition_settlement();
REVOKE ALL ON FUNCTION public.portal_validate_tuition_settlement() FROM PUBLIC,anon,authenticated;

-- Promotion history and the student's displayed belt change in the same transaction.
-- Preserve a migrated student's starting belt before their first new promotion.
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS initial_belt varchar(30);
UPDATE public.students s SET initial_belt='White' WHERE initial_belt IS NULL AND EXISTS(SELECT 1 FROM public.belt_histories h WHERE h.student_id=s.id);
CREATE OR REPLACE FUNCTION public.portal_guard_student_identity() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND pg_trigger_depth()<=1 AND
 (NEW.id IS DISTINCT FROM OLD.id OR NEW.profile_id IS DISTINCT FROM OLD.profile_id OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.initial_belt IS DISTINCT FROM OLD.initial_belt OR
 NEW.current_belt IS DISTINCT FROM OLD.current_belt AND EXISTS(SELECT 1 FROM public.belt_histories WHERE student_id=OLD.id)) THEN
 RAISE EXCEPTION 'Student identity and recorded belt changes require trusted operations' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.portal_lock_promotion_student() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sid text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.student_id IS DISTINCT FROM OLD.student_id THEN RAISE EXCEPTION 'A promotion cannot move to another student' USING ERRCODE='22023'; END IF;
 sid:=CASE WHEN TG_OP='DELETE' THEN OLD.student_id ELSE NEW.student_id END;
 PERFORM 1 FROM public.students WHERE id=sid AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student is missing or archived' USING ERRCODE='22023'; END IF;
 UPDATE public.students SET initial_belt=COALESCE(initial_belt,current_belt,'White') WHERE id=sid;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.portal_sync_promotion_belt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sid text; latest text;
BEGIN
 sid:=CASE WHEN TG_OP='DELETE' THEN OLD.student_id ELSE NEW.student_id END;
 SELECT belt_level INTO latest FROM public.belt_histories WHERE student_id=sid ORDER BY promotion_date DESC,id DESC LIMIT 1;
 UPDATE public.students SET current_belt=COALESCE(latest,initial_belt,'White'),updated_at=now() WHERE id=sid;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS portal_lock_promotion ON public.belt_histories;
DROP TRIGGER IF EXISTS portal_sync_promotion ON public.belt_histories;
CREATE TRIGGER portal_lock_promotion BEFORE INSERT OR UPDATE OR DELETE ON public.belt_histories FOR EACH ROW EXECUTE FUNCTION public.portal_lock_promotion_student();
CREATE TRIGGER portal_sync_promotion AFTER INSERT OR UPDATE OR DELETE ON public.belt_histories FOR EACH ROW EXECUTE FUNCTION public.portal_sync_promotion_belt();
REVOKE ALL ON FUNCTION public.portal_lock_promotion_student(),public.portal_sync_promotion_belt() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.portal_reconcile_belts(p_actor uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s record; latest text; changes jsonb:='[]'; scanned integer:=0;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:evaluations_grade');
 FOR s IN SELECT * FROM public.students WHERE deleted_at IS NULL ORDER BY id FOR UPDATE LOOP
 scanned:=scanned+1;
 SELECT belt_level INTO latest FROM public.belt_histories WHERE student_id=s.id ORDER BY promotion_date DESC,id DESC LIMIT 1;
 latest:=COALESCE(latest,s.initial_belt,s.current_belt,'White');
 IF s.current_belt IS DISTINCT FROM latest THEN
 UPDATE public.students SET current_belt=latest,updated_at=now() WHERE id=s.id;
 changes:=changes||jsonb_build_array(s.english_name||' ('||s.id||'): '||s.current_belt||' to '||latest);
 END IF;
 END LOOP;
 INSERT INTO public.audit_logs(action,performed_by,details) VALUES('BELTS_RECONCILED',p_actor::text,jsonb_build_object('corrected',jsonb_array_length(changes)));
 RETURN jsonb_build_object('success',true,'scanned',scanned,'corrected',jsonb_array_length(changes),'details',changes);
END $$;
REVOKE ALL ON FUNCTION public.portal_reconcile_belts(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_reconcile_belts(uuid) TO service_role;

-- Class edits validate the merged record, including single-field time edits.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid='public.class_enrollments'::regclass AND i.indisunique AND i.indisvalid AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indnkeyatts=2 AND i.indkey::smallint[] @> (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid='public.class_enrollments'::regclass AND attname IN ('student_id','class_id'))) THEN
 CREATE UNIQUE INDEX IF NOT EXISTS portal_unique_enrollment ON public.class_enrollments(student_id,class_id);
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.portal_validate_class() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 IF NEW.start_time>=NEW.end_time OR NEW.capacity<0 OR NEW.capacity>500 THEN RAISE EXCEPTION 'Invalid class times or capacity' USING ERRCODE='22023'; END IF;
 IF NEW.days_of_week IS NULL OR cardinality(NEW.days_of_week) NOT BETWEEN 1 AND 7 OR NOT NEW.days_of_week::text[] <@ ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']::text[] THEN RAISE EXCEPTION 'Invalid class weekdays' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO n FROM public.class_enrollments e JOIN public.students s ON s.id=e.student_id WHERE e.class_id=NEW.id AND s.deleted_at IS NULL AND s.student_status='Active';
 IF n>NEW.capacity THEN RAISE EXCEPTION 'Capacity cannot be less than the active enrollment count' USING ERRCODE='22023'; END IF;
 IF NEW.coach_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.coach_id AND is_active=true AND role<>'Student') THEN RAISE EXCEPTION 'Coach must be an active staff account' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS portal_validate_class ON public.class_sessions;
CREATE TRIGGER portal_validate_class BEFORE INSERT OR UPDATE ON public.class_sessions FOR EACH ROW EXECUTE FUNCTION public.portal_validate_class();
CREATE OR REPLACE FUNCTION public.portal_validate_reactivation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c record; n integer;
BEGIN
 IF NEW.student_status='Active' AND NEW.deleted_at IS NULL AND (OLD.student_status IS DISTINCT FROM 'Active' OR OLD.deleted_at IS NOT NULL) THEN
 FOR c IN SELECT cs.id,cs.capacity FROM public.class_sessions cs WHERE EXISTS(SELECT 1 FROM public.class_enrollments WHERE student_id=NEW.id AND class_id=cs.id) ORDER BY cs.id FOR UPDATE LOOP
 SELECT count(*) INTO n FROM public.class_enrollments e JOIN public.students s ON s.id=e.student_id WHERE e.class_id=c.id AND s.id<>NEW.id AND s.student_status='Active' AND s.deleted_at IS NULL;
 IF n>=c.capacity THEN RAISE EXCEPTION 'Reactivation would exceed class capacity. Change the enrollment first' USING ERRCODE='22023'; END IF;
 END LOOP;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS portal_validate_reactivation ON public.students;
CREATE TRIGGER portal_validate_reactivation BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.portal_validate_reactivation();
REVOKE ALL ON FUNCTION public.portal_validate_class(),public.portal_validate_reactivation() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.portal_set_user_permissions(p_actor uuid,p_user uuid,p_updates jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item record;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:staff_manage');
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role IN ('Root','Super Root')) THEN RAISE EXCEPTION 'Root authority required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Target account not found' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(p_updates) IS DISTINCT FROM 'array' OR jsonb_array_length(p_updates) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid permission batch' USING ERRCODE='22023'; END IF;
 IF (SELECT count(DISTINCT value->>'permissionKey') FROM jsonb_array_elements(p_updates))<>jsonb_array_length(p_updates) THEN RAISE EXCEPTION 'Duplicate permission keys' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT value AS data FROM jsonb_array_elements(p_updates) LOOP
 IF NOT EXISTS(SELECT 1 FROM public.role_permissions WHERE permission_key=item.data->>'permissionKey') OR jsonb_typeof(item.data->'isGranted') NOT IN ('boolean','null') THEN RAISE EXCEPTION 'Unknown permission or invalid value' USING ERRCODE='22023'; END IF;
 IF item.data->'isGranted'='null'::jsonb THEN DELETE FROM public.user_permissions WHERE user_id=p_user AND permission_key=item.data->>'permissionKey';
 ELSE INSERT INTO public.user_permissions(user_id,permission_key,is_granted,updated_by,updated_at) VALUES(p_user,item.data->>'permissionKey',(item.data->>'isGranted')::boolean,p_actor,now()) ON CONFLICT(user_id,permission_key) DO UPDATE SET is_granted=EXCLUDED.is_granted,updated_by=p_actor,updated_at=now(); END IF;
 END LOOP;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('USER_PERMISSIONS_UPDATED',p_actor::text,p_user::text,jsonb_build_object('changes',p_updates));
END $$;
REVOKE ALL ON FUNCTION public.portal_set_user_permissions(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_set_user_permissions(uuid,uuid,jsonb) TO service_role;


-- 20261010090000_portal_workflow_integrity.sql

CREATE OR REPLACE FUNCTION public.portal_update_student_with_enrollment(p_actor uuid,p_id text,p_changes jsonb,p_address jsonb,p_enrollment bigint,p_enrollment_date date) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.portal_update_student(p_actor,p_id,p_changes,p_address);
 IF p_enrollment_date IS NOT NULL THEN
  IF p_enrollment IS NULL OR p_enrollment_date<'1900-01-01'::date OR p_enrollment_date>(now() AT TIME ZONE 'Asia/Phnom_Penh')::date THEN RAISE EXCEPTION 'Invalid enrollment date request' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM public.class_enrollments WHERE id=p_enrollment AND student_id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student enrollment not found. Refresh before editing' USING ERRCODE='P0002'; END IF;
  UPDATE public.class_enrollments SET enrollment_date=p_enrollment_date WHERE id=p_enrollment;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.portal_update_student_with_enrollment(uuid,text,jsonb,jsonb,bigint,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_update_student_with_enrollment(uuid,text,jsonb,jsonb,bigint,date) TO service_role;

-- Delete a class only if its historical attendance is safe. Any later FK failure
-- rolls back enrollment deletion as well. Direct client deletes cannot bypass this.
CREATE OR REPLACE FUNCTION public.portal_delete_class(p_actor uuid,p_class_id integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:schedule_manage');
 PERFORM 1 FROM public.class_sessions WHERE id=p_class_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Class not found' USING ERRCODE='P0002'; END IF;
 IF EXISTS(SELECT 1 FROM public.attendance WHERE class_id=p_class_id) THEN
  RAISE EXCEPTION 'This class has attendance history and cannot be deleted. Keep the class to preserve its records' USING ERRCODE='22023';
 END IF;
 DELETE FROM public.class_enrollments WHERE class_id=p_class_id;
 DELETE FROM public.class_sessions WHERE id=p_class_id;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('CLASS_DELETED',p_actor::text,p_class_id::text,'{}');
END $$;
REVOKE DELETE ON public.class_sessions FROM authenticated;
REVOKE ALL ON FUNCTION public.portal_delete_class(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_delete_class(uuid,integer) TO service_role;

-- A measurement and the student's latest height/weight commit together. Older
-- measurements remain in history without overwriting a newer measurement.
ALTER TABLE public.student_body_compositions ADD COLUMN IF NOT EXISTS request_key uuid;
ALTER TABLE public.student_body_compositions ADD COLUMN IF NOT EXISTS request_payload jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS portal_body_composition_request ON public.student_body_compositions(request_key) WHERE request_key IS NOT NULL;
CREATE OR REPLACE FUNCTION public.portal_record_body_composition(p_actor uuid,p_payload jsonb,p_request_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE measurement public.student_body_compositions; latest public.student_body_compositions; field text; amount numeric;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:student_edit');
 IF p_request_key IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid measurement request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('body-composition:'||p_request_key::text,0));
 SELECT * INTO measurement FROM public.student_body_compositions WHERE request_key=p_request_key;
 IF FOUND THEN
  IF measurement.recorded_by<>p_actor OR measurement.request_payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Idempotency key mismatch' USING ERRCODE='22023'; END IF;
  SELECT * INTO latest FROM public.student_body_compositions WHERE student_id=measurement.student_id ORDER BY recorded_date DESC,created_at DESC,id DESC LIMIT 1;
  RETURN jsonb_build_object('measurement',to_jsonb(measurement),'latest',to_jsonb(latest));
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('student_id','recorded_date','height_cm','weight_kg','body_fat_percentage','skeletal_muscle_mass_kg','neck_cm','shoulder_width_cm','chest_cm','waist_cm','hips_cm','left_arm_cm','right_arm_cm','left_thigh_cm','right_thigh_cm','left_calf_cm','right_calf_cm')) THEN RAISE EXCEPTION 'Unsupported measurement field' USING ERRCODE='22023'; END IF;
 SELECT * INTO measurement FROM jsonb_populate_record(NULL::public.student_body_compositions,p_payload);
 IF measurement.height_cm IS NULL OR measurement.height_cm<=0 OR measurement.height_cm>300 OR measurement.weight_kg IS NULL OR measurement.weight_kg<=0 OR measurement.weight_kg>600 THEN RAISE EXCEPTION 'Invalid height or weight' USING ERRCODE='22023'; END IF;
 FOREACH field IN ARRAY ARRAY['body_fat_percentage','skeletal_muscle_mass_kg','neck_cm','shoulder_width_cm','chest_cm','waist_cm','hips_cm','left_arm_cm','right_arm_cm','left_thigh_cm','right_thigh_cm','left_calf_cm','right_calf_cm'] LOOP
  amount:=(p_payload->>field)::numeric;
  IF amount IS NOT NULL AND (amount<0 OR amount>CASE WHEN field='body_fat_percentage' THEN 100 ELSE 500 END OR amount::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Invalid measurement: %',field USING ERRCODE='22023'; END IF;
 END LOOP;
 measurement.recorded_date:=COALESCE(measurement.recorded_date,(now() AT TIME ZONE 'Asia/Phnom_Penh')::date);
 IF measurement.recorded_date<'1900-01-01'::date OR measurement.recorded_date>(now() AT TIME ZONE 'Asia/Phnom_Penh')::date THEN RAISE EXCEPTION 'Invalid measurement date' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM public.students WHERE id=measurement.student_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student not found or archived' USING ERRCODE='22023'; END IF;
 INSERT INTO public.student_body_compositions(student_id,recorded_date,height_cm,weight_kg,body_fat_percentage,skeletal_muscle_mass_kg,neck_cm,shoulder_width_cm,chest_cm,waist_cm,hips_cm,left_arm_cm,right_arm_cm,left_thigh_cm,right_thigh_cm,left_calf_cm,right_calf_cm,recorded_by,request_key,request_payload)
 VALUES(measurement.student_id,measurement.recorded_date,measurement.height_cm,measurement.weight_kg,measurement.body_fat_percentage,measurement.skeletal_muscle_mass_kg,measurement.neck_cm,measurement.shoulder_width_cm,measurement.chest_cm,measurement.waist_cm,measurement.hips_cm,measurement.left_arm_cm,measurement.right_arm_cm,measurement.left_thigh_cm,measurement.right_thigh_cm,measurement.left_calf_cm,measurement.right_calf_cm,p_actor,p_request_key,p_payload) RETURNING * INTO measurement;
 SELECT * INTO latest FROM public.student_body_compositions WHERE student_id=measurement.student_id ORDER BY recorded_date DESC,created_at DESC,id DESC LIMIT 1;
 UPDATE public.students SET height_cm=latest.height_cm,weight_kg=latest.weight_kg,updated_at=now() WHERE id=measurement.student_id;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('BODY_COMPOSITION_RECORDED',p_actor::text,measurement.student_id,jsonb_build_object('measurementId',measurement.id));
 RETURN jsonb_build_object('measurement',to_jsonb(measurement),'latest',to_jsonb(latest));
END $$;
REVOKE INSERT,UPDATE,DELETE ON public.student_body_compositions FROM authenticated;
REVOKE ALL ON FUNCTION public.portal_record_body_composition(uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_record_body_composition(uuid,jsonb,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.portal_validate_payment_method() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.payment_method='Waived' AND NEW.amount_usd<>0 THEN RAISE EXCEPTION 'A waiver must have zero value' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER portal_payment_method BEFORE INSERT ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.portal_validate_payment_method();
REVOKE ALL ON FUNCTION public.portal_validate_payment_method() FROM PUBLIC,anon,authenticated;

-- A household collection is one transaction with a permanent batch receipt.
CREATE TABLE IF NOT EXISTS public.household_payment_batches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_key uuid NOT NULL UNIQUE,
 household_id uuid NOT NULL REFERENCES public.households(id),recorded_by uuid NOT NULL REFERENCES public.profiles(id),
 guardian_name text NOT NULL,payment_method text NOT NULL,external_reference text,
 receipt_number text NOT NULL UNIQUE DEFAULT ('FAMILY-'||replace(gen_random_uuid()::text,'-','')),
 request_payload jsonb NOT NULL,transactions jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS portal_family_external_reference ON public.household_payment_batches(payment_method,external_reference) WHERE external_reference IS NOT NULL;
ALTER TABLE public.household_payment_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY portal_family_payment_read ON public.household_payment_batches FOR SELECT TO authenticated USING(public.portal_has_permission('page:financials') OR public.portal_has_permission('action:finance_record_payment'));
REVOKE ALL ON public.household_payment_batches FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.household_payment_batches TO authenticated;
GRANT ALL ON public.household_payment_batches TO service_role;
CREATE TRIGGER portal_family_payment_immutable BEFORE UPDATE OR DELETE ON public.household_payment_batches FOR EACH ROW EXECUTE FUNCTION public.portal_immutable_transaction();
CREATE OR REPLACE FUNCTION public.portal_record_household_payment(p_actor uuid,p_household uuid,p_entries jsonb,p_method text,p_reference text,p_request_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE batch public.household_payment_batches; guardian text; entry record; collected jsonb; transactions jsonb:='[]'; payload jsonb; reference text;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:finance_record_payment');
 reference:=NULLIF(trim(p_reference),'');
 IF p_request_key IS NULL OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array' OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 50 OR p_method NOT IN ('Cash','Bank Transfer','Credit Card','ABA Bank KHQR') THEN RAISE EXCEPTION 'Invalid family payment' USING ERRCODE='22023'; END IF;
 IF p_method<>'Cash' AND (reference IS NULL OR length(reference) NOT BETWEEN 3 AND 100) THEN RAISE EXCEPTION 'Enter the verified bank or card payment reference' USING ERRCODE='22023'; END IF;
 IF (SELECT count(DISTINCT value->>'studentId') FROM jsonb_array_elements(p_entries))<>jsonb_array_length(p_entries) THEN RAISE EXCEPTION 'Choose one tuition month per student' USING ERRCODE='22023'; END IF;
 SELECT jsonb_agg(value ORDER BY value->>'studentId') INTO p_entries FROM jsonb_array_elements(p_entries);
 payload:=jsonb_build_object('householdId',p_household,'entries',p_entries,'method',p_method,'reference',reference);
 PERFORM pg_advisory_xact_lock(hashtextextended('family-payment:'||p_request_key::text,0));
 SELECT * INTO batch FROM public.household_payment_batches WHERE request_key=p_request_key;
 IF FOUND THEN
  IF batch.recorded_by<>p_actor OR batch.request_payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'Idempotency key mismatch' USING ERRCODE='22023'; END IF;
  RETURN to_jsonb(batch);
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_household::text,0));
 SELECT guardian_name INTO guardian FROM public.households WHERE id=p_household FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Household not found' USING ERRCODE='P0002'; END IF;
 FOR entry IN SELECT value AS data FROM jsonb_array_elements(p_entries) ORDER BY value->>'studentId' LOOP
  IF NOT EXISTS(SELECT 1 FROM public.household_students h JOIN public.students s ON s.id=h.student_id WHERE h.household_id=p_household AND h.student_id=entry.data->>'studentId' AND s.deleted_at IS NULL AND s.student_status='Active') THEN RAISE EXCEPTION 'A selected student is no longer active or linked to this household' USING ERRCODE='22023'; END IF;
  IF (entry.data->>'amount')::numeric<=0 THEN RAISE EXCEPTION 'Use the individual waiver workflow for zero tuition' USING ERRCODE='22023'; END IF;
  collected:=public.portal_record_payment(p_actor,entry.data->>'studentId',(entry.data->>'year')::integer,entry.data->>'month',(entry.data->>'amount')::numeric,p_method,md5('family:'||p_request_key::text||':'||(entry.data->>'studentId'))::uuid);
  collected:=collected||jsonb_build_object('student_name',(SELECT english_name FROM public.students WHERE id=entry.data->>'studentId'));
  transactions:=transactions||jsonb_build_array(collected);
 END LOOP;
 INSERT INTO public.household_payment_batches(request_key,household_id,recorded_by,guardian_name,payment_method,external_reference,request_payload,transactions) VALUES(p_request_key,p_household,p_actor,guardian,p_method,reference,payload,transactions) RETURNING * INTO batch;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('HOUSEHOLD_PAYMENT_RECORDED',p_actor::text,p_household::text,jsonb_build_object('batchId',batch.id,'receipt',batch.receipt_number,'students',jsonb_array_length(transactions)));
 RETURN to_jsonb(batch);
END $$;
REVOKE ALL ON FUNCTION public.portal_record_household_payment(uuid,uuid,jsonb,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_record_household_payment(uuid,uuid,jsonb,text,text,uuid) TO service_role;
-- Library and LMS records used to be saved separately, sometimes overwriting an
-- unrelated curriculum row with the same numeric ID. Keep existing mismatches
-- untouched and reject them for manual reconciliation.
ALTER TABLE public.library_assets ADD COLUMN IF NOT EXISTS request_key uuid;
ALTER TABLE public.library_assets ADD COLUMN IF NOT EXISTS request_payload jsonb;
ALTER TABLE public.library_assets ADD COLUMN IF NOT EXISTS created_by uuid;
CREATE UNIQUE INDEX IF NOT EXISTS portal_library_request ON public.library_assets(request_key) WHERE request_key IS NOT NULL;
INSERT INTO public.curriculum(id,title,target_belt,category,is_active)
 SELECT a.id,a.title,CASE WHEN a.library_type='Fitness' OR a.target_level IN ('All','Dance','Fitness') THEN 'White' ELSE a.target_level END,
 CASE WHEN a.tkd_category::text IN ('Demonstration','Tricking') THEN a.tkd_category::text ELSE 'Recognized Poomsae' END,true
 FROM public.library_assets a WHERE NOT EXISTS(SELECT 1 FROM public.curriculum c WHERE c.id=a.id);
SELECT setval(pg_get_serial_sequence('public.curriculum','id'),GREATEST(COALESCE((SELECT max(id) FROM public.curriculum),0),1),EXISTS(SELECT 1 FROM public.curriculum));
CREATE OR REPLACE FUNCTION public.portal_save_library_asset(p_actor uuid,p_action text,p_id integer,p_payload jsonb,p_request_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE asset public.library_assets; desired public.library_assets; mirrored public.curriculum; old_title text; relation jsonb; curriculum_category text; maximum_id integer;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 PERFORM pg_advisory_xact_lock(hashtextextended('library-curriculum-write',0));
 IF p_action NOT IN ('CREATE','UPDATE','DELETE') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid library request' USING ERRCODE='22023'; END IF;
 SELECT * INTO desired FROM jsonb_populate_record(NULL::public.library_assets,p_payload);
 IF p_action='CREATE' THEN
  IF p_request_key IS NULL THEN RAISE EXCEPTION 'Request key required' USING ERRCODE='22023'; END IF;
  SELECT * INTO asset FROM public.library_assets WHERE request_key=p_request_key;
  IF FOUND THEN
   IF asset.created_by IS DISTINCT FROM p_actor OR asset.request_payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Idempotency key mismatch' USING ERRCODE='22023'; END IF;
   RETURN jsonb_build_object('asset',to_jsonb(asset),'relations',COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM public.library_asset_muscles r WHERE asset_id=asset.id),'[]'::jsonb));
  END IF;
  SELECT GREATEST(COALESCE((SELECT max(id) FROM public.library_assets),0),COALESCE((SELECT max(id) FROM public.curriculum),0)) INTO maximum_id;
  PERFORM setval(pg_get_serial_sequence('public.library_assets','id'),GREATEST(maximum_id,1),maximum_id>0);
  INSERT INTO public.library_assets(title,description,library_type,tkd_category,fitness_category,target_level,video_url,request_key,request_payload,created_by)
  VALUES(desired.title,desired.description,desired.library_type,desired.tkd_category,desired.fitness_category,desired.target_level,desired.video_url,p_request_key,p_payload,p_actor) RETURNING * INTO asset;
 ELSE
  SELECT * INTO asset FROM public.library_assets WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Library asset not found' USING ERRCODE='P0002'; END IF;
  old_title:=asset.title;
  PERFORM 1 FROM public.curriculum WHERE id=p_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.curriculum WHERE id=p_id AND title<>old_title) THEN RAISE EXCEPTION 'Library/curriculum ID conflict. Reconcile these records before editing or deleting' USING ERRCODE='22023'; END IF;
  IF p_action='DELETE' THEN
   IF EXISTS(SELECT 1 FROM public.lms_progress WHERE curriculum_id=p_id) THEN RAISE EXCEPTION 'This asset has student progress and cannot be deleted' USING ERRCODE='22023'; END IF;
   DELETE FROM public.library_asset_muscles WHERE asset_id=p_id;
   DELETE FROM public.library_assets WHERE id=p_id;
   DELETE FROM public.curriculum WHERE id=p_id;
   INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LIBRARY_ASSET_DELETED',p_actor::text,p_id::text,'{}');
   RETURN jsonb_build_object('deleted',p_id);
  END IF;
  UPDATE public.library_assets SET title=desired.title,description=desired.description,library_type=desired.library_type,tkd_category=desired.tkd_category,fitness_category=desired.fitness_category,target_level=desired.target_level,video_url=desired.video_url WHERE id=p_id RETURNING * INTO asset;
 END IF;
 IF asset.title IS NULL OR trim(asset.title)='' OR asset.library_type NOT IN ('Fitness','Taekwondo') OR asset.target_level IS NULL OR trim(asset.target_level)='' THEN RAISE EXCEPTION 'Invalid library asset fields' USING ERRCODE='22023'; END IF;
 curriculum_category:=CASE WHEN asset.tkd_category::text IN ('Demonstration','Tricking') THEN asset.tkd_category::text ELSE 'Recognized Poomsae' END;
 SELECT * INTO mirrored FROM jsonb_populate_record(NULL::public.curriculum,jsonb_build_object('title',asset.title,'target_belt',CASE WHEN asset.library_type='Fitness' OR asset.target_level IN ('All','Dance','Fitness') THEN 'White' ELSE asset.target_level END,'category',curriculum_category));
 INSERT INTO public.curriculum(id,title,target_belt,category,is_active) VALUES(asset.id,mirrored.title,mirrored.target_belt,mirrored.category,true)
 ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,target_belt=EXCLUDED.target_belt,category=EXCLUDED.category;
 PERFORM setval(pg_get_serial_sequence('public.curriculum','id'),GREATEST(COALESCE((SELECT max(id) FROM public.curriculum),1),1),true);
 IF p_payload ? 'muscleRelations' THEN
  IF jsonb_typeof(p_payload->'muscleRelations') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'muscleRelations')>100 THEN RAISE EXCEPTION 'Invalid muscle relations' USING ERRCODE='22023'; END IF;
  DELETE FROM public.library_asset_muscles WHERE asset_id=asset.id;
  FOR relation IN SELECT value FROM jsonb_array_elements(p_payload->'muscleRelations') LOOP
   IF relation->>'role' NOT IN ('Primary','Secondary') OR NOT EXISTS(SELECT 1 FROM public.muscles WHERE id=(relation->>'muscleId')::integer) THEN RAISE EXCEPTION 'Invalid muscle relation' USING ERRCODE='22023'; END IF;
   INSERT INTO public.library_asset_muscles(asset_id,muscle_id,role) VALUES(asset.id,(relation->>'muscleId')::integer,relation->>'role');
  END LOOP;
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LIBRARY_ASSET_'||p_action,p_actor::text,asset.id::text,'{}');
 RETURN jsonb_build_object('asset',to_jsonb(asset),'relations',COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM public.library_asset_muscles r WHERE asset_id=asset.id),'[]'::jsonb));
END $$;
REVOKE INSERT,UPDATE,DELETE ON public.library_assets,public.library_asset_muscles,public.curriculum FROM authenticated;
REVOKE ALL ON FUNCTION public.portal_save_library_asset(uuid,text,integer,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_save_library_asset(uuid,text,integer,jsonb,uuid) TO service_role;

DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid='public.lms_progress'::regclass AND i.indisunique AND i.indisvalid AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indnkeyatts=2 AND i.indkey::smallint[] @> (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid='public.lms_progress'::regclass AND attname IN ('student_id','curriculum_id'))) THEN
 CREATE UNIQUE INDEX IF NOT EXISTS portal_lms_student_asset ON public.lms_progress(student_id,curriculum_id);
 END IF;
END $$;
REVOKE INSERT,UPDATE,DELETE ON public.lms_progress FROM authenticated;
CREATE OR REPLACE FUNCTION public.portal_set_video_progress(p_actor uuid,p_student text,p_asset integer,p_completed boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE asset public.library_assets; result public.lms_progress;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:evaluations_grade');
 SELECT * INTO asset FROM public.library_assets WHERE id=p_asset FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Library asset not found' USING ERRCODE='P0002'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.curriculum WHERE id=p_asset AND title=asset.title) THEN RAISE EXCEPTION 'Library/curriculum link needs reconciliation' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.students WHERE id=p_student AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Student not found or archived' USING ERRCODE='P0002'; END IF;
 IF p_completed THEN
  INSERT INTO public.lms_progress(student_id,curriculum_id,status,last_watched_at,completed_at) VALUES(p_student,p_asset,'Completed',now(),now())
  ON CONFLICT(student_id,curriculum_id) DO UPDATE SET status='Completed',last_watched_at=EXCLUDED.last_watched_at,completed_at=COALESCE(public.lms_progress.completed_at,EXCLUDED.completed_at) RETURNING * INTO result;
 ELSE
  UPDATE public.lms_progress SET status='Not Started',completed_at=NULL WHERE student_id=p_student AND curriculum_id=p_asset RETURNING * INTO result;
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('VIDEO_PROGRESS_UPDATED',p_actor::text,p_student,jsonb_build_object('assetId',p_asset,'completed',p_completed));
 RETURN COALESCE(to_jsonb(result),jsonb_build_object('student_id',p_student,'curriculum_id',p_asset));
END $$;
REVOKE ALL ON FUNCTION public.portal_set_video_progress(uuid,text,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_set_video_progress(uuid,text,integer,boolean) TO service_role;



-- 20261011090000_portal_live_schema_hardening.sql

-- Preserve historical staff/member records when a role changes. Provisioning
-- fills this automatically created member row with the supplied staff details.
CREATE OR REPLACE FUNCTION public.sync_profile_to_members() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.role IN ('Root','Super Root','Admin','Head Coach','Coach','Assistant Coach') THEN
 INSERT INTO public.members(id) VALUES(NEW.id) ON CONFLICT(id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;

-- Explicit links only. Matching contact email/username must never transfer an
-- account or silently attach an existing student to a different identity.
CREATE OR REPLACE FUNCTION public.fn_sync_profile_student_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF pg_trigger_depth()>1 THEN RETURN NEW; END IF;
 IF NEW.role<>'Student' AND NEW.student_id IS NOT NULL THEN
 RAISE EXCEPTION 'Only Student accounts can link a student record' USING ERRCODE='22023'; END IF;
 IF TG_OP='UPDATE' AND OLD.student_id IS NOT NULL AND OLD.student_id IS DISTINCT FROM NEW.student_id THEN
 UPDATE public.students SET profile_id=NULL WHERE id=OLD.student_id AND profile_id=NEW.id;
 END IF;
 IF NEW.student_id IS NOT NULL THEN
 PERFORM 1 FROM public.students WHERE id=NEW.student_id AND deleted_at IS NULL AND (profile_id IS NULL OR profile_id=NEW.id) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student is missing or already linked' USING ERRCODE='22023'; END IF;
 UPDATE public.students SET profile_id=NEW.id WHERE id=NEW.student_id AND profile_id IS DISTINCT FROM NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.fn_sync_student_profile_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF pg_trigger_depth()>1 THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.profile_id IS NOT NULL AND OLD.profile_id IS DISTINCT FROM NEW.profile_id THEN
 UPDATE public.profiles SET student_id=NULL WHERE id=OLD.profile_id AND student_id=NEW.id;
 END IF;
 IF NEW.profile_id IS NOT NULL THEN
 PERFORM 1 FROM public.profiles WHERE id=NEW.profile_id AND role='Student' AND (student_id IS NULL OR student_id=NEW.id) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile is not an available Student account' USING ERRCODE='22023'; END IF;
 UPDATE public.profiles SET student_id=NEW.id WHERE id=NEW.profile_id AND student_id IS DISTINCT FROM NEW.id;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_profile_student_link ON public.profiles;
DROP TRIGGER IF EXISTS trg_sync_student_profile_link ON public.students;
CREATE TRIGGER trg_sync_profile_student_link AFTER INSERT OR UPDATE OF student_id,username,email,role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_sync_profile_student_link();
CREATE TRIGGER trg_sync_student_profile_link AFTER INSERT OR UPDATE OF profile_id,email ON public.students FOR EACH ROW EXECUTE FUNCTION public.fn_sync_student_profile_link();
DROP TRIGGER IF EXISTS trigger_sync_profile_to_members ON public.profiles;
CREATE TRIGGER trigger_sync_profile_to_members AFTER INSERT OR UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_members();
-- The old INSERT-only trigger overwrites a backdated promotion's correct belt.
DROP TRIGGER IF EXISTS trg_update_student_belt ON public.belt_histories;

-- Legacy policy helpers must also consult the current account, not stale JWTs.
CREATE OR REPLACE FUNCTION public.is_own_student_record(student_id_param varchar) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT public.is_current_student(student_id_param::text) $$;
CREATE OR REPLACE FUNCTION public.is_admin_or_root() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT public.auth_is_active() AND public.auth_role() IN ('Root','Super Root','Admin') $$;
CREATE OR REPLACE FUNCTION public.is_elevated_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT public.auth_is_active() AND public.auth_role() IN ('Root','Super Root','Admin','Head Coach') $$;
CREATE OR REPLACE FUNCTION public.is_coach_or_above() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT public.is_dojo_staff() AND public.auth_role()<>'Assistant Coach' $$;
CREATE OR REPLACE FUNCTION public.check_user_role(required_roles text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT public.auth_is_active() AND public.auth_role()=ANY(required_roles) $$;

-- Use caller permissions for views; table RLS then applies to all five live views.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT c.oid::regclass AS relation FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v' LOOP
 EXECUTE format('ALTER VIEW %s SET (security_invoker=true)',r.relation);
 END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature,p.proname,p.prosecdef,p.prorettype FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e') LOOP
 IF f.prosecdef OR f.prorettype='trigger'::regtype THEN
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 IF f.proname IN ('auth_role','auth_is_active','is_current_student','is_dojo_staff','portal_has_permission','is_own_student_record','is_admin_or_root','is_elevated_staff','is_coach_or_above','check_user_role') THEN
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
 END IF;
 END IF;
 END LOOP;
 -- Preserve legacy unqualified references with a fixed trusted search path.
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
 WHERE n.nspname='public' AND l.lanname='plpgsql' AND NOT EXISTS(SELECT 1 FROM unnest(COALESCE(p.proconfig,ARRAY[]::text[])) setting WHERE setting LIKE 'search_path=%') LOOP
 EXECUTE format('ALTER FUNCTION %s SET search_path=pg_catalog,public,pg_temp',f.signature);
 END LOOP;
END $$;

-- One primary address per person. Unique keys already present are reused.
CREATE UNIQUE INDEX IF NOT EXISTS portal_student_primary_address ON public.student_addresses(student_id) WHERE is_primary=true;
CREATE UNIQUE INDEX IF NOT EXISTS portal_member_primary_address ON public.member_addresses(member_id) WHERE is_primary=true;
DO $$ DECLARE spec record; columns smallint[]; BEGIN
 FOR spec IN SELECT * FROM (VALUES
 ('payments',ARRAY['student_id','year','for_month'],'portal_unique_billing_month'),
 ('class_enrollments',ARRAY['student_id','class_id'],'portal_unique_enrollment'),
 ('lms_progress',ARRAY['student_id','curriculum_id'],'portal_lms_student_asset'),
 ('student_physical_evaluations',ARRAY['student_id','skill_name'],'portal_unique_student_skill')
 ) AS keys(table_name,column_names,index_name) LOOP
 SELECT array_agg(a.attnum ORDER BY array_position(spec.column_names,a.attname::text)) INTO columns FROM pg_attribute a WHERE a.attrelid=('public.'||spec.table_name)::regclass AND a.attname::text=ANY(spec.column_names);
 IF NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=('public.'||spec.table_name)::regclass AND i.indisunique AND i.indisvalid AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indnkeyatts=cardinality(columns) AND (i.indkey::smallint[]) @> columns) THEN
 EXECUTE format('CREATE UNIQUE INDEX %I ON public.%I(%s)',spec.index_name,spec.table_name,(SELECT string_agg(quote_ident(x),',') FROM unnest(spec.column_names) x));
 END IF;
 END LOOP;
END $$;

-- Remove only proven identical legacy indexes; retain constraint-owned indexes.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT c.oid,c.conname FROM pg_constraint c WHERE c.conrelid='public.lms_progress'::regclass AND c.conname='unique_student_curriculum' AND c.contype='u'
 AND EXISTS(SELECT 1 FROM pg_constraint keep WHERE keep.conrelid=c.conrelid AND keep.conname='lms_progress_student_curriculum_unique' AND keep.contype='u' AND keep.conkey=c.conkey) LOOP
 EXECUTE format('ALTER TABLE public.lms_progress DROP CONSTRAINT %I',r.conname);
 END LOOP;
 FOR r IN SELECT i.indexrelid::regclass AS relation FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
 WHERE c.relnamespace='public'::regnamespace AND c.relname IN ('idx_inventory_logs_product','idx_students_profile_fk','idx_students_profile_id','idx_payments_composite_search')
 AND NOT i.indisunique AND NOT EXISTS(SELECT 1 FROM pg_constraint con WHERE con.conindid=i.indexrelid)
 AND EXISTS(SELECT 1 FROM pg_index keep JOIN pg_class kc ON kc.oid=keep.indexrelid
 WHERE keep.indrelid=i.indrelid AND keep.indexrelid<>i.indexrelid AND keep.indisvalid AND kc.relam=c.relam
 AND keep.indkey=i.indkey AND keep.indclass=i.indclass AND keep.indcollation=i.indcollation AND keep.indoption=i.indoption
 AND keep.indpred IS NOT DISTINCT FROM i.indpred AND keep.indexprs IS NOT DISTINCT FROM i.indexprs
 AND (keep.indisunique OR kc.relname='idx_inventory_logs_prod')) LOOP
 EXECUTE format('DROP INDEX %s',r.relation);
 END LOOP;
END $$;

-- Foreign keys do not automatically index their referencing columns. Add only
-- missing full indexes; existing leading-key indexes already cover lookups.
DO $$ DECLARE f record; column_names text; BEGIN
 FOR f IN SELECT c.oid,c.conrelid,c.conkey,c.conname,t.relname FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
 WHERE c.contype='f' AND n.nspname='public' LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=f.conrelid AND i.indisvalid AND i.indpred IS NULL AND i.indexprs IS NULL AND (i.indkey::smallint[])[0:cardinality(f.conkey)-1] @> f.conkey) THEN
 SELECT string_agg(quote_ident(a.attname),',' ORDER BY k.ordinality) INTO column_names FROM unnest(f.conkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_attribute a ON a.attrelid=f.conrelid AND a.attnum=k.attnum;
 EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(%s)','portal_fk_'||substr(md5(f.relname||':'||f.conname),1,16),f.relname,column_names);
 END IF;
 END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS portal_payment_date ON public.payments(payment_date) WHERE payment_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS portal_transaction_month ON public.payment_transactions(student_id,year,for_month);
CREATE INDEX IF NOT EXISTS portal_audit_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS portal_body_latest ON public.student_body_compositions(student_id,recorded_date DESC,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS portal_rate_limit_expiry ON public.portal_rate_limits(expires_at);

-- Existing missing payment dates are retained for reconciliation. Do not invent
-- dates or receipts; reject new settled payments lacking a verified date.
ALTER TABLE public.payments ADD CONSTRAINT portal_settled_payment_date CHECK(status NOT IN ('Paid','Waived') OR payment_date IS NOT NULL) NOT VALID;
ALTER TABLE public.payments ADD CONSTRAINT portal_waiver_amount CHECK(status<>'Waived' OR amount_usd=0) NOT VALID;
ALTER TABLE public.payments ADD CONSTRAINT portal_money_precision CHECK(amount_usd::text NOT IN ('NaN','Infinity','-Infinity') AND amount_usd=round(amount_usd,2)) NOT VALID;
ALTER TABLE public.student_body_compositions ADD CONSTRAINT portal_measurement_values CHECK(height_cm>0 AND height_cm<=300 AND weight_kg>0 AND weight_kg<=600 AND (body_fat_percentage IS NULL OR body_fat_percentage BETWEEN 0 AND 100)) NOT VALID;
ALTER TABLE public.academy_profile ADD CONSTRAINT portal_academy_bounds CHECK(tuition_grace_period_days BETWEEN 0 AND 365 AND tax_rate_percentage BETWEEN 0 AND 100 AND default_class_duration_mins BETWEEN 15 AND 480 AND exam_passing_score BETWEEN 0 AND 100 AND min_attendance_exam_pct BETWEEN 0 AND 100) NOT VALID;

-- Avoid evaluating the current auth identity once for every row.
DO $$ DECLARE p record; expression text; BEGIN
 FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' AND (COALESCE(qual,'') LIKE '%auth.uid()%' OR COALESCE(with_check,'') LIKE '%auth.uid()%') LOOP
 IF p.qual IS NOT NULL THEN
 expression:=replace(p.qual,'auth.uid()','(SELECT auth.uid())');
 EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)',p.policyname,p.tablename,expression);
 END IF;
 IF p.with_check IS NOT NULL THEN
 expression:=replace(p.with_check,'auth.uid()','(SELECT auth.uid())');
 EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)',p.policyname,p.tablename,expression);
 END IF;
 END LOOP;
END $$;


-- 20261011090100_portal_policy_optimization.sql

-- Split ALL into equivalent commands, then combine permissive predicates with OR.
-- No grants or predicates are broadened: this preserves PostgreSQL's existing
-- permissive-policy semantics and avoids evaluating separate read policies.
DO $$ DECLARE p record; command text; predicate text; check_predicate text; role_list text; BEGIN
 FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' AND permissive='PERMISSIVE' AND cmd='ALL' LOOP
 SELECT string_agg(CASE WHEN x='public' THEN 'PUBLIC' ELSE quote_ident(x) END,',') INTO role_list FROM unnest(p.roles) x;
 EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);
 FOREACH command IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
 predicate:=COALESCE(p.qual,'true');
 check_predicate:=COALESCE(p.with_check,p.qual,'true');
 EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO %s%s%s',
 'portal_split_'||substr(md5(p.tablename||':'||p.policyname),1,12)||'_'||lower(command),p.tablename,command,role_list,
 CASE WHEN command IN ('SELECT','UPDATE','DELETE') THEN ' USING ('||predicate||')' ELSE '' END,
 CASE WHEN command IN ('INSERT','UPDATE') THEN ' WITH CHECK ('||check_predicate||')' ELSE '' END);
 END LOOP;
 END LOOP;
 FOR p IN SELECT tablename,cmd,roles,array_agg(policyname) names,
 string_agg('('||COALESCE(qual,'true')||')',' OR ') AS read_expression,
 string_agg('('||COALESCE(with_check,qual,'true')||')',' OR ') AS check_expression
 FROM pg_policies WHERE schemaname='public' AND permissive='PERMISSIVE'
 GROUP BY tablename,cmd,roles HAVING count(*)>1 LOOP
 SELECT string_agg(CASE WHEN x='public' THEN 'PUBLIC' ELSE quote_ident(x) END,',') INTO role_list FROM unnest(p.roles) x;
 FOREACH command IN ARRAY p.names LOOP EXECUTE format('DROP POLICY %I ON public.%I',command,p.tablename); END LOOP;
 EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO %s%s%s',
 'portal_combined_'||lower(p.cmd)||'_'||substr(md5(p.roles::text),1,8),p.tablename,p.cmd,role_list,
 CASE WHEN p.cmd IN ('SELECT','UPDATE','DELETE') THEN ' USING ('||p.read_expression||')' ELSE '' END,
 CASE WHEN p.cmd IN ('INSERT','UPDATE') THEN ' WITH CHECK ('||p.check_expression||')' ELSE '' END);
 END LOOP;
END $$;


-- 20261011090200_portal_validate_existing_records.sql

-- Validate rules against existing records where reconciliation is not needed.
-- The settled-payment-date rule remains NOT VALID until historical dates are verified.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT c.conname,c.conrelid::regclass AS relation FROM pg_constraint c
 WHERE c.connamespace='public'::regnamespace AND NOT c.convalidated
 AND c.conname IN ('portal_partner_dates','portal_waiver_amount','portal_payment_status','portal_money_precision','portal_measurement_values','portal_academy_bounds') LOOP
 EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I',r.relation,r.conname);
 END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
