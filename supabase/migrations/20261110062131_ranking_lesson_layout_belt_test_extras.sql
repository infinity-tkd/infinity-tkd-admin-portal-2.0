-- Ranking opt-out, lesson order and length, and belt test extras: test fees
-- (tracked only), student requests with coach approval, and examiner panels
-- whose item score is the panel average.
-- Additive: existing rows keep their meaning. The belt test functions are
-- replaced from their deployed versions (20261107095953, verified identical
-- by md5 before writing) with the changes marked inline.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

-- ===========================================================================
-- 1. Ranking opt-out (students.ranking_opt_out, read by the student portal)
-- ===========================================================================
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS ranking_opt_out boolean NOT NULL DEFAULT false;

-- Identity rules shared by the student_portal_* writes below; the same checks
-- as student_portal_cancel_pending_order. Internal helper (no grants).
CREATE OR REPLACE FUNCTION public.student_portal_assert_student(p_actor uuid,p_student text) RETURNS public.students
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.profiles; athlete public.students;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 SELECT * INTO actor FROM public.profiles WHERE id=p_actor AND role='Student' AND is_active=true AND must_change_password=false FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account ineligible' USING ERRCODE='42501'; END IF;
 SELECT * INTO athlete FROM public.students WHERE id=p_student AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR NOT (COALESCE(athlete.profile_id=p_actor,false) OR COALESCE(actor.student_id=p_student,false)) THEN RAISE EXCEPTION 'Student mismatch' USING ERRCODE='42501'; END IF;
 IF (athlete.profile_id IS NOT NULL AND athlete.profile_id<>p_actor) OR (actor.student_id IS NOT NULL AND actor.student_id<>p_student)
  OR EXISTS(SELECT 1 FROM public.students WHERE profile_id=p_actor AND id<>p_student) THEN RAISE EXCEPTION 'Contradictory identity links' USING ERRCODE='42501'; END IF;
 RETURN athlete;
END $$;

-- Staff: Directory → student profile.
CREATE OR REPLACE FUNCTION public.portal_set_ranking_opt_out(p_actor uuid,p_student text,p_opt_out boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:student_edit');
 IF p_opt_out IS NULL THEN RAISE EXCEPTION 'Choose whether the student appears in rankings' USING ERRCODE='22023'; END IF;
 SELECT * INTO st FROM public.students WHERE id=p_student AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student not found' USING ERRCODE='P0002'; END IF;
 IF st.ranking_opt_out IS DISTINCT FROM p_opt_out THEN
  UPDATE public.students SET ranking_opt_out=p_opt_out,updated_at=now() WHERE id=st.id;
  INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('STUDENT_RANKING_OPT_OUT',p_actor::text,st.id,jsonb_build_object('rankingOptOut',p_opt_out,'source','staff'));
 END IF;
 RETURN jsonb_build_object('studentId',st.id,'rankingOptOut',p_opt_out);
END $$;

-- Student (or parent) in student portal settings.
CREATE OR REPLACE FUNCTION public.student_portal_set_ranking_opt_out(p_actor uuid,p_student text,p_opt_out boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students;
BEGIN
 st:=public.student_portal_assert_student(p_actor,p_student);
 IF p_opt_out IS NULL THEN RAISE EXCEPTION 'Choose whether you appear in rankings' USING ERRCODE='22023'; END IF;
 IF st.ranking_opt_out IS DISTINCT FROM p_opt_out THEN
  UPDATE public.students SET ranking_opt_out=p_opt_out,updated_at=now() WHERE id=st.id;
  INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('STUDENT_RANKING_OPT_OUT',p_actor::text,st.id,jsonb_build_object('rankingOptOut',p_opt_out,'source','student'));
 END IF;
 RETURN jsonb_build_object('studentId',st.id,'rankingOptOut',p_opt_out);
END $$;

-- ===========================================================================
-- 2. Lesson order and length (curriculum = the published student lesson)
-- ===========================================================================
ALTER TABLE public.curriculum
 ADD COLUMN IF NOT EXISTS sort_order int CHECK (sort_order IS NULL OR sort_order BETWEEN 1 AND 10000),
 ADD COLUMN IF NOT EXISTS duration_seconds int CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 86400);

-- Order and length are lesson metadata: they apply immediately, without
-- republishing. Keyed by library asset id, resolved to its linked lesson.
CREATE OR REPLACE FUNCTION public.portal_set_lesson_layout(p_actor uuid,p_lessons jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE lesson jsonb; asset public.library_assets; linked int; seen int[]:='{}'; changed int:=0; ord int; dur int;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 IF jsonb_typeof(p_lessons) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lessons) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'Send 1 to 300 lessons' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('library-curriculum-write',0));
 FOR lesson IN SELECT value FROM jsonb_array_elements(p_lessons) LOOP
  IF jsonb_typeof(lesson) IS DISTINCT FROM 'object' OR COALESCE(lesson->>'assetId','') !~ '^[1-9][0-9]{0,8}$'
   OR (lesson->'sortOrder' IS NOT NULL AND jsonb_typeof(lesson->'sortOrder')<>'null' AND COALESCE(lesson->>'sortOrder','') !~ '^[0-9]{1,5}$')
   OR (lesson->'durationSeconds' IS NOT NULL AND jsonb_typeof(lesson->'durationSeconds')<>'null' AND COALESCE(lesson->>'durationSeconds','') !~ '^[0-9]{1,5}$') THEN
   RAISE EXCEPTION 'Invalid lesson order' USING ERRCODE='22023';
  END IF;
  ord:=(lesson->>'sortOrder')::int; dur:=(lesson->>'durationSeconds')::int;
  IF ord NOT BETWEEN 1 AND 10000 OR dur NOT BETWEEN 1 AND 86400 THEN RAISE EXCEPTION 'Positions run from 1 to 10000 and lengths from 1 second to 24 hours' USING ERRCODE='22023'; END IF;
  SELECT * INTO asset FROM public.library_assets WHERE id=(lesson->>'assetId')::int;
  IF NOT FOUND THEN RAISE EXCEPTION 'Library lesson % was not found',lesson->>'assetId' USING ERRCODE='P0002'; END IF;
  linked:=asset.student_curriculum_id;
  IF linked IS NULL THEN SELECT id INTO linked FROM public.curriculum WHERE id=asset.id AND title=asset.title; END IF;
  IF linked IS NULL THEN RAISE EXCEPTION 'Save "%" once in the library before ordering it',asset.title USING ERRCODE='22023'; END IF;
  IF linked=ANY(seen) THEN RAISE EXCEPTION 'A lesson appears twice in the list' USING ERRCODE='22023'; END IF;
  seen:=array_append(seen,linked);
  UPDATE public.curriculum SET sort_order=ord,duration_seconds=dur WHERE id=linked AND (sort_order IS DISTINCT FROM ord OR duration_seconds IS DISTINCT FROM dur);
  IF FOUND THEN changed:=changed+1; END IF;
 END LOOP;
 IF changed>0 THEN
  INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LIBRARY_LESSON_LAYOUT',p_actor::text,'curriculum',jsonb_build_object('lessons',p_lessons,'changed',changed));
 END IF;
 RETURN jsonb_build_object('updated',changed);
END $$;

-- ===========================================================================
-- 3. Belt test extras
-- ===========================================================================
-- Fees are tracked for the office only; they never block testing or promotion.
ALTER TABLE public.belt_test_syllabi ADD COLUMN IF NOT EXISTS fee_usd numeric(10,2) NOT NULL DEFAULT 0 CHECK (fee_usd BETWEEN 0 AND 10000);
ALTER TABLE public.grading_events
 ADD COLUMN IF NOT EXISTS capacity int CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 500),
 ADD COLUMN IF NOT EXISTS accepts_requests boolean NOT NULL DEFAULT true;

ALTER TABLE public.grading_candidates DROP CONSTRAINT grading_candidates_status_check;
ALTER TABLE public.grading_candidates
 ADD CONSTRAINT grading_candidates_status_check CHECK (status IN (
  'draft','assessed','failed','promoted',            -- legacy single-score flow
  'registered','scoring','finalized','withdrawn',    -- color belt tests
  'nominated','submitted','passed','certified',      -- Kukkiwon via CTF ('failed' shared)
  'requested','declined')),                          -- student requests (both tracks)
 ADD COLUMN IF NOT EXISTS requested_at timestamptz,
 ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES public.profiles(id),
 ADD COLUMN IF NOT EXISTS decided_at timestamptz,
 ADD COLUMN IF NOT EXISTS decline_reason text CHECK (decline_reason IS NULL OR length(btrim(decline_reason)) BETWEEN 5 AND 500),
 ADD COLUMN IF NOT EXISTS fee_usd numeric(10,2) CHECK (fee_usd IS NULL OR fee_usd BETWEEN 0 AND 10000),
 ADD COLUMN IF NOT EXISTS fee_status text NOT NULL DEFAULT 'none' CHECK (fee_status IN ('none','unpaid','paid','waived')),
 ADD COLUMN IF NOT EXISTS fee_method text CHECK (fee_method IS NULL OR length(btrim(fee_method)) BETWEEN 1 AND 40),
 ADD COLUMN IF NOT EXISTS fee_reference text CHECK (fee_reference IS NULL OR length(btrim(fee_reference)) BETWEEN 1 AND 120),
 ADD COLUMN IF NOT EXISTS fee_paid_on date,
 ADD COLUMN IF NOT EXISTS fee_waiver_reason text CHECK (fee_waiver_reason IS NULL OR length(btrim(fee_waiver_reason)) BETWEEN 5 AND 500),
 ADD COLUMN IF NOT EXISTS fee_recorded_by uuid REFERENCES public.profiles(id),
 ADD COLUMN IF NOT EXISTS fee_recorded_at timestamptz;
CREATE INDEX IF NOT EXISTS grading_candidates_decided_by_ops_idx ON public.grading_candidates(decided_by);
CREATE INDEX IF NOT EXISTS grading_candidates_fee_recorded_by_ops_idx ON public.grading_candidates(fee_recorded_by);

-- Examiner panel per test day. No panel = any coach with grading permission
-- may score (as before). With a panel, only its examiners score, and an item
-- counts once every examiner has scored it.
CREATE TABLE IF NOT EXISTS public.grading_event_examiners (
 event_id uuid NOT NULL REFERENCES public.grading_events(id) ON DELETE CASCADE,
 profile_id uuid NOT NULL REFERENCES public.profiles(id),
 added_by uuid NOT NULL REFERENCES public.profiles(id),
 added_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (event_id,profile_id)
);
CREATE INDEX IF NOT EXISTS grading_event_examiners_profile_ops_idx ON public.grading_event_examiners(profile_id);
CREATE INDEX IF NOT EXISTS grading_event_examiners_added_by_ops_idx ON public.grading_event_examiners(added_by);
ALTER TABLE public.grading_event_examiners ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.grading_event_examiners FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.grading_event_examiners TO service_role;

CREATE OR REPLACE FUNCTION public.portal_guard_belt_test_panel() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_setting('portal.belt_tests_write',true)='on' THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
 RAISE EXCEPTION 'Use Belt Tests to change the examiner panel' USING ERRCODE='42501';
END $$;
DROP TRIGGER IF EXISTS portal_guard_belt_test_panel ON public.grading_event_examiners;
CREATE TRIGGER portal_guard_belt_test_panel BEFORE INSERT OR UPDATE OR DELETE ON public.grading_event_examiners FOR EACH ROW EXECUTE FUNCTION public.portal_guard_belt_test_panel();

-- One score per examiner per item (was one score per item).
ALTER TABLE public.grading_item_scores DROP CONSTRAINT grading_item_scores_candidate_id_item_id_key;
ALTER TABLE public.grading_item_scores ADD CONSTRAINT grading_item_scores_candidate_item_examiner_key UNIQUE (candidate_id,item_id,scored_by);

-- The panel score of each item: the average of the examiners' scores, rounded
-- to one decimal (mirrored by panelItemScores in lib/belt-test-scoring.ts).
CREATE OR REPLACE FUNCTION public.portal_belt_test_item_scores(p_candidate uuid) RETURNS TABLE(item_id uuid,score numeric,scorers int,complete boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH c AS (SELECT id,event_id FROM public.grading_candidates WHERE id=p_candidate),
 panel AS (SELECT x.profile_id FROM public.grading_event_examiners x JOIN c ON c.event_id=x.event_id),
 size AS (SELECT count(*)::int AS n FROM panel)
 SELECT g.item_id,round(avg(g.score),1),count(*)::int,CASE WHEN (SELECT n FROM size)=0 THEN true ELSE count(*)=(SELECT n FROM size) END
 FROM public.grading_item_scores g JOIN c ON c.id=g.candidate_id
 WHERE (SELECT n FROM size)=0 OR g.scored_by IN (SELECT profile_id FROM panel)
 GROUP BY g.item_id
$$;

-- Scoring: as before, but each item uses its panel score and counts only once complete.
CREATE OR REPLACE FUNCTION public.portal_belt_test_compute(p_candidate uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.grading_candidates; s public.belt_test_syllabi; sec record; sections jsonb:='[]'::jsonb;
 failed uuid[]:='{}'; critical_failures uuid[]:='{}'; total_items int:=0; scored_items int:=0;
 overall numeric:=0; pct numeric; minimum numeric; outcome text;
BEGIN
 SELECT * INTO c FROM public.grading_candidates WHERE id=p_candidate;
 SELECT y.* INTO s FROM public.grading_events e JOIN public.belt_test_syllabi y ON y.id=e.syllabus_id WHERE e.id=c.event_id;
 IF c.id IS NULL OR s.id IS NULL OR s.track<>'color' THEN RETURN NULL; END IF;
 FOR sec IN
  WITH scored AS (SELECT g.item_id,g.score FROM public.portal_belt_test_item_scores(c.id) g WHERE g.complete)
  SELECT x.id,x.kind,x.title,x.weight,x.minimum,
   (SELECT count(*) FROM public.belt_test_items i WHERE i.section_id=x.id) AS item_count,
   (SELECT count(*) FROM public.belt_test_items i JOIN scored g ON g.item_id=i.id WHERE i.section_id=x.id) AS scored_count,
   (SELECT sum(g.score*i.weight)/NULLIF(sum(i.weight),0) FROM public.belt_test_items i JOIN scored g ON g.item_id=i.id WHERE i.section_id=x.id) AS weighted
  FROM public.belt_test_sections x WHERE x.syllabus_id=s.id ORDER BY x.position
 LOOP
  total_items:=total_items+sec.item_count; scored_items:=scored_items+sec.scored_count;
  pct:=round(COALESCE(sec.weighted,0)*10,2);
  minimum:=COALESCE(sec.minimum,s.section_minimum);
  overall:=overall+pct*COALESCE(sec.weight,0)/100;
  IF sec.item_count>0 AND pct<minimum THEN failed:=array_append(failed,sec.id); END IF;
  sections:=sections||jsonb_build_object('id',sec.id,'kind',sec.kind,'title',sec.title,'weight',sec.weight,'percent',pct,'minimum',minimum,
   'met',pct>=minimum,'grade',CASE WHEN pct>=90 THEN 'A' WHEN pct>=80 THEN 'B' WHEN pct>=70 THEN 'C' WHEN pct>=60 THEN 'D' ELSE 'F' END,
   'items',sec.item_count,'scored',sec.scored_count);
 END LOOP;
 SELECT COALESCE(array_agg(i.id ORDER BY i.id),'{}') INTO critical_failures
 FROM public.belt_test_items i JOIN public.belt_test_sections x ON x.id=i.section_id
 JOIN public.portal_belt_test_item_scores(c.id) g ON g.item_id=i.id AND g.complete
 WHERE x.syllabus_id=s.id AND i.critical AND g.score<s.critical_minimum;
 -- A section holding a failed critical item is retested too.
 SELECT COALESCE(array_agg(DISTINCT id ORDER BY id),'{}') INTO failed FROM (
  SELECT unnest(failed) AS id UNION SELECT i.section_id FROM public.belt_test_items i WHERE i.id=ANY(critical_failures)) f;
 overall:=round(overall,2);
 outcome:=CASE WHEN total_items=0 OR scored_items<total_items THEN 'pending'
  WHEN overall<s.pass_mark THEN 'fail'
  WHEN cardinality(failed)>0 THEN 'retest'
  WHEN overall>=s.distinction_mark THEN 'distinction' ELSE 'pass' END;
 RETURN jsonb_build_object('overall',overall,'result',outcome,'complete',total_items>0 AND scored_items=total_items,
  'scoredItems',scored_items,'totalItems',total_items,'sections',sections,
  'retestSections',to_jsonb(failed),'criticalFailures',to_jsonb(critical_failures));
END $$;

-- Admission: staff registration, approval of a student request, or staff
-- registering a student whose request was declined or cancelled. One place
-- for eligibility, capacity, the fee snapshot and the Kukkiwon details.
-- Internal helper, called by portal_belt_tests_mutate (no grants).
CREATE OR REPLACE FUNCTION public.portal_belt_test_admit(p_actor uuid,p_event uuid,p_student text,p_override text,p_request uuid) RETURNS public.grading_candidates
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE exam public.grading_events; syl public.belt_test_syllabi; st public.students; cand public.grading_candidates; eligibility jsonb; taken int; holds_place boolean;
BEGIN
 PERFORM set_config('portal.belt_tests_write','on',true);
 SELECT * INTO exam FROM public.grading_events WHERE id=p_event AND syllabus_id IS NOT NULL FOR UPDATE;
 IF NOT FOUND OR exam.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'Test day unavailable or cancelled' USING ERRCODE='22023'; END IF;
 IF exam.results_published_at IS NOT NULL THEN RAISE EXCEPTION 'Results for this test day are already published' USING ERRCODE='22023'; END IF;
 SELECT * INTO syl FROM public.belt_test_syllabi WHERE id=exam.syllabus_id;
 SELECT * INTO st FROM public.students WHERE id=p_student AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student unavailable' USING ERRCODE='P0002'; END IF;
 SELECT * INTO cand FROM public.grading_candidates WHERE event_id=exam.id AND student_id=st.id FOR UPDATE;
 IF p_request IS NOT NULL AND (cand.id IS DISTINCT FROM p_request OR cand.status<>'requested') THEN RAISE EXCEPTION 'This request was already handled' USING ERRCODE='22023'; END IF;
 IF cand.id IS NOT NULL AND NOT (cand.status IN ('requested','declined') OR (cand.status='withdrawn' AND cand.registered_at IS NULL)) THEN
  RAISE EXCEPTION 'The student is already on this test day' USING ERRCODE='23505';
 END IF;
 eligibility:=public.portal_belt_test_eligibility(st.id,exam.syllabus_id);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(eligibility->'rules') r WHERE r->>'key'='current_belt' AND (r->>'met')::boolean) THEN
  RAISE EXCEPTION 'This test day is for the next rank after %; the student holds %',(SELECT r->>'required' FROM jsonb_array_elements(eligibility->'rules') r WHERE r->>'key'='current_belt'),(SELECT r->>'current' FROM jsonb_array_elements(eligibility->'rules') r WHERE r->>'key'='current_belt') USING ERRCODE='22023';
 END IF;
 IF eligibility->>'status'<>'eligible' AND length(btrim(COALESCE(p_override,'')))<5 THEN
  RAISE EXCEPTION '%',CASE WHEN p_request IS NULL THEN 'The student is not yet eligible. Record an override reason to register anyway' ELSE 'The student is no longer eligible. Record an override reason to approve anyway' END USING ERRCODE='22023';
 END IF;
 -- A pending request already holds its place.
 holds_place:=cand.id IS NOT NULL AND cand.status='requested';
 IF exam.capacity IS NOT NULL AND NOT holds_place THEN
  SELECT count(*) INTO taken FROM public.grading_candidates WHERE event_id=exam.id AND status NOT IN ('withdrawn','declined');
  IF taken>=exam.capacity THEN RAISE EXCEPTION 'This test day is full (% places). Raise the capacity to add more',exam.capacity USING ERRCODE='22023'; END IF;
 END IF;
 IF cand.id IS NULL THEN
  INSERT INTO public.grading_candidates(event_id,student_id,status,registered_by,registered_at,eligibility_snapshot,registration_override_reason,result,
   poom_or_dan,legal_name_en,legal_name_kh,dob,gender,previous_certificate_no,fee_usd,fee_status)
  VALUES(exam.id,st.id,CASE WHEN exam.kind='kukkiwon' THEN 'nominated' ELSE 'registered' END,p_actor,now(),eligibility,
   CASE WHEN eligibility->>'status'<>'eligible' THEN btrim(p_override) END,CASE WHEN exam.kind='color' THEN 'pending' END,
   CASE WHEN exam.kind='kukkiwon' THEN CASE WHEN extract(year FROM age(exam.exam_date,st.dob))<15 THEN 'Poom' ELSE 'Dan' END END,
   CASE WHEN exam.kind='kukkiwon' THEN st.english_name END,CASE WHEN exam.kind='kukkiwon' THEN st.khmer_name END,
   CASE WHEN exam.kind='kukkiwon' THEN st.dob END,CASE WHEN exam.kind='kukkiwon' THEN st.gender END,
   CASE WHEN exam.kind='kukkiwon' THEN NULLIF(btrim(st.kukkiwon_id),'') END,
   NULLIF(syl.fee_usd,0),CASE WHEN syl.fee_usd>0 THEN 'unpaid' ELSE 'none' END) RETURNING * INTO cand;
 ELSE
  UPDATE public.grading_candidates SET status=CASE WHEN exam.kind='kukkiwon' THEN 'nominated' ELSE 'registered' END,registered_by=p_actor,registered_at=now(),
   eligibility_snapshot=eligibility,registration_override_reason=CASE WHEN eligibility->>'status'<>'eligible' THEN btrim(p_override) END,
   result=CASE WHEN exam.kind='color' THEN 'pending' END,decided_by=p_actor,decided_at=now(),decline_reason=NULL,withdrawn_reason=NULL,
   poom_or_dan=CASE WHEN exam.kind='kukkiwon' THEN CASE WHEN extract(year FROM age(exam.exam_date,st.dob))<15 THEN 'Poom' ELSE 'Dan' END END,
   legal_name_en=CASE WHEN exam.kind='kukkiwon' THEN st.english_name END,legal_name_kh=CASE WHEN exam.kind='kukkiwon' THEN st.khmer_name END,
   dob=CASE WHEN exam.kind='kukkiwon' THEN st.dob END,gender=CASE WHEN exam.kind='kukkiwon' THEN st.gender END,
   previous_certificate_no=CASE WHEN exam.kind='kukkiwon' THEN NULLIF(btrim(st.kukkiwon_id),'') END,
   fee_usd=NULLIF(syl.fee_usd,0),fee_status=CASE WHEN syl.fee_usd>0 THEN 'unpaid' ELSE 'none' END,
   revision=revision+1,updated_at=now() WHERE id=cand.id RETURNING * INTO cand;
 END IF;
 RETURN cand;
END $$;

-- portal_belt_tests_mutate: deployed version plus the extras (request approval,
-- fees, examiner panel, capacity). Unchanged branches are byte-identical.
CREATE OR REPLACE FUNCTION public.portal_belt_tests_mutate(p_actor uuid,p_action text,p_data jsonb,p_request_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.profiles; previous public.portal_operation_requests; result jsonb; student text;
 syl public.belt_test_syllabi; exam public.grading_events; cand public.grading_candidates; target public.belts; prior public.belts;
 sec jsonb; item jsonb; section_id uuid; saved_id uuid; computed jsonb; eligibility jsonb; total numeric; n int; pos int; ipos int;
 today date:=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date; manages boolean; existing public.grading_item_scores; history_id int; taken int;
 manage_actions text[]:=ARRAY['syllabus_save','syllabus_publish','syllabus_retire','syllabus_discard','event_create','event_update','event_publish','event_cancel',
  'register','withdraw','finalize','start_retest','publish_results','promote','kukkiwon_update','kukkiwon_submit','kukkiwon_result','kukkiwon_certificate',
  'approve_request','decline_request','fee_update','examiners_set'];
BEGIN
 IF p_request_key IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR NOT (p_action=ANY(manage_actions||ARRAY['score','feedback'])) THEN
  RAISE EXCEPTION 'Invalid belt test request' USING ERRCODE='22023';
 END IF;
 PERFORM public.portal_assert_actor(p_actor,'action:evaluations_grade');
 SELECT * INTO actor FROM public.profiles WHERE id=p_actor;
 manages:=actor.role IN ('Root','Super Root','Admin','Head Coach');
 IF p_action=ANY(manage_actions) AND NOT manages THEN RAISE EXCEPTION 'A head coach or administrator manages belt tests' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_key::text,0));
 SELECT * INTO previous FROM public.portal_operation_requests WHERE request_key=p_request_key;
 IF FOUND THEN
  IF previous.actor<>p_actor OR previous.action<>'belt:'||p_action OR previous.payload<>p_data THEN RAISE EXCEPTION 'Request key mismatch' USING ERRCODE='22023'; END IF;
  RETURN previous.result;
 END IF;
 PERFORM set_config('portal.belt_tests_write','on',true);

 CASE p_action
 -- Syllabus -----------------------------------------------------------------
 WHEN 'syllabus_save' THEN
  SELECT * INTO target FROM public.belts WHERE id=(p_data->>'targetBeltId')::int;
  IF NOT FOUND OR target.belt_order<2 THEN RAISE EXCEPTION 'Choose a belt above White' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(p_data->'sections') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'sections') NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Add 1 to 12 sections' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(p_data->'eligibility') IS DISTINCT FROM 'object'
   OR COALESCE((p_data->'eligibility'->>'minimumDays')::int,-1) NOT BETWEEN 0 AND 3650
   OR COALESCE((p_data->'eligibility'->>'minimumClasses')::int,-1) NOT BETWEEN 0 AND 1000
   OR COALESCE((p_data->'eligibility'->>'minimumSkillAverage')::numeric,-1) NOT BETWEEN 0 AND 4
   OR jsonb_typeof(p_data->'eligibility'->'requireLessons') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Review the eligibility rules' USING ERRCODE='22023'; END IF;
  -- Extras: the test fee (tracked only).
  IF COALESCE((p_data->>'feeUsd')::numeric,0) NOT BETWEEN 0 AND 10000 OR COALESCE((p_data->>'feeUsd')::numeric,0)<>round(COALESCE((p_data->>'feeUsd')::numeric,0),2) THEN RAISE EXCEPTION 'Enter a test fee from 0 to 10000 USD' USING ERRCODE='22023'; END IF;
  IF lower(target.belt_type)='black' THEN
   IF p_data->>'passMark' IS NOT NULL THEN RAISE EXCEPTION 'Kukkiwon tests are not scored by the academy' USING ERRCODE='22023'; END IF;
  ELSE
   SELECT COALESCE(sum((value->>'weight')::numeric),0) INTO total FROM jsonb_array_elements(p_data->'sections');
   IF total<>100 THEN RAISE EXCEPTION 'Section weights must add up to 100 (now %)',total USING ERRCODE='22023'; END IF;
  END IF;
  IF p_data->>'id' IS NULL THEN
   INSERT INTO public.belt_test_syllabi(target_belt_id,track,version,title,pass_mark,distinction_mark,section_minimum,critical_minimum,retest_days,eligibility,notes,created_by,fee_usd)
   VALUES(target.id,CASE WHEN lower(target.belt_type)='black' THEN 'kukkiwon' ELSE 'color' END,
    COALESCE((SELECT max(version) FROM public.belt_test_syllabi WHERE target_belt_id=target.id),0)+1,
    btrim(p_data->>'title'),(p_data->>'passMark')::numeric,(p_data->>'distinctionMark')::numeric,(p_data->>'sectionMinimum')::numeric,
    (p_data->>'criticalMinimum')::numeric,(p_data->>'retestDays')::int,p_data->'eligibility',COALESCE(p_data->>'notes',''),p_actor,COALESCE((p_data->>'feeUsd')::numeric,0)) RETURNING * INTO syl;
  ELSE
   SELECT * INTO syl FROM public.belt_test_syllabi WHERE id=(p_data->>'id')::uuid FOR UPDATE;
   IF NOT FOUND OR syl.status<>'draft' THEN RAISE EXCEPTION 'Only a draft syllabus can be edited; save a new version' USING ERRCODE='22023'; END IF;
   IF syl.revision<>(p_data->>'revision')::int THEN RAISE EXCEPTION 'This syllabus changed. Reload before saving' USING ERRCODE='40001'; END IF;
   IF syl.target_belt_id<>target.id THEN RAISE EXCEPTION 'A syllabus cannot move to another belt' USING ERRCODE='22023'; END IF;
   UPDATE public.belt_test_syllabi SET title=btrim(p_data->>'title'),pass_mark=(p_data->>'passMark')::numeric,distinction_mark=(p_data->>'distinctionMark')::numeric,
    section_minimum=(p_data->>'sectionMinimum')::numeric,critical_minimum=(p_data->>'criticalMinimum')::numeric,retest_days=(p_data->>'retestDays')::int,
    eligibility=p_data->'eligibility',notes=COALESCE(p_data->>'notes',''),fee_usd=COALESCE((p_data->>'feeUsd')::numeric,0),revision=revision+1,updated_at=now() WHERE id=syl.id RETURNING * INTO syl;
   DELETE FROM public.belt_test_sections WHERE syllabus_id=syl.id;
  END IF;
  pos:=0;
  FOR sec IN SELECT value FROM jsonb_array_elements(p_data->'sections') LOOP
   IF jsonb_typeof(sec->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(sec->'items') NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'Each section needs 1 to 40 items' USING ERRCODE='22023'; END IF;
   INSERT INTO public.belt_test_sections(syllabus_id,kind,title,weight,minimum,position)
   VALUES(syl.id,sec->>'kind',btrim(sec->>'title'),CASE WHEN syl.track='color' THEN (sec->>'weight')::numeric END,
    CASE WHEN syl.track='color' THEN (sec->>'minimum')::numeric END,pos) RETURNING id INTO section_id;
   ipos:=0;
   FOR item IN SELECT value FROM jsonb_array_elements(sec->'items') LOOP
    INSERT INTO public.belt_test_items(section_id,title,library_asset_id,weight,critical,guide,position)
    VALUES(section_id,btrim(item->>'title'),(item->>'libraryAssetId')::int,CASE WHEN syl.track='color' THEN COALESCE((item->>'weight')::numeric,1) ELSE 1 END,
     syl.track='color' AND COALESCE((item->>'critical')::boolean,false),COALESCE(item->>'guide',''),ipos);
    ipos:=ipos+1;
   END LOOP;
   pos:=pos+1;
  END LOOP;
  result:=jsonb_build_object('id',syl.id,'version',syl.version,'revision',syl.revision);
 WHEN 'syllabus_publish' THEN
  SELECT * INTO syl FROM public.belt_test_syllabi WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR syl.status<>'draft' THEN RAISE EXCEPTION 'Only a draft syllabus can be published' USING ERRCODE='22023'; END IF;
  IF syl.revision<>(p_data->>'revision')::int THEN RAISE EXCEPTION 'This syllabus changed. Reload before publishing' USING ERRCODE='40001'; END IF;
  UPDATE public.belt_test_syllabi SET status='retired',updated_at=now() WHERE target_belt_id=syl.target_belt_id AND status='published';
  UPDATE public.belt_test_syllabi SET status='published',published_by=p_actor,published_at=now(),updated_at=now() WHERE id=syl.id;
  result:=jsonb_build_object('id',syl.id,'published',true);
 WHEN 'syllabus_retire' THEN
  UPDATE public.belt_test_syllabi SET status='retired',updated_at=now() WHERE id=(p_data->>'id')::uuid AND status='published' RETURNING * INTO syl;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only a published syllabus can be retired' USING ERRCODE='22023'; END IF;
  result:=jsonb_build_object('id',syl.id,'retired',true);
 WHEN 'syllabus_discard' THEN
  DELETE FROM public.belt_test_syllabi WHERE id=(p_data->>'id')::uuid AND status='draft' RETURNING * INTO syl;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only a draft syllabus can be discarded' USING ERRCODE='22023'; END IF;
  result:=jsonb_build_object('id',syl.id,'discarded',true);

 -- Test days ----------------------------------------------------------------
 WHEN 'event_create' THEN
  SELECT * INTO syl FROM public.belt_test_syllabi WHERE id=(p_data->>'syllabusId')::uuid;
  IF NOT FOUND OR syl.status<>'published' THEN RAISE EXCEPTION 'Choose the published syllabus for this belt' USING ERRCODE='22023'; END IF;
  IF NULLIF(p_data->>'capacity','')::int NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Capacity must be 1 to 500 students, or left empty' USING ERRCODE='22023'; END IF;
  INSERT INTO public.grading_events(title,exam_date,target_belt_id,passing_score,minimum_attendance,attendance_from,created_by,branch_id,start_time,location,kind,syllabus_id,capacity,accepts_requests)
  VALUES(btrim(p_data->>'title'),(p_data->>'examDate')::date,syl.target_belt_id,COALESCE(round(syl.pass_mark)::int,0),0,(p_data->>'examDate')::date,p_actor,
   NULLIF(p_data->>'branchId','')::int,NULLIF(p_data->>'startTime','')::time,NULLIF(btrim(p_data->>'location'),''),syl.track,syl.id,
   NULLIF(p_data->>'capacity','')::int,COALESCE((p_data->>'acceptsRequests')::boolean,true)) RETURNING * INTO exam;
  result:=jsonb_build_object('id',exam.id);
 WHEN 'event_update' THEN
  SELECT * INTO exam FROM public.grading_events WHERE id=(p_data->>'id')::uuid AND syllabus_id IS NOT NULL FOR UPDATE;
  IF NOT FOUND OR exam.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'Test day unavailable or cancelled' USING ERRCODE='22023'; END IF;
  IF (p_data->>'examDate')::date IS DISTINCT FROM exam.exam_date AND EXISTS(SELECT 1 FROM public.grading_candidates WHERE event_id=exam.id AND (status IN ('scoring','finalized','promoted') OR EXISTS(SELECT 1 FROM public.grading_item_scores g WHERE g.candidate_id=grading_candidates.id))) THEN
   RAISE EXCEPTION 'Scores already use this test date' USING ERRCODE='22023';
  END IF;
  IF NULLIF(p_data->>'capacity','')::int NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Capacity must be 1 to 500 students, or left empty' USING ERRCODE='22023'; END IF;
  SELECT count(*) INTO taken FROM public.grading_candidates WHERE event_id=exam.id AND status NOT IN ('withdrawn','declined');
  IF NULLIF(p_data->>'capacity','')::int<taken THEN RAISE EXCEPTION '% students already hold places; the capacity cannot be lower',taken USING ERRCODE='22023'; END IF;
  UPDATE public.grading_events SET title=btrim(p_data->>'title'),exam_date=(p_data->>'examDate')::date,attendance_from=LEAST(attendance_from,(p_data->>'examDate')::date),
   start_time=NULLIF(p_data->>'startTime','')::time,location=NULLIF(btrim(p_data->>'location'),''),branch_id=NULLIF(p_data->>'branchId','')::int,
   capacity=CASE WHEN p_data ? 'capacity' THEN NULLIF(p_data->>'capacity','')::int ELSE capacity END,
   accepts_requests=COALESCE((p_data->>'acceptsRequests')::boolean,accepts_requests) WHERE id=exam.id;
  result:=jsonb_build_object('id',exam.id);
 WHEN 'event_publish' THEN
  UPDATE public.grading_events SET published_at=COALESCE(published_at,now()) WHERE id=(p_data->>'id')::uuid AND syllabus_id IS NOT NULL AND cancelled_at IS NULL RETURNING * INTO exam;
  IF NOT FOUND THEN RAISE EXCEPTION 'Test day unavailable or cancelled' USING ERRCODE='22023'; END IF;
  result:=jsonb_build_object('id',exam.id,'published',true);
 WHEN 'event_cancel' THEN
  SELECT * INTO exam FROM public.grading_events WHERE id=(p_data->>'id')::uuid AND syllabus_id IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Test day unavailable' USING ERRCODE='P0002'; END IF;
  IF EXISTS(SELECT 1 FROM public.grading_candidates WHERE event_id=exam.id AND status='promoted') THEN RAISE EXCEPTION 'A test day with promotions cannot be cancelled' USING ERRCODE='22023'; END IF;
  UPDATE public.grading_events SET cancelled_at=COALESCE(cancelled_at,now()) WHERE id=exam.id;
  result:=jsonb_build_object('id',exam.id,'cancelled',true);

 -- Candidates ---------------------------------------------------------------
 WHEN 'register' THEN
  cand:=public.portal_belt_test_admit(p_actor,(p_data->>'eventId')::uuid,p_data->>'studentId',p_data->>'overrideReason',NULL);
  student:=cand.student_id;
  result:=jsonb_build_object('id',cand.id,'status',cand.status,'eligibility',cand.eligibility_snapshot->>'status');

 -- Extras: student requests, fees and the examiner panel ----------------------
 WHEN 'approve_request' THEN
  SELECT * INTO cand FROM public.grading_candidates WHERE id=(p_data->>'id')::uuid;
  IF NOT FOUND OR cand.status<>'requested' THEN RAISE EXCEPTION 'This request was already handled' USING ERRCODE='22023'; END IF;
  cand:=public.portal_belt_test_admit(p_actor,cand.event_id,cand.student_id,p_data->>'overrideReason',cand.id);
  student:=cand.student_id;
  result:=jsonb_build_object('id',cand.id,'status',cand.status,'eligibility',cand.eligibility_snapshot->>'status');
 WHEN 'decline_request' THEN
  SELECT * INTO cand FROM public.grading_candidates WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR cand.status<>'requested' THEN RAISE EXCEPTION 'This request was already handled' USING ERRCODE='22023'; END IF;
  IF length(btrim(COALESCE(p_data->>'reason','')))<5 THEN RAISE EXCEPTION 'Tell the student why (at least 5 characters)' USING ERRCODE='22023'; END IF;
  student:=cand.student_id;
  UPDATE public.grading_candidates SET status='declined',decline_reason=btrim(p_data->>'reason'),decided_by=p_actor,decided_at=now(),revision=revision+1,updated_at=now() WHERE id=cand.id;
  result:=jsonb_build_object('id',cand.id,'status','declined');
 WHEN 'fee_update' THEN
  SELECT * INTO cand FROM public.grading_candidates WHERE id=(p_data->>'candidateId')::uuid FOR UPDATE;
  IF NOT FOUND OR cand.status IN ('requested','declined','withdrawn') THEN RAISE EXCEPTION 'Record fees for registered students' USING ERRCODE='22023'; END IF;
  IF cand.revision<>(p_data->>'revision')::int THEN RAISE EXCEPTION 'This candidate changed. Reload before saving' USING ERRCODE='40001'; END IF;
  IF COALESCE(p_data->>'status','') NOT IN ('unpaid','paid','waived') THEN RAISE EXCEPTION 'Choose unpaid, paid or waived' USING ERRCODE='22023'; END IF;
  IF COALESCE((p_data->>'amountUsd')::numeric,0) NOT BETWEEN 0 AND 10000 OR COALESCE((p_data->>'amountUsd')::numeric,0)<>round(COALESCE((p_data->>'amountUsd')::numeric,0),2) THEN RAISE EXCEPTION 'Enter a fee from 0 to 10000 USD' USING ERRCODE='22023'; END IF;
  IF p_data->>'status'='paid' AND (length(btrim(COALESCE(p_data->>'method',''))) NOT BETWEEN 1 AND 40 OR (p_data->>'paidOn')::date IS NULL OR (p_data->>'paidOn')::date>today) THEN RAISE EXCEPTION 'Record how and when the fee was paid' USING ERRCODE='22023'; END IF;
  IF p_data->>'status'='waived' AND length(btrim(COALESCE(p_data->>'waiverReason','')))<5 THEN RAISE EXCEPTION 'Record why the fee is waived' USING ERRCODE='22023'; END IF;
  student:=cand.student_id;
  UPDATE public.grading_candidates SET fee_usd=CASE WHEN p_data ? 'amountUsd' THEN NULLIF((p_data->>'amountUsd')::numeric,0) ELSE fee_usd END,fee_status=p_data->>'status',
   fee_method=CASE WHEN p_data->>'status'='paid' THEN btrim(p_data->>'method') END,
   fee_reference=CASE WHEN p_data->>'status'='paid' THEN NULLIF(btrim(COALESCE(p_data->>'reference','')),'') END,
   fee_paid_on=CASE WHEN p_data->>'status'='paid' THEN (p_data->>'paidOn')::date END,
   fee_waiver_reason=CASE WHEN p_data->>'status'='waived' THEN btrim(p_data->>'waiverReason') END,
   fee_recorded_by=p_actor,fee_recorded_at=now(),revision=revision+1,updated_at=now() WHERE id=cand.id RETURNING * INTO cand;
  result:=jsonb_build_object('id',cand.id,'feeStatus',cand.fee_status,'feeUsd',cand.fee_usd);
 WHEN 'examiners_set' THEN
  SELECT * INTO exam FROM public.grading_events WHERE id=(p_data->>'eventId')::uuid AND syllabus_id IS NOT NULL FOR UPDATE;
  IF NOT FOUND OR exam.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'Test day unavailable or cancelled' USING ERRCODE='22023'; END IF;
  IF exam.kind<>'color' THEN RAISE EXCEPTION 'Kukkiwon tests are not scored by the academy' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(p_data->'examiners') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'examiners')>5 THEN RAISE EXCEPTION 'Choose up to 5 examiners' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.grading_candidates WHERE event_id=exam.id AND status IN ('finalized','promoted')) THEN RAISE EXCEPTION 'The panel is locked once a result is finalized' USING ERRCODE='22023'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_data->'examiners') LOOP
   BEGIN
    PERFORM public.portal_assert_actor((item#>>'{}')::uuid,'action:evaluations_grade');
   EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Each examiner must be an active coach who can grade belt tests' USING ERRCODE='22023';
   END;
  END LOOP;
  DELETE FROM public.grading_event_examiners WHERE event_id=exam.id AND profile_id NOT IN (SELECT (value#>>'{}')::uuid FROM jsonb_array_elements(p_data->'examiners'));
  INSERT INTO public.grading_event_examiners(event_id,profile_id,added_by) SELECT exam.id,(value#>>'{}')::uuid,p_actor FROM jsonb_array_elements(p_data->'examiners') ON CONFLICT DO NOTHING;
  result:=jsonb_build_object('id',exam.id,'examiners',(SELECT COALESCE(jsonb_agg(profile_id ORDER BY added_at,profile_id),'[]'::jsonb) FROM public.grading_event_examiners WHERE event_id=exam.id));
 WHEN 'withdraw' THEN
  SELECT * INTO cand FROM public.grading_candidates WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR cand.status IN ('promoted','withdrawn','certified','declined') THEN RAISE EXCEPTION 'This candidate cannot be withdrawn' USING ERRCODE='22023'; END IF;
  IF length(btrim(COALESCE(p_data->>'reason','')))<5 THEN RAISE EXCEPTION 'Record a withdrawal reason' USING ERRCODE='22023'; END IF;
  student:=cand.student_id;
  UPDATE public.grading_candidates SET status='withdrawn',withdrawn_reason=btrim(p_data->>'reason'),revision=revision+1,updated_at=now() WHERE id=cand.id;
  result:=jsonb_build_object('id',cand.id,'status','withdrawn');

 -- Scoring (color only) ------------------------------------------------------
 WHEN 'score' THEN
  SELECT * INTO cand FROM public.grading_candidates WHERE id=(p_data->>'candidateId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate unavailable' USING ERRCODE='P0002'; END IF;
  SELECT * INTO exam FROM public.grading_events WHERE id=cand.event_id;
  IF exam.kind<>'color' OR exam.syllabus_id IS NULL THEN RAISE EXCEPTION 'Kukkiwon tests are not scored by the academy' USING ERRCODE='22023'; END IF;
  IF exam.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'This test day was cancelled' USING ERRCODE='22023'; END IF;
  IF exam.exam_date>today THEN RAISE EXCEPTION 'Scores can be entered from the test day' USING ERRCODE='22023'; END IF;
  IF cand.status NOT IN ('registered','scoring') THEN RAISE EXCEPTION 'Scores are locked for this candidate' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.belt_test_items i JOIN public.belt_test_sections x ON x.id=i.section_id WHERE i.id=(p_data->>'itemId')::uuid AND x.syllabus_id=exam.syllabus_id) THEN RAISE EXCEPTION 'This item is not part of the test' USING ERRCODE='22023'; END IF;
  IF cand.retest_count>0 AND NOT EXISTS(SELECT 1 FROM public.belt_test_items i WHERE i.id=(p_data->>'itemId')::uuid AND i.section_id=ANY(cand.retest_sections)) THEN RAISE EXCEPTION 'Only the retest sections can be re-scored' USING ERRCODE='22023'; END IF;
  IF (p_data->>'score')::numeric NOT BETWEEN 0 AND 10 OR (p_data->>'score')::numeric<>round((p_data->>'score')::numeric,1) THEN RAISE EXCEPTION 'Enter a score from 0 to 10 with one decimal' USING ERRCODE='22023'; END IF;
  student:=cand.student_id;
  -- Extras: with a panel, only its examiners score; each examiner keeps their own row.
  IF EXISTS(SELECT 1 FROM public.grading_event_examiners WHERE event_id=exam.id) AND NOT EXISTS(SELECT 1 FROM public.grading_event_examiners WHERE event_id=exam.id AND profile_id=p_actor) THEN
   RAISE EXCEPTION 'Only the examiners on this test day''s panel can score' USING ERRCODE='42501';
  END IF;
  SELECT * INTO existing FROM public.grading_item_scores WHERE candidate_id=cand.id AND item_id=(p_data->>'itemId')::uuid AND scored_by=p_actor FOR UPDATE;
  IF COALESCE(existing.revision,0)<>(p_data->>'revision')::int THEN RAISE EXCEPTION 'This score changed. Reload before saving' USING ERRCODE='40001'; END IF;
  INSERT INTO public.grading_item_scores(candidate_id,item_id,score,note,scored_by)
  VALUES(cand.id,(p_data->>'itemId')::uuid,(p_data->>'score')::numeric,COALESCE(p_data->>'note',''),p_actor)
  ON CONFLICT(candidate_id,item_id,scored_by) DO UPDATE SET score=EXCLUDED.score,note=EXCLUDED.note,revision=public.grading_item_scores.revision+1,updated_at=now()
  RETURNING id INTO saved_id;
  UPDATE public.grading_candidates SET status='scoring',updated_at=now() WHERE id=cand.id AND status='registered';
  computed:=public.portal_belt_test_compute(cand.id);
  -- Examiners see only their own scores, so the panel preview goes to managers only.
  result:=jsonb_build_object('id',saved_id,'revision',(SELECT revision FROM public.grading_item_scores WHERE id=saved_id),'preview',CASE WHEN manages THEN computed END);
 WHEN 'feedback' THEN
  SELECT * INTO cand FROM public.grading_candidates WHERE id=(p_data->>'candidateId')::uuid FOR UPDATE;
  IF NOT FOUND OR cand.status IN ('withdrawn','promoted') THEN RAISE EXCEPTION 'Candidate unavailable' USING ERRCODE='22023'; END IF;
  IF length(COALESCE(p_data->>'feedback',''))>1000 THEN RAISE EXCEPTION 'Feedback is limited to 1000 characters' USING ERRCODE='22023'; END IF;
  student:=cand.student_id;
  UPDATE public.grading_candidates SET public_feedback=COALESCE(p_data->>'feedback',''),updated_at=now() WHERE id=cand.id;
  result:=jsonb_build_object('id',cand.id,'saved',true);
 WHEN 'finalize' THEN
  SELECT * INTO cand FROM public.grading_candidates WHERE id=(p_data->>'candidateId')::uuid FOR UPDATE;
  IF NOT FOUND OR cand.status<>'scoring' THEN RAISE EXCEPTION 'Score every item before finalizing' USING ERRCODE='22023'; END IF;
  IF cand.revision<>(p_data->>'revision')::int THEN RAISE EXCEPTION 'This candidate changed. Reload before finalizing' USING ERRCODE='40001'; END IF;
  computed:=public.portal_belt_test_compute(cand.id);
  IF NOT (computed->>'complete')::boolean THEN RAISE EXCEPTION 'Score every item before finalizing (% of % scored)',computed->>'scoredItems',computed->>'totalItems' USING ERRCODE='22023'; END IF;
  student:=cand.student_id;
  UPDATE public.grading_candidates SET status='finalized',
   result=CASE WHEN computed->>'result'='retest' AND retest_count>0 THEN 'fail' ELSE computed->>'result' END,
   overall_percent=(computed->>'overall')::numeric,score=(computed->>'overall')::numeric,section_results=computed->'sections',
   retest_sections=CASE WHEN computed->>'result'='retest' AND retest_count=0 THEN ARRAY(SELECT jsonb_array_elements_text(computed->'retestSections')::uuid) ELSE retest_sections END,
   finalized_at=now(),finalized_by=p_actor,assessed_by=p_actor,revision=revision+1,updated_at=now() WHERE id=cand.id RETURNING * INTO cand;
  result:=jsonb_build_object('id',cand.id,'result',cand.result,'overall',cand.overall_percent);
 WHEN 'start_retest' THEN
  SELECT * INTO cand FROM public.grading_candidates WHERE id=(p_data->>'candidateId')::uuid FOR UPDATE;
  IF NOT FOUND OR cand.status<>'finalized' OR cand.result<>'retest' OR cand.retest_count>0 THEN RAISE EXCEPTION 'Only a first retest result can be retested' USING ERRCODE='22023'; END IF;
  IF cand.revision<>(p_data->>'revision')::int THEN RAISE EXCEPTION 'This candidate changed. Reload before saving' USING ERRCODE='40001'; END IF;
  SELECT y.* INTO syl FROM public.grading_events e JOIN public.belt_test_syllabi y ON y.id=e.syllabus_id WHERE e.id=cand.event_id;
  SELECT * INTO exam FROM public.grading_events WHERE id=cand.event_id;
  IF today>exam.exam_date+syl.retest_days THEN RAISE EXCEPTION 'The % day retest window has closed',syl.retest_days USING ERRCODE='22023'; END IF;
  student:=cand.student_id;
  UPDATE public.grading_candidates SET status='scoring',result='pending',retest_count=retest_count+1,finalized_at=NULL,finalized_by=NULL,revision=revision+1,updated_at=now() WHERE id=cand.id;
  result:=jsonb_build_object('id',cand.id,'retest',true);
 WHEN 'publish_results' THEN
  SELECT * INTO exam FROM public.grading_events WHERE id=(p_data->>'eventId')::uuid AND syllabus_id IS NOT NULL AND kind='color' FOR UPDATE;
  IF NOT FOUND OR exam.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'Test day unavailable or cancelled' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.grading_candidates WHERE event_id=exam.id AND status IN ('registered','scoring')) THEN RAISE EXCEPTION 'Finalize or withdraw every candidate before publishing results' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.grading_candidates WHERE event_id=exam.id AND status='requested') THEN RAISE EXCEPTION 'Approve or decline every request before publishing results' USING ERRCODE='22023'; END IF;
  UPDATE public.grading_events SET results_published_at=COALESCE(results_published_at,now()) WHERE id=exam.id;
  INSERT INTO public.student_activity_events(student_id,category,title,record_id,recorded_by)
  SELECT student_id,'grading','Belt test result published',id::text,p_actor FROM public.grading_candidates WHERE event_id=exam.id AND status='finalized';
  result:=jsonb_build_object('id',exam.id,'published',true);

 -- Promotion (both tracks) ----------------------------------------------------
 WHEN 'promote' THEN
  SELECT * INTO cand FROM public.grading_candidates WHERE id=(p_data->>'candidateId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate unavailable' USING ERRCODE='P0002'; END IF;
  IF cand.revision<>(p_data->>'revision')::int THEN RAISE EXCEPTION 'This candidate changed. Reload before promoting' USING ERRCODE='40001'; END IF;
  SELECT * INTO exam FROM public.grading_events WHERE id=cand.event_id;
  IF exam.kind='color' AND NOT (cand.status='finalized' AND cand.result IN ('pass','distinction')) THEN RAISE EXCEPTION 'Only a finalized pass can be promoted' USING ERRCODE='22023'; END IF;
  IF exam.kind='kukkiwon' AND cand.status<>'certified' THEN RAISE EXCEPTION 'Record the Kukkiwon certificate before promoting' USING ERRCODE='22023'; END IF;
  student:=cand.student_id;
  PERFORM 1 FROM public.students WHERE id=student AND deleted_at IS NULL FOR UPDATE;
  SELECT * INTO target FROM public.belts WHERE id=exam.target_belt_id;
  SELECT b.* INTO prior FROM public.students s JOIN public.belts b ON b.id=s.belt_id WHERE s.id=student;
  IF prior.id IS NOT NULL AND target.belt_order<=prior.belt_order THEN RAISE EXCEPTION 'The student already holds % or higher',target.belt_name USING ERRCODE='22023'; END IF;
  INSERT INTO public.belt_histories(student_id,belt_level,promotion_date,certificate_id,kukkiwon_dan_card_id)
  VALUES(student,target.belt_name,CASE WHEN exam.kind='kukkiwon' THEN COALESCE(cand.certificate_date,exam.exam_date) ELSE exam.exam_date END,
   CASE WHEN exam.kind='kukkiwon' THEN cand.certificate_no END,CASE WHEN exam.kind='kukkiwon' THEN cand.certificate_no END) RETURNING id INTO history_id;
  UPDATE public.grading_candidates SET status='promoted',promoted_by=p_actor,belt_history_id=history_id,revision=revision+1,updated_at=now() WHERE id=cand.id;
  IF exam.kind='kukkiwon' AND cand.certificate_no IS NOT NULL THEN UPDATE public.students SET kukkiwon_id=COALESCE(NULLIF(btrim(kukkiwon_id),''),cand.certificate_no) WHERE id=student; END IF;
  result:=jsonb_build_object('id',cand.id,'beltHistoryId',history_id,'belt',target.belt_name);

 -- Kukkiwon via CTF -----------------------------------------------------------
 WHEN 'kukkiwon_update' THEN
  SELECT * INTO cand FROM public.grading_candidates WHERE id=(p_data->>'candidateId')::uuid FOR UPDATE;
  IF NOT FOUND OR cand.status<>'nominated' THEN RAISE EXCEPTION 'Nomination details are locked after CTF submission' USING ERRCODE='22023'; END IF;
  IF cand.revision<>(p_data->>'revision')::int THEN RAISE EXCEPTION 'This nomination changed. Reload before saving' USING ERRCODE='40001'; END IF;
  student:=cand.student_id;
  UPDATE public.grading_candidates SET legal_name_en=NULLIF(btrim(p_data->>'legalNameEn'),''),legal_name_kh=NULLIF(btrim(p_data->>'legalNameKh'),''),
   previous_certificate_no=NULLIF(btrim(p_data->>'previousCertificateNo'),''),revision=revision+1,updated_at=now() WHERE id=cand.id;
  result:=jsonb_build_object('id',cand.id,'saved',true);
 WHEN 'kukkiwon_submit' THEN
  SELECT * INTO exam FROM public.grading_events WHERE id=(p_data->>'eventId')::uuid AND kind='kukkiwon' FOR UPDATE;
  IF NOT FOUND OR exam.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'Kukkiwon test day unavailable or cancelled' USING ERRCODE='22023'; END IF;
  IF (p_data->>'submittedOn')::date>today OR length(btrim(COALESCE(p_data->>'reference','')))<1 THEN RAISE EXCEPTION 'Record the CTF submission date and reference' USING ERRCODE='22023'; END IF;
  SELECT target_b.belt_order INTO n FROM public.belts target_b WHERE target_b.id=exam.target_belt_id;
  IF NOT EXISTS(SELECT 1 FROM public.grading_candidates WHERE event_id=exam.id AND status='nominated') THEN RAISE EXCEPTION 'There are no nominations to submit' USING ERRCODE='22023'; END IF;
  SELECT count(*) INTO pos FROM public.grading_candidates WHERE event_id=exam.id AND status='nominated'
   AND (legal_name_en IS NULL OR dob IS NULL OR gender IS NULL OR (n>7 AND previous_certificate_no IS NULL));
  IF pos>0 THEN RAISE EXCEPTION '% nomination(s) are missing CTF details',pos USING ERRCODE='22023'; END IF;
  UPDATE public.grading_candidates SET status='submitted',ctf_submitted_on=(p_data->>'submittedOn')::date,ctf_reference=btrim(p_data->>'reference'),revision=revision+1,updated_at=now()
  WHERE event_id=exam.id AND status='nominated';
  GET DIAGNOSTICS pos=ROW_COUNT;
  result:=jsonb_build_object('id',exam.id,'submitted',pos);
 WHEN 'kukkiwon_result' THEN
  SELECT * INTO cand FROM public.grading_candidates WHERE id=(p_data->>'candidateId')::uuid FOR UPDATE;
  IF NOT FOUND OR cand.status NOT IN ('submitted','passed','failed') THEN RAISE EXCEPTION 'Record a result only after CTF submission' USING ERRCODE='22023'; END IF;
  IF cand.revision<>(p_data->>'revision')::int THEN RAISE EXCEPTION 'This nomination changed. Reload before saving' USING ERRCODE='40001'; END IF;
  SELECT * INTO exam FROM public.grading_events WHERE id=cand.event_id;
  IF exam.exam_date>today THEN RAISE EXCEPTION 'Record the result after the Kukkiwon test date' USING ERRCODE='22023'; END IF;
  IF p_data->>'result' NOT IN ('passed','failed') THEN RAISE EXCEPTION 'Choose passed or failed' USING ERRCODE='22023'; END IF;
  student:=cand.student_id;
  UPDATE public.grading_candidates SET status=p_data->>'result',external_result=p_data->>'result',revision=revision+1,updated_at=now() WHERE id=cand.id;
  result:=jsonb_build_object('id',cand.id,'status',p_data->>'result');
 WHEN 'kukkiwon_certificate' THEN
  SELECT * INTO cand FROM public.grading_candidates WHERE id=(p_data->>'candidateId')::uuid FOR UPDATE;
  IF NOT FOUND OR cand.status<>'passed' THEN RAISE EXCEPTION 'Record a certificate only for a passed candidate' USING ERRCODE='22023'; END IF;
  IF cand.revision<>(p_data->>'revision')::int THEN RAISE EXCEPTION 'This nomination changed. Reload before saving' USING ERRCODE='40001'; END IF;
  IF length(btrim(COALESCE(p_data->>'certificateNo','')))<1 OR (p_data->>'certificateDate')::date>today THEN RAISE EXCEPTION 'Record the certificate number and issue date' USING ERRCODE='22023'; END IF;
  student:=cand.student_id;
  UPDATE public.grading_candidates SET status='certified',certificate_no=btrim(p_data->>'certificateNo'),certificate_date=(p_data->>'certificateDate')::date,revision=revision+1,updated_at=now() WHERE id=cand.id;
  result:=jsonb_build_object('id',cand.id,'status','certified');
 END CASE;

 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('BELT_TESTS_'||upper(p_action),p_actor::text,COALESCE(student,result->>'id',p_data->>'id'),jsonb_build_object('requestKey',p_request_key,'input',p_data,'result',result));
 IF student IS NOT NULL AND p_action IN ('register','withdraw','promote','kukkiwon_result','kukkiwon_certificate','approve_request','decline_request') THEN
  INSERT INTO public.student_activity_events(student_id,category,title,record_id,recorded_by)
  VALUES(student,'grading',CASE p_action WHEN 'register' THEN 'Registered for a belt test' WHEN 'approve_request' THEN 'Belt test request approved' WHEN 'decline_request' THEN 'Belt test request declined' WHEN 'withdraw' THEN 'Withdrawn from a belt test'
   WHEN 'promote' THEN 'Promoted to '||(result->>'belt') WHEN 'kukkiwon_result' THEN 'Kukkiwon test result recorded' ELSE 'Kukkiwon certificate recorded' END,
   COALESCE(result->>'id',p_data->>'id'),p_actor);
 END IF;
 INSERT INTO public.portal_operation_requests(request_key,actor,action,payload,result) VALUES(p_request_key,p_actor,'belt:'||p_action,p_data,result);
 RETURN result;
END $$;

-- Student request (eligible students only; requests close the day before the test).
CREATE OR REPLACE FUNCTION public.student_portal_request_belt_test(p_actor uuid,p_student text,p_event uuid,p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; exam public.grading_events; cand public.grading_candidates; eligibility jsonb; taken int;
 previous public.portal_operation_requests; result jsonb; payload jsonb; today date:=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date;
BEGIN
 st:=public.student_portal_assert_student(p_actor,p_student);
 IF p_request IS NULL OR p_event IS NULL THEN RAISE EXCEPTION 'Invalid belt test request' USING ERRCODE='22023'; END IF;
 payload:=jsonb_build_object('studentId',p_student,'eventId',p_event);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 SELECT * INTO previous FROM public.portal_operation_requests WHERE request_key=p_request;
 IF FOUND THEN
  IF previous.actor<>p_actor OR previous.action<>'belt:student_request' OR previous.payload<>payload THEN RAISE EXCEPTION 'Request key mismatch' USING ERRCODE='22023'; END IF;
  RETURN previous.result;
 END IF;
 PERFORM set_config('portal.belt_tests_write','on',true);
 SELECT * INTO exam FROM public.grading_events WHERE id=p_event AND syllabus_id IS NOT NULL FOR UPDATE;
 IF NOT FOUND OR exam.published_at IS NULL OR exam.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'This test day is not open' USING ERRCODE='22023'; END IF;
 IF NOT exam.accepts_requests THEN RAISE EXCEPTION 'Your coach registers students for this test day' USING ERRCODE='22023'; END IF;
 IF exam.results_published_at IS NOT NULL OR today>=exam.exam_date THEN RAISE EXCEPTION 'Requests for this test day have closed' USING ERRCODE='22023'; END IF;
 IF exam.branch_id IS NOT NULL AND exam.branch_id IS DISTINCT FROM st.home_branch_id THEN RAISE EXCEPTION 'This test day is for another branch' USING ERRCODE='22023'; END IF;
 SELECT * INTO cand FROM public.grading_candidates WHERE event_id=exam.id AND student_id=st.id FOR UPDATE;
 IF cand.id IS NOT NULL AND cand.status='requested' THEN
  result:=jsonb_build_object('eventId',exam.id,'status','requested');
 ELSE
  IF cand.id IS NOT NULL AND NOT (cand.status='withdrawn' AND cand.registered_at IS NULL) THEN
   RAISE EXCEPTION '%',CASE cand.status WHEN 'declined' THEN 'Your coach declined this request. Talk to your coach before requesting again'
    WHEN 'withdrawn' THEN 'You were withdrawn from this test day. Talk to your coach' ELSE 'You are already on this test day' END USING ERRCODE='22023';
  END IF;
  eligibility:=public.portal_belt_test_eligibility(st.id,exam.syllabus_id);
  IF eligibility->>'status'<>'eligible' THEN RAISE EXCEPTION 'You are not yet eligible for this test' USING ERRCODE='22023'; END IF;
  IF exam.capacity IS NOT NULL THEN
   SELECT count(*) INTO taken FROM public.grading_candidates WHERE event_id=exam.id AND status NOT IN ('withdrawn','declined');
   IF taken>=exam.capacity THEN RAISE EXCEPTION 'This test day is full' USING ERRCODE='22023'; END IF;
  END IF;
  IF cand.id IS NULL THEN
   INSERT INTO public.grading_candidates(event_id,student_id,status,requested_at,eligibility_snapshot,result)
   VALUES(exam.id,st.id,'requested',now(),eligibility,CASE WHEN exam.kind='color' THEN 'pending' END) RETURNING * INTO cand;
  ELSE
   UPDATE public.grading_candidates SET status='requested',requested_at=now(),eligibility_snapshot=eligibility,withdrawn_reason=NULL,revision=revision+1,updated_at=now()
   WHERE id=cand.id RETURNING * INTO cand;
  END IF;
  INSERT INTO public.student_activity_events(student_id,category,title,record_id,recorded_by) VALUES(st.id,'grading','Requested a belt test',cand.id::text,p_actor);
  INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('BELT_TESTS_STUDENT_REQUEST',p_actor::text,st.id,jsonb_build_object('eventId',exam.id,'candidateId',cand.id));
  result:=jsonb_build_object('eventId',exam.id,'status','requested');
 END IF;
 INSERT INTO public.portal_operation_requests(request_key,actor,action,payload,result) VALUES(p_request,p_actor,'belt:student_request',payload,result);
 RETURN result;
END $$;

-- Student cancels their own pending request (repeat calls are harmless).
CREATE OR REPLACE FUNCTION public.student_portal_cancel_belt_test_request(p_actor uuid,p_student text,p_event uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; cand public.grading_candidates;
BEGIN
 st:=public.student_portal_assert_student(p_actor,p_student);
 PERFORM set_config('portal.belt_tests_write','on',true);
 SELECT * INTO cand FROM public.grading_candidates WHERE event_id=p_event AND student_id=st.id FOR UPDATE;
 IF cand.id IS NULL OR (cand.status='withdrawn' AND cand.registered_at IS NULL) THEN RETURN jsonb_build_object('eventId',p_event,'status',NULL); END IF;
 IF cand.status<>'requested' THEN RAISE EXCEPTION 'Ask your coach to change a registration' USING ERRCODE='22023'; END IF;
 UPDATE public.grading_candidates SET status='withdrawn',withdrawn_reason='Request cancelled by the student',revision=revision+1,updated_at=now() WHERE id=cand.id;
 INSERT INTO public.student_activity_events(student_id,category,title,record_id,recorded_by) VALUES(st.id,'grading','Cancelled a belt test request',cand.id::text,p_actor);
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('BELT_TESTS_STUDENT_CANCEL',p_actor::text,st.id,jsonb_build_object('eventId',p_event,'candidateId',cand.id));
 RETURN jsonb_build_object('eventId',p_event,'status',NULL);
END $$;

-- belt-tests-v1, extended with optional fields (see docs/STUDENT_PORTAL_BELT_TESTS_HANDOFF.md):
-- upcoming[].requestsOpen/requestDeadline/placesLeft/canRequest/feeUsd/feeStatus/declineReason.
-- registration may now also be 'requested' or 'declined'. The Kukkiwon list never
-- carries requests, so its status enum is unchanged.
CREATE OR REPLACE FUNCTION public.portal_student_belt_tests(p_student text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; current_b public.belts; next_b public.belts; syl public.belt_test_syllabi;
 today date:=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date;
BEGIN
 SELECT * INTO st FROM public.students WHERE id=p_student AND deleted_at IS NULL;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO current_b FROM public.belts WHERE id=st.belt_id;
 SELECT * INTO next_b FROM public.belts WHERE belt_order=current_b.belt_order+1;
 SELECT * INTO syl FROM public.belt_test_syllabi WHERE target_belt_id=next_b.id AND status='published';
 RETURN jsonb_build_object(
  'contractVersion','belt-tests-v1','studentId',st.id,'currentBelt',st.current_belt,
  'nextBelt',CASE WHEN next_b.id IS NULL THEN NULL ELSE jsonb_build_object('name',next_b.belt_name,'order',next_b.belt_order,'track',CASE WHEN lower(next_b.belt_type)='black' THEN 'kukkiwon' ELSE 'color' END) END,
  'eligibility',CASE WHEN syl.id IS NULL THEN NULL ELSE public.portal_belt_test_eligibility(st.id,syl.id) END,
  'curriculum',CASE WHEN syl.id IS NULL THEN NULL ELSE jsonb_build_object('title',syl.title,'version',syl.version,'track',syl.track,'passMark',syl.pass_mark,
   'sections',(SELECT COALESCE(jsonb_agg(jsonb_build_object('kind',x.kind,'title',x.title,'weight',x.weight,
     'items',(SELECT COALESCE(jsonb_agg(jsonb_build_object('title',i.title,'libraryAssetId',i.library_asset_id) ORDER BY i.position),'[]'::jsonb) FROM public.belt_test_items i WHERE i.section_id=x.id)) ORDER BY x.position),'[]'::jsonb)
    FROM public.belt_test_sections x WHERE x.syllabus_id=syl.id)) END,
  'upcoming',(SELECT COALESCE(jsonb_agg(jsonb_build_object('eventId',e.id,'title',e.title,'kind',e.kind,'date',e.exam_date,'startTime',substr(e.start_time::text,1,5),
     'location',e.location,'branchName',b.branch_name,'targetBelt',t.belt_name,
     'registration',CASE WHEN c.id IS NULL THEN NULL ELSE c.status END,
     'requestsOpen',e.accepts_requests AND today<e.exam_date,
     'requestDeadline',CASE WHEN e.accepts_requests THEN (e.exam_date-1)::text END,
     'placesLeft',CASE WHEN e.capacity IS NULL THEN NULL ELSE GREATEST(e.capacity-taken.n,0) END,
     -- Only a cancelled request (withdrawn, never registered) can be requested again.
     'canRequest',COALESCE(NOT EXISTS(SELECT 1 FROM public.grading_candidates w WHERE w.event_id=e.id AND w.student_id=st.id AND NOT (w.status='withdrawn' AND w.registered_at IS NULL))
       AND e.accepts_requests AND today<e.exam_date AND e.target_belt_id=next_b.id
       AND (e.capacity IS NULL OR taken.n<e.capacity) AND (e.branch_id IS NULL OR e.branch_id=st.home_branch_id)
       AND public.portal_belt_test_eligibility(st.id,e.syllabus_id)->>'status'='eligible',false),
     'feeUsd',NULLIF(y.fee_usd,0),
     'feeStatus',CASE WHEN c.status IN ('registered','scoring','finalized','promoted','nominated','submitted','passed','failed','certified') THEN NULLIF(c.fee_status,'none') END,
     'declineReason',CASE WHEN c.status='declined' THEN c.decline_reason END) ORDER BY e.exam_date,e.start_time),'[]'::jsonb)
   FROM public.grading_events e JOIN public.belts t ON t.id=e.target_belt_id JOIN public.belt_test_syllabi y ON y.id=e.syllabus_id LEFT JOIN public.branches b ON b.id=e.branch_id
   LEFT JOIN public.grading_candidates c ON c.event_id=e.id AND c.student_id=st.id AND c.status<>'withdrawn'
   CROSS JOIN LATERAL (SELECT count(*)::int AS n FROM public.grading_candidates o WHERE o.event_id=e.id AND o.status NOT IN ('withdrawn','declined')) taken
   WHERE e.syllabus_id IS NOT NULL AND e.published_at IS NOT NULL AND e.cancelled_at IS NULL AND e.exam_date>=today
    AND (e.target_belt_id=next_b.id OR c.id IS NOT NULL) AND (e.branch_id IS NULL OR e.branch_id=st.home_branch_id OR c.id IS NOT NULL)),
  'results',(SELECT COALESCE(jsonb_agg(jsonb_build_object('eventId',e.id,'title',e.title,'date',e.exam_date,'targetBelt',t.belt_name,
     'overallPercent',c.overall_percent,'result',c.result,'promoted',c.status='promoted',
     'sections',(SELECT COALESCE(jsonb_agg(jsonb_build_object('kind',r->>'kind','title',r->>'title','percent',(r->>'percent')::numeric,'grade',r->>'grade','met',(r->>'met')::boolean)),'[]'::jsonb) FROM jsonb_array_elements(COALESCE(c.section_results,'[]'::jsonb)) r),
     'feedback',NULLIF(c.public_feedback,'')) ORDER BY e.exam_date DESC),'[]'::jsonb)
   FROM public.grading_candidates c JOIN public.grading_events e ON e.id=c.event_id JOIN public.belts t ON t.id=e.target_belt_id
   WHERE c.student_id=st.id AND e.kind='color' AND e.results_published_at IS NOT NULL AND c.status IN ('finalized','promoted')),
  'kukkiwon',(SELECT COALESCE(jsonb_agg(jsonb_build_object('eventId',e.id,'title',e.title,'testDate',e.exam_date,'location',e.location,'targetBelt',t.belt_name,
     'poomOrDan',c.poom_or_dan,'status',c.status,'ctfSubmittedOn',c.ctf_submitted_on,
     'certificateNo',CASE WHEN c.status IN ('certified','promoted') THEN c.certificate_no END) ORDER BY e.exam_date DESC),'[]'::jsonb)
   FROM public.grading_candidates c JOIN public.grading_events e ON e.id=c.event_id JOIN public.belts t ON t.id=e.target_belt_id
   WHERE c.student_id=st.id AND e.kind='kukkiwon' AND c.status NOT IN ('withdrawn','requested','declined') AND e.cancelled_at IS NULL)
 );
END $$;

-- ===========================================================================
-- Grants: service role only; helpers are internal.
-- ===========================================================================
DO $$ DECLARE f text; BEGIN
 FOREACH f IN ARRAY ARRAY['student_portal_assert_student(uuid,text)','portal_set_ranking_opt_out(uuid,text,boolean)','student_portal_set_ranking_opt_out(uuid,text,boolean)',
  'portal_set_lesson_layout(uuid,jsonb)','portal_guard_belt_test_panel()','portal_belt_test_item_scores(uuid)','portal_belt_test_compute(uuid)',
  'portal_belt_test_admit(uuid,uuid,text,text,uuid)','portal_belt_tests_mutate(uuid,text,jsonb,uuid)','student_portal_request_belt_test(uuid,text,uuid,uuid)',
  'student_portal_cancel_belt_test_request(uuid,text,uuid)','portal_student_belt_tests(text)'] LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC,anon,authenticated',f);
 END LOOP;
 FOREACH f IN ARRAY ARRAY['portal_set_ranking_opt_out(uuid,text,boolean)','student_portal_set_ranking_opt_out(uuid,text,boolean)','portal_set_lesson_layout(uuid,jsonb)',
  'portal_belt_test_item_scores(uuid)','portal_belt_test_compute(uuid)','portal_belt_tests_mutate(uuid,text,jsonb,uuid)',
  'student_portal_request_belt_test(uuid,text,uuid,uuid)','student_portal_cancel_belt_test_request(uuid,text,uuid)','portal_student_belt_tests(text)'] LOOP
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role',f);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
