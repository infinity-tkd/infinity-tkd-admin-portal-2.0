-- Apply after the existing migrations, first on a staging copy. This migration is atomic.
BEGIN;
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
COMMIT;
