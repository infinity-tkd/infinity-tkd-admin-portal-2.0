-- Read-only release verification. Execute after the upgrade on staging, then production.
-- These first two queries should return no rows.
SELECT p.oid::regprocedure AS exposed_mutator
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND
 (p.proname IN ('process_admin_pos_sale','place_student_order','confirm_student_order','cancel_pos_order','cancel_or_refund_order','adjust_inventory_stock','get_email_by_username') OR p.proname LIKE 'portal_%' AND p.proname<>'portal_has_permission')
 AND (has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE'));
SELECT c.relname AS unprotected_table FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('profiles','user_permissions','role_permissions','audit_logs','students','student_addresses','payments','payment_transactions','products','product_variants','pos_orders','pos_order_items','inventory_logs','class_enrollments','attendance','households','household_students','household_payment_batches','student_body_compositions','portal_rate_limits') AND NOT c.relrowsecurity;

-- Confirm core service-only signatures exist and the occurrence constraint is installed.
SELECT to_regprocedure('public.portal_place_order(uuid,text,jsonb,uuid)') AS checkout,
 to_regprocedure('public.portal_record_payments(uuid,text,jsonb,text,uuid)') AS payments,
 to_regprocedure('public.portal_update_user(uuid,uuid,jsonb,jsonb,jsonb)') AS account_update,
 to_regprocedure('public.portal_refund_order(uuid,uuid,text,text,boolean)') AS refund,
 to_regprocedure('public.portal_delete_class(uuid,integer)') AS class_delete,
 to_regprocedure('public.portal_record_body_composition(uuid,jsonb,uuid)') AS measurement,
 to_regprocedure('public.portal_record_household_payment(uuid,uuid,jsonb,text,text,uuid)') AS family_payment,
 to_regprocedure('public.portal_save_library_asset(uuid,text,integer,jsonb,uuid)') AS library_save,
 to_regprocedure('public.portal_set_video_progress(uuid,text,integer,boolean)') AS library_progress,
 to_regprocedure('public.portal_update_student_with_enrollment(uuid,text,jsonb,jsonb,bigint,date)') AS student_edit;
SELECT conname,pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.attendance'::regclass AND conname='portal_attendance_occurrence';
SELECT role,permission_key,is_granted FROM public.role_permissions WHERE role IN ('Admin','Head Coach','Coach','Assistant Coach') ORDER BY role,permission_key;
