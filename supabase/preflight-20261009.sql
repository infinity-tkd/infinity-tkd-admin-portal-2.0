-- Read-only checks for an existing Infinity TKD installation. Run before upgrading.
DO $$
DECLARE missing text; major integer;
BEGIN
 major:=current_setting('server_version_num')::integer;
 IF major<150000 THEN RAISE EXCEPTION 'PostgreSQL 15+ is required for class attendance uniqueness and security-invoker views'; END IF;
 SELECT string_agg(name,', ') INTO missing FROM unnest(ARRAY[
 'profiles','role_permissions','user_permissions','students','student_addresses',
 'members','member_addresses','class_sessions','class_enrollments','attendance',
 'payments','scholarships','academy_profile','products','product_variants',
 'pos_orders','pos_order_items','inventory_logs','audit_logs','partners','library_assets','curriculum','library_asset_muscles','muscles','lms_progress','student_body_compositions'
 ]) AS t(name) WHERE to_regclass('public.'||name) IS NULL;
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'Existing baseline tables are missing: %',missing; END IF;
 SELECT string_agg(name,', ') INTO missing FROM unnest(ARRAY['collaboration_scope','benefits_summary','contact_name','telegram_link','secondary_contact_name','secondary_contact_phone','secondary_contact_telegram','website_url','address','contract_document_url','notes','created_by']) AS t(name)
 WHERE NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='partners' AND column_name=name);
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'Partner CRM columns are missing: %. Apply the existing partner schema alignment migration on staging first',missing; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE role IN ('Root','Super Root') AND is_active) THEN
 RAISE EXCEPTION 'No active Root account. Provision and verify an existing trusted Root before upgrading'; END IF;
 IF EXISTS(SELECT 1 FROM public.product_variants WHERE stock<0) OR EXISTS(SELECT 1 FROM public.products WHERE stock<0) THEN
 RAISE EXCEPTION 'Negative inventory requires reconciliation before upgrading'; END IF;
 IF EXISTS(SELECT 1 FROM public.payments GROUP BY student_id,year,for_month HAVING count(*)>1) THEN
 RAISE EXCEPTION 'Duplicate monthly payment projections require reconciliation before upgrading'; END IF;
 IF EXISTS(SELECT 1 FROM public.class_enrollments GROUP BY student_id,class_id HAVING count(*)>1) THEN
 RAISE EXCEPTION 'Duplicate class enrollments require reconciliation before upgrading'; END IF;
 IF EXISTS(SELECT 1 FROM public.lms_progress GROUP BY student_id,curriculum_id HAVING count(*)>1) THEN
 RAISE EXCEPTION 'Duplicate student lesson progress requires reconciliation before upgrading'; END IF;
 IF EXISTS(SELECT 1 FROM public.students s LEFT JOIN public.scholarships p ON p.id=s.scholarship_id WHERE s.deleted_at IS NULL AND p.id IS NULL) THEN
 RAISE EXCEPTION 'Students have missing tuition plans. Reconcile scholarship assignments'; END IF;
END $$;

-- Review these existing objects on staging: they are not present in the simplified test fixture.
SELECT event_object_table,trigger_name,action_timing,event_manipulation,action_statement
FROM information_schema.triggers WHERE event_object_schema IN ('auth','public') ORDER BY event_object_table,trigger_name;
SELECT tablename,policyname,roles,cmd FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY tablename,policyname;
SELECT p.oid::regprocedure AS function,p.prosecdef AS security_definer,p.proacl AS grants
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY 1;

-- Do not overwrite conflicting legacy curriculum IDs. These rows need a reviewed
-- reconciliation on staging before staff can edit/delete or grade the asset.
SELECT a.id,a.title AS library_title,c.title AS curriculum_title
FROM public.library_assets a JOIN public.curriculum c ON c.id=a.id WHERE a.title<>c.title;
