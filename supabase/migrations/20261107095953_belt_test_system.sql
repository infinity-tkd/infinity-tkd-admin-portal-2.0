-- Belt test system.
-- Color belts (Yellow..Red) are tested and scored by the academy against a
-- published, versioned syllabus. Black belts (Poom/Dan) are tested at Kukkiwon
-- Cambodia through the Cambodia Taekwondo Federation (CTF): the academy records
-- the test day, curriculum, nominations, CTF submission, result and certificate,
-- but never scores them.
-- Writes go only through portal_belt_tests_mutate (service role, audited,
-- idempotent). Management actions need action:evaluations_grade plus the Root,
-- Super Root, Admin or Head Coach role; scoring needs action:evaluations_grade.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

-- ---------------------------------------------------------------------------
-- Syllabi, sections and items
-- ---------------------------------------------------------------------------
CREATE TABLE public.belt_test_syllabi (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 target_belt_id int NOT NULL REFERENCES public.belts(id),
 track text NOT NULL CHECK (track IN ('color','kukkiwon')),
 version int NOT NULL CHECK (version>0),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 160),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
 pass_mark numeric(5,2) CHECK (pass_mark BETWEEN 0 AND 100),
 distinction_mark numeric(5,2) CHECK (distinction_mark BETWEEN 0 AND 100),
 section_minimum numeric(5,2) CHECK (section_minimum BETWEEN 0 AND 100),
 critical_minimum numeric(3,1) CHECK (critical_minimum BETWEEN 0 AND 10),
 retest_days int CHECK (retest_days BETWEEN 0 AND 365),
 eligibility jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(eligibility)='object'),
 notes text NOT NULL DEFAULT '' CHECK (length(notes)<=2000),
 revision int NOT NULL DEFAULT 1,
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 published_by uuid REFERENCES public.profiles(id),
 published_at timestamptz,
 UNIQUE (target_belt_id,version),
 CHECK (track='kukkiwon' OR (pass_mark IS NOT NULL AND distinction_mark IS NOT NULL AND section_minimum IS NOT NULL AND critical_minimum IS NOT NULL AND retest_days IS NOT NULL AND distinction_mark>=pass_mark))
);
CREATE UNIQUE INDEX belt_test_syllabi_one_published ON public.belt_test_syllabi(target_belt_id) WHERE status='published';

CREATE TABLE public.belt_test_sections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 syllabus_id uuid NOT NULL REFERENCES public.belt_test_syllabi(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('physical','skill','poomsae','acrobatics','custom')),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 120),
 weight numeric(5,2) CHECK (weight IS NULL OR weight BETWEEN 0 AND 100),
 minimum numeric(5,2) CHECK (minimum IS NULL OR minimum BETWEEN 0 AND 100),
 position int NOT NULL CHECK (position>=0),
 UNIQUE (syllabus_id,position)
);
CREATE TABLE public.belt_test_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 section_id uuid NOT NULL REFERENCES public.belt_test_sections(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 150),
 -- A soft link to the library lesson the name came from; the name is the record.
 library_asset_id int,
 weight numeric(5,2) NOT NULL DEFAULT 1 CHECK (weight>0 AND weight<=100),
 critical boolean NOT NULL DEFAULT false,
 guide text NOT NULL DEFAULT '' CHECK (length(guide)<=500),
 position int NOT NULL CHECK (position>=0),
 UNIQUE (section_id,position)
);
CREATE INDEX belt_test_items_section ON public.belt_test_items(section_id);

-- Published syllabi are frozen; only published -> retired is allowed.
CREATE OR REPLACE FUNCTION public.portal_guard_belt_test_syllabus() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE parent text;
BEGIN
 IF TG_TABLE_NAME='belt_test_syllabi' THEN
  IF TG_OP='UPDATE' AND OLD.status<>'draft' AND NOT (OLD.status='published' AND NEW.status='retired' AND (to_jsonb(NEW)-'status'-'updated_at')=(to_jsonb(OLD)-'status'-'updated_at')) THEN
   RAISE EXCEPTION 'A published belt test syllabus cannot change; save a new version' USING ERRCODE='22023';
  END IF;
  IF TG_OP='DELETE' AND OLD.status<>'draft' THEN RAISE EXCEPTION 'Only draft syllabi can be discarded' USING ERRCODE='22023'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
 END IF;
 IF TG_TABLE_NAME='belt_test_sections' THEN
  SELECT status INTO parent FROM public.belt_test_syllabi WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.syllabus_id ELSE NEW.syllabus_id END;
 ELSE
  SELECT y.status INTO parent FROM public.belt_test_sections x JOIN public.belt_test_syllabi y ON y.id=x.syllabus_id WHERE x.id=CASE WHEN TG_OP='DELETE' THEN OLD.section_id ELSE NEW.section_id END;
 END IF;
 IF parent IS DISTINCT FROM 'draft' AND parent IS NOT NULL THEN RAISE EXCEPTION 'A published belt test syllabus cannot change; save a new version' USING ERRCODE='22023'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER portal_guard_belt_test_syllabus BEFORE UPDATE OR DELETE ON public.belt_test_syllabi FOR EACH ROW EXECUTE FUNCTION public.portal_guard_belt_test_syllabus();
CREATE TRIGGER portal_guard_belt_test_sections BEFORE INSERT OR UPDATE OR DELETE ON public.belt_test_sections FOR EACH ROW EXECUTE FUNCTION public.portal_guard_belt_test_syllabus();
CREATE TRIGGER portal_guard_belt_test_items BEFORE INSERT OR UPDATE OR DELETE ON public.belt_test_items FOR EACH ROW EXECUTE FUNCTION public.portal_guard_belt_test_syllabus();

-- ---------------------------------------------------------------------------
-- Test days and candidates (extends the existing grading tables)
-- ---------------------------------------------------------------------------
ALTER TABLE public.grading_events
 ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'color' CHECK (kind IN ('color','kukkiwon')),
 ADD COLUMN IF NOT EXISTS syllabus_id uuid REFERENCES public.belt_test_syllabi(id),
 ADD COLUMN IF NOT EXISTS results_published_at timestamptz;
CREATE INDEX IF NOT EXISTS grading_events_syllabus ON public.grading_events(syllabus_id) WHERE syllabus_id IS NOT NULL;

DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT conname FROM pg_constraint WHERE conrelid='public.grading_candidates'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%status%' LOOP
  EXECUTE format('ALTER TABLE public.grading_candidates DROP CONSTRAINT %I',r.conname);
 END LOOP;
END $$;
ALTER TABLE public.grading_candidates
 ADD CONSTRAINT grading_candidates_status_check CHECK (status IN (
  'draft','assessed','failed','promoted',            -- legacy single-score flow
  'registered','scoring','finalized','withdrawn',    -- color belt tests
  'nominated','submitted','passed','certified')),    -- Kukkiwon via CTF ('failed' shared)
 ADD COLUMN IF NOT EXISTS registered_by uuid REFERENCES public.profiles(id),
 ADD COLUMN IF NOT EXISTS registered_at timestamptz,
 ADD COLUMN IF NOT EXISTS eligibility_snapshot jsonb,
 ADD COLUMN IF NOT EXISTS registration_override_reason text CHECK (registration_override_reason IS NULL OR length(registration_override_reason) BETWEEN 5 AND 500),
 ADD COLUMN IF NOT EXISTS overall_percent numeric(5,2) CHECK (overall_percent BETWEEN 0 AND 100),
 ADD COLUMN IF NOT EXISTS result text CHECK (result IN ('pending','distinction','pass','retest','fail')),
 ADD COLUMN IF NOT EXISTS section_results jsonb,
 ADD COLUMN IF NOT EXISTS retest_sections uuid[] NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS retest_count int NOT NULL DEFAULT 0 CHECK (retest_count BETWEEN 0 AND 1),
 ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
 ADD COLUMN IF NOT EXISTS finalized_by uuid REFERENCES public.profiles(id),
 ADD COLUMN IF NOT EXISTS public_feedback text NOT NULL DEFAULT '' CHECK (length(public_feedback)<=1000),
 ADD COLUMN IF NOT EXISTS withdrawn_reason text CHECK (withdrawn_reason IS NULL OR length(withdrawn_reason) BETWEEN 5 AND 500),
 ADD COLUMN IF NOT EXISTS poom_or_dan text CHECK (poom_or_dan IN ('Poom','Dan')),
 ADD COLUMN IF NOT EXISTS legal_name_en text CHECK (legal_name_en IS NULL OR length(btrim(legal_name_en)) BETWEEN 2 AND 150),
 ADD COLUMN IF NOT EXISTS legal_name_kh text CHECK (legal_name_kh IS NULL OR length(btrim(legal_name_kh)) BETWEEN 1 AND 150),
 ADD COLUMN IF NOT EXISTS dob date,
 ADD COLUMN IF NOT EXISTS gender text,
 ADD COLUMN IF NOT EXISTS previous_certificate_no text CHECK (previous_certificate_no IS NULL OR length(btrim(previous_certificate_no)) BETWEEN 1 AND 60),
 ADD COLUMN IF NOT EXISTS ctf_submitted_on date,
 ADD COLUMN IF NOT EXISTS ctf_reference text CHECK (ctf_reference IS NULL OR length(btrim(ctf_reference)) BETWEEN 1 AND 120),
 ADD COLUMN IF NOT EXISTS external_result text CHECK (external_result IN ('passed','failed')),
 ADD COLUMN IF NOT EXISTS certificate_no text CHECK (certificate_no IS NULL OR length(btrim(certificate_no)) BETWEEN 1 AND 60),
 ADD COLUMN IF NOT EXISTS certificate_date date;

CREATE TABLE public.grading_item_scores (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 candidate_id uuid NOT NULL REFERENCES public.grading_candidates(id) ON DELETE CASCADE,
 item_id uuid NOT NULL REFERENCES public.belt_test_items(id),
 score numeric(3,1) NOT NULL CHECK (score BETWEEN 0 AND 10),
 note text NOT NULL DEFAULT '' CHECK (length(note)<=500),
 scored_by uuid NOT NULL REFERENCES public.profiles(id),
 revision int NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (candidate_id,item_id)
);
CREATE INDEX grading_item_scores_item ON public.grading_item_scores(item_id);

-- Structured test days can only change through portal_belt_tests_mutate,
-- which sets this transaction-local flag. The legacy single-score operations
-- keep working for test days without a syllabus.
CREATE OR REPLACE FUNCTION public.portal_guard_belt_test_writes() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE structured boolean;
BEGIN
 IF current_setting('portal.belt_tests_write',true)='on' THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
 IF TG_TABLE_NAME='grading_item_scores' THEN RAISE EXCEPTION 'Use Belt Tests to record scores' USING ERRCODE='42501'; END IF;
 SELECT syllabus_id IS NOT NULL INTO structured FROM public.grading_events WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.event_id ELSE NEW.event_id END;
 IF structured THEN RAISE EXCEPTION 'Use Belt Tests to change candidates on this test day' USING ERRCODE='42501'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER portal_guard_belt_test_candidates BEFORE INSERT OR UPDATE OR DELETE ON public.grading_candidates FOR EACH ROW EXECUTE FUNCTION public.portal_guard_belt_test_writes();
CREATE TRIGGER portal_guard_belt_test_scores BEFORE INSERT OR UPDATE OR DELETE ON public.grading_item_scores FOR EACH ROW EXECUTE FUNCTION public.portal_guard_belt_test_writes();

-- Same service-only boundary as the other operational tables.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['belt_test_syllabi','belt_test_sections','belt_test_items','grading_item_scores'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Scoring (mirrored by lib/belt-test-scoring.ts; tests assert they agree)
-- ---------------------------------------------------------------------------
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
  SELECT x.id,x.kind,x.title,x.weight,x.minimum,
   (SELECT count(*) FROM public.belt_test_items i WHERE i.section_id=x.id) AS item_count,
   (SELECT count(*) FROM public.belt_test_items i JOIN public.grading_item_scores g ON g.item_id=i.id AND g.candidate_id=c.id WHERE i.section_id=x.id) AS scored_count,
   (SELECT sum(g.score*i.weight)/NULLIF(sum(i.weight),0) FROM public.belt_test_items i JOIN public.grading_item_scores g ON g.item_id=i.id AND g.candidate_id=c.id WHERE i.section_id=x.id) AS weighted
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
 JOIN public.grading_item_scores g ON g.item_id=i.id AND g.candidate_id=c.id
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

-- ---------------------------------------------------------------------------
-- Eligibility (one engine for the admin checker, registration and students)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.portal_belt_test_eligibility(p_student text,p_syllabus uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; s public.belt_test_syllabi; target public.belts; previous public.belts;
 today date:=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date; since date; days int; classes int;
 rules jsonb:='[]'::jsonb; e jsonb; min_days int; min_classes int; min_skill numeric;
 skills_total int; skills_graded int; skill_average numeric; lessons_total int; lessons_done int; all_met boolean;
BEGIN
 SELECT * INTO st FROM public.students WHERE id=p_student AND deleted_at IS NULL;
 SELECT * INTO s FROM public.belt_test_syllabi WHERE id=p_syllabus;
 IF st.id IS NULL OR s.id IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO target FROM public.belts WHERE id=s.target_belt_id;
 SELECT * INTO previous FROM public.belts WHERE belt_order=target.belt_order-1;
 e:=s.eligibility;
 min_days:=COALESCE((e->>'minimumDays')::int,0);
 min_classes:=COALESCE((e->>'minimumClasses')::int,0);
 min_skill:=COALESCE((e->>'minimumSkillAverage')::numeric,0);
 SELECT COALESCE(max(promotion_date),st.registration_date) INTO since FROM public.belt_histories WHERE student_id=st.id;
 days:=GREATEST(0,today-since);
 SELECT count(*) INTO classes FROM public.attendance a WHERE a.student_id=st.id AND a.status IN ('Present','Late') AND a.date>=since AND a.date<=today;
 rules:=rules||jsonb_build_object('key','current_belt','met',public.portal_belt_key(st.current_belt)=public.portal_belt_key(previous.belt_name),'current',st.current_belt,'required',previous.belt_name);
 rules:=rules||jsonb_build_object('key','active','met',st.student_status='Active','current',st.student_status,'required','Active');
 rules:=rules||jsonb_build_object('key','time_in_rank','met',days>=min_days,'current',days,'required',min_days,'since',since);
 rules:=rules||jsonb_build_object('key','classes','met',classes>=min_classes,'current',classes,'required',min_classes,'since',since);
 IF min_skill>0 THEN
  SELECT count(*),count(g.points),avg(g.points) INTO skills_total,skills_graded,skill_average
  FROM public.belt_techniques t
  LEFT JOIN LATERAL (SELECT CASE v.grade WHEN 'Needs Work' THEN 1 WHEN 'F' THEN 1 WHEN 'Developing' THEN 2 WHEN 'C' THEN 2 WHEN 'Proficient' THEN 3 WHEN 'B' THEN 3 WHEN 'Outstanding' THEN 4 WHEN 'A' THEN 4 END AS points
   FROM public.student_physical_evaluations v WHERE v.student_id=st.id AND v.skill_name=t.technique_name LIMIT 1) g ON true
  WHERE public.portal_belt_key(t.belt_level)=public.portal_belt_key(st.current_belt);
  rules:=rules||jsonb_build_object('key','skill_average','met',skills_total=0 OR (skills_graded=skills_total AND round(COALESCE(skill_average,0),2)>=min_skill),
   'current',round(COALESCE(skill_average,0),2),'required',min_skill,'graded',skills_graded,'total',skills_total);
 END IF;
 IF COALESCE((e->>'requireLessons')::boolean,false) THEN
  SELECT count(DISTINCT i.library_asset_id),
   count(DISTINCT i.library_asset_id) FILTER (WHERE EXISTS(SELECT 1 FROM public.library_assets la JOIN public.lms_progress p ON p.curriculum_id=COALESCE(la.student_curriculum_id,la.id) AND p.student_id=st.id AND p.status='Completed' WHERE la.id=i.library_asset_id))
  INTO lessons_total,lessons_done
  FROM public.belt_test_items i JOIN public.belt_test_sections x ON x.id=i.section_id WHERE x.syllabus_id=s.id AND i.library_asset_id IS NOT NULL;
  rules:=rules||jsonb_build_object('key','lessons','met',lessons_done>=lessons_total,'current',lessons_done,'required',lessons_total);
 END IF;
 SELECT bool_and((r->>'met')::boolean) INTO all_met FROM jsonb_array_elements(rules) r;
 RETURN jsonb_build_object('status',CASE WHEN all_met THEN 'eligible' ELSE 'not_yet' END,'syllabusId',s.id,'targetBelt',target.belt_name,'track',s.track,'evaluatedOn',today,'since',since,'rules',rules);
END $$;

-- Every active student at the previous belt, for the admin eligibility checker.
CREATE OR REPLACE FUNCTION public.portal_belt_test_eligibility_list(p_syllabus uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('studentId',st.id,'englishName',st.english_name,'khmerName',st.khmer_name,'currentBelt',st.current_belt,
   'homeBranchId',st.home_branch_id,'eligibility',public.portal_belt_test_eligibility(st.id,s.id)) ORDER BY st.english_name),'[]'::jsonb)
 FROM public.belt_test_syllabi s
 JOIN public.belts target ON target.id=s.target_belt_id
 JOIN public.belts previous ON previous.belt_order=target.belt_order-1
 JOIN public.students st ON public.portal_belt_key(st.current_belt)=public.portal_belt_key(previous.belt_name) AND st.deleted_at IS NULL AND st.student_status='Active'
 WHERE s.id=p_syllabus
$$;

-- ---------------------------------------------------------------------------
-- Mutations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.portal_belt_tests_mutate(p_actor uuid,p_action text,p_data jsonb,p_request_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.profiles; previous public.portal_operation_requests; result jsonb; student text;
 syl public.belt_test_syllabi; exam public.grading_events; cand public.grading_candidates; target public.belts; prior public.belts;
 sec jsonb; item jsonb; section_id uuid; saved_id uuid; computed jsonb; eligibility jsonb; total numeric; n int; pos int; ipos int;
 today date:=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date; manages boolean; existing public.grading_item_scores; history_id int;
 manage_actions text[]:=ARRAY['syllabus_save','syllabus_publish','syllabus_retire','syllabus_discard','event_create','event_update','event_publish','event_cancel',
  'register','withdraw','finalize','start_retest','publish_results','promote','kukkiwon_update','kukkiwon_submit','kukkiwon_result','kukkiwon_certificate'];
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
  IF lower(target.belt_type)='black' THEN
   IF p_data->>'passMark' IS NOT NULL THEN RAISE EXCEPTION 'Kukkiwon tests are not scored by the academy' USING ERRCODE='22023'; END IF;
  ELSE
   SELECT COALESCE(sum((value->>'weight')::numeric),0) INTO total FROM jsonb_array_elements(p_data->'sections');
   IF total<>100 THEN RAISE EXCEPTION 'Section weights must add up to 100 (now %)',total USING ERRCODE='22023'; END IF;
  END IF;
  IF p_data->>'id' IS NULL THEN
   INSERT INTO public.belt_test_syllabi(target_belt_id,track,version,title,pass_mark,distinction_mark,section_minimum,critical_minimum,retest_days,eligibility,notes,created_by)
   VALUES(target.id,CASE WHEN lower(target.belt_type)='black' THEN 'kukkiwon' ELSE 'color' END,
    COALESCE((SELECT max(version) FROM public.belt_test_syllabi WHERE target_belt_id=target.id),0)+1,
    btrim(p_data->>'title'),(p_data->>'passMark')::numeric,(p_data->>'distinctionMark')::numeric,(p_data->>'sectionMinimum')::numeric,
    (p_data->>'criticalMinimum')::numeric,(p_data->>'retestDays')::int,p_data->'eligibility',COALESCE(p_data->>'notes',''),p_actor) RETURNING * INTO syl;
  ELSE
   SELECT * INTO syl FROM public.belt_test_syllabi WHERE id=(p_data->>'id')::uuid FOR UPDATE;
   IF NOT FOUND OR syl.status<>'draft' THEN RAISE EXCEPTION 'Only a draft syllabus can be edited; save a new version' USING ERRCODE='22023'; END IF;
   IF syl.revision<>(p_data->>'revision')::int THEN RAISE EXCEPTION 'This syllabus changed. Reload before saving' USING ERRCODE='40001'; END IF;
   IF syl.target_belt_id<>target.id THEN RAISE EXCEPTION 'A syllabus cannot move to another belt' USING ERRCODE='22023'; END IF;
   UPDATE public.belt_test_syllabi SET title=btrim(p_data->>'title'),pass_mark=(p_data->>'passMark')::numeric,distinction_mark=(p_data->>'distinctionMark')::numeric,
    section_minimum=(p_data->>'sectionMinimum')::numeric,critical_minimum=(p_data->>'criticalMinimum')::numeric,retest_days=(p_data->>'retestDays')::int,
    eligibility=p_data->'eligibility',notes=COALESCE(p_data->>'notes',''),revision=revision+1,updated_at=now() WHERE id=syl.id RETURNING * INTO syl;
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
  INSERT INTO public.grading_events(title,exam_date,target_belt_id,passing_score,minimum_attendance,attendance_from,created_by,branch_id,start_time,location,kind,syllabus_id)
  VALUES(btrim(p_data->>'title'),(p_data->>'examDate')::date,syl.target_belt_id,COALESCE(round(syl.pass_mark)::int,0),0,(p_data->>'examDate')::date,p_actor,
   NULLIF(p_data->>'branchId','')::int,NULLIF(p_data->>'startTime','')::time,NULLIF(btrim(p_data->>'location'),''),syl.track,syl.id) RETURNING * INTO exam;
  result:=jsonb_build_object('id',exam.id);
 WHEN 'event_update' THEN
  SELECT * INTO exam FROM public.grading_events WHERE id=(p_data->>'id')::uuid AND syllabus_id IS NOT NULL FOR UPDATE;
  IF NOT FOUND OR exam.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'Test day unavailable or cancelled' USING ERRCODE='22023'; END IF;
  IF (p_data->>'examDate')::date IS DISTINCT FROM exam.exam_date AND EXISTS(SELECT 1 FROM public.grading_candidates WHERE event_id=exam.id AND (status IN ('scoring','finalized','promoted') OR EXISTS(SELECT 1 FROM public.grading_item_scores g WHERE g.candidate_id=grading_candidates.id))) THEN
   RAISE EXCEPTION 'Scores already use this test date' USING ERRCODE='22023';
  END IF;
  UPDATE public.grading_events SET title=btrim(p_data->>'title'),exam_date=(p_data->>'examDate')::date,attendance_from=LEAST(attendance_from,(p_data->>'examDate')::date),
   start_time=NULLIF(p_data->>'startTime','')::time,location=NULLIF(btrim(p_data->>'location'),''),branch_id=NULLIF(p_data->>'branchId','')::int WHERE id=exam.id;
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
  student:=p_data->>'studentId';
  SELECT * INTO exam FROM public.grading_events WHERE id=(p_data->>'eventId')::uuid AND syllabus_id IS NOT NULL FOR UPDATE;
  IF NOT FOUND OR exam.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'Test day unavailable or cancelled' USING ERRCODE='22023'; END IF;
  IF exam.results_published_at IS NOT NULL THEN RAISE EXCEPTION 'Results for this test day are already published' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM public.students WHERE id=student AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student unavailable' USING ERRCODE='P0002'; END IF;
  eligibility:=public.portal_belt_test_eligibility(student,exam.syllabus_id);
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(eligibility->'rules') r WHERE r->>'key'='current_belt' AND (r->>'met')::boolean) THEN
   RAISE EXCEPTION 'This test day is for the next rank after %; the student holds %',(SELECT r->>'required' FROM jsonb_array_elements(eligibility->'rules') r WHERE r->>'key'='current_belt'),(SELECT r->>'current' FROM jsonb_array_elements(eligibility->'rules') r WHERE r->>'key'='current_belt') USING ERRCODE='22023';
  END IF;
  IF eligibility->>'status'<>'eligible' AND length(btrim(COALESCE(p_data->>'overrideReason','')))<5 THEN RAISE EXCEPTION 'The student is not yet eligible. Record an override reason to register anyway' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.grading_candidates WHERE event_id=exam.id AND student_id=student) THEN RAISE EXCEPTION 'The student is already on this test day' USING ERRCODE='23505'; END IF;
  INSERT INTO public.grading_candidates(event_id,student_id,status,registered_by,registered_at,eligibility_snapshot,registration_override_reason,result,
   poom_or_dan,legal_name_en,legal_name_kh,dob,gender,previous_certificate_no)
  SELECT exam.id,st.id,CASE WHEN exam.kind='kukkiwon' THEN 'nominated' ELSE 'registered' END,p_actor,now(),eligibility,
   CASE WHEN eligibility->>'status'<>'eligible' THEN btrim(p_data->>'overrideReason') END,CASE WHEN exam.kind='color' THEN 'pending' END,
   CASE WHEN exam.kind='kukkiwon' THEN CASE WHEN extract(year FROM age(exam.exam_date,st.dob))<15 THEN 'Poom' ELSE 'Dan' END END,
   CASE WHEN exam.kind='kukkiwon' THEN st.english_name END,CASE WHEN exam.kind='kukkiwon' THEN st.khmer_name END,
   CASE WHEN exam.kind='kukkiwon' THEN st.dob END,CASE WHEN exam.kind='kukkiwon' THEN st.gender END,
   CASE WHEN exam.kind='kukkiwon' THEN NULLIF(btrim(st.kukkiwon_id),'') END
  FROM public.students st WHERE st.id=student RETURNING * INTO cand;
  result:=jsonb_build_object('id',cand.id,'status',cand.status,'eligibility',eligibility->>'status');
 WHEN 'withdraw' THEN
  SELECT * INTO cand FROM public.grading_candidates WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR cand.status IN ('promoted','withdrawn','certified') THEN RAISE EXCEPTION 'This candidate cannot be withdrawn' USING ERRCODE='22023'; END IF;
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
  SELECT * INTO existing FROM public.grading_item_scores WHERE candidate_id=cand.id AND item_id=(p_data->>'itemId')::uuid FOR UPDATE;
  IF COALESCE(existing.revision,0)<>(p_data->>'revision')::int THEN RAISE EXCEPTION 'This score changed. Reload before saving' USING ERRCODE='40001'; END IF;
  INSERT INTO public.grading_item_scores(candidate_id,item_id,score,note,scored_by)
  VALUES(cand.id,(p_data->>'itemId')::uuid,(p_data->>'score')::numeric,COALESCE(p_data->>'note',''),p_actor)
  ON CONFLICT(candidate_id,item_id) DO UPDATE SET score=EXCLUDED.score,note=EXCLUDED.note,scored_by=EXCLUDED.scored_by,revision=public.grading_item_scores.revision+1,updated_at=now()
  RETURNING id INTO saved_id;
  UPDATE public.grading_candidates SET status='scoring',updated_at=now() WHERE id=cand.id AND status='registered';
  computed:=public.portal_belt_test_compute(cand.id);
  result:=jsonb_build_object('id',saved_id,'revision',(SELECT revision FROM public.grading_item_scores WHERE id=saved_id),'preview',computed);
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
 IF student IS NOT NULL AND p_action IN ('register','withdraw','promote','kukkiwon_result','kukkiwon_certificate') THEN
  INSERT INTO public.student_activity_events(student_id,category,title,record_id,recorded_by)
  VALUES(student,'grading',CASE p_action WHEN 'register' THEN 'Registered for a belt test' WHEN 'withdraw' THEN 'Withdrawn from a belt test'
   WHEN 'promote' THEN 'Promoted to '||(result->>'belt') WHEN 'kukkiwon_result' THEN 'Kukkiwon test result recorded' ELSE 'Kukkiwon certificate recorded' END,
   COALESCE(result->>'id',p_data->>'id'),p_actor);
 END IF;
 INSERT INTO public.portal_operation_requests(request_key,actor,action,payload,result) VALUES(p_request_key,p_actor,'belt:'||p_action,p_data,result);
 RETURN result;
END $$;

-- ---------------------------------------------------------------------------
-- Student portal contract: belt-tests-v1 (whitelisted fields only)
-- ---------------------------------------------------------------------------
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
     'registration',CASE WHEN c.id IS NULL THEN NULL ELSE c.status END) ORDER BY e.exam_date,e.start_time),'[]'::jsonb)
   FROM public.grading_events e JOIN public.belts t ON t.id=e.target_belt_id LEFT JOIN public.branches b ON b.id=e.branch_id
   LEFT JOIN public.grading_candidates c ON c.event_id=e.id AND c.student_id=st.id AND c.status<>'withdrawn'
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
   WHERE c.student_id=st.id AND e.kind='kukkiwon' AND c.status<>'withdrawn' AND e.cancelled_at IS NULL)
 );
END $$;

DO $$ DECLARE f text; BEGIN
 FOREACH f IN ARRAY ARRAY['portal_guard_belt_test_syllabus()','portal_guard_belt_test_writes()','portal_belt_test_compute(uuid)','portal_belt_test_eligibility(text,uuid)',
  'portal_belt_test_eligibility_list(uuid)','portal_belt_tests_mutate(uuid,text,jsonb,uuid)','portal_student_belt_tests(text)'] LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC,anon,authenticated',f);
 END LOOP;
 FOREACH f IN ARRAY ARRAY['portal_belt_test_compute(uuid)','portal_belt_test_eligibility(text,uuid)','portal_belt_test_eligibility_list(uuid)','portal_belt_tests_mutate(uuid,text,jsonb,uuid)','portal_student_belt_tests(text)'] LOOP
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role',f);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
