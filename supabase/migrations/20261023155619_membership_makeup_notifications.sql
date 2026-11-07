BEGIN;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS membership_start_date date;
UPDATE public.students s SET membership_start_date=COALESCE((SELECT min(e.enrollment_date) FROM public.class_enrollments e WHERE e.student_id=s.id),s.registration_date) WHERE s.membership_start_date IS NULL AND EXISTS(SELECT 1 FROM public.class_enrollments e WHERE e.student_id=s.id);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS billing_schedule jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(billing_schedule)='array');
CREATE TABLE IF NOT EXISTS public.membership_schedule_changes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id varchar NOT NULL REFERENCES public.students(id), previous_day int NOT NULL CHECK(previous_day BETWEEN 1 AND 31), new_day int NOT NULL CHECK(new_day BETWEEN 1 AND 31), effective_month date NOT NULL CHECK(extract(day from effective_month)=1), reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 500), changed_by uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(), request_key uuid NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS membership_schedule_student ON public.membership_schedule_changes(student_id,effective_month DESC,created_at DESC);
CREATE TABLE IF NOT EXISTS public.makeup_attendance (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id varchar NOT NULL REFERENCES public.students(id),source_class_id int NOT NULL REFERENCES public.class_sessions(id),source_date date NOT NULL,attended_date date NOT NULL,target_class_id int REFERENCES public.class_sessions(id),status text NOT NULL CHECK(status IN ('Present','Late')),source_status text NOT NULL CHECK(source_status IN ('Absent','Unmarked')),reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 500),marked_by uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now(),voided_at timestamptz,voided_by uuid REFERENCES public.profiles(id),void_reason text,request_key uuid NOT NULL UNIQUE,CHECK(attended_date>=source_date),CHECK((voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL) OR (voided_at IS NOT NULL AND voided_by IS NOT NULL AND length(trim(void_reason))>=5))
);
CREATE UNIQUE INDEX IF NOT EXISTS makeup_one_source ON public.makeup_attendance(student_id,source_class_id,source_date) WHERE voided_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS makeup_one_target ON public.makeup_attendance(student_id,attended_date,COALESCE(target_class_id,0)) WHERE voided_at IS NULL;
CREATE TABLE IF NOT EXISTS public.portal_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,source_key text NOT NULL,category text NOT NULL CHECK(category IN ('attendance','billing','orders','system')),title text NOT NULL,body text NOT NULL,href text NOT NULL CHECK(href ~ '^/[^/]'),permission_key text,read_at timestamptz,dismissed_at timestamptz,resolved_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,source_key)
);
CREATE INDEX IF NOT EXISTS portal_notifications_inbox ON public.portal_notifications(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.portal_notification_preferences (user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,push_enabled boolean NOT NULL DEFAULT false,muted_categories text[] NOT NULL DEFAULT '{}',quiet_start int NOT NULL DEFAULT 22 CHECK(quiet_start BETWEEN 0 AND 23),quiet_end int NOT NULL DEFAULT 7 CHECK(quiet_end BETWEEN 0 AND 23),updated_at timestamptz NOT NULL DEFAULT now(),CHECK(muted_categories <@ ARRAY['attendance','billing','orders','system']::text[]));
CREATE TABLE IF NOT EXISTS public.portal_push_subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,endpoint text NOT NULL UNIQUE,keys jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS portal_push_user ON public.portal_push_subscriptions(user_id);
CREATE TABLE IF NOT EXISTS public.portal_push_deliveries (notification_id uuid NOT NULL REFERENCES public.portal_notifications(id) ON DELETE CASCADE,subscription_id uuid NOT NULL REFERENCES public.portal_push_subscriptions(id) ON DELETE CASCADE,attempts int NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),lease_until timestamptz,sent_at timestamptz,dead_at timestamptz,last_error_code int,PRIMARY KEY(notification_id,subscription_id));
CREATE TABLE IF NOT EXISTS public.portal_notification_refresh (user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,refreshed_at timestamptz NOT NULL DEFAULT now());
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['membership_schedule_changes','makeup_attendance','portal_notifications','portal_notification_preferences','portal_push_subscriptions','portal_push_deliveries','portal_notification_refresh'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
GRANT SELECT ON public.membership_schedule_changes,public.makeup_attendance,public.portal_notifications,public.portal_notification_preferences TO authenticated;
CREATE POLICY membership_history_read ON public.membership_schedule_changes FOR SELECT TO authenticated USING(public.auth_is_active() AND (public.is_current_student(student_id::text) OR public.portal_has_permission('page:attendance') OR public.portal_has_permission('page:financials')));
CREATE POLICY makeup_read ON public.makeup_attendance FOR SELECT TO authenticated USING(public.auth_is_active() AND (public.is_current_student(student_id::text) OR public.portal_has_permission('page:attendance')));
CREATE POLICY notification_own_read ON public.portal_notifications FOR SELECT TO authenticated USING(public.auth_is_active() AND user_id=(select auth.uid()) AND (permission_key IS NULL OR public.portal_has_permission(permission_key)));
CREATE POLICY notification_preferences_read ON public.portal_notification_preferences FOR SELECT TO authenticated USING(public.auth_is_active() AND user_id=(select auth.uid()));
CREATE TRIGGER membership_history_immutable BEFORE UPDATE OR DELETE ON public.membership_schedule_changes FOR EACH ROW EXECUTE FUNCTION public.portal_immutable_transaction();
CREATE OR REPLACE FUNCTION public.portal_guard_billing_schedule() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF (NEW.billing_schedule IS DISTINCT FROM OLD.billing_schedule OR NEW.membership_start_date IS DISTINCT FROM OLD.membership_start_date) AND current_setting('portal.billing_write',true) IS DISTINCT FROM 'allowed' THEN RAISE EXCEPTION 'Use the audited membership schedule action' USING ERRCODE='42501'; END IF; RETURN NEW; END $$;
CREATE TRIGGER portal_billing_schedule_guard BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.portal_guard_billing_schedule();
CREATE OR REPLACE FUNCTION public.portal_change_billing_schedule(p_actor uuid,p_student_id text,p_day int,p_effective_month date,p_reason text,p_expected_version text,p_request_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.students; h public.membership_schedule_changes; base date; old_day int; entry jsonb; today date:=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:finance_record_payment');
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role IN ('Root','Super Root','Admin')) THEN RAISE EXCEPTION 'Only administrators can change billing dates' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.students WHERE id=p_student_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student not found' USING ERRCODE='P0002'; END IF;
 SELECT * INTO h FROM public.membership_schedule_changes WHERE request_key=p_request_key;
 IF FOUND THEN IF h.student_id<>p_student_id OR h.changed_by<>p_actor OR h.new_day<>p_day OR h.effective_month<>p_effective_month OR h.reason<>trim(p_reason) THEN RAISE EXCEPTION 'Request key mismatch' USING ERRCODE='22023'; END IF; RETURN to_jsonb(h); END IF;
 IF p_day IS NULL OR p_day NOT BETWEEN 1 AND 31 OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 5 AND 500 OR p_request_key IS NULL OR p_effective_month IS NULL OR extract(day from p_effective_month)<>1 OR p_effective_month<date_trunc('month',today)::date OR p_effective_month>(date_trunc('month',today)+interval '24 months')::date THEN RAISE EXCEPTION 'Choose a day, reason and current or future billing month' USING ERRCODE='22023'; END IF;
 IF COALESCE(s.billing_schedule->-1->>'id','') IS DISTINCT FROM COALESCE(p_expected_version,'') THEN RAISE EXCEPTION 'Billing schedule changed. Reload before saving' USING ERRCODE='40001'; END IF;
 SELECT COALESCE(s.membership_start_date,min(enrollment_date),s.registration_date) INTO base FROM public.class_enrollments WHERE student_id=p_student_id;
 SELECT (x->>'day')::int INTO old_day FROM jsonb_array_elements(s.billing_schedule) x WHERE (x->>'effectiveMonth')::date<=p_effective_month ORDER BY x->>'effectiveMonth' DESC,x->>'changedAt' DESC LIMIT 1;
 old_day:=COALESCE(old_day,extract(day from base)::int);
 INSERT INTO public.membership_schedule_changes(student_id,previous_day,new_day,effective_month,reason,changed_by,request_key) VALUES(p_student_id,old_day,p_day,p_effective_month,trim(p_reason),p_actor,p_request_key) RETURNING * INTO h;
 entry:=jsonb_build_object('id',h.id,'day',p_day,'previousDay',old_day,'effectiveMonth',p_effective_month,'reason',trim(p_reason),'changedBy',p_actor,'changedAt',h.created_at);
 PERFORM set_config('portal.billing_write','allowed',true);
 UPDATE public.students SET billing_schedule=billing_schedule||jsonb_build_array(entry),updated_at=now() WHERE id=p_student_id;
 PERFORM set_config('portal.billing_write','',true);
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('MEMBERSHIP_BILLING_DATE_CHANGED',p_actor::text,p_student_id,entry);
 RETURN to_jsonb(h);
END $$;
CREATE OR REPLACE FUNCTION public.portal_record_makeup(p_actor uuid,p_student_id text,p_source_class int,p_source_date date,p_attended_date date,p_target_class int,p_status text,p_reason text,p_request_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.students; c public.class_sessions; e public.class_enrollments; m public.makeup_attendance; original_status text; ended timestamptz; today date:=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:attendance_mark');
 SELECT * INTO s FROM public.students WHERE id=p_student_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR s.student_status<>'Active' THEN RAISE EXCEPTION 'An active student is required' USING ERRCODE='22023'; END IF;
 SELECT * INTO m FROM public.makeup_attendance WHERE request_key=p_request_key;
 IF FOUND THEN IF m.student_id<>p_student_id OR m.source_class_id<>p_source_class OR m.source_date<>p_source_date OR m.attended_date<>p_attended_date OR m.target_class_id IS DISTINCT FROM p_target_class OR m.status<>p_status OR m.reason<>trim(p_reason) OR m.marked_by<>p_actor THEN RAISE EXCEPTION 'Request key mismatch' USING ERRCODE='22023'; END IF; RETURN to_jsonb(m); END IF;
 SELECT * INTO c FROM public.class_sessions WHERE id=p_source_class;
 SELECT * INTO e FROM public.class_enrollments WHERE student_id=p_student_id AND class_id=p_source_class;
 IF c.id IS NULL OR e.id IS NULL OR p_source_date<GREATEST(s.registration_date,COALESCE(e.enrollment_date,s.registration_date)) OR NOT(trim(to_char(p_source_date,'Day'))=ANY(CASE WHEN cardinality(c.days_of_week)>0 THEN c.days_of_week ELSE ARRAY[c.day_of_week::text] END)) THEN RAISE EXCEPTION 'The source must be an enrolled scheduled class' USING ERRCODE='22023'; END IF;
 ended:=((p_source_date+CASE WHEN c.end_time<=c.start_time THEN 1 ELSE 0 END)+c.end_time) AT TIME ZONE 'Asia/Phnom_Penh';
 IF ended+interval '30 minutes'>now() OR p_attended_date>today OR p_attended_date<p_source_date OR p_status NOT IN ('Present','Late') OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 5 AND 500 OR p_request_key IS NULL OR p_source_date IS NULL OR p_attended_date IS NULL OR p_status IS NULL THEN RAISE EXCEPTION 'Choose a completed source class, attendance date and reason' USING ERRCODE='22023'; END IF;
 SELECT status INTO original_status FROM public.attendance WHERE student_id=p_student_id AND class_id=p_source_class AND date=p_source_date FOR UPDATE;
 IF original_status IN ('Present','Late') THEN RAISE EXCEPTION 'The original class already has attendance' USING ERRCODE='22023'; END IF;
 INSERT INTO public.makeup_attendance(student_id,source_class_id,source_date,attended_date,target_class_id,status,source_status,reason,marked_by,request_key) VALUES(p_student_id,p_source_class,p_source_date,p_attended_date,p_target_class,p_status,COALESCE(original_status,'Unmarked'),trim(p_reason),p_actor,p_request_key) RETURNING * INTO m;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('MAKEUP_ATTENDANCE_RECORDED',p_actor::text,p_student_id,to_jsonb(m)); RETURN to_jsonb(m);
END $$;
CREATE OR REPLACE FUNCTION public.portal_void_makeup(p_actor uuid,p_id uuid,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE m public.makeup_attendance; BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:attendance_delete');
 IF p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'A correction reason is required' USING ERRCODE='22023'; END IF;
 SELECT * INTO m FROM public.makeup_attendance WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Makeup record not found' USING ERRCODE='P0002'; END IF;
 IF m.voided_at IS NOT NULL THEN RETURN to_jsonb(m); END IF;
 UPDATE public.makeup_attendance SET voided_at=now(),voided_by=p_actor,void_reason=trim(p_reason) WHERE id=p_id RETURNING * INTO m;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('MAKEUP_ATTENDANCE_VOIDED',p_actor::text,m.student_id,to_jsonb(m));RETURN to_jsonb(m);END $$;
CREATE OR REPLACE FUNCTION public.portal_guard_makeup_source() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM 1 FROM public.students WHERE id=NEW.student_id FOR UPDATE;
 IF NEW.status IN ('Present','Late') AND EXISTS(SELECT 1 FROM public.makeup_attendance WHERE student_id=NEW.student_id AND source_class_id=NEW.class_id AND source_date=NEW.date AND voided_at IS NULL) THEN RAISE EXCEPTION 'Void the linked makeup before changing the original attendance' USING ERRCODE='22023'; END IF; RETURN NEW; END $$;
CREATE TRIGGER portal_makeup_source_guard BEFORE INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.portal_guard_makeup_source();
CREATE OR REPLACE FUNCTION public.portal_claim_notification_refresh(p_user uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE claimed uuid; BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 INSERT INTO public.portal_notification_refresh(user_id,refreshed_at) VALUES(p_user,now()) ON CONFLICT(user_id) DO UPDATE SET refreshed_at=now() WHERE public.portal_notification_refresh.refreshed_at<now()-interval '5 minutes' RETURNING user_id INTO claimed; RETURN claimed IS NOT NULL; END $$;
CREATE OR REPLACE FUNCTION public.portal_claim_push(p_notification uuid,p_subscription uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE claimed uuid; BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 INSERT INTO public.portal_push_deliveries(notification_id,subscription_id) SELECT p_notification,p_subscription WHERE EXISTS(SELECT 1 FROM public.portal_notifications n JOIN public.portal_push_subscriptions s ON s.user_id=n.user_id WHERE n.id=p_notification AND s.id=p_subscription AND n.read_at IS NULL AND n.dismissed_at IS NULL AND n.resolved_at IS NULL) ON CONFLICT DO NOTHING;
 UPDATE public.portal_push_deliveries SET lease_until=now()+interval '2 minutes',attempts=attempts+1 WHERE notification_id=p_notification AND subscription_id=p_subscription AND sent_at IS NULL AND dead_at IS NULL AND attempts<5 AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now()) AND EXISTS(SELECT 1 FROM public.portal_notifications n JOIN public.portal_push_subscriptions s ON s.user_id=n.user_id WHERE n.id=p_notification AND s.id=p_subscription AND n.read_at IS NULL AND n.dismissed_at IS NULL AND n.resolved_at IS NULL) RETURNING notification_id INTO claimed; RETURN claimed IS NOT NULL; END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('portal_change_billing_schedule','portal_record_makeup','portal_void_makeup','portal_claim_notification_refresh','portal_claim_push','portal_guard_billing_schedule','portal_guard_makeup_source') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',r.signature); IF r.signature::text NOT LIKE '%guard%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',r.signature); END IF; END LOOP; END $$;

CREATE OR REPLACE FUNCTION public.portal_anchor_first_enrollment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM set_config('portal.billing_write','allowed',true);
 UPDATE public.students SET membership_start_date=COALESCE(NEW.enrollment_date,(NEW.enrolled_at AT TIME ZONE 'Asia/Phnom_Penh')::date),updated_at=now() WHERE id=NEW.student_id AND membership_start_date IS NULL;
 PERFORM set_config('portal.billing_write','',true);RETURN NEW;END $$;
CREATE TRIGGER portal_first_membership_enrollment AFTER INSERT ON public.class_enrollments FOR EACH ROW EXECUTE FUNCTION public.portal_anchor_first_enrollment();
REVOKE ALL ON FUNCTION public.portal_anchor_first_enrollment() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.portal_notify_order_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE student_user uuid; key text; BEGIN
 IF TG_OP='UPDATE' AND NEW.order_status IS NOT DISTINCT FROM OLD.order_status AND NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status THEN RETURN NEW; END IF;
 key:='orders:'||NEW.id||':'||NEW.order_status||':'||NEW.payment_status;
 SELECT profile_id INTO student_user FROM public.students WHERE id=NEW.student_id;
 IF student_user IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=student_user AND is_active AND NOT must_change_password) THEN
 INSERT INTO public.portal_notifications(user_id,source_key,category,title,body,href) VALUES(student_user,key,'orders','Your order has an update','Order '||NEW.order_number||': '||replace(NEW.order_status,'_',' ')||'. Payment: '||NEW.payment_status||'.','/pro-shop') ON CONFLICT(user_id,source_key) DO NOTHING;
 END IF;
 IF NEW.order_channel='STUDENT_PORTAL' AND NEW.order_status='PENDING_CONFIRMATION' THEN
 INSERT INTO public.portal_notifications(user_id,source_key,category,title,body,href,permission_key)
 SELECT p.id,key,'orders','New student order','Order '||NEW.order_number||' needs confirmation. Check stock and payment before fulfillment.','/pos','page:pos' FROM public.profiles p WHERE p.is_active AND NOT p.must_change_password AND p.role<>'Student' AND (p.role IN ('Root','Super Root') OR COALESCE((SELECT is_granted FROM public.user_permissions WHERE user_id=p.id AND permission_key='page:pos'),(SELECT is_granted FROM public.role_permissions WHERE role=p.role AND permission_key='page:pos'),false)) ON CONFLICT(user_id,source_key) DO NOTHING;
 ELSE UPDATE public.portal_notifications SET resolved_at=now() WHERE source_key LIKE 'orders:'||NEW.id||':%' AND permission_key='page:pos' AND resolved_at IS NULL;
 END IF; RETURN NEW;END $$;
CREATE TRIGGER portal_order_notifications AFTER INSERT OR UPDATE OF order_status,payment_status ON public.pos_orders FOR EACH ROW EXECUTE FUNCTION public.portal_notify_order_event();
REVOKE ALL ON FUNCTION public.portal_notify_order_event() FROM PUBLIC,anon,authenticated;
COMMIT;
