-- Restrictive policies can only narrow existing access. Staff permissive policies
-- remain authoritative, including own-profile reads needed for MFA setup.
-- Student resource reads and mutations go through the verified server gateway.

do $$ declare t text; begin
 foreach t in array array['profiles','students','student_addresses','members','member_addresses','attendance','payments','payment_transactions','membership_invoices','membership_receipts','membership_allocations','membership_credits','membership_credit_uses','membership_pauses','membership_schedule_changes','class_enrollments','class_membership_periods','class_enrollment_history','class_occurrences','class_occurrence_roster','makeup_attendance','achievements','belt_histories','student_physical_evaluations','student_body_compositions','student_training_plans','lms_progress','library_assets','library_asset_muscles','curriculum','workout_templates','products','product_variants','pos_orders','pos_order_items','inventory_logs','households','household_students','household_payment_batches','portal_notifications','portal_notification_preferences','portal_push_subscriptions','portal_push_deliveries','grading_events','grading_candidates','audit_logs','role_permissions','user_permissions'] loop
  if to_regclass('public.'||t) is not null then
   if not (select relrowsecurity from pg_class where oid=to_regclass('public.'||t)) then raise exception 'Expected existing RLS on %',t; end if;
   execute format('create policy student_portal_server_boundary on public.%I as restrictive for all to authenticated using ((select public.auth_role()) in (''Root'',''Super Root'',''Admin'',''Head Coach'',''Coach'',''Assistant Coach'')) with check ((select public.auth_role()) in (''Root'',''Super Root'',''Admin'',''Head Coach'',''Coach'',''Assistant Coach''))',t);
   execute format('create policy student_portal_anon_boundary on public.%I as restrictive for all to anon using (false) with check (false)',t);
  end if;
 end loop;
end $$;
