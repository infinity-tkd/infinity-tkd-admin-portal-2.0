BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

-- Browser policy and service transactions share the same canonical permission
-- dependencies as lib/permissions.ts. No role grants or user records are changed.
CREATE FUNCTION public.portal_permission_default(p_role text,p_key text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM (VALUES
 ('Admin','page:dashboard'),
 ('Admin','page:pos'),
 ('Admin','page:financials'),
 ('Admin','page:directory'),
 ('Admin','page:attendance'),
 ('Admin','page:schedule'),
 ('Admin','page:lms'),
 ('Admin','page:library'),
 ('Admin','page:staff'),
 ('Admin','page:partners'),
 ('Admin','page:settings'),
 ('Admin','action:pos_create_order'),
 ('Admin','action:pos_manage_inventory'),
 ('Admin','action:pos_cancel_order'),
 ('Admin','action:student_create'),
 ('Admin','action:student_edit'),
 ('Admin','action:attendance_mark'),
 ('Admin','action:attendance_delete'),
 ('Admin','action:evaluations_grade'),
 ('Admin','action:curriculum_edit'),
 ('Admin','action:finance_record_payment'),
 ('Admin','action:schedule_manage'),
 ('Admin','action:staff_manage'),
 ('Admin','action:partner_create'),
 ('Admin','action:partner_edit'),
 ('Admin','action:partner_delete'),
 ('Admin','manage:users'),
 ('Admin','manage:students'),
 ('Admin','manage:finances'),
 ('Admin','manage:pos'),
 ('Admin','manage:curriculum'),
 ('Admin','manage:branches'),
 ('Admin','manage:schedule'),
 ('Admin','view:financials'),
 ('Admin','view:pos'),
 ('Admin','view:analytics'),
 ('Admin','mark:attendance'),
 ('Admin','grade:evaluations'),
 ('Admin','view:own_dossier'),
 ('Admin','page:calendar'),
 ('Admin','action:events_create'),
 ('Admin','action:events_edit'),
 ('Admin','action:events_publish'),
 ('Admin','action:announcements_send'),
 ('Head Coach','page:dashboard'),
 ('Head Coach','page:pos'),
 ('Head Coach','page:directory'),
 ('Head Coach','page:attendance'),
 ('Head Coach','page:schedule'),
 ('Head Coach','page:lms'),
 ('Head Coach','page:library'),
 ('Head Coach','page:staff'),
 ('Head Coach','page:partners'),
 ('Head Coach','action:pos_create_order'),
 ('Head Coach','action:student_create'),
 ('Head Coach','action:student_edit'),
 ('Head Coach','action:attendance_mark'),
 ('Head Coach','action:attendance_delete'),
 ('Head Coach','action:evaluations_grade'),
 ('Head Coach','action:curriculum_edit'),
 ('Head Coach','action:schedule_manage'),
 ('Head Coach','action:partner_create'),
 ('Head Coach','action:partner_edit'),
 ('Head Coach','manage:students'),
 ('Head Coach','manage:curriculum'),
 ('Head Coach','manage:schedule'),
 ('Head Coach','view:pos'),
 ('Head Coach','view:analytics'),
 ('Head Coach','mark:attendance'),
 ('Head Coach','grade:evaluations'),
 ('Head Coach','view:own_dossier'),
 ('Head Coach','page:calendar'),
 ('Head Coach','action:events_create'),
 ('Head Coach','action:events_edit'),
 ('Coach','page:dashboard'),
 ('Coach','page:directory'),
 ('Coach','page:attendance'),
 ('Coach','page:schedule'),
 ('Coach','page:lms'),
 ('Coach','page:library'),
 ('Coach','page:partners'),
 ('Coach','action:attendance_mark'),
 ('Coach','action:evaluations_grade'),
 ('Coach','action:curriculum_edit'),
 ('Coach','manage:curriculum'),
 ('Coach','mark:attendance'),
 ('Coach','grade:evaluations'),
 ('Coach','view:own_dossier'),
 ('Coach','page:calendar'),
 ('Assistant Coach','page:dashboard'),
 ('Assistant Coach','page:directory'),
 ('Assistant Coach','page:attendance'),
 ('Assistant Coach','page:schedule'),
 ('Assistant Coach','page:lms'),
 ('Assistant Coach','page:library'),
 ('Assistant Coach','page:partners'),
 ('Assistant Coach','action:attendance_mark'),
 ('Assistant Coach','mark:attendance'),
 ('Assistant Coach','view:own_dossier'),
 ('Assistant Coach','page:calendar'),
 ('Student','page:lms'),
 ('Student','page:library'),
 ('Student','view:own_dossier')
 ) AS factory(role,key) WHERE role=p_role AND key=p_key)
$$;
REVOKE ALL ON FUNCTION public.portal_permission_default(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_permission_default(text,text) TO service_role;

CREATE FUNCTION public.portal_permission_allowed(p_actor uuid,p_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.profiles; canonical text; parents text[]; key text; allowed boolean;
BEGIN
 SELECT * INTO p FROM public.profiles WHERE id=p_actor AND is_active AND NOT must_change_password;
 IF NOT FOUND OR p.role NOT IN('Root','Super Root','Admin','Head Coach','Coach','Assistant Coach','Student') THEN RETURN false; END IF;
 IF p.role IN('Root','Super Root') THEN RETURN true; END IF;
 canonical:=CASE p_key
 WHEN 'manage:users' THEN 'action:staff_manage'
 WHEN 'manage:students' THEN 'action:student_edit'
 WHEN 'manage:finances' THEN 'action:finance_record_payment'
 WHEN 'manage:pos' THEN 'action:pos_create_order'
 WHEN 'manage:curriculum' THEN 'action:curriculum_edit'
 WHEN 'manage:branches' THEN 'action:schedule_manage'
 WHEN 'manage:schedule' THEN 'action:schedule_manage'
 WHEN 'view:financials' THEN 'page:financials'
 WHEN 'view:pos' THEN 'page:pos'
 WHEN 'view:analytics' THEN 'page:dashboard'
 WHEN 'mark:attendance' THEN 'action:attendance_mark'
 WHEN 'grade:evaluations' THEN 'action:evaluations_grade'
 ELSE p_key END;
 IF p.role='Student' AND canonical LIKE 'action:%' THEN RETURN false; END IF;
 FOR key IN SELECT DISTINCT value FROM unnest(ARRAY[p_key,canonical]) value LOOP
 SELECT COALESCE((SELECT is_granted FROM public.user_permissions WHERE user_id=p_actor AND permission_key=key),
  (SELECT is_granted FROM public.role_permissions WHERE role=p.role AND permission_key=key),public.portal_permission_default(p.role,key)) INTO allowed;
 IF NOT allowed THEN RETURN false; END IF;
 END LOOP;
 parents:=CASE canonical
 WHEN 'action:events_create' THEN ARRAY['page:calendar']::text[]
 WHEN 'action:events_edit' THEN ARRAY['page:calendar']::text[]
 WHEN 'action:events_publish' THEN ARRAY['page:calendar']::text[]
 WHEN 'action:announcements_send' THEN ARRAY['page:calendar']::text[]
 WHEN 'action:pos_create_order' THEN ARRAY['page:pos']::text[]
 WHEN 'action:pos_manage_inventory' THEN ARRAY['page:pos']::text[]
 WHEN 'action:pos_cancel_order' THEN ARRAY['page:pos']::text[]
 WHEN 'action:student_create' THEN ARRAY['page:directory']::text[]
 WHEN 'action:student_edit' THEN ARRAY['page:directory']::text[]
 WHEN 'action:student_delete' THEN ARRAY['page:directory']::text[]
 WHEN 'action:attendance_mark' THEN ARRAY['page:attendance']::text[]
 WHEN 'action:attendance_delete' THEN ARRAY['page:attendance']::text[]
 WHEN 'action:finance_record_payment' THEN ARRAY['page:financials']::text[]
 WHEN 'action:schedule_manage' THEN ARRAY['page:schedule']::text[]
 WHEN 'action:staff_manage' THEN ARRAY['page:staff','page:settings']::text[]
 WHEN 'action:partner_create' THEN ARRAY['page:partners']::text[]
 WHEN 'action:partner_edit' THEN ARRAY['page:partners']::text[]
 WHEN 'action:partner_delete' THEN ARRAY['page:partners']::text[]
 WHEN 'action:evaluations_grade' THEN ARRAY['page:lms']::text[]
 WHEN 'action:curriculum_edit' THEN ARRAY['page:lms','page:library']::text[]
 ELSE '{}'::text[] END;
 IF cardinality(parents)=0 THEN RETURN true; END IF;
 FOREACH key IN ARRAY parents LOOP
 SELECT COALESCE((SELECT is_granted FROM public.user_permissions WHERE user_id=p_actor AND permission_key=key),
  (SELECT is_granted FROM public.role_permissions WHERE role=p.role AND permission_key=key),public.portal_permission_default(p.role,key)) INTO allowed;
 IF allowed THEN RETURN true; END IF;
 END LOOP;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.portal_permission_allowed(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_permission_allowed(uuid,text) TO service_role;

-- Authenticated callers can evaluate only themselves. MFA applies to direct
-- browser table writes too; service RPCs use an independently verified actor.
CREATE OR REPLACE FUNCTION public.portal_has_permission(p_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.auth_is_active() AND public.portal_permission_allowed(auth.uid(),p_key)
$$;
REVOKE ALL ON FUNCTION public.portal_has_permission(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal_has_permission(text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.portal_assert_actor(p_actor uuid,p_key text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server-only operation' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role<>'Student') THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE='42501'; END IF;
 IF NOT public.portal_permission_allowed(p_actor,p_key) THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.portal_assert_actor(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_assert_actor(uuid,text) TO service_role;

-- The self-service Student exception never becomes cross-account staff access.
CREATE OR REPLACE FUNCTION public.portal_update_user(p_actor uuid,p_target uuid,p_profile jsonb,p_member jsonb,p_address jsonb DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.profiles; target public.profiles; changed public.profiles; m public.members; privileged boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('portal-active-root-authority',0));
 SELECT * INTO actor FROM public.profiles WHERE id=p_actor AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inactive account' USING ERRCODE='42501'; END IF;
 SELECT * INTO target FROM public.profiles WHERE id=p_target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Target missing' USING ERRCODE='22023'; END IF;
 privileged:=actor.role<>'Student' AND public.portal_permission_allowed(p_actor,'action:staff_manage');
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
 UPDATE public.members SET khmer_name=m.khmer_name,english_name=m.english_name,gender=m.gender,dob=m.dob,phone=m.phone,telegram_username=m.telegram_username,emergency_contact_name=m.emergency_contact_name,emergency_contact_phone=m.emergency_contact_phone,emergency_contact_relation=m.emergency_contact_relation,medical_notes=m.medical_notes,allergies=m.allergies,profile_picture_path=m.profile_picture_path,nationality=m.nationality WHERE id=p_target;
 IF p_address IS NOT NULL THEN
 UPDATE public.member_addresses SET address_line1=p_address->>'address_line1',address_line2=p_address->>'address_line2',district_commune=p_address->>'district_commune',state_province_city=p_address->>'state_province_city',postal_code=p_address->>'postal_code',country=p_address->>'country' WHERE member_id=p_target AND is_primary=true;
 IF NOT FOUND THEN INSERT INTO public.member_addresses(member_id,address_line1,address_line2,district_commune,state_province_city,postal_code,country,is_primary) VALUES(p_target,p_address->>'address_line1',p_address->>'address_line2',p_address->>'district_commune',p_address->>'state_province_city',p_address->>'postal_code',p_address->>'country',true); END IF;
 END IF; END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('USER_UPDATED',p_actor::text,p_target::text,jsonb_build_object('fields',ARRAY(SELECT jsonb_object_keys(p_profile))));
END $$;
REVOKE ALL ON FUNCTION public.portal_update_user(uuid,uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_update_user(uuid,uuid,jsonb,jsonb,jsonb) TO service_role;
-- A settings page grant is read access, not authority to change billing policy.
CREATE OR REPLACE FUNCTION public.portal_operations_mutate(p_actor uuid,p_action text,p_data jsonb,p_request_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE permission text; actor public.profiles; previous public.portal_operation_requests; result jsonb; student text;
 invoice public.membership_invoices; receipt public.membership_receipts; credit public.membership_credits;
 occurrence public.class_occurrences; task public.followup_tasks; exam public.grading_events; candidate public.grading_candidates;
 bank public.payment_reconciliation_lines; paused public.membership_pauses; item jsonb; amount numeric; allocation numeric; balance numeric;
 total numeric; saved_id uuid; starts timestamptz; ends timestamptz; day date; today date:=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date;
 class_count int; attended_count int; attendance_pct numeric; target_belt text; promoted int; BEGIN
 permission:=CASE WHEN p_action IN ('policy','quality_review') THEN 'action:staff_manage'
 WHEN p_action IN ('pause','void_pause','return','invoice','payment','issue_credit','apply_credit','bank_import','reconcile') THEN 'action:finance_record_payment'
 WHEN p_action IN ('snapshot_sessions','holiday','session_change') THEN 'action:schedule_manage'
 WHEN p_action='session_attendance' THEN 'action:attendance_mark'
 WHEN p_action IN ('exam','assess','promote') THEN 'action:evaluations_grade'
 WHEN p_action IN ('task','task_update') THEN 'page:dashboard' END;
 IF permission IS NULL OR p_request_key IS NULL OR jsonb_typeof(p_data)<>'object' THEN RAISE EXCEPTION 'Invalid operation' USING ERRCODE='22023'; END IF;
 PERFORM public.portal_assert_actor(p_actor,permission);
 SELECT * INTO actor FROM public.profiles WHERE id=p_actor;
 IF p_action IN ('policy','quality_review','pause','void_pause','return','issue_credit') AND actor.role NOT IN ('Root','Super Root','Admin') THEN RAISE EXCEPTION 'Administrator approval required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_key::text,0));
 SELECT * INTO previous FROM public.portal_operation_requests WHERE request_key=p_request_key;
 IF FOUND THEN IF previous.actor<>p_actor OR previous.action<>p_action OR previous.payload<>p_data THEN RAISE EXCEPTION 'Request key mismatch' USING ERRCODE='22023'; END IF; RETURN previous.result; END IF;
 student:=p_data->>'studentId';
 IF student IS NOT NULL THEN PERFORM 1 FROM public.students WHERE id=student AND deleted_at IS NULL FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Student unavailable' USING ERRCODE='P0002'; END IF; END IF;
 CASE p_action
 WHEN 'policy' THEN
  UPDATE public.academy_operations_policy SET reminder_lead_days=(p_data->>'reminderLeadDays')::int,late_grace_days=(p_data->>'lateGraceDays')::int,updated_by=p_actor,updated_at=now() WHERE id='default';result:='{"saved":true}';
 WHEN 'invoice' THEN
  day:=(p_data->>'cycleMonth')::date;
  IF day>(date_trunc('month',today)+interval '24 months')::date THEN RAISE EXCEPTION 'Choose a billing cycle within the next 24 months' USING ERRCODE='22023'; END IF;
  IF day<date_trunc('month',today)::date AND NOT EXISTS(SELECT 1 FROM public.membership_invoices WHERE student_id=student AND cycle_month=day) AND NOT EXISTS(SELECT 1 FROM public.payments WHERE student_id=student AND year=extract(year from day) AND for_month=(ARRAY['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])[extract(month from day)::int] AND status IN ('Paid','Waived')) THEN
   amount:=(p_data->>'historicalAmount')::numeric;
   IF actor.role NOT IN ('Root','Super Root','Admin') OR amount IS NULL OR amount<0 OR amount>100000 OR amount<>round(amount,2) OR length(trim(COALESCE(p_data->>'reason','')))<5 THEN RAISE EXCEPTION 'A verified historical fee and administrator approval reason are required' USING ERRCODE='22023'; END IF;
   saved_id:=public.portal_ensure_invoice(student,day);
   UPDATE public.membership_invoices SET amount_usd=amount,waiver_usd=CASE WHEN waiver_usd>0 THEN amount ELSE 0 END,balance_usd=CASE WHEN waiver_usd>0 THEN 0 ELSE amount END,rate_snapshot=rate_snapshot||jsonb_build_object('historicalVerifiedAmount',amount,'approvedBy',p_actor,'reason',p_data->>'reason') WHERE id=saved_id;
  ELSE saved_id:=public.portal_ensure_invoice(student,day); END IF;
  PERFORM public.portal_project_invoice(saved_id);result:=jsonb_build_object('id',saved_id);
 WHEN 'payment' THEN
  amount:=(p_data->>'amount')::numeric;
  IF amount IS NULL OR amount<=0 OR amount>100000 OR amount<>round(amount,2) OR NOT COALESCE((p_data->>'receivedVerified')::boolean,false) OR (p_data->>'paymentDate')::date>today THEN RAISE EXCEPTION 'Confirm received funds, date and a positive two-decimal amount' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(p_data->'allocations') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'allocations') NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'Choose invoice allocations' USING ERRCODE='22023'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_data->'allocations'))<>(SELECT count(DISTINCT value->>'invoiceId') FROM jsonb_array_elements(p_data->'allocations')) THEN RAISE EXCEPTION 'Duplicate invoice allocation' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.household_payment_batches WHERE lower(trim(external_reference))=lower(trim(p_data->>'externalReference')) AND external_reference IS NOT NULL) THEN RAISE EXCEPTION 'This external reference is already recorded' USING ERRCODE='23505'; END IF;
  INSERT INTO public.membership_receipts(student_id,amount_usd,payment_date,payment_method,external_reference,recorded_by) VALUES(student,amount,(p_data->>'paymentDate')::date,p_data->>'method',NULLIF(trim(p_data->>'externalReference'),''),p_actor) RETURNING * INTO receipt;
  total:=0;
  FOR item IN SELECT value FROM jsonb_array_elements(p_data->'allocations') ORDER BY value->>'invoiceId' LOOP
   SELECT * INTO invoice FROM public.membership_invoices WHERE id=(item->>'invoiceId')::uuid AND student_id=student FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Invoice does not belong to this student' USING ERRCODE='42501'; END IF;
   allocation:=(item->>'amount')::numeric;balance:=public.portal_invoice_balance(invoice.id);
   IF allocation IS NULL OR allocation<=0 OR allocation<>round(allocation,2) OR allocation>balance THEN RAISE EXCEPTION 'Allocation exceeds the outstanding invoice balance' USING ERRCODE='22023'; END IF;
   total:=total+allocation;IF total>amount THEN RAISE EXCEPTION 'Allocations exceed received funds' USING ERRCODE='22023'; END IF;
   INSERT INTO public.membership_allocations(receipt_id,invoice_id,amount_usd) VALUES(receipt.id,invoice.id,allocation);PERFORM public.portal_project_invoice(invoice.id);
  END LOOP;
  IF amount>total THEN INSERT INTO public.membership_credits(student_id,receipt_id,amount_usd,reason,issued_by) VALUES(student,receipt.id,amount-total,'Unallocated balance from verified receipt',p_actor); END IF;
  result:=to_jsonb(receipt);
 WHEN 'issue_credit' THEN
  amount:=(p_data->>'amount')::numeric;
  IF amount IS NULL OR amount<=0 OR amount>10000 OR amount<>round(amount,2) THEN RAISE EXCEPTION 'Invalid credit amount' USING ERRCODE='22023'; END IF;
  INSERT INTO public.membership_credits(student_id,amount_usd,reason,issued_by) VALUES(student,amount,p_data->>'reason',p_actor) RETURNING id INTO saved_id;result:=jsonb_build_object('id',saved_id);
 WHEN 'apply_credit' THEN
  SELECT * INTO invoice FROM public.membership_invoices WHERE id=(p_data->>'invoiceId')::uuid FOR UPDATE;
  IF NOT FOUND OR invoice.student_id IS DISTINCT FROM student THEN RAISE EXCEPTION 'Invoice unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO credit FROM public.membership_credits WHERE id=(p_data->>'creditId')::uuid AND student_id=student FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Credit does not belong to this student' USING ERRCODE='42501'; END IF;
  amount:=(p_data->>'amount')::numeric;SELECT credit.amount_usd-COALESCE(sum(amount_usd),0) INTO balance FROM public.membership_credit_uses WHERE credit_id=credit.id;
  IF amount IS NULL OR amount<=0 OR amount<>round(amount,2) OR amount>balance OR amount>public.portal_invoice_balance(invoice.id) THEN RAISE EXCEPTION 'Credit allocation exceeds available balances' USING ERRCODE='22023'; END IF;
  INSERT INTO public.membership_credit_uses(credit_id,invoice_id,amount_usd,recorded_by) VALUES(credit.id,invoice.id,amount,p_actor);PERFORM public.portal_project_invoice(invoice.id);result:='{"saved":true}';
 WHEN 'pause' THEN
  IF (p_data->>'resumeDate')::date<=(p_data->>'startDate')::date OR length(trim(p_data->>'reason')) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Choose a valid pause period and reason' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.membership_pauses WHERE student_id=student AND voided_at IS NULL AND start_date<(p_data->>'resumeDate')::date AND resume_date>(p_data->>'startDate')::date) THEN RAISE EXCEPTION 'Pause periods overlap' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.membership_invoices i WHERE student_id=student AND due_date>=(p_data->>'startDate')::date AND cycle_end<=(p_data->>'resumeDate')::date AND public.portal_invoice_balance(i.id)>0 AND (EXISTS(SELECT 1 FROM public.membership_allocations WHERE invoice_id=i.id) OR EXISTS(SELECT 1 FROM public.membership_credit_uses WHERE invoice_id=i.id))) THEN RAISE EXCEPTION 'Review partially collected cycles before approving this pause' USING ERRCODE='22023'; END IF;
  INSERT INTO public.membership_pauses(student_id,start_date,resume_date,reason,approved_by) VALUES(student,(p_data->>'startDate')::date,(p_data->>'resumeDate')::date,p_data->>'reason',p_actor) RETURNING * INTO paused;
  UPDATE public.students SET student_status='Paused',approved_pause_id=paused.id,pause_end_date=paused.resume_date,status_reason='Approved membership pause',status_changed_at=now() WHERE id=student AND student_status='Active' AND paused.start_date<=today AND paused.resume_date>today;
  FOR invoice IN SELECT * FROM public.membership_invoices WHERE student_id=student AND legacy_settlement_id IS NULL AND due_date>=paused.start_date AND cycle_end<=paused.resume_date AND public.portal_invoice_balance(id)=amount_usd LOOP
   UPDATE public.membership_invoices SET waiver_usd=amount_usd WHERE id=invoice.id;PERFORM public.portal_project_invoice(invoice.id);
  END LOOP;
  result:=to_jsonb(paused);
 WHEN 'void_pause' THEN
  SELECT * INTO paused FROM public.membership_pauses WHERE id=(p_data->>'id')::uuid AND student_id=student FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pause unavailable' USING ERRCODE='P0002'; END IF;
  IF length(trim(p_data->>'reason')) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'A correction reason is required' USING ERRCODE='22023'; END IF;
  UPDATE public.membership_pauses SET voided_at=now(),voided_by=p_actor,void_reason=p_data->>'reason' WHERE id=paused.id;
  FOR invoice IN SELECT * FROM public.membership_invoices WHERE student_id=student AND legacy_settlement_id IS NULL AND due_date>=paused.start_date AND cycle_end<=paused.resume_date AND waiver_usd>0 LOOP
   UPDATE public.membership_invoices SET waiver_usd=0 WHERE id=invoice.id;PERFORM public.portal_project_invoice(invoice.id);
  END LOOP;result:='{"saved":true}';
 WHEN 'return' THEN
  IF length(trim(p_data->>'reason')) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'A return reason is required' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.membership_pauses WHERE student_id=student AND voided_at IS NULL AND start_date<=today AND resume_date>today) THEN RAISE EXCEPTION 'Correct or void the active pause before an early return' USING ERRCODE='22023'; END IF;
  UPDATE public.students SET student_status='Active',approved_pause_id=NULL,pause_end_date=NULL,status_reason=p_data->>'reason',status_changed_at=now() WHERE id=student;result:='{"saved":true}';
 WHEN 'snapshot_sessions' THEN result:=jsonb_build_object('created',public.portal_snapshot_sessions(p_actor,(p_data->>'from')::date,(p_data->>'to')::date));
 WHEN 'holiday' THEN
  IF (p_data->>'startDate')::date<today THEN RAISE EXCEPTION 'New holidays must start today or later' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.class_occurrences o JOIN public.attendance a ON a.occurrence_id=o.id OR a.class_id=o.class_id AND a.date=(o.starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date WHERE (o.starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date BETWEEN (p_data->>'startDate')::date AND (p_data->>'endDate')::date AND (p_data->>'branchId' IS NULL OR o.branch_id=(p_data->>'branchId')::int)) THEN RAISE EXCEPTION 'Review existing attendance before cancelling these sessions' USING ERRCODE='22023'; END IF;
  INSERT INTO public.academy_holidays(title,branch_id,start_date,end_date,reason,created_by) VALUES(p_data->>'title',(p_data->>'branchId')::int,(p_data->>'startDate')::date,(p_data->>'endDate')::date,p_data->>'reason',p_actor) RETURNING id INTO saved_id;
  UPDATE public.class_occurrences SET status='cancelled',holiday_id=saved_id,change_reason=p_data->>'reason',revision=revision+1,updated_at=now() WHERE (starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date BETWEEN (p_data->>'startDate')::date AND (p_data->>'endDate')::date AND (p_data->>'branchId' IS NULL OR branch_id=(p_data->>'branchId')::int) AND status='scheduled';result:=jsonb_build_object('id',saved_id);
 WHEN 'session_change' THEN
  SELECT * INTO occurrence FROM public.class_occurrences WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session unavailable' USING ERRCODE='P0002'; END IF;
  IF occurrence.revision<>(p_data->>'revision')::int THEN RAISE EXCEPTION 'Session changed. Reload before saving' USING ERRCODE='40001'; END IF;
  IF length(trim(p_data->>'reason')) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'A change reason is required' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.attendance WHERE occurrence_id=occurrence.id OR class_id=occurrence.class_id AND date=(occurrence.starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date) THEN RAISE EXCEPTION 'A marked session cannot be moved or cancelled' USING ERRCODE='22023'; END IF;
  starts:=COALESCE((p_data->>'startsAt')::timestamptz,occurrence.starts_at);ends:=COALESCE((p_data->>'endsAt')::timestamptz,occurrence.ends_at);
  IF ends<=starts OR starts<now() AND p_data->>'status'='scheduled' THEN RAISE EXCEPTION 'Choose a future session with a valid end time' USING ERRCODE='22023'; END IF;
  IF p_data->>'status'='scheduled' AND EXISTS(SELECT 1 FROM public.class_occurrences WHERE id<>occurrence.id AND status<>'cancelled' AND (class_id=occurrence.class_id AND (starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date=(starts AT TIME ZONE 'Asia/Phnom_Penh')::date OR coach_id=occurrence.coach_id AND starts_at<ends AND ends_at>starts)) THEN RAISE EXCEPTION 'The class date or coach time conflicts with another session' USING ERRCODE='22023'; END IF;
  UPDATE public.class_occurrences SET starts_at=starts,ends_at=ends,status=p_data->>'status',change_reason=p_data->>'reason',revision=revision+1,updated_at=now() WHERE id=occurrence.id;result:='{"saved":true}';
 WHEN 'session_attendance' THEN
  SELECT * INTO occurrence FROM public.class_occurrences WHERE id=(p_data->>'occurrenceId')::uuid FOR UPDATE;
  IF NOT FOUND OR occurrence.status='cancelled' OR occurrence.starts_at>now() THEN RAISE EXCEPTION 'Choose a started, non-cancelled session' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.class_occurrence_roster WHERE occurrence_id=occurrence.id AND student_id=student) THEN RAISE EXCEPTION 'Student is not in the session roster' USING ERRCODE='42501'; END IF;
  day:=(occurrence.starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date;
  IF EXISTS(SELECT 1 FROM public.membership_pauses WHERE student_id=student AND voided_at IS NULL AND day>=start_date AND day<resume_date) THEN RAISE EXCEPTION 'Student membership is paused on this date' USING ERRCODE='22023'; END IF;
  INSERT INTO public.attendance(student_id,class_id,date,status,marked_by,occurrence_id) VALUES(student,occurrence.class_id,day,p_data->>'status',p_actor,occurrence.id)
  ON CONFLICT(student_id,date,class_id) DO UPDATE SET status=EXCLUDED.status,marked_by=EXCLUDED.marked_by,occurrence_id=EXCLUDED.occurrence_id;result:='{"saved":true}';
 WHEN 'task' THEN
  permission:=CASE p_data->>'category' WHEN 'billing' THEN 'page:financials' WHEN 'attendance' THEN 'page:attendance' WHEN 'orders' THEN 'page:pos' ELSE 'page:dashboard' END;
  PERFORM public.portal_assert_actor(p_actor,permission);PERFORM public.portal_assert_actor((p_data->>'assignedTo')::uuid,permission);
  INSERT INTO public.followup_tasks(title,description,student_id,category,assigned_to,due_date,created_by) VALUES(p_data->>'title',COALESCE(p_data->>'description',''),student,p_data->>'category',(p_data->>'assignedTo')::uuid,(p_data->>'dueDate')::date,p_actor) RETURNING id INTO saved_id;result:=jsonb_build_object('id',saved_id);
 WHEN 'task_update' THEN
  SELECT * INTO task FROM public.followup_tasks WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR task.assigned_to<>p_actor AND actor.role NOT IN ('Root','Super Root','Admin') THEN RAISE EXCEPTION 'Task access denied' USING ERRCODE='42501'; END IF;
  permission:=CASE task.category WHEN 'billing' THEN 'page:financials' WHEN 'attendance' THEN 'page:attendance' WHEN 'orders' THEN 'page:pos' ELSE 'page:dashboard' END;
  PERFORM public.portal_assert_actor(p_actor,permission);
  IF task.revision<>(p_data->>'revision')::int THEN RAISE EXCEPTION 'Task changed. Reload before saving' USING ERRCODE='40001'; END IF;
  IF p_data->>'status' IN ('completed','cancelled') AND length(trim(COALESCE(p_data->>'note','')))<5 THEN RAISE EXCEPTION 'Record the follow-up outcome' USING ERRCODE='22023'; END IF;
  UPDATE public.followup_tasks SET status=p_data->>'status',completion_note=p_data->>'note',revision=revision+1,updated_at=now() WHERE id=task.id;student:=task.student_id;result:='{"saved":true}';
 WHEN 'bank_import' THEN
  IF jsonb_typeof(p_data->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'lines') NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Import 1 to 500 bank records' USING ERRCODE='22023'; END IF;
  total:=0;
  FOR item IN SELECT value FROM jsonb_array_elements(p_data->'lines') LOOP
   IF (item->>'transactionDate')::date>today THEN RAISE EXCEPTION 'A bank record cannot be future-dated' USING ERRCODE='22023'; END IF;
   SELECT * INTO bank FROM public.payment_reconciliation_lines WHERE bank_reference=lower(trim(item->>'reference'));
   IF FOUND THEN IF bank.amount_usd<>(item->>'amount')::numeric OR bank.transaction_date<>(item->>'transactionDate')::date THEN RAISE EXCEPTION 'An imported bank reference has conflicting values' USING ERRCODE='22023'; END IF;CONTINUE;END IF;
   INSERT INTO public.payment_reconciliation_lines(bank_reference,amount_usd,transaction_date,imported_by) VALUES(lower(trim(item->>'reference')),(item->>'amount')::numeric,(item->>'transactionDate')::date,p_actor);total:=total+1;
  END LOOP;result:=jsonb_build_object('imported',total);
 WHEN 'reconcile' THEN
  SELECT * INTO bank FROM public.payment_reconciliation_lines WHERE id=(p_data->>'bankLineId')::uuid FOR UPDATE;IF NOT FOUND OR bank.receipt_id IS NOT NULL THEN RAISE EXCEPTION 'Bank record unavailable or already matched' USING ERRCODE='22023'; END IF;
  SELECT * INTO receipt FROM public.membership_receipts WHERE id=(p_data->>'receiptId')::uuid FOR UPDATE;
  IF NOT FOUND OR receipt.payment_method='Cash' OR receipt.amount_usd<>bank.amount_usd OR lower(trim(receipt.external_reference)) IS DISTINCT FROM bank.bank_reference THEN RAISE EXCEPTION 'Match the exact bank reference and amount to a non-cash receipt' USING ERRCODE='22023'; END IF;
  UPDATE public.payment_reconciliation_lines SET receipt_id=receipt.id,matched_by=p_actor,matched_at=now() WHERE id=bank.id;student:=receipt.student_id;result:='{"saved":true}';
 WHEN 'exam' THEN
  INSERT INTO public.grading_events(title,exam_date,target_belt_id,passing_score,minimum_attendance,attendance_from,created_by) VALUES(p_data->>'title',(p_data->>'examDate')::date,(p_data->>'targetBeltId')::int,(p_data->>'passingScore')::int,(p_data->>'minimumAttendance')::int,(p_data->>'attendanceFrom')::date,p_actor) RETURNING id INTO saved_id;result:=jsonb_build_object('id',saved_id);
 WHEN 'assess' THEN
  SELECT * INTO exam FROM public.grading_events WHERE id=(p_data->>'eventId')::uuid;
  IF NOT FOUND OR exam.exam_date>today THEN RAISE EXCEPTION 'Choose a completed examination date' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.grading_candidates WHERE event_id=exam.id AND student_id=student AND status='promoted') THEN RAISE EXCEPTION 'A promoted assessment is immutable' USING ERRCODE='22023'; END IF;
  SELECT * INTO candidate FROM public.grading_candidates WHERE event_id=exam.id AND student_id=student FOR UPDATE;
  IF COALESCE(candidate.revision,0) IS DISTINCT FROM (p_data->>'revision')::int THEN RAISE EXCEPTION 'Assessment changed. Reload before saving' USING ERRCODE='40001'; END IF;
  INSERT INTO public.grading_candidates(event_id,student_id,score,status,assessment_notes,assessed_by) VALUES(exam.id,student,(p_data->>'score')::numeric,CASE WHEN (p_data->>'score')::numeric>=exam.passing_score THEN 'assessed' ELSE 'failed' END,p_data->>'notes',p_actor)
  ON CONFLICT(event_id,student_id) DO UPDATE SET score=EXCLUDED.score,status=EXCLUDED.status,assessment_notes=EXCLUDED.assessment_notes,assessed_by=p_actor,revision=public.grading_candidates.revision+1,updated_at=now() RETURNING id INTO saved_id;result:=jsonb_build_object('id',saved_id);
 WHEN 'promote' THEN
  SELECT * INTO candidate FROM public.grading_candidates WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR candidate.student_id IS DISTINCT FROM student OR candidate.status='promoted' THEN RAISE EXCEPTION 'Assessment unavailable or already promoted' USING ERRCODE='22023'; END IF;
  IF candidate.revision<>(p_data->>'revision')::int THEN RAISE EXCEPTION 'Assessment changed. Reload before saving' USING ERRCODE='40001'; END IF;
  SELECT * INTO exam FROM public.grading_events WHERE id=candidate.event_id;
  SELECT count(*),count(*) FILTER(WHERE EXISTS(SELECT 1 FROM public.attendance a WHERE a.student_id=student AND a.status IN ('Present','Late') AND (a.occurrence_id=o.id OR a.class_id=o.class_id AND a.date=(o.starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date)) OR EXISTS(SELECT 1 FROM public.makeup_attendance m WHERE m.student_id=student AND m.voided_at IS NULL AND m.source_class_id=o.class_id AND m.source_date=(o.starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date)) INTO class_count,attended_count FROM public.class_occurrences o JOIN public.class_occurrence_roster r ON r.occurrence_id=o.id AND r.student_id=student WHERE o.status<>'cancelled' AND o.ends_at<=now() AND (o.starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date BETWEEN exam.attendance_from AND exam.exam_date;
  attendance_pct:=CASE WHEN class_count=0 THEN 0 ELSE round(attended_count*100.0/class_count,2) END;
  IF candidate.score IS NULL OR candidate.score<exam.passing_score OR attendance_pct<exam.minimum_attendance OR class_count=0 OR EXISTS(SELECT 1 FROM public.class_occurrences o JOIN public.class_occurrence_roster r ON r.occurrence_id=o.id AND r.student_id=student WHERE o.roster_provenance='reconstructed' AND o.status<>'cancelled' AND (o.starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date BETWEEN exam.attendance_from AND exam.exam_date) THEN
   IF actor.role NOT IN ('Root','Super Root','Admin') OR length(trim(COALESCE(p_data->>'overrideReason','')))<5 THEN RAISE EXCEPTION 'Exam or attendance requirements are not met. An administrator override reason is required' USING ERRCODE='22023'; END IF;
  END IF;
  SELECT belt_name INTO target_belt FROM public.belts WHERE id=exam.target_belt_id;
  IF EXISTS(SELECT 1 FROM public.students s JOIN public.belts current ON current.id=s.belt_id JOIN public.belts target ON target.id=exam.target_belt_id WHERE s.id=student AND target.belt_order<=current.belt_order) THEN RAISE EXCEPTION 'Target belt must advance the current rank' USING ERRCODE='22023'; END IF;
  INSERT INTO public.belt_histories(student_id,belt_level,promotion_date) VALUES(student,target_belt,exam.exam_date) RETURNING id INTO promoted;
  UPDATE public.grading_candidates SET status='promoted',promoted_by=p_actor,belt_history_id=promoted,override_reason=NULLIF(trim(p_data->>'overrideReason'),''),revision=revision+1,updated_at=now() WHERE id=candidate.id;
  result:=jsonb_build_object('beltHistoryId',promoted,'attendancePercentage',attendance_pct);
 WHEN 'quality_review' THEN
  INSERT INTO public.data_quality_reviews(finding_key,note,reviewed_by) VALUES(p_data->>'findingKey',p_data->>'note',p_actor) ON CONFLICT(finding_key) DO UPDATE SET note=EXCLUDED.note,reviewed_by=p_actor,reviewed_at=now();result:='{"saved":true}';
 ELSE RAISE EXCEPTION 'Unknown operation' USING ERRCODE='22023';
 END CASE;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('OPERATIONS_'||upper(p_action),p_actor::text,COALESCE(student,result->>'id',p_data->>'id'),jsonb_build_object('requestKey',p_request_key,'input',p_data,'result',result));
 IF student IS NOT NULL THEN INSERT INTO public.student_activity_events(student_id,category,title,record_id,recorded_by) VALUES(student,CASE WHEN p_action IN ('assess','promote') THEN 'grading' WHEN p_action='session_attendance' THEN 'attendance' WHEN p_action IN ('task','task_update') THEN 'profile' ELSE 'billing' END,replace(initcap(replace(p_action,'_',' ')),'Invoice','Billing cycle'),COALESCE(result->>'id',p_data->>'id'),p_actor); END IF;
 INSERT INTO public.portal_operation_requests(request_key,actor,action,payload,result) VALUES(p_request_key,p_actor,p_action,p_data,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.portal_operations_mutate(uuid,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_operations_mutate(uuid,text,jsonb,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
