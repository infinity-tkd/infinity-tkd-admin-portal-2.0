-- Student portal data requests (docs/admin-data-requests-2026-11-07.md in the student portal).
-- 1. Belt catalog, using the belt names already stored on every student, promotion,
--    lesson and technique record (the student portal's beltPathKey accepts these names).
-- 2. Coach assessment scores (0-10) on physical evaluations.
-- 3. Grading-day publication, branch, time, location and cancellation.
-- 4. Branch opening hours.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

-- Normalised belt identity shared by every belt comparison in this migration:
-- 'White' = 'White Belt'; '1st Poom/Dan' = 'Black 1st Dan' = '1st Dan' (degree 1).
CREATE OR REPLACE FUNCTION public.portal_belt_key(p_name text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
 SELECT CASE
  WHEN n.t IN ('white','yellow','green','blue','brown','red') THEN n.t
  WHEN n.t ~ '^(black)?[1-9](st|nd|rd|th)?(poomdan|dan|poom)(black)?$' THEN 'dan-'||substring(n.t from '[1-9]')
  ELSE NULLIF(n.t,'') END
 FROM (SELECT regexp_replace(replace(lower(coalesce(p_name,'')),'belt',''),'[^a-z0-9]','','g') AS t) n
$$;
REVOKE ALL ON FUNCTION public.portal_belt_key(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal_belt_key(text) TO authenticated,service_role;

-- 1. Belt catalog. Existing rows (if any) are kept; only missing ranks are added.
-- Rows inserted with explicit ids can leave the sequence behind; never reuse an id.
SELECT setval(pg_get_serial_sequence('public.belts','id'),GREATEST(COALESCE((SELECT max(id) FROM public.belts),0),1),EXISTS(SELECT 1 FROM public.belts));
INSERT INTO public.belts(belt_name,belt_order,belt_type,color_hex)
SELECT v.belt_name,v.belt_order,v.belt_type,v.color_hex
FROM (VALUES
 ('White',1,'color','#FFFFFF'),('Yellow',2,'color','#FFD505'),('Green',3,'color','#09BB00'),
 ('Blue',4,'color','#0042EA'),('Brown',5,'color','#A05B00'),('Red',6,'color','#EF2F38'),
 ('1st Poom/Dan',7,'black','#000000'),('2nd Poom/Dan',8,'black','#000000'),('3rd Poom/Dan',9,'black','#000000'),
 ('4th Poom/Dan',10,'black','#000000'),('5th Dan',11,'black','#000000'),('6th Dan',12,'black','#000000')
) AS v(belt_name,belt_order,belt_type,color_hex)
WHERE NOT EXISTS(SELECT 1 FROM public.belts b WHERE public.portal_belt_key(b.belt_name)=public.portal_belt_key(v.belt_name))
  AND NOT EXISTS(SELECT 1 FROM public.belts b WHERE b.belt_order=v.belt_order);

-- students.belt_id follows students.current_belt, so grading checks
-- ("target belt must advance the current rank") see the real rank.
CREATE OR REPLACE FUNCTION public.portal_sync_student_belt_id() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- belt_id is derived, never set independently of current_belt.
 NEW.belt_id:=(SELECT b.id FROM public.belts b WHERE public.portal_belt_key(b.belt_name)=public.portal_belt_key(NEW.current_belt) ORDER BY b.belt_order LIMIT 1);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.portal_sync_student_belt_id() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS portal_sync_student_belt_id ON public.students;
CREATE TRIGGER portal_sync_student_belt_id BEFORE INSERT OR UPDATE OF current_belt,belt_id ON public.students
 FOR EACH ROW EXECUTE FUNCTION public.portal_sync_student_belt_id();
-- Backfill: only belt_id changes; no billing, roster, status or identity column is touched.
UPDATE public.students s SET belt_id=b.id
FROM public.belts b
WHERE public.portal_belt_key(b.belt_name)=public.portal_belt_key(s.current_belt)
  AND s.belt_id IS DISTINCT FROM b.id;

-- 2. Coach assessment score for the student radar chart (0-10, one decimal).
ALTER TABLE public.student_physical_evaluations
 ADD COLUMN IF NOT EXISTS score numeric(3,1) CHECK (score IS NULL OR (score>=0 AND score<=10));
CREATE OR REPLACE FUNCTION public.portal_touch_physical_evaluation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN NEW.updated_at:=now(); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.portal_touch_physical_evaluation() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS portal_touch_physical_evaluation ON public.student_physical_evaluations;
CREATE TRIGGER portal_touch_physical_evaluation BEFORE INSERT OR UPDATE ON public.student_physical_evaluations
 FOR EACH ROW EXECUTE FUNCTION public.portal_touch_physical_evaluation();

-- 3. Grading-day publication. Events stay private until published; cancelled events are hidden.
ALTER TABLE public.grading_events
 ADD COLUMN IF NOT EXISTS published_at timestamptz,
 ADD COLUMN IF NOT EXISTS branch_id int REFERENCES public.branches(id),
 ADD COLUMN IF NOT EXISTS start_time time,
 ADD COLUMN IF NOT EXISTS location text CHECK (location IS NULL OR length(location)<=160),
 ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
CREATE INDEX IF NOT EXISTS grading_events_published_upcoming ON public.grading_events(exam_date) WHERE published_at IS NOT NULL AND cancelled_at IS NULL;

-- 4. Branch opening hours: [{"day":"Mon","opens":"08:00","closes":"20:00"},{"day":"Sun","closed":true}]
ALTER TABLE public.branches
 ADD COLUMN IF NOT EXISTS opening_hours jsonb
 CHECK (opening_hours IS NULL OR (jsonb_typeof(opening_hours)='array' AND jsonb_array_length(opening_hours)<=7));

-- Operations: grading events gain branch/time/location at creation, plus edit, publish and cancel.
-- Copied from 20261101161201_role_permission_boundaries.sql (the deployed version) with only those changes.
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
 WHEN p_action IN ('exam','exam_update','exam_publish','exam_cancel','assess','promote') THEN 'action:evaluations_grade'
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
  INSERT INTO public.grading_events(title,exam_date,target_belt_id,passing_score,minimum_attendance,attendance_from,created_by,branch_id,start_time,location) VALUES(p_data->>'title',(p_data->>'examDate')::date,(p_data->>'targetBeltId')::int,(p_data->>'passingScore')::int,(p_data->>'minimumAttendance')::int,(p_data->>'attendanceFrom')::date,p_actor,NULLIF(p_data->>'branchId','')::int,NULLIF(p_data->>'startTime','')::time,NULLIF(btrim(p_data->>'location'),'')) RETURNING id INTO saved_id;result:=jsonb_build_object('id',saved_id);
 WHEN 'exam_update' THEN
  SELECT * INTO exam FROM public.grading_events WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR exam.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'Examination unavailable or cancelled' USING ERRCODE='22023'; END IF;
  IF (p_data->>'examDate')::date<exam.attendance_from THEN RAISE EXCEPTION 'The examination date cannot be before the attendance period starts' USING ERRCODE='22023'; END IF;
  IF (p_data->>'examDate')::date IS DISTINCT FROM exam.exam_date AND EXISTS(SELECT 1 FROM public.grading_candidates WHERE event_id=exam.id AND status='promoted') THEN RAISE EXCEPTION 'Promotions already use this examination date' USING ERRCODE='22023'; END IF;
  UPDATE public.grading_events SET title=p_data->>'title',exam_date=(p_data->>'examDate')::date,start_time=NULLIF(p_data->>'startTime','')::time,location=NULLIF(btrim(p_data->>'location'),''),branch_id=NULLIF(p_data->>'branchId','')::int WHERE id=exam.id;
  result:=jsonb_build_object('id',exam.id);
 WHEN 'exam_publish' THEN
  SELECT * INTO exam FROM public.grading_events WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR exam.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'Examination unavailable or cancelled' USING ERRCODE='22023'; END IF;
  UPDATE public.grading_events SET published_at=COALESCE(published_at,now()) WHERE id=exam.id;
  result:=jsonb_build_object('id',exam.id,'published',true);
 WHEN 'exam_cancel' THEN
  SELECT * INTO exam FROM public.grading_events WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Examination unavailable' USING ERRCODE='P0002'; END IF;
  IF EXISTS(SELECT 1 FROM public.grading_candidates WHERE event_id=exam.id AND status='promoted') THEN RAISE EXCEPTION 'An examination with recorded promotions cannot be cancelled' USING ERRCODE='22023'; END IF;
  UPDATE public.grading_events SET cancelled_at=COALESCE(cancelled_at,now()) WHERE id=exam.id;
  result:=jsonb_build_object('id',exam.id,'cancelled',true);
 WHEN 'assess' THEN
  SELECT * INTO exam FROM public.grading_events WHERE id=(p_data->>'eventId')::uuid;
  IF NOT FOUND OR exam.exam_date>today THEN RAISE EXCEPTION 'Choose a completed examination date' USING ERRCODE='22023'; END IF;
  IF exam.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'This examination was cancelled' USING ERRCODE='22023'; END IF;
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
  IF exam.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'This examination was cancelled' USING ERRCODE='22023'; END IF;
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
