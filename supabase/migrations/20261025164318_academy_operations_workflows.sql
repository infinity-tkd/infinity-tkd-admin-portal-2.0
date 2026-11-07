BEGIN;

-- Administrator access is challenged before operational records are exposed.
CREATE OR REPLACE FUNCTION public.auth_is_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active AND NOT p.must_change_password
 AND (p.role NOT IN ('Root','Super Root','Admin') OR auth.jwt()->>'aal'='aal2'));
$$;

CREATE TABLE public.portal_job_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_name text NOT NULL,
 status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','succeeded','partial','failed')),
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 metrics jsonb NOT NULL DEFAULT '{}', error_code text,
 CHECK(finished_at IS NULL OR finished_at>=started_at)
);
CREATE INDEX portal_job_runs_recent ON public.portal_job_runs(job_name,started_at DESC);
CREATE TABLE public.portal_job_leases (
 job_name text PRIMARY KEY, lease_until timestamptz NOT NULL, run_id uuid NOT NULL REFERENCES public.portal_job_runs(id)
);
CREATE TABLE public.academy_operations_policy (
 id text PRIMARY KEY DEFAULT 'default' CHECK(id='default'),
 reminder_lead_days int NOT NULL DEFAULT 5 CHECK(reminder_lead_days BETWEEN 0 AND 60),
 late_grace_days int NOT NULL DEFAULT 5 CHECK(late_grace_days BETWEEN 0 AND 60),
 pause_billing_rule text NOT NULL DEFAULT 'whole_cycles' CHECK(pause_billing_rule='whole_cycles'),
 updated_by uuid REFERENCES public.profiles(id),updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.academy_operations_policy(id) VALUES('default');

CREATE TABLE public.membership_pauses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id varchar NOT NULL REFERENCES public.students(id),
 start_date date NOT NULL, resume_date date NOT NULL, reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 500),
 approved_by uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(),
 voided_at timestamptz, voided_by uuid REFERENCES public.profiles(id), void_reason text,
 CHECK(resume_date>start_date), CHECK((voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL) OR (voided_at IS NOT NULL AND voided_by IS NOT NULL AND length(trim(void_reason)) BETWEEN 5 AND 500))
);
CREATE INDEX membership_pauses_student ON public.membership_pauses(student_id,start_date,resume_date) WHERE voided_at IS NULL;

ALTER TABLE public.students ADD COLUMN approved_pause_id uuid REFERENCES public.membership_pauses(id);
CREATE TABLE public.class_enrollment_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id varchar NOT NULL REFERENCES public.students(id),
 class_id int NOT NULL REFERENCES public.class_sessions(id), enrollment_id bigint,
 event_type text NOT NULL CHECK(event_type IN ('enrolled','changed','unenrolled','baseline')),
 before_record jsonb, after_record jsonb, recorded_by uuid REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX enrollment_history_student ON public.class_enrollment_history(student_id,created_at DESC);
CREATE TABLE public.class_membership_periods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id varchar NOT NULL REFERENCES public.students(id),
 class_id int NOT NULL REFERENCES public.class_sessions(id), enrollment_id bigint,
 start_date date NOT NULL,end_date date,baseline boolean NOT NULL DEFAULT false,
 CHECK(end_date IS NULL OR end_date>=start_date)
);
CREATE UNIQUE INDEX membership_period_open ON public.class_membership_periods(student_id,class_id) WHERE end_date IS NULL;
INSERT INTO public.class_membership_periods(student_id,class_id,enrollment_id,start_date,baseline)
 SELECT e.student_id,e.class_id,e.id,COALESCE(e.enrollment_date,s.registration_date),true FROM public.class_enrollments e JOIN public.students s ON s.id=e.student_id;
INSERT INTO public.class_enrollment_history(student_id,class_id,enrollment_id,event_type,after_record)
 SELECT student_id,class_id,id,'baseline',to_jsonb(e) FROM public.class_enrollments e;

CREATE TABLE public.academy_holidays (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL CHECK(length(trim(title)) BETWEEN 2 AND 120),
 branch_id int REFERENCES public.branches(id),start_date date NOT NULL,end_date date NOT NULL,
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 500),created_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),voided_at timestamptz, CHECK(end_date>=start_date)
);
CREATE TABLE public.class_occurrences (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),class_id int NOT NULL REFERENCES public.class_sessions(id),
 source_date date NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,
 class_name text NOT NULL,branch_id int NOT NULL REFERENCES public.branches(id),coach_id uuid REFERENCES public.profiles(id),
 capacity int NOT NULL CHECK(capacity>0),status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled')),
 roster_provenance text NOT NULL DEFAULT 'snapshot' CHECK(roster_provenance IN ('snapshot','reconstructed','reviewed')),
 revision int NOT NULL DEFAULT 1 CHECK(revision>0),change_reason text,holiday_id uuid REFERENCES public.academy_holidays(id),
 created_by uuid REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(class_id,source_date),CHECK(ends_at>starts_at)
);
CREATE INDEX occurrence_dates ON public.class_occurrences(starts_at,status);
CREATE TABLE public.class_occurrence_roster (
 occurrence_id uuid NOT NULL REFERENCES public.class_occurrences(id),student_id varchar NOT NULL REFERENCES public.students(id),
 enrolled_date date NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(occurrence_id,student_id)
);
ALTER TABLE public.attendance ADD COLUMN occurrence_id uuid REFERENCES public.class_occurrences(id);
CREATE INDEX attendance_occurrence ON public.attendance(occurrence_id) WHERE occurrence_id IS NOT NULL;

CREATE TABLE public.membership_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id varchar NOT NULL REFERENCES public.students(id),
 cycle_month date NOT NULL CHECK(extract(day from cycle_month)=1),due_date date NOT NULL,cycle_end date NOT NULL,
 amount_usd numeric(12,2) NOT NULL CHECK(amount_usd>=0),waiver_usd numeric(12,2) NOT NULL DEFAULT 0 CHECK(waiver_usd>=0),balance_usd numeric(12,2) NOT NULL DEFAULT 0 CHECK(balance_usd>=0),
 rate_snapshot jsonb NOT NULL,legacy_settlement_id bigint REFERENCES public.payments(id),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(student_id,cycle_month),CHECK(cycle_end>due_date),CHECK(waiver_usd<=amount_usd)
);
CREATE TABLE public.membership_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id varchar NOT NULL REFERENCES public.students(id),
 amount_usd numeric(12,2) NOT NULL CHECK(amount_usd>0),payment_date date NOT NULL,
 payment_method text NOT NULL CHECK(payment_method IN ('Cash','Bank Transfer','Credit Card','ABA Bank KHQR')),
 external_reference text,receipt_number text NOT NULL UNIQUE DEFAULT ('ITA-'||replace(gen_random_uuid()::text,'-','')),
 recorded_by uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(payment_method='Cash' OR length(trim(external_reference)) BETWEEN 3 AND 120)
);
CREATE UNIQUE INDEX membership_receipt_reference ON public.membership_receipts(lower(trim(external_reference))) WHERE external_reference IS NOT NULL;
CREATE TABLE public.membership_allocations (
 receipt_id uuid NOT NULL REFERENCES public.membership_receipts(id),invoice_id uuid NOT NULL REFERENCES public.membership_invoices(id),
 amount_usd numeric(12,2) NOT NULL CHECK(amount_usd>0),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(receipt_id,invoice_id)
);
CREATE TABLE public.membership_credits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id varchar NOT NULL REFERENCES public.students(id),
 receipt_id uuid UNIQUE REFERENCES public.membership_receipts(id),amount_usd numeric(12,2) NOT NULL CHECK(amount_usd>0),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 500),issued_by uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.membership_credit_uses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),credit_id uuid NOT NULL REFERENCES public.membership_credits(id),
 invoice_id uuid NOT NULL REFERENCES public.membership_invoices(id),amount_usd numeric(12,2) NOT NULL CHECK(amount_usd>0),
 recorded_by uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.payment_reconciliation_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bank_reference text NOT NULL UNIQUE CHECK(length(trim(bank_reference)) BETWEEN 3 AND 120),
 amount_usd numeric(12,2) NOT NULL CHECK(amount_usd>0),transaction_date date NOT NULL,
 receipt_id uuid UNIQUE REFERENCES public.membership_receipts(id),matched_by uuid REFERENCES public.profiles(id),matched_at timestamptz,
 imported_by uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((receipt_id IS NULL AND matched_by IS NULL AND matched_at IS NULL) OR (receipt_id IS NOT NULL AND matched_by IS NOT NULL AND matched_at IS NOT NULL))
);

CREATE TABLE public.followup_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL CHECK(length(trim(title)) BETWEEN 3 AND 160),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=1000),student_id varchar REFERENCES public.students(id),source_key text UNIQUE,
 category text NOT NULL CHECK(category IN ('attendance','billing','orders','general')),
 assigned_to uuid NOT NULL REFERENCES public.profiles(id),due_date date NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','completed','cancelled')),
 revision int NOT NULL DEFAULT 1,completion_note text,created_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX followup_due ON public.followup_tasks(assigned_to,status,due_date);
CREATE TABLE public.student_activity_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id varchar NOT NULL REFERENCES public.students(id),
 category text NOT NULL CHECK(category IN ('profile','attendance','billing','enrollment','grading')),
 title text NOT NULL,record_id text,recorded_by uuid REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX student_activity_recent ON public.student_activity_events(student_id,created_at DESC);
CREATE TABLE public.grading_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL CHECK(length(trim(title)) BETWEEN 3 AND 160),
 exam_date date NOT NULL,target_belt_id int NOT NULL REFERENCES public.belts(id),
 passing_score int NOT NULL CHECK(passing_score BETWEEN 0 AND 100),minimum_attendance int NOT NULL CHECK(minimum_attendance BETWEEN 0 AND 100),
 attendance_from date NOT NULL,created_by uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now(),CHECK(attendance_from<=exam_date)
);
CREATE TABLE public.grading_candidates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES public.grading_events(id),
 student_id varchar NOT NULL REFERENCES public.students(id),score numeric(5,2) CHECK(score BETWEEN 0 AND 100),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','assessed','failed','promoted')),
 assessment_notes text NOT NULL DEFAULT '' CHECK(length(assessment_notes)<=1000),override_reason text,
 assessed_by uuid REFERENCES public.profiles(id),promoted_by uuid REFERENCES public.profiles(id),
 belt_history_id int UNIQUE REFERENCES public.belt_histories(id),revision int NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(event_id,student_id)
);
CREATE TABLE public.portal_performance_samples (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),page text NOT NULL CHECK(page ~ '^/[a-z/-]*$'),
 metric_key text NOT NULL UNIQUE,
 metric text NOT NULL CHECK(metric IN ('LCP','INP','CLS')),value numeric NOT NULL CHECK(value>=0 AND value<=600000),
 device text NOT NULL CHECK(device IN ('phone','tablet','desktop')),recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX performance_recent ON public.portal_performance_samples(recorded_at,metric,device);
CREATE TABLE public.data_quality_reviews (
 finding_key text PRIMARY KEY,note text NOT NULL CHECK(length(trim(note)) BETWEEN 5 AND 500),reviewed_by uuid NOT NULL REFERENCES public.profiles(id),reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.portal_operation_requests (
 request_key uuid PRIMARY KEY,actor uuid NOT NULL REFERENCES public.profiles(id),action text NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['portal_job_runs','portal_job_leases','academy_operations_policy','membership_pauses','class_enrollment_history','class_membership_periods','academy_holidays','class_occurrences','class_occurrence_roster','membership_invoices','membership_receipts','membership_allocations','membership_credits','membership_credit_uses','payment_reconciliation_lines','followup_tasks','student_activity_events','grading_events','grading_candidates','portal_performance_samples','data_quality_reviews','portal_operation_requests'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
-- Operational reads are performed by scoped server endpoints. No broad client policies.

CREATE FUNCTION public.portal_claim_job(p_name text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE run uuid; BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 IF p_name NOT IN ('notifications','operations') THEN RAISE EXCEPTION 'Unknown job' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('job:'||p_name,0));
 IF EXISTS(SELECT 1 FROM public.portal_job_leases WHERE job_name=p_name AND lease_until>now()) THEN RETURN NULL; END IF;
 UPDATE public.portal_job_runs SET status='failed',finished_at=now(),error_code='LEASE_EXPIRED' WHERE job_name=p_name AND status='running';
 INSERT INTO public.portal_job_runs(job_name) VALUES(p_name) RETURNING id INTO run;
 INSERT INTO public.portal_job_leases(job_name,lease_until,run_id) VALUES(p_name,now()+interval '2 minutes',run) ON CONFLICT(job_name) DO UPDATE SET lease_until=EXCLUDED.lease_until,run_id=EXCLUDED.run_id;
 RETURN run;
END $$;
REVOKE ALL ON FUNCTION public.portal_claim_job(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_claim_job(text) TO service_role;

CREATE FUNCTION public.portal_billing_due(p_student text,p_month date) RETURNS date
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.students; base date; day_number int; due date; BEGIN
 SELECT * INTO s FROM public.students WHERE id=p_student AND deleted_at IS NULL;
 IF NOT FOUND OR p_month IS NULL OR extract(day from p_month)<>1 OR extract(year from p_month) NOT BETWEEN 2020 AND 2100 THEN RAISE EXCEPTION 'Invalid student or billing cycle' USING ERRCODE='22023'; END IF;
 SELECT COALESCE(s.membership_start_date,min(enrollment_date),s.registration_date) INTO base FROM public.class_enrollments WHERE student_id=s.id;
 IF p_month<date_trunc('month',base)::date THEN RAISE EXCEPTION 'Billing cycle precedes membership' USING ERRCODE='22023'; END IF;
 SELECT (x->>'day')::int INTO day_number FROM jsonb_array_elements(s.billing_schedule) x WHERE (x->>'effectiveMonth')::date<=p_month ORDER BY x->>'effectiveMonth' DESC,x->>'changedAt' DESC LIMIT 1;
 day_number:=COALESCE(day_number,extract(day from base)::int);
 due:=p_month+least(day_number,extract(day from p_month+interval '1 month'-interval '1 day')::int)-1;
 RETURN CASE WHEN date_trunc('month',base)::date=p_month THEN greatest(base,due) ELSE due END;
END $$;

CREATE FUNCTION public.portal_ensure_invoice(p_student text,p_month date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i public.membership_invoices; s public.students; plan public.scholarships; config public.academy_profile; settled public.payments; due date; ends date; amount numeric; waived numeric:=0; BEGIN
 PERFORM 1 FROM public.students WHERE id=p_student AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student unavailable' USING ERRCODE='P0002'; END IF;
 SELECT * INTO i FROM public.membership_invoices WHERE student_id=p_student AND cycle_month=p_month;
 IF FOUND THEN RETURN i.id; END IF;
 due:=public.portal_billing_due(p_student,p_month);ends:=public.portal_billing_due(p_student,(p_month+interval '1 month')::date);
 SELECT * INTO s FROM public.students WHERE id=p_student; SELECT * INTO plan FROM public.scholarships WHERE id=s.scholarship_id;SELECT * INTO config FROM public.academy_profile WHERE id='default';
 amount:=CASE WHEN plan.type_name='Early Group Student' THEN COALESCE(config.early_group_tuition_usd,25) ELSE round(COALESCE(config.standard_tuition_usd,45)*(100-greatest(0,least(100,plan.discount_percentage)))/100,2) END;
 SELECT * INTO settled FROM public.payments WHERE student_id=p_student AND year=extract(year from p_month) AND for_month=(ARRAY['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])[extract(month from p_month)::int] AND status IN ('Paid','Waived');
 IF settled.id IS NOT NULL THEN amount:=settled.amount_usd;
 ELSIF EXISTS(SELECT 1 FROM public.membership_pauses WHERE student_id=p_student AND voided_at IS NULL AND start_date<=due AND resume_date>=ends) THEN waived:=amount; END IF;
 INSERT INTO public.membership_invoices(student_id,cycle_month,due_date,cycle_end,amount_usd,waiver_usd,balance_usd,rate_snapshot,legacy_settlement_id)
 VALUES(p_student,p_month,due,ends,amount,waived,CASE WHEN settled.id IS NOT NULL THEN 0 ELSE amount-waived END,jsonb_build_object('scholarshipId',plan.id,'discountPercentage',plan.discount_percentage,'standardFee',config.standard_tuition_usd,'earlyFee',config.early_group_tuition_usd,'legacy',settled.id IS NOT NULL),settled.id) RETURNING id INTO i.id;
 RETURN i.id;
END $$;

CREATE FUNCTION public.portal_invoice_balance(p_invoice uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN legacy_settlement_id IS NOT NULL THEN 0 ELSE greatest(0,amount_usd-waiver_usd-
 COALESCE((SELECT sum(amount_usd) FROM public.membership_allocations WHERE invoice_id=i.id),0)-
 COALESCE((SELECT sum(amount_usd) FROM public.membership_credit_uses WHERE invoice_id=i.id),0)) END FROM public.membership_invoices i WHERE id=p_invoice;
$$;

CREATE FUNCTION public.portal_project_invoice(p_invoice uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i public.membership_invoices; cash numeric; method_date date; BEGIN
 SELECT * INTO i FROM public.membership_invoices WHERE id=p_invoice FOR UPDATE;
 IF i.legacy_settlement_id IS NOT NULL THEN RETURN; END IF;
 UPDATE public.membership_invoices SET balance_usd=public.portal_invoice_balance(i.id) WHERE id=i.id;
 SELECT COALESCE(sum(a.amount_usd),0),max(r.payment_date) INTO cash,method_date FROM public.membership_allocations a JOIN public.membership_receipts r ON r.id=a.receipt_id WHERE a.invoice_id=i.id;
 INSERT INTO public.payments(student_id,year,for_month,billing_month,status,payment_date,amount_usd,notes)
 VALUES(i.student_id,extract(year from i.cycle_month),(ARRAY['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])[extract(month from i.cycle_month)::int],i.cycle_month,
 CASE WHEN public.portal_invoice_balance(i.id)>0 THEN 'Pending' WHEN cash>0 THEN 'Paid' ELSE 'Waived' END,CASE WHEN public.portal_invoice_balance(i.id)=0 THEN COALESCE(method_date,(now() AT TIME ZONE 'Asia/Phnom_Penh')::date) ELSE method_date END,cash,'INV-'||i.id::text)
 ON CONFLICT(student_id,year,for_month) DO UPDATE SET status=EXCLUDED.status,payment_date=EXCLUDED.payment_date,amount_usd=EXCLUDED.amount_usd,notes=EXCLUDED.notes;
END $$;

CREATE FUNCTION public.portal_capture_enrollment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE student text; lesson int; enrollment bigint; starts date; actor uuid; BEGIN
 actor:=auth.uid();
 IF TG_OP='DELETE' THEN student:=OLD.student_id;lesson:=OLD.class_id;enrollment:=OLD.id; ELSE student:=NEW.student_id;lesson:=NEW.class_id;enrollment:=NEW.id; END IF;
 INSERT INTO public.class_enrollment_history(student_id,class_id,enrollment_id,event_type,before_record,after_record,recorded_by)
 VALUES(student,lesson,enrollment,CASE TG_OP WHEN 'INSERT' THEN 'enrolled' WHEN 'DELETE' THEN 'unenrolled' ELSE 'changed' END,CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END,actor);
 IF TG_OP='DELETE' OR TG_OP='UPDATE' AND (OLD.student_id,OLD.class_id) IS DISTINCT FROM (NEW.student_id,NEW.class_id) THEN
  UPDATE public.class_membership_periods SET end_date=greatest(start_date,(now() AT TIME ZONE 'Asia/Phnom_Penh')::date) WHERE enrollment_id=OLD.id AND end_date IS NULL;
 END IF;
 IF TG_OP<>'DELETE' THEN
  SELECT COALESCE(NEW.enrollment_date,registration_date) INTO starts FROM public.students WHERE id=student;
  INSERT INTO public.class_membership_periods(student_id,class_id,enrollment_id,start_date) VALUES(student,lesson,enrollment,starts)
  ON CONFLICT(student_id,class_id) WHERE end_date IS NULL DO UPDATE SET enrollment_id=EXCLUDED.enrollment_id,start_date=EXCLUDED.start_date;
 END IF;
 INSERT INTO public.student_activity_events(student_id,category,title,record_id,recorded_by) VALUES(student,'enrollment',CASE TG_OP WHEN 'INSERT' THEN 'Class enrollment added' WHEN 'DELETE' THEN 'Class enrollment ended' ELSE 'Enrollment corrected' END,enrollment::text,actor);
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER portal_capture_enrollment AFTER INSERT OR UPDATE OR DELETE ON public.class_enrollments FOR EACH ROW EXECUTE FUNCTION public.portal_capture_enrollment();
CREATE TRIGGER enrollment_history_immutable BEFORE UPDATE OR DELETE ON public.class_enrollment_history FOR EACH ROW EXECUTE FUNCTION public.portal_immutable_transaction();
CREATE TRIGGER membership_receipts_immutable BEFORE UPDATE OR DELETE ON public.membership_receipts FOR EACH ROW EXECUTE FUNCTION public.portal_immutable_transaction();
CREATE TRIGGER allocations_immutable BEFORE UPDATE OR DELETE ON public.membership_allocations FOR EACH ROW EXECUTE FUNCTION public.portal_immutable_transaction();
CREATE TRIGGER credits_immutable BEFORE UPDATE OR DELETE ON public.membership_credits FOR EACH ROW EXECUTE FUNCTION public.portal_immutable_transaction();
CREATE TRIGGER credit_uses_immutable BEFORE UPDATE OR DELETE ON public.membership_credit_uses FOR EACH ROW EXECUTE FUNCTION public.portal_immutable_transaction();
CREATE TRIGGER activity_events_immutable BEFORE UPDATE OR DELETE ON public.student_activity_events FOR EACH ROW EXECUTE FUNCTION public.portal_immutable_transaction();

CREATE FUNCTION public.portal_snapshot_sessions(p_actor uuid,p_from date,p_to date) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.class_sessions; day date; occurrence uuid; holiday uuid; count_created int:=0; BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:schedule_manage');
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>93 THEN RAISE EXCEPTION 'Choose a session range up to 93 days' USING ERRCODE='22023'; END IF;
 FOR c IN SELECT * FROM public.class_sessions ORDER BY id LOOP
  FOR day IN SELECT generate_series(p_from,p_to,interval '1 day')::date LOOP
   IF NOT(trim(to_char(day,'Day'))=ANY(CASE WHEN cardinality(c.days_of_week)>0 THEN c.days_of_week ELSE ARRAY[c.day_of_week::text] END)) THEN CONTINUE; END IF;
   SELECT id INTO holiday FROM public.academy_holidays WHERE voided_at IS NULL AND day BETWEEN start_date AND end_date AND (branch_id IS NULL OR branch_id=c.branch_id) ORDER BY created_at LIMIT 1;
   INSERT INTO public.class_occurrences(class_id,source_date,starts_at,ends_at,class_name,branch_id,coach_id,capacity,status,holiday_id,change_reason,created_by,roster_provenance)
   VALUES(c.id,day,(day+c.start_time) AT TIME ZONE 'Asia/Phnom_Penh',((day+CASE WHEN c.end_time<=c.start_time THEN 1 ELSE 0 END)+c.end_time) AT TIME ZONE 'Asia/Phnom_Penh',c.class_name,c.branch_id,COALESCE(c.coach_id,c.head_coach_id),c.capacity,CASE WHEN holiday IS NULL THEN 'scheduled' ELSE 'cancelled' END,holiday,CASE WHEN holiday IS NOT NULL THEN 'Academy holiday' END,p_actor,CASE WHEN (day+c.start_time) AT TIME ZONE 'Asia/Phnom_Penh'<now() THEN 'reconstructed' ELSE 'snapshot' END)
   ON CONFLICT(class_id,source_date) DO NOTHING RETURNING id INTO occurrence;
   IF occurrence IS NULL THEN CONTINUE; END IF;count_created:=count_created+1;
   INSERT INTO public.class_occurrence_roster(occurrence_id,student_id,enrolled_date)
   SELECT occurrence,s.id,p.start_date FROM public.class_membership_periods p JOIN public.students s ON s.id=p.student_id
   WHERE p.class_id=c.id AND p.start_date<=day AND (p.end_date IS NULL OR day<p.end_date) AND s.deleted_at IS NULL
   AND ((day+c.start_time) AT TIME ZONE 'Asia/Phnom_Penh'<=now() OR s.student_status='Active' OR s.student_status='Paused' AND EXISTS(SELECT 1 FROM public.membership_pauses x WHERE x.id=s.approved_pause_id AND x.voided_at IS NULL AND x.resume_date<=day))
   AND NOT EXISTS(SELECT 1 FROM public.membership_pauses m WHERE m.student_id=s.id AND m.voided_at IS NULL AND day>=m.start_date AND day<m.resume_date);
  END LOOP;
 END LOOP; RETURN count_created;
END $$;

DO $$ DECLARE fn record; BEGIN
 FOR fn IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('portal_billing_due','portal_ensure_invoice','portal_invoice_balance','portal_project_invoice','portal_capture_enrollment','portal_snapshot_sessions') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fn.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fn.signature);
 END LOOP;
END $$;
CREATE FUNCTION public.portal_operations_mutate(p_actor uuid,p_action text,p_data jsonb,p_request_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE permission text; actor public.profiles; previous public.portal_operation_requests; result jsonb; student text;
 invoice public.membership_invoices; receipt public.membership_receipts; credit public.membership_credits;
 occurrence public.class_occurrences; task public.followup_tasks; exam public.grading_events; candidate public.grading_candidates;
 bank public.payment_reconciliation_lines; paused public.membership_pauses; item jsonb; amount numeric; allocation numeric; balance numeric;
 total numeric; saved_id uuid; starts timestamptz; ends timestamptz; day date; today date:=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date;
 class_count int; attended_count int; attendance_pct numeric; target_belt text; promoted int; BEGIN
 permission:=CASE WHEN p_action IN ('policy','quality_review') THEN 'page:settings'
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
CREATE FUNCTION public.portal_process_membership_dates() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.students; pause_active public.membership_pauses; owner_id uuid; today date:=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date; processed int:=0; failed int:=0; invoice_id uuid; BEGIN
 SELECT id INTO owner_id FROM public.profiles WHERE is_active AND NOT must_change_password AND role IN ('Root','Super Root') ORDER BY created_at LIMIT 1;
 FOR s IN SELECT * FROM public.students WHERE deleted_at IS NULL AND student_status IN ('Active','Paused') ORDER BY id LIMIT 1000 LOOP
  BEGIN
   PERFORM 1 FROM public.students WHERE id=s.id FOR UPDATE;
   SELECT * INTO pause_active FROM public.membership_pauses WHERE student_id=s.id AND voided_at IS NULL AND start_date<=today AND resume_date>today ORDER BY start_date LIMIT 1;
   IF pause_active.id IS NOT NULL AND s.student_status='Active' THEN
    UPDATE public.students SET student_status='Paused',approved_pause_id=pause_active.id,pause_end_date=pause_active.resume_date,status_reason='Approved membership pause',status_changed_at=now() WHERE id=s.id;
    INSERT INTO public.student_activity_events(student_id,category,title,recorded_by) VALUES(s.id,'profile','Approved membership pause started',pause_active.approved_by);
   ELSIF pause_active.id IS NULL AND s.student_status='Paused' AND EXISTS(SELECT 1 FROM public.membership_pauses WHERE id=s.approved_pause_id AND student_id=s.id AND (resume_date<=today OR voided_at IS NOT NULL)) THEN
    UPDATE public.students SET student_status='Active',approved_pause_id=NULL,pause_end_date=NULL,status_reason='Approved membership pause completed',status_changed_at=now() WHERE id=s.id;
    INSERT INTO public.student_activity_events(student_id,category,title) VALUES(s.id,'profile','Membership returned after approved pause');
   END IF;
   IF date_trunc('month',COALESCE(s.membership_start_date,s.registration_date))::date<=date_trunc('month',today)::date THEN
    invoice_id:=public.portal_ensure_invoice(s.id,date_trunc('month',today)::date);
    IF EXISTS(SELECT 1 FROM public.membership_invoices WHERE id=invoice_id AND waiver_usd>0 AND legacy_settlement_id IS NULL) THEN PERFORM public.portal_project_invoice(invoice_id); END IF;
   END IF;
   processed:=processed+1;
  EXCEPTION WHEN OTHERS THEN
   failed:=failed+1;
   IF owner_id IS NOT NULL THEN
    INSERT INTO public.followup_tasks(source_key,title,description,student_id,category,assigned_to,due_date,created_by)
    VALUES('membership-status:'||s.id,'Membership status needs review','An automated membership update was blocked. Review roster capacity, approved pause dates and billing configuration.',s.id,'general',owner_id,today,owner_id)
    ON CONFLICT(source_key) DO UPDATE SET status=CASE WHEN public.followup_tasks.status IN ('completed','cancelled') THEN 'open' ELSE public.followup_tasks.status END,updated_at=now();
   END IF;
  END;
 END LOOP;RETURN jsonb_build_object('processed',processed,'failed',failed);
END $$;
REVOKE ALL ON FUNCTION public.portal_process_membership_dates() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_process_membership_dates() TO service_role;
CREATE OR REPLACE FUNCTION public.portal_validate_tuition_settlement() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE invoice_id uuid; invoice public.membership_invoices; cycle date; expected numeric; BEGIN
 IF NEW.for_month NOT IN ('Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec') THEN RAISE EXCEPTION 'Invalid billing month' USING ERRCODE='22023'; END IF;
 cycle:=make_date(NEW.year,array_position(ARRAY['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],NEW.for_month),1);
 IF cycle<date_trunc('month',now() AT TIME ZONE 'Asia/Phnom_Penh')::date AND NOT EXISTS(SELECT 1 FROM public.membership_invoices WHERE student_id=NEW.student_id AND cycle_month=cycle) THEN RAISE EXCEPTION 'Open this historical cycle in the invoice ledger and verify its original fee first' USING ERRCODE='22023'; END IF;
 invoice_id:=public.portal_ensure_invoice(NEW.student_id,cycle);SELECT * INTO invoice FROM public.membership_invoices WHERE id=invoice_id FOR UPDATE;
 IF invoice.legacy_settlement_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.membership_allocations a WHERE a.invoice_id=invoice.id) OR EXISTS(SELECT 1 FROM public.membership_credit_uses u WHERE u.invoice_id=invoice.id) THEN RAISE EXCEPTION 'Use the invoice ledger for a cycle with existing payments or credits' USING ERRCODE='22023'; END IF;
 expected:=invoice.amount_usd-invoice.waiver_usd;
 IF NEW.amount_usd>0 AND NEW.amount_usd<>expected THEN RAISE EXCEPTION 'This cycle is % USD. Use its invoice ledger for partial collection',expected USING ERRCODE='22023'; END IF;
 IF NEW.amount_usd=0 AND NEW.payment_method<>'Waived' THEN RAISE EXCEPTION 'A zero settlement requires an explicit waiver' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.portal_link_legacy_settlement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.status IN ('Paid','Waived') AND COALESCE(NEW.notes,'') NOT LIKE 'INV-%' THEN
  UPDATE public.membership_invoices SET legacy_settlement_id=NEW.id,balance_usd=0 WHERE student_id=NEW.student_id AND cycle_month=make_date(NEW.year,array_position(ARRAY['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],NEW.for_month),1) AND legacy_settlement_id IS NULL;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER portal_link_legacy_settlement AFTER INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.portal_link_legacy_settlement();
REVOKE ALL ON FUNCTION public.portal_link_legacy_settlement() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.portal_refresh_future_rosters() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 DELETE FROM public.class_occurrence_roster r USING public.class_occurrences o WHERE r.occurrence_id=o.id AND o.starts_at>now();
 INSERT INTO public.class_occurrence_roster(occurrence_id,student_id,enrolled_date)
 SELECT o.id,s.id,p.start_date FROM public.class_occurrences o JOIN public.class_membership_periods p ON p.class_id=o.class_id JOIN public.students s ON s.id=p.student_id
 WHERE o.starts_at>now() AND s.deleted_at IS NULL AND p.start_date<=(o.starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date
 AND (p.end_date IS NULL OR (o.starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date<p.end_date)
 AND (s.student_status='Active' OR s.student_status='Paused' AND EXISTS(SELECT 1 FROM public.membership_pauses x WHERE x.id=s.approved_pause_id AND x.voided_at IS NULL AND x.resume_date<=(o.starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date))
 AND NOT EXISTS(SELECT 1 FROM public.membership_pauses m WHERE m.student_id=s.id AND m.voided_at IS NULL AND (o.starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date>=m.start_date AND (o.starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date<m.resume_date)
 ON CONFLICT DO NOTHING;
END $$;
CREATE FUNCTION public.portal_refresh_rosters_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM public.portal_refresh_future_rosters();RETURN NULL;
END $$;
CREATE TRIGGER portal_refresh_enrollment_rosters AFTER INSERT OR UPDATE OR DELETE ON public.class_membership_periods FOR EACH STATEMENT EXECUTE FUNCTION public.portal_refresh_rosters_trigger();
CREATE TRIGGER portal_refresh_pause_rosters AFTER INSERT OR UPDATE ON public.membership_pauses FOR EACH STATEMENT EXECUTE FUNCTION public.portal_refresh_rosters_trigger();
CREATE TRIGGER portal_refresh_student_rosters AFTER UPDATE OF student_status,deleted_at ON public.students FOR EACH STATEMENT EXECUTE FUNCTION public.portal_refresh_rosters_trigger();
CREATE TRIGGER portal_refresh_moved_rosters AFTER UPDATE OF starts_at ON public.class_occurrences FOR EACH STATEMENT EXECUTE FUNCTION public.portal_refresh_rosters_trigger();

CREATE FUNCTION public.portal_attendance_session_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.class_occurrences; BEGIN
 IF NEW.date>(now() AT TIME ZONE 'Asia/Phnom_Penh')::date THEN RAISE EXCEPTION 'Future attendance cannot be marked' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.membership_pauses WHERE student_id=NEW.student_id AND voided_at IS NULL AND NEW.date>=start_date AND NEW.date<resume_date) THEN RAISE EXCEPTION 'Membership is paused on this date' USING ERRCODE='22023'; END IF;
 IF NEW.class_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO o FROM public.class_occurrences WHERE class_id=NEW.class_id AND (id=NEW.occurrence_id OR (starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date=NEW.date OR source_date=NEW.date)
 ORDER BY CASE WHEN id=NEW.occurrence_id THEN 0 WHEN (starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date=NEW.date THEN 1 ELSE 2 END LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  IF o.status='cancelled' THEN RAISE EXCEPTION 'This session is cancelled. No attendance mark is required' USING ERRCODE='22023'; END IF;
  IF (o.starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date<>NEW.date THEN RAISE EXCEPTION 'This session was rescheduled. Use its actual date' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.class_occurrence_roster WHERE occurrence_id=o.id AND student_id=NEW.student_id) THEN RAISE EXCEPTION 'Student is outside the saved session roster' USING ERRCODE='22023'; END IF;
  NEW.occurrence_id:=o.id;
 END IF;
 IF EXISTS(SELECT 1 FROM public.membership_pauses WHERE student_id=NEW.student_id AND voided_at IS NULL AND NEW.date>=start_date AND NEW.date<resume_date) THEN RAISE EXCEPTION 'Membership is paused on this date' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER portal_attendance_session_guard BEFORE INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.portal_attendance_session_guard();
CREATE FUNCTION public.portal_attendance_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 INSERT INTO public.student_activity_events(student_id,category,title,record_id,recorded_by) VALUES(COALESCE(NEW.student_id,OLD.student_id),'attendance',CASE TG_OP WHEN 'INSERT' THEN 'Attendance recorded' WHEN 'DELETE' THEN 'Attendance mark cleared' ELSE 'Attendance corrected' END,COALESCE(NEW.id,OLD.id)::text,auth.uid());RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER portal_attendance_activity AFTER INSERT OR UPDATE OR DELETE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.portal_attendance_activity();

CREATE FUNCTION public.portal_sync_invoice_dates() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i public.membership_invoices; BEGIN
 IF NEW.billing_schedule IS NOT DISTINCT FROM OLD.billing_schedule THEN RETURN NEW; END IF;
 FOR i IN SELECT * FROM public.membership_invoices WHERE student_id=NEW.id AND legacy_settlement_id IS NULL AND public.portal_invoice_balance(id)>0 AND cycle_month>=date_trunc('month',(now() AT TIME ZONE 'Asia/Phnom_Penh'))::date LOOP
  UPDATE public.membership_invoices SET due_date=public.portal_billing_due(NEW.id,i.cycle_month),cycle_end=public.portal_billing_due(NEW.id,(i.cycle_month+interval '1 month')::date) WHERE id=i.id;
 END LOOP; RETURN NEW;
END $$;
CREATE TRIGGER portal_sync_invoice_dates AFTER UPDATE OF billing_schedule ON public.students FOR EACH ROW EXECUTE FUNCTION public.portal_sync_invoice_dates();

CREATE FUNCTION public.portal_unique_bank_reference() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ref text; BEGIN
 ref:=NULLIF(lower(trim(NEW.external_reference)),'');IF ref IS NULL THEN RETURN NEW;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('bank-reference:'||ref,0));
 IF TG_TABLE_NAME='membership_receipts' AND EXISTS(SELECT 1 FROM public.household_payment_batches WHERE lower(trim(external_reference))=ref) OR TG_TABLE_NAME='household_payment_batches' AND EXISTS(SELECT 1 FROM public.membership_receipts WHERE lower(trim(external_reference))=ref) THEN RAISE EXCEPTION 'Bank reference is already recorded in another collection' USING ERRCODE='23505'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER portal_unique_bank_reference BEFORE INSERT ON public.membership_receipts FOR EACH ROW EXECUTE FUNCTION public.portal_unique_bank_reference();
CREATE TRIGGER portal_unique_family_bank_reference BEFORE INSERT ON public.household_payment_batches FOR EACH ROW EXECUTE FUNCTION public.portal_unique_bank_reference();

GRANT SELECT ON public.academy_operations_policy TO authenticated;
CREATE POLICY operations_policy_read ON public.academy_operations_policy FOR SELECT TO authenticated USING(public.is_dojo_staff());
GRANT SELECT ON public.membership_invoices,public.membership_pauses TO authenticated;
CREATE POLICY invoice_summary_read ON public.membership_invoices FOR SELECT TO authenticated USING(public.auth_is_active() AND (public.portal_has_permission('page:financials') OR public.is_current_student(student_id)));
CREATE POLICY membership_pause_read ON public.membership_pauses FOR SELECT TO authenticated USING(public.auth_is_active() AND (public.portal_has_permission('page:financials') OR public.portal_has_permission('page:attendance') OR public.is_current_student(student_id)));

DO $$ DECLARE fn record; BEGIN
 FOR fn IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('portal_refresh_future_rosters','portal_refresh_rosters_trigger','portal_attendance_session_guard','portal_attendance_activity','portal_sync_invoice_dates','portal_unique_bank_reference') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fn.signature);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fn.signature);
 END LOOP;
END $$;
ALTER TABLE public.makeup_attendance ADD COLUMN source_occurrence_id uuid REFERENCES public.class_occurrences(id);
CREATE OR REPLACE FUNCTION public.portal_record_makeup(p_actor uuid,p_student_id text,p_source_class int,p_source_date date,p_attended_date date,p_target_class int,p_status text,p_reason text,p_request_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.students; c public.class_sessions; e public.class_enrollments; m public.makeup_attendance; original_status text; occurrence public.class_occurrences; ended timestamptz; today date:=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:attendance_mark');
 SELECT * INTO s FROM public.students WHERE id=p_student_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR s.student_status<>'Active' THEN RAISE EXCEPTION 'An active student is required' USING ERRCODE='22023'; END IF;
 SELECT * INTO m FROM public.makeup_attendance WHERE request_key=p_request_key;
 IF FOUND THEN IF m.student_id<>p_student_id OR m.source_class_id<>p_source_class OR m.source_date<>p_source_date OR m.attended_date<>p_attended_date OR m.target_class_id IS DISTINCT FROM p_target_class OR m.status<>p_status OR m.reason<>trim(p_reason) OR m.marked_by<>p_actor THEN RAISE EXCEPTION 'Request key mismatch' USING ERRCODE='22023'; END IF; RETURN to_jsonb(m); END IF;
 SELECT * INTO c FROM public.class_sessions WHERE id=p_source_class;
 SELECT * INTO e FROM public.class_enrollments WHERE student_id=p_student_id AND class_id=p_source_class;
 SELECT * INTO occurrence FROM public.class_occurrences WHERE class_id=p_source_class AND (starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date=p_source_date LIMIT 1 FOR SHARE;
 IF occurrence.id IS NOT NULL THEN
  IF occurrence.status='cancelled' OR NOT EXISTS(SELECT 1 FROM public.class_occurrence_roster WHERE occurrence_id=occurrence.id AND student_id=p_student_id) THEN RAISE EXCEPTION 'Choose a non-cancelled source session from the saved roster' USING ERRCODE='22023'; END IF;
  ended:=occurrence.ends_at;
 ELSE
  IF EXISTS(SELECT 1 FROM public.class_occurrences WHERE class_id=p_source_class AND source_date=p_source_date) THEN RAISE EXCEPTION 'The source class was rescheduled. Choose its actual session date' USING ERRCODE='22023'; END IF;
  IF c.id IS NULL OR e.id IS NULL OR p_source_date<GREATEST(s.registration_date,COALESCE(e.enrollment_date,s.registration_date)) OR NOT(trim(to_char(p_source_date,'Day'))=ANY(CASE WHEN cardinality(c.days_of_week)>0 THEN c.days_of_week ELSE ARRAY[c.day_of_week::text] END)) THEN RAISE EXCEPTION 'The source must be an enrolled scheduled class' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.academy_holidays WHERE voided_at IS NULL AND p_source_date BETWEEN start_date AND end_date AND (branch_id IS NULL OR branch_id=c.branch_id)) THEN RAISE EXCEPTION 'A holiday does not create makeup attendance' USING ERRCODE='22023'; END IF;
  ended:=((p_source_date+CASE WHEN c.end_time<=c.start_time THEN 1 ELSE 0 END)+c.end_time) AT TIME ZONE 'Asia/Phnom_Penh';
 END IF;
 IF EXISTS(SELECT 1 FROM public.membership_pauses WHERE student_id=p_student_id AND voided_at IS NULL AND (p_source_date>=start_date AND p_source_date<resume_date OR p_attended_date>=start_date AND p_attended_date<resume_date)) THEN RAISE EXCEPTION 'The source or attended date is inside an approved pause' USING ERRCODE='22023'; END IF;
 IF p_target_class IS NOT NULL AND EXISTS(SELECT 1 FROM public.class_occurrences WHERE class_id=p_target_class AND status='cancelled' AND (starts_at AT TIME ZONE 'Asia/Phnom_Penh')::date=p_attended_date) THEN RAISE EXCEPTION 'The chosen target session is cancelled' USING ERRCODE='22023'; END IF;
 IF ended+interval '30 minutes'>now() OR p_attended_date>today OR p_attended_date<p_source_date OR p_status NOT IN ('Present','Late') OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 5 AND 500 OR p_request_key IS NULL OR p_source_date IS NULL OR p_attended_date IS NULL OR p_status IS NULL THEN RAISE EXCEPTION 'Choose a completed source class, attendance date and reason' USING ERRCODE='22023'; END IF;
 SELECT status INTO original_status FROM public.attendance WHERE student_id=p_student_id AND class_id=p_source_class AND date=p_source_date FOR UPDATE;
 IF original_status IN ('Present','Late') THEN RAISE EXCEPTION 'The original class already has attendance' USING ERRCODE='22023'; END IF;
 INSERT INTO public.makeup_attendance(student_id,source_class_id,source_date,attended_date,target_class_id,status,source_status,reason,marked_by,request_key,source_occurrence_id) VALUES(p_student_id,p_source_class,p_source_date,p_attended_date,p_target_class,p_status,COALESCE(original_status,'Unmarked'),trim(p_reason),p_actor,p_request_key,occurrence.id) RETURNING * INTO m;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('MAKEUP_ATTENDANCE_RECORDED',p_actor::text,p_student_id,to_jsonb(m)); RETURN to_jsonb(m);
END $$;


-- Approved pauses cannot be bypassed through the ordinary student profile editor.
CREATE FUNCTION public.portal_guard_membership_pause() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.student_status='Active' AND EXISTS(SELECT 1 FROM public.membership_pauses WHERE student_id=NEW.id AND voided_at IS NULL AND start_date<=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date AND resume_date>(now() AT TIME ZONE 'Asia/Phnom_Penh')::date) THEN
  RAISE EXCEPTION 'Correct or void the approved pause before changing membership status' USING ERRCODE='22023';
 END IF;
 IF OLD.approved_pause_id IS NOT NULL AND NEW.approved_pause_id IS NOT DISTINCT FROM OLD.approved_pause_id AND (NEW.student_status IS DISTINCT FROM OLD.student_status OR NEW.pause_end_date IS DISTINCT FROM OLD.pause_end_date) THEN
  RAISE EXCEPTION 'Correct or void the approved pause before changing membership status' USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER portal_guard_membership_pause BEFORE UPDATE OF student_status,pause_end_date,approved_pause_id ON public.students FOR EACH ROW EXECUTE FUNCTION public.portal_guard_membership_pause();
REVOKE ALL ON FUNCTION public.portal_guard_membership_pause() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_guard_membership_pause() TO service_role;


-- Index references used for scoped reads, history retention and foreign-key checks.
DO $$ DECLARE r record; BEGIN
 FOR r IN
  SELECT t.relname AS table_name,a.attname AS column_name
  FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
  JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=c.conkey[1]
  WHERE c.contype='f' AND n.nspname='public' AND cardinality(c.conkey)=1
  AND (t.relname IN ('makeup_attendance','membership_schedule_changes','portal_push_deliveries','portal_job_leases','academy_operations_policy','membership_pauses','class_enrollment_history','class_membership_periods','academy_holidays','class_occurrences','class_occurrence_roster','membership_invoices','membership_receipts','membership_allocations','membership_credits','membership_credit_uses','payment_reconciliation_lines','followup_tasks','student_activity_events','grading_events','grading_candidates','data_quality_reviews','portal_operation_requests') OR t.relname='students' AND a.attname='approved_pause_id' OR t.relname='makeup_attendance' AND a.attname='source_occurrence_id')
  AND NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=t.oid AND i.indisvalid AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indkey[0]=a.attnum)
 LOOP
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(%I)',r.table_name||'_'||r.column_name||'_ops_idx',r.table_name,r.column_name);
 END LOOP;
END $$;
COMMIT;

