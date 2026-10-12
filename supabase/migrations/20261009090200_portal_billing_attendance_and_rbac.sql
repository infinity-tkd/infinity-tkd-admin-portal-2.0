BEGIN;
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
COMMIT;
