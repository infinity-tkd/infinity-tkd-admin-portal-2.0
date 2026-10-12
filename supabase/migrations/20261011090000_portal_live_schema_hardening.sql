BEGIN;

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
COMMIT;
