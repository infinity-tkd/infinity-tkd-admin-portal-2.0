-- LMS learning records (docs/STUDENT_PORTAL_LMS_DESIGN_2026-11-12.md, phases 1-3):
-- notice groundwork for reminders, the poomsae form registry, the quiz bank,
-- form progress, quiz attempts, self-assessments, technique-step checklists,
-- student goals and coach weekly plans, practice targets on belt syllabus items,
-- and the coach attention view.
-- Additive: existing tables keep their meaning. portal_belt_tests_mutate and
-- portal_student_belt_tests are replaced from their deployed versions
-- (20261110062131, verified identical by md5) with the changes marked inline.
-- Every new table has row level security with no client policy: staff write
-- through portal_* functions (permission checked in SQL), students through the
-- student_portal_* functions called by the student portal's server.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

-- ===========================================================================
-- 1. Notice groundwork: LMS categories, reminder settings, LMS notice rows
-- ===========================================================================
-- Student-facing categories: 'events' (academy events) plus the LMS ones.
CREATE OR REPLACE FUNCTION public.lms_student_notice_categories() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT ARRAY['events','class_reminder','exam_reminder','assignment_due','practice_reminder','streak_reminder','new_material','feedback','missed_class','achievement','announcement']::text[] $$;

ALTER TABLE public.portal_notifications DROP CONSTRAINT portal_notifications_category_check;
ALTER TABLE public.portal_notifications ADD CONSTRAINT portal_notifications_category_check CHECK (category = ANY (ARRAY['attendance','billing','orders','system','events',
 'class_reminder','exam_reminder','assignment_due','practice_reminder','streak_reminder','new_material','feedback','missed_class','achievement','announcement']::text[]));
ALTER TABLE public.portal_notifications
 ADD COLUMN topic text CHECK (topic IS NULL OR topic ~ '^[a-z][a-z0-9_]{0,63}$'),
 ADD COLUMN subject_ref text CHECK (subject_ref IS NULL OR length(subject_ref) BETWEEN 1 AND 120);
-- An LMS notice belongs to one student and never points at an academy event.
ALTER TABLE public.portal_notifications ADD CONSTRAINT portal_lms_notice_complete CHECK (source_type IS DISTINCT FROM 'lms' OR (
 source_id IS NULL AND source_revision IS NULL AND subject_student_id IS NOT NULL AND permission_key IS NULL
 AND category = ANY (ARRAY['class_reminder','exam_reminder','assignment_due','practice_reminder','streak_reminder','new_material','feedback','missed_class','achievement','announcement']::text[])));
CREATE INDEX portal_notifications_lms_student_idx ON public.portal_notifications(user_id,subject_student_id,created_at DESC) WHERE source_type='lms';

ALTER TABLE public.portal_notification_preferences DROP CONSTRAINT portal_notification_preferences_muted_categories_check;
ALTER TABLE public.portal_notification_preferences ADD CONSTRAINT portal_notification_preferences_muted_categories_check CHECK (muted_categories <@ ARRAY['attendance','billing','orders','system','events',
 'class_reminder','exam_reminder','assignment_due','practice_reminder','streak_reminder','new_material','feedback','missed_class','achievement','announcement']::text[]);
ALTER TABLE public.portal_notification_preferences
 ADD COLUMN practice_reminder_time time,
 ADD COLUMN practice_days smallint[] CHECK (practice_days IS NULL OR (practice_days <@ ARRAY[1,2,3,4,5,6,7]::smallint[] AND cardinality(practice_days) BETWEEN 1 AND 7)),
 ADD COLUMN class_reminder_hours smallint NOT NULL DEFAULT 2 CHECK (class_reminder_hours BETWEEN 0 AND 24);

-- Student phone alerts for LMS notices stay off until the student portal's
-- service worker accepts sourceType 'lms' (see docs/STUDENT_PORTAL_LMS_HANDOFF.md).
ALTER TABLE public.academy_profile ADD COLUMN student_lms_push_enabled boolean NOT NULL DEFAULT false;

-- ===========================================================================
-- 2. Shared helpers
-- ===========================================================================
-- The library's belt rule (studentLessonEligible in lib/student-catalog-contract.ts):
-- 'All', 'All Belts', 'All Levels' and 'Beginner' in any case or spacing are open
-- to everyone; otherwise the target belt must be at or below the student's belt.
CREATE OR REPLACE FUNCTION public.lms_belt_allows(p_target text,p_current text) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE current_order integer; target_order integer;
BEGIN
 IF p_target IS NULL OR regexp_replace(lower(p_target),'[^a-z0-9]','','g') IN ('all','allbelts','alllevels','beginner') THEN RETURN true; END IF;
 IF EXISTS(SELECT 1 FROM public.belts) THEN
  SELECT belt_order INTO current_order FROM public.belts WHERE regexp_replace(replace(lower(belt_name),'belt',''),'[^a-z0-9]','','g')=regexp_replace(replace(lower(COALESCE(p_current,'')),'belt',''),'[^a-z0-9]','','g') ORDER BY belt_order LIMIT 1;
  SELECT belt_order INTO target_order FROM public.belts WHERE regexp_replace(replace(lower(belt_name),'belt',''),'[^a-z0-9]','','g')=regexp_replace(replace(lower(p_target),'belt',''),'[^a-z0-9]','','g') ORDER BY belt_order LIMIT 1;
 ELSE
  current_order:=public.student_portal_belt_order(p_current); target_order:=public.student_portal_belt_order(p_target);
 END IF;
 RETURN current_order IS NOT NULL AND target_order IS NOT NULL AND target_order<=current_order;
END $$;

-- The belt row matching a free-text belt name (same normalisation as above).
CREATE OR REPLACE FUNCTION public.lms_belt_named(p_name text) RETURNS public.belts
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT b.* FROM public.belts b WHERE regexp_replace(replace(lower(b.belt_name),'belt',''),'[^a-z0-9]','','g')=regexp_replace(replace(lower(COALESCE(p_name,'')),'belt',''),'[^a-z0-9]','','g') ORDER BY b.belt_order LIMIT 1 $$;

-- A student staff may act on (not deleted).
CREATE OR REPLACE FUNCTION public.lms_staff_student(p_student text) RETURNS public.students
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE st public.students;
BEGIN
 SELECT * INTO st FROM public.students WHERE id=p_student AND deleted_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student not found' USING ERRCODE='P0002'; END IF;
 RETURN st;
END $$;

-- Writes one LMS notice to every portal account linked one-to-one with the
-- student (the same identity rule as academy event notices). p_copy holds
-- {"en":{"title","body"},"kh":{...},"zh":{...}}; each account gets its
-- language, falling back to English. A repeated p_key is never sent twice.
CREATE OR REPLACE FUNCTION public.lms_notify(p_student text,p_category text,p_key text,p_copy jsonb,p_href text,p_ref text DEFAULT NULL,p_topic text DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE total integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.academy_profile WHERE id='default' AND allow_student_portal_login) THEN RETURN 0; END IF;
 INSERT INTO public.portal_notifications(user_id,source_key,category,title,body,href,permission_key,source_type,subject_student_id,topic,subject_ref,delivered_at)
 SELECT p.id,left(p_key,240),p_category,
  left(COALESCE(NULLIF(p_copy#>>ARRAY[lang.code,'title'],''),p_copy#>>'{en,title}'),240),
  left(COALESCE(NULLIF(p_copy#>>ARRAY[lang.code,'body'],''),p_copy#>>'{en,body}',''),2000),
  p_href,NULL,'lms',s.id,COALESCE(p_topic,p_category),p_ref,now()
 FROM public.profiles p JOIN public.students s ON (p.student_id=s.id OR s.profile_id=p.id)
 CROSS JOIN LATERAL (SELECT COALESCE((SELECT CASE WHEN pr.language IN ('kh','zh') THEN pr.language END FROM public.student_portal_preferences pr WHERE pr.user_id=p.id),'en') AS code) lang
 WHERE s.id=p_student AND p.role='Student' AND p.is_active AND NOT p.must_change_password AND s.deleted_at IS NULL
 AND (p.student_id IS NULL OR p.student_id=s.id) AND (s.profile_id IS NULL OR s.profile_id=p.id)
 AND NOT EXISTS(SELECT 1 FROM public.profiles x WHERE x.id<>p.id AND x.student_id=s.id)
 AND NOT EXISTS(SELECT 1 FROM public.students x WHERE x.id<>s.id AND x.profile_id=p.id)
 ON CONFLICT(user_id,source_key) DO NOTHING;
 GET DIAGNOSTICS total=ROW_COUNT;
 RETURN total;
END $$;

-- Generic notice copy in English, Khmer and Chinese. Lock screens never show it
-- (student pushes carry references only); the inbox shows it as written.
CREATE OR REPLACE FUNCTION public.lms_notice_copy(p_category text,p_vars jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE t text:=left(COALESCE(p_vars->>'title',''),160); n text:=COALESCE(p_vars->>'n',''); w text:=COALESCE(p_vars->>'when','');
BEGIN
 RETURN CASE p_category
  WHEN 'class_reminder' THEN jsonb_build_object(
   'en',jsonb_build_object('title','Class soon: '||t,'body','Your class starts at '||w||'. See you on the mat.'),
   'kh',jsonb_build_object('title','ថ្នាក់ជិតចាប់ផ្តើម៖ '||t,'body','ថ្នាក់របស់អ្នកចាប់ផ្តើមនៅម៉ោង '||w||'។'),
   'zh',jsonb_build_object('title','即将上课：'||t,'body','你的课程将于 '||w||' 开始。'))
  WHEN 'exam_reminder' THEN CASE WHEN n='1' THEN jsonb_build_object(
   'en',jsonb_build_object('title','Belt test tomorrow','body','Your belt test is on '||w||'. Rest well and review your forms.'),
   'kh',jsonb_build_object('title','ការប្រឡងខ្សែក្រវាត់នៅថ្ងៃស្អែក','body','ការប្រឡងរបស់អ្នកនៅថ្ងៃ '||w||'។ សម្រាកឱ្យបានល្អ ហើយរំលឹកពុំសេរបស់អ្នក។'),
   'zh',jsonb_build_object('title','明天晋级考核','body','你的晋级考核在 '||w||'。好好休息，复习套路。'))
  ELSE jsonb_build_object(
   'en',jsonb_build_object('title','Belt test in '||n||' days','body','Your belt test is on '||w||'. Check your next-belt checklist.'),
   'kh',jsonb_build_object('title','ការប្រឡងខ្សែក្រវាត់ក្នុងរយៈពេល '||n||' ថ្ងៃទៀត','body','ការប្រឡងរបស់អ្នកនៅថ្ងៃ '||w||'។ ពិនិត្យបញ្ជីតម្រូវការខ្សែក្រវាត់បន្ទាប់។'),
   'zh',jsonb_build_object('title',n||' 天后晋级考核','body','你的晋级考核在 '||w||'。请查看下一条腰带的要求。')) END
  WHEN 'assignment_due' THEN jsonb_build_object(
   'en',jsonb_build_object('title','Due soon: '||t,'body','This task is due '||w||'.'),
   'kh',jsonb_build_object('title','ជិតដល់ពេលកំណត់៖ '||t,'body','កិច្ចការនេះត្រូវបញ្ចប់ '||w||'។'),
   'zh',jsonb_build_object('title','即将截止：'||t,'body','此任务截止时间：'||w||'。'))
  WHEN 'practice_reminder' THEN jsonb_build_object(
   'en',jsonb_build_object('title','Time to practise','body','A few minutes today keeps you moving toward your next belt.'),
   'kh',jsonb_build_object('title','ដល់ពេលហាត់ហើយ','body','ហាត់ពីរបីនាទីថ្ងៃនេះ ដើម្បីឈានទៅខ្សែក្រវាត់បន្ទាប់។'),
   'zh',jsonb_build_object('title','该练习了','body','今天练习几分钟，向下一条腰带迈进。'))
  WHEN 'streak_reminder' THEN jsonb_build_object(
   'en',jsonb_build_object('title','Keep your '||n||'-day streak going','body','Log a short practice today to keep it alive.'),
   'kh',jsonb_build_object('title','រក្សាការហាត់ជាប់គ្នា '||n||' ថ្ងៃរបស់អ្នក','body','ហាត់បន្តិចថ្ងៃនេះ ដើម្បីរក្សាវា។'),
   'zh',jsonb_build_object('title','保持 '||n||' 天连续练习','body','今天记录一次简短练习，保持连续。'))
  WHEN 'new_material' THEN jsonb_build_object(
   'en',jsonb_build_object('title','New lessons for you','body',n||' new lessons or forms are ready for your belt.'),
   'kh',jsonb_build_object('title','មេរៀនថ្មីសម្រាប់អ្នក','body','មានមេរៀន ឬពុំសេថ្មីចំនួន '||n||' សម្រាប់ខ្សែក្រវាត់របស់អ្នក។'),
   'zh',jsonb_build_object('title','你有新课程','body','有 '||n||' 个新课程或套路适合你的腰带。'))
  WHEN 'feedback' THEN jsonb_build_object(
   'en',jsonb_build_object('title','Your coach left feedback','body','Open your feedback to see what to practise next.'),
   'kh',jsonb_build_object('title','គ្រូបង្វឹកបានផ្តល់មតិយោបល់','body','បើកមើលមតិយោបល់ ដើម្បីដឹងថាត្រូវហាត់អ្វីបន្ទាប់។'),
   'zh',jsonb_build_object('title','教练给了你反馈','body','打开反馈，看看接下来练习什么。'))
  WHEN 'missed_class' THEN jsonb_build_object(
   'en',jsonb_build_object('title','We missed you in class','body','Catch up at home with the lesson from '||w||'.'),
   'kh',jsonb_build_object('title','យើងនឹកអ្នកនៅក្នុងថ្នាក់','body','ហាត់តាមមេរៀនថ្ងៃ '||w||' នៅផ្ទះ។'),
   'zh',jsonb_build_object('title','课堂上没见到你','body','在家补习 '||w||' 的课程内容。'))
  WHEN 'achievement' THEN jsonb_build_object(
   'en',jsonb_build_object('title','New achievement: '||t,'body','Well done! Open your achievements to see it.'),
   'kh',jsonb_build_object('title','សមិទ្ធផលថ្មី៖ '||COALESCE(NULLIF(p_vars->>'titleKh',''),t),'body','ល្អណាស់! បើកមើលសមិទ្ធផលរបស់អ្នក។'),
   'zh',jsonb_build_object('title','新成就：'||COALESCE(NULLIF(p_vars->>'titleZh',''),t),'body','做得好！打开成就查看。'))
  ELSE jsonb_build_object('en',jsonb_build_object('title',COALESCE(NULLIF(t,''),'Academy update'),'body',''))
 END;
END $$;

-- ===========================================================================
-- 3. Poomsae form registry and quiz bank (staff content)
-- ===========================================================================
CREATE TABLE public.poomsae_forms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 curriculum_id integer NOT NULL UNIQUE REFERENCES public.curriculum(id),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
 korean_name text CHECK (korean_name IS NULL OR length(korean_name)<=120),
 series text NOT NULL CHECK (length(btrim(series)) BETWEEN 1 AND 60),
 belt_id integer REFERENCES public.belts(id),
 movement_count integer NOT NULL CHECK (movement_count BETWEEN 1 AND 200),
 sort_order integer NOT NULL DEFAULT 100 CHECK (sort_order BETWEEN 1 AND 100000),
 published boolean NOT NULL DEFAULT false,
 translations jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(translations)='object' AND octet_length(translations::text)<=8000),
 revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 created_by uuid REFERENCES public.profiles(id),
 updated_by uuid REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX poomsae_forms_belt_idx ON public.poomsae_forms(belt_id);
CREATE INDEX poomsae_forms_created_by_ops_idx ON public.poomsae_forms(created_by);
CREATE INDEX poomsae_forms_updated_by_ops_idx ON public.poomsae_forms(updated_by);

CREATE TABLE public.quiz_questions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 scope text NOT NULL CHECK (scope IN ('form','lesson','belt','terminology')),
 scope_ref text NOT NULL CHECK (length(scope_ref) BETWEEN 1 AND 80),
 kind text NOT NULL CHECK (kind IN ('next_movement','direction','stance','term','choice')),
 prompt text NOT NULL CHECK (length(btrim(prompt)) BETWEEN 1 AND 500),
 choices jsonb NOT NULL CHECK (jsonb_typeof(choices)='array' AND jsonb_array_length(choices) BETWEEN 2 AND 8),
 answer jsonb NOT NULL CHECK (jsonb_typeof(answer) IN ('number','array')),
 explanation text CHECK (explanation IS NULL OR length(explanation)<=1000),
 translations jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(translations)='object' AND octet_length(translations::text)<=20000),
 sort_order integer NOT NULL DEFAULT 100 CHECK (sort_order BETWEEN 1 AND 100000),
 published boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 created_by uuid REFERENCES public.profiles(id),
 updated_by uuid REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quiz_questions_scope_idx ON public.quiz_questions(scope,scope_ref,sort_order);
CREATE INDEX quiz_questions_created_by_ops_idx ON public.quiz_questions(created_by);
CREATE INDEX quiz_questions_updated_by_ops_idx ON public.quiz_questions(updated_by);

-- ===========================================================================
-- 4. Student learning records (written only by the functions below)
-- ===========================================================================
CREATE TABLE public.student_form_progress (
 student_id varchar NOT NULL REFERENCES public.students(id),
 form_id uuid NOT NULL REFERENCES public.poomsae_forms(id),
 status text NOT NULL DEFAULT 'learning' CHECK (status IN ('learning','practising','ready_for_review','mastered')),
 practice_count integer NOT NULL DEFAULT 0 CHECK (practice_count BETWEEN 0 AND 1000000),
 practice_seconds integer NOT NULL DEFAULT 0 CHECK (practice_seconds BETWEEN 0 AND 100000000),
 best_quiz_percent smallint CHECK (best_quiz_percent BETWEEN 0 AND 100),
 last_practised_at timestamptz,
 review_requested_at timestamptz,
 reviewed_by uuid REFERENCES public.profiles(id),
 reviewed_at timestamptz,
 review_note text CHECK (review_note IS NULL OR length(review_note)<=1000),
 mastered_by uuid REFERENCES public.profiles(id),  -- only a coach sets mastered
 mastered_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (student_id,form_id),
 CONSTRAINT student_form_progress_mastered CHECK ((status='mastered')=(mastered_by IS NOT NULL AND mastered_at IS NOT NULL))
);
CREATE INDEX student_form_progress_form_idx ON public.student_form_progress(form_id,status);
CREATE INDEX student_form_progress_reviewed_by_ops_idx ON public.student_form_progress(reviewed_by);
CREATE INDEX student_form_progress_mastered_by_ops_idx ON public.student_form_progress(mastered_by);

CREATE TABLE public.student_quiz_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 student_id varchar NOT NULL REFERENCES public.students(id),
 scope text NOT NULL CHECK (scope IN ('form','lesson','belt','terminology')),
 scope_ref text NOT NULL CHECK (length(scope_ref) BETWEEN 1 AND 80),
 score smallint NOT NULL,
 total smallint NOT NULL,
 missed uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(missed)<=200),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT student_quiz_attempts_score CHECK (total BETWEEN 1 AND 200 AND score BETWEEN 0 AND total)
);
CREATE INDEX student_quiz_attempts_student_idx ON public.student_quiz_attempts(student_id,scope,scope_ref,created_at DESC);

CREATE TABLE public.student_self_assessments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 student_id varchar NOT NULL REFERENCES public.students(id),
 subject_type text NOT NULL CHECK (subject_type IN ('lesson','step','form','movement')),
 subject_ref text NOT NULL CHECK (length(subject_ref) BETWEEN 1 AND 120),  -- '12', '12:chamber', a form id, '<form id>:7'
 rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 4),  -- the 4 coach-grade levels; 1 = still learning
 note text CHECK (note IS NULL OR length(note)<=500),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX student_self_assessments_student_idx ON public.student_self_assessments(student_id,subject_type,subject_ref,created_at DESC);
CREATE INDEX student_self_assessments_recent_idx ON public.student_self_assessments(created_at) WHERE rating=1;

CREATE TABLE public.student_step_checks (
 student_id varchar NOT NULL REFERENCES public.students(id),
 curriculum_id integer NOT NULL REFERENCES public.curriculum(id),
 step_id text NOT NULL CHECK (step_id ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
 checked smallint[] NOT NULL DEFAULT '{}' CHECK (cardinality(checked)<=50 AND 0<=ALL(checked) AND 49>=ALL(checked)),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (student_id,curriculum_id,step_id)
);
CREATE INDEX student_step_checks_curriculum_ops_idx ON public.student_step_checks(curriculum_id);

CREATE TABLE public.student_goals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 student_id varchar NOT NULL REFERENCES public.students(id),
 kind text NOT NULL CHECK (kind IN ('weekly_days','weekly_minutes','lesson','form','belt_exam','custom')),
 target integer CHECK (target IS NULL OR target BETWEEN 1 AND 100000),  -- days, minutes or reps
 subject_ref text CHECK (subject_ref IS NULL OR length(subject_ref) BETWEEN 1 AND 80),  -- lesson id or form id
 title text CHECK (title IS NULL OR length(btrim(title)) BETWEEN 1 AND 200),  -- custom goals, in the student's words
 set_by text NOT NULL CHECK (set_by IN ('student','coach')),
 coach_id uuid REFERENCES public.profiles(id),
 starts_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Phnom_Penh')::date),
 ends_on date,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','done','dropped')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT student_goals_shape CHECK (
  (kind<>'weekly_days' OR target BETWEEN 1 AND 7) AND (kind<>'weekly_minutes' OR target BETWEEN 5 AND 5000)
  AND (kind NOT IN ('lesson','form') OR subject_ref IS NOT NULL) AND (kind<>'custom' OR title IS NOT NULL)
  AND (ends_on IS NULL OR ends_on>=starts_on) AND ((set_by='coach')=(coach_id IS NOT NULL)))
);
-- one active weekly goal of each kind per student
CREATE UNIQUE INDEX student_goals_weekly_key ON public.student_goals(student_id,kind) WHERE status='active' AND kind IN ('weekly_days','weekly_minutes');
CREATE INDEX student_goals_student_idx ON public.student_goals(student_id,status);
CREATE INDEX student_goals_coach_ops_idx ON public.student_goals(coach_id);

CREATE TABLE public.student_learning_plans (  -- a coach's plan for one student's week
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 student_id varchar NOT NULL REFERENCES public.students(id),
 week_start date NOT NULL CHECK (extract(isodow FROM week_start)=1),  -- Monday, Asia/Phnom_Penh
 items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items)='array' AND jsonb_array_length(items)<=30 AND octet_length(items::text)<=20000),
 note text CHECK (note IS NULL OR length(note)<=1000),
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 updated_by uuid REFERENCES public.profiles(id),
 published_at timestamptz,
 revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (student_id,week_start)
);
CREATE INDEX student_learning_plans_created_by_ops_idx ON public.student_learning_plans(created_by);
CREATE INDEX student_learning_plans_updated_by_ops_idx ON public.student_learning_plans(updated_by);

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['poomsae_forms','quiz_questions','student_form_progress','student_quiz_attempts','student_self_assessments','student_step_checks','student_goals','student_learning_plans'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;

-- ===========================================================================
-- 5. Belt syllabus: practice targets and form links on items
-- ===========================================================================
ALTER TABLE public.belt_test_items
 ADD COLUMN practice_target jsonb CHECK (practice_target IS NULL OR (jsonb_typeof(practice_target)='object' AND octet_length(practice_target::text)<=500)),  -- {"reps":50,"timesPerWeek":3}
 ADD COLUMN form_id uuid REFERENCES public.poomsae_forms(id);  -- when the item is a form
CREATE INDEX belt_test_items_form_ops_idx ON public.belt_test_items(form_id);

-- Replaced from 20261110062131 (md5 e70c9880c8aa4e947da67f135f3b8201): items also save practiceTarget and formId.
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
    -- LMS: practice target and form link on each item.
    INSERT INTO public.belt_test_items(section_id,title,library_asset_id,weight,critical,guide,position,practice_target,form_id)
    VALUES(section_id,btrim(item->>'title'),(item->>'libraryAssetId')::int,CASE WHEN syl.track='color' THEN COALESCE((item->>'weight')::numeric,1) ELSE 1 END,
     syl.track='color' AND COALESCE((item->>'critical')::boolean,false),COALESCE(item->>'guide',''),ipos,
     CASE WHEN jsonb_typeof(item->'practiceTarget')='object' THEN item->'practiceTarget' END,NULLIF(item->>'formId','')::uuid);
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

-- Replaced from 20261110062131 (md5 e922fddd1812a8120e63a015daa2839d): items also carry practiceTarget and formId.
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
     'items',(SELECT COALESCE(jsonb_agg(jsonb_build_object('title',i.title,'libraryAssetId',i.library_asset_id,
       -- LMS: optional practice target and published form (items are parsed without .strict()).
       'practiceTarget',i.practice_target,'formId',(SELECT pf.id FROM public.poomsae_forms pf WHERE pf.id=i.form_id AND pf.published)) ORDER BY i.position),'[]'::jsonb) FROM public.belt_test_items i WHERE i.section_id=x.id)) ORDER BY x.position),'[]'::jsonb)
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
-- 6. Staff: forms, quiz questions, coach plans and goals
--    (Coaches and above: action:curriculum_edit, checked here)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.portal_save_poomsae_form(p_actor uuid,p_action text,p_id uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.poomsae_forms; lesson public.curriculum; ref text; n integer:=0; belt integer; publish boolean;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 IF p_action IS NULL OR p_action NOT IN ('CREATE','UPDATE','DELETE','REORDER') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid form request' USING ERRCODE='22023'; END IF;
 IF p_action='REORDER' THEN
  IF jsonb_typeof(p_payload->'order') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'order') NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid form order' USING ERRCODE='22023'; END IF;
  FOR ref IN SELECT value FROM jsonb_array_elements_text(p_payload->'order') LOOP
   n:=n+1; UPDATE public.poomsae_forms SET sort_order=n*10,updated_by=p_actor,updated_at=now() WHERE id::text=ref;
  END LOOP;
  RETURN jsonb_build_object('reordered',n);
 END IF;
 IF p_action<>'CREATE' THEN
  SELECT * INTO f FROM public.poomsae_forms WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Form not found' USING ERRCODE='P0002'; END IF;
  IF f.revision IS DISTINCT FROM (p_payload->>'expectedRevision')::integer THEN RAISE EXCEPTION 'This form changed. Reload before saving' USING ERRCODE='40001'; END IF;
 END IF;
 IF p_action='DELETE' THEN
  IF EXISTS(SELECT 1 FROM public.student_form_progress WHERE form_id=f.id) THEN RAISE EXCEPTION 'Students already have progress on this form. Unpublish it instead' USING ERRCODE='23503'; END IF;
  IF EXISTS(SELECT 1 FROM public.belt_test_items WHERE form_id=f.id) THEN RAISE EXCEPTION 'A belt test syllabus links this form. Unpublish it instead' USING ERRCODE='23503'; END IF;
  DELETE FROM public.quiz_questions WHERE scope='form' AND scope_ref=f.id::text;
  DELETE FROM public.poomsae_forms WHERE id=f.id;
  INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_FORM_DELETE',p_actor::text,f.id::text,jsonb_build_object('name',f.name));
  RETURN jsonb_build_object('deleted',f.id);
 END IF;
 SELECT * INTO lesson FROM public.curriculum WHERE id=(p_payload->>'curriculumId')::integer;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose the form''s library lesson (publish it first)' USING ERRCODE='22023'; END IF;
 belt:=(p_payload->>'beltId')::integer;
 IF belt IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.belts WHERE id=belt) THEN RAISE EXCEPTION 'Choose a belt from the belt list' USING ERRCODE='22023'; END IF;
 publish:=COALESCE((p_payload->>'published')::boolean,false);
 IF publish AND NOT lesson.is_active THEN RAISE EXCEPTION 'Publish the form''s library lesson before publishing the form' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.poomsae_forms WHERE curriculum_id=lesson.id AND id IS DISTINCT FROM f.id) THEN RAISE EXCEPTION 'Another form already uses this lesson' USING ERRCODE='23505'; END IF;
 IF jsonb_typeof(COALESCE(p_payload->'translations','{}'::jsonb))<>'object' THEN RAISE EXCEPTION 'Invalid translations' USING ERRCODE='22023'; END IF;
 IF p_action='CREATE' THEN
  INSERT INTO public.poomsae_forms(curriculum_id,name,korean_name,series,belt_id,movement_count,sort_order,published,translations,created_by,updated_by)
  VALUES(lesson.id,btrim(p_payload->>'name'),NULLIF(btrim(COALESCE(p_payload->>'koreanName','')),''),btrim(p_payload->>'series'),belt,(p_payload->>'movementCount')::integer,
   LEAST(100000,COALESCE((SELECT max(sort_order) FROM public.poomsae_forms),0)+10),publish,COALESCE(p_payload->'translations','{}'::jsonb),p_actor,p_actor) RETURNING * INTO f;
 ELSE
  UPDATE public.poomsae_forms SET curriculum_id=lesson.id,name=btrim(p_payload->>'name'),korean_name=NULLIF(btrim(COALESCE(p_payload->>'koreanName','')),''),
   series=btrim(p_payload->>'series'),belt_id=belt,movement_count=(p_payload->>'movementCount')::integer,published=publish,
   translations=COALESCE(p_payload->'translations','{}'::jsonb),revision=revision+1,updated_by=p_actor,updated_at=now() WHERE id=f.id RETURNING * INTO f;
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_FORM_SAVE',p_actor::text,f.id::text,jsonb_build_object('name',f.name,'published',f.published,'revision',f.revision));
 RETURN to_jsonb(f);
END $$;

CREATE OR REPLACE FUNCTION public.portal_save_quiz_question(p_actor uuid,p_action text,p_id uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.quiz_questions; v_scope text; v_ref text; v_choices jsonb; v_answer jsonb; n integer;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 IF p_action IS NULL OR p_action NOT IN ('CREATE','UPDATE','DELETE') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid question request' USING ERRCODE='22023'; END IF;
 IF p_action<>'CREATE' THEN
  SELECT * INTO q FROM public.quiz_questions WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Question not found' USING ERRCODE='P0002'; END IF;
  IF q.revision IS DISTINCT FROM (p_payload->>'expectedRevision')::integer THEN RAISE EXCEPTION 'This question changed. Reload before saving' USING ERRCODE='40001'; END IF;
 END IF;
 IF p_action='DELETE' THEN
  DELETE FROM public.quiz_questions WHERE id=q.id;
  INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_QUIZ_DELETE',p_actor::text,q.id::text,jsonb_build_object('scope',q.scope,'scopeRef',q.scope_ref));
  RETURN jsonb_build_object('deleted',q.id);
 END IF;
 v_scope:=p_payload->>'scope'; v_ref:=btrim(COALESCE(p_payload->>'scopeRef',''));
 IF v_scope='form' AND NOT EXISTS(SELECT 1 FROM public.poomsae_forms WHERE id::text=v_ref) THEN RAISE EXCEPTION 'Choose a registered form' USING ERRCODE='22023';
 ELSIF v_scope='lesson' AND NOT (v_ref ~ '^[0-9]{1,9}$' AND EXISTS(SELECT 1 FROM public.curriculum WHERE id=v_ref::integer)) THEN RAISE EXCEPTION 'Choose a published lesson' USING ERRCODE='22023';
 ELSIF v_scope='belt' AND NOT EXISTS(SELECT 1 FROM public.belts WHERE belt_name=v_ref) THEN RAISE EXCEPTION 'Choose a belt from the belt list' USING ERRCODE='22023';
 ELSIF v_scope='terminology' AND v_ref !~ '^[A-Za-z0-9][A-Za-z0-9 _:-]{0,79}$' THEN RAISE EXCEPTION 'Name the terminology set with letters and numbers' USING ERRCODE='22023';
 ELSIF v_scope IS NULL OR v_scope NOT IN ('form','lesson','belt','terminology') THEN RAISE EXCEPTION 'Choose what the question is about' USING ERRCODE='22023';
 END IF;
 v_choices:=p_payload->'choices'; v_answer:=p_payload->'answer';
 IF jsonb_typeof(v_choices) IS DISTINCT FROM 'array' OR jsonb_array_length(v_choices) NOT BETWEEN 2 AND 8
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_choices) c WHERE jsonb_typeof(c)<>'string' OR length(btrim(c#>>'{}')) NOT BETWEEN 1 AND 200) THEN
  RAISE EXCEPTION 'Give 2 to 8 answer choices' USING ERRCODE='22023'; END IF;
 n:=jsonb_array_length(v_choices);
 IF jsonb_typeof(v_answer)='number' THEN
  IF (v_answer#>>'{}')::numeric<>floor((v_answer#>>'{}')::numeric) OR (v_answer#>>'{}')::numeric NOT BETWEEN 0 AND n-1 THEN RAISE EXCEPTION 'Mark the right answer' USING ERRCODE='22023'; END IF;
 ELSIF jsonb_typeof(v_answer)='array' THEN
  IF jsonb_array_length(v_answer)<>n OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_answer) a WHERE jsonb_typeof(a)<>'number' OR (a#>>'{}')::numeric<>floor((a#>>'{}')::numeric) OR (a#>>'{}')::numeric NOT BETWEEN 0 AND n-1)
   OR (SELECT count(DISTINCT a#>>'{}') FROM jsonb_array_elements(v_answer) a)<>n THEN RAISE EXCEPTION 'Give the right order using every choice once' USING ERRCODE='22023'; END IF;
 ELSE RAISE EXCEPTION 'Mark the right answer' USING ERRCODE='22023';
 END IF;
 IF jsonb_typeof(COALESCE(p_payload->'translations','{}'::jsonb))<>'object' THEN RAISE EXCEPTION 'Invalid translations' USING ERRCODE='22023'; END IF;
 IF p_action='CREATE' THEN
  INSERT INTO public.quiz_questions(scope,scope_ref,kind,prompt,choices,answer,explanation,translations,sort_order,published,created_by,updated_by)
  VALUES(v_scope,v_ref,p_payload->>'kind',btrim(p_payload->>'prompt'),v_choices,v_answer,NULLIF(btrim(COALESCE(p_payload->>'explanation','')),''),COALESCE(p_payload->'translations','{}'::jsonb),
   LEAST(100000,COALESCE((SELECT max(x.sort_order) FROM public.quiz_questions x WHERE x.scope=v_scope AND x.scope_ref=v_ref),0)+10),COALESCE((p_payload->>'published')::boolean,false),p_actor,p_actor) RETURNING * INTO q;
 ELSE
  UPDATE public.quiz_questions SET scope=v_scope,scope_ref=v_ref,kind=p_payload->>'kind',prompt=btrim(p_payload->>'prompt'),choices=v_choices,answer=v_answer,
   explanation=NULLIF(btrim(COALESCE(p_payload->>'explanation','')),''),translations=COALESCE(p_payload->'translations','{}'::jsonb),
   published=COALESCE((p_payload->>'published')::boolean,false),revision=revision+1,updated_by=p_actor,updated_at=now() WHERE id=q.id RETURNING * INTO q;
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_QUIZ_SAVE',p_actor::text,q.id::text,jsonb_build_object('scope',q.scope,'scopeRef',q.scope_ref,'published',q.published));
 RETURN to_jsonb(q);
END $$;

-- Plan items: [{"type":"lesson","ref":"12","title":"Front kick","target":"3 x 10","day":1,"note":"..."}]
CREATE OR REPLACE FUNCTION public.lms_check_plan_items(p_items jsonb) RETURNS void
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE item jsonb;
BEGIN
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)>30 THEN RAISE EXCEPTION 'A weekly plan holds up to 30 items' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  IF jsonb_typeof(item)<>'object' OR item->>'type' IS NULL OR item->>'type' NOT IN ('lesson','form','quiz','custom')
   OR length(COALESCE(item->>'title',''))>120 OR length(COALESCE(item->>'target',''))>60 OR length(COALESCE(item->>'note',''))>200
   OR (item ? 'day' AND jsonb_typeof(item->'day')<>'null' AND NOT (jsonb_typeof(item->'day')='number' AND (item->>'day') IN ('1','2','3','4','5','6','7'))) THEN
   RAISE EXCEPTION 'Check each plan item: type, title, target, day 1 to 7' USING ERRCODE='22023'; END IF;
  IF item->>'type'='lesson' AND NOT (COALESCE(item->>'ref','') ~ '^[0-9]{1,9}$' AND EXISTS(SELECT 1 FROM public.curriculum WHERE id=(item->>'ref')::integer)) THEN RAISE EXCEPTION 'A plan item links a lesson that is not published' USING ERRCODE='22023'; END IF;
  IF item->>'type'='form' AND NOT EXISTS(SELECT 1 FROM public.poomsae_forms WHERE id::text=item->>'ref') THEN RAISE EXCEPTION 'A plan item links a form that is not registered' USING ERRCODE='22023'; END IF;
  IF item->>'type'='custom' AND length(btrim(COALESCE(item->>'title','')))=0 THEN RAISE EXCEPTION 'Give each custom plan item a title' USING ERRCODE='22023'; END IF;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.portal_save_learning_plan(p_actor uuid,p_action text,p_student text,p_week date,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; plan public.student_learning_plans;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 IF p_action IS NULL OR p_action NOT IN ('SAVE','PUBLISH','UNPUBLISH','DELETE') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid plan request' USING ERRCODE='22023'; END IF;
 IF p_week IS NULL OR extract(isodow FROM p_week)<>1 THEN RAISE EXCEPTION 'A weekly plan starts on a Monday' USING ERRCODE='22023'; END IF;
 st:=public.lms_staff_student(p_student);
 SELECT * INTO plan FROM public.student_learning_plans WHERE student_id=st.id AND week_start=p_week FOR UPDATE;
 IF FOUND AND plan.revision IS DISTINCT FROM (p_payload->>'expectedRevision')::integer THEN RAISE EXCEPTION 'This plan changed. Reload before saving' USING ERRCODE='40001'; END IF;
 IF NOT FOUND AND p_action<>'SAVE' THEN RAISE EXCEPTION 'Save the plan first' USING ERRCODE='P0002'; END IF;
 IF p_action='DELETE' THEN
  DELETE FROM public.student_learning_plans WHERE id=plan.id;
  INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_PLAN_DELETE',p_actor::text,st.id,jsonb_build_object('weekStart',p_week));
  RETURN jsonb_build_object('deleted',plan.id);
 END IF;
 IF p_action='SAVE' THEN
  PERFORM public.lms_check_plan_items(p_payload->'items');
  IF length(COALESCE(p_payload->>'note',''))>1000 THEN RAISE EXCEPTION 'Keep the note under 1000 characters' USING ERRCODE='22023'; END IF;
  INSERT INTO public.student_learning_plans(student_id,week_start,items,note,created_by,updated_by)
  VALUES(st.id,p_week,p_payload->'items',NULLIF(btrim(COALESCE(p_payload->>'note','')),''),p_actor,p_actor)
  ON CONFLICT(student_id,week_start) DO UPDATE SET items=EXCLUDED.items,note=EXCLUDED.note,updated_by=p_actor,revision=student_learning_plans.revision+1,updated_at=now()
  RETURNING * INTO plan;
 ELSE
  UPDATE public.student_learning_plans SET published_at=CASE WHEN p_action='PUBLISH' THEN now() END,updated_by=p_actor,revision=revision+1,updated_at=now() WHERE id=plan.id RETURNING * INTO plan;
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_PLAN_'||p_action,p_actor::text,st.id,jsonb_build_object('weekStart',p_week,'items',jsonb_array_length(plan.items),'published',plan.published_at IS NOT NULL));
 RETURN to_jsonb(plan);
END $$;

-- Goal checks shared by coaches (portal_save_student_goal) and students (the 'goal' activity).
CREATE OR REPLACE FUNCTION public.lms_set_goal(p_student public.students,p_payload jsonb,p_set_by text,p_coach uuid) RETURNS public.student_goals
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_kind text:=p_payload->>'kind'; v_target integer; v_ref text:=NULLIF(btrim(COALESCE(p_payload->>'subjectRef','')),''); goal public.student_goals;
BEGIN
 IF v_kind IS NULL OR v_kind NOT IN ('weekly_days','weekly_minutes','lesson','form','belt_exam','custom') THEN RAISE EXCEPTION 'Choose a goal type' USING ERRCODE='22023'; END IF;
 IF p_payload ? 'target' AND jsonb_typeof(p_payload->'target')<>'null' THEN
  IF jsonb_typeof(p_payload->'target')<>'number' OR (p_payload->>'target')::numeric<>floor((p_payload->>'target')::numeric) OR (p_payload->>'target')::numeric NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'Choose a whole-number target' USING ERRCODE='22023'; END IF;
  v_target:=(p_payload->>'target')::integer;
 END IF;
 IF v_kind IN ('weekly_days','weekly_minutes') AND v_target IS NULL THEN RAISE EXCEPTION 'Choose a weekly target' USING ERRCODE='22023'; END IF;
 IF v_kind='lesson' AND NOT (COALESCE(v_ref,'') ~ '^[0-9]{1,9}$' AND EXISTS(SELECT 1 FROM public.curriculum c WHERE c.id=v_ref::integer AND c.is_active AND public.lms_belt_allows(c.target_belt,p_student.current_belt))) THEN RAISE EXCEPTION 'Choose a lesson open to this belt' USING ERRCODE='22023'; END IF;
 IF v_kind='form' AND NOT EXISTS(SELECT 1 FROM public.poomsae_forms f WHERE f.id::text=v_ref AND f.published) THEN RAISE EXCEPTION 'Choose a published form' USING ERRCODE='22023'; END IF;
 IF v_kind NOT IN ('lesson','form') THEN v_ref:=NULL; END IF;
 IF (SELECT count(*) FROM public.student_goals g WHERE g.student_id=p_student.id AND g.status='active')>=30 THEN RAISE EXCEPTION 'A student can have up to 30 active goals' USING ERRCODE='22023'; END IF;
 IF v_kind IN ('weekly_days','weekly_minutes') THEN
  UPDATE public.student_goals g SET status='dropped',updated_at=now() WHERE g.student_id=p_student.id AND g.kind=v_kind AND g.status='active';
 END IF;
 INSERT INTO public.student_goals(student_id,kind,target,subject_ref,title,set_by,coach_id,ends_on)
 VALUES(p_student.id,v_kind,v_target,v_ref,NULLIF(btrim(COALESCE(p_payload->>'title','')),''),p_set_by,p_coach,NULLIF(p_payload->>'endsOn','')::date) RETURNING * INTO goal;
 RETURN goal;
END $$;

CREATE OR REPLACE FUNCTION public.portal_save_student_goal(p_actor uuid,p_action text,p_student text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; goal public.student_goals;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 IF p_action IS NULL OR p_action NOT IN ('SET','DONE','DROP') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid goal request' USING ERRCODE='22023'; END IF;
 st:=public.lms_staff_student(p_student);
 IF p_action='SET' THEN
  goal:=public.lms_set_goal(st,p_payload,'coach',p_actor);
 ELSE
  UPDATE public.student_goals SET status=CASE WHEN p_action='DONE' THEN 'done' ELSE 'dropped' END,updated_at=now()
  WHERE id::text=p_payload->>'goalId' AND student_id=st.id AND status='active' RETURNING * INTO goal;
  IF NOT FOUND THEN RAISE EXCEPTION 'This goal is no longer active' USING ERRCODE='P0002'; END IF;
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_GOAL_'||p_action,p_actor::text,st.id,jsonb_build_object('goalId',goal.id,'kind',goal.kind,'target',goal.target));
 RETURN to_jsonb(goal);
END $$;

-- A form the student may see: published, its lesson active and open to the
-- student's belt, and the form's own belt at or below the student's belt.
CREATE OR REPLACE FUNCTION public.lms_form_visible(p_student public.students,p_form text) RETURNS public.poomsae_forms
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT f.* FROM public.poomsae_forms f JOIN public.curriculum c ON c.id=f.curriculum_id LEFT JOIN public.belts b ON b.id=f.belt_id
 WHERE f.id::text=p_form AND f.published AND c.is_active AND public.lms_belt_allows(c.target_belt,p_student.current_belt)
  AND (b.id IS NULL OR public.lms_belt_allows(b.belt_name,p_student.current_belt)) $$;

-- A lesson the student may practise: active and open to the student's belt.
CREATE OR REPLACE FUNCTION public.lms_lesson_visible(p_student public.students,p_lesson text) RETURNS public.curriculum
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT c.* FROM public.curriculum c WHERE p_lesson ~ '^[0-9]{1,9}$' AND c.id=p_lesson::integer AND c.is_active
  AND public.lms_belt_allows(c.target_belt,p_student.current_belt) $$;

-- Quiz scopes a student may take: visible forms and lessons, belts up to the
-- next belt, and any terminology set.
CREATE OR REPLACE FUNCTION public.lms_quiz_scope_allowed(p_student public.students,p_scope text,p_ref text) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT COALESCE(CASE p_scope
  WHEN 'form' THEN (public.lms_form_visible(p_student,p_ref)).id IS NOT NULL
  WHEN 'lesson' THEN (public.lms_lesson_visible(p_student,p_ref)).id IS NOT NULL
  WHEN 'belt' THEN public.lms_belt_allows(p_ref,p_student.current_belt)
   OR EXISTS(SELECT 1 FROM public.belts nb WHERE nb.belt_name=p_ref AND nb.belt_order=(public.lms_belt_named(p_student.current_belt)).belt_order+1)
  WHEN 'terminology' THEN p_ref ~ '^[A-Za-z0-9][A-Za-z0-9 _:-]{0,79}$'
  ELSE false END,false) $$;

-- ===========================================================================
-- 7. Student feeds (server only; the student portal passes the signed-in
--    student's id after checking the session and the student link)
-- ===========================================================================
-- forms-v1: published forms for the student's belt and below, with progress.
CREATE OR REPLACE FUNCTION public.portal_student_forms(p_student text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 SELECT * INTO st FROM public.students WHERE id=p_student AND deleted_at IS NULL;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('contractVersion','forms-v1','studentId',st.id,'currentBelt',st.current_belt,
  'forms',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',f.id,'lessonId',f.curriculum_id,'name',f.name,'koreanName',f.korean_name,'series',f.series,
    'belt',b.belt_name,'beltOrder',b.belt_order,'isCurrentBelt',COALESCE(b.id=(public.lms_belt_named(st.current_belt)).id,false),
    'movementCount',f.movement_count,'sortOrder',f.sort_order,'translations',f.translations,
    'quizQuestions',(SELECT count(*) FROM public.quiz_questions q WHERE q.scope='form' AND q.scope_ref=f.id::text AND q.published),
    'progress',jsonb_build_object('status',COALESCE(p.status,'learning'),'practiceCount',COALESCE(p.practice_count,0),'practiceSeconds',COALESCE(p.practice_seconds,0),
     'bestQuizPercent',p.best_quiz_percent,'lastPractisedAt',p.last_practised_at,'reviewRequestedAt',p.review_requested_at,
     'reviewedAt',p.reviewed_at,'reviewNote',p.review_note,'masteredAt',p.mastered_at))
   ORDER BY f.sort_order,f.name),'[]'::jsonb)
   FROM public.poomsae_forms f JOIN public.curriculum c ON c.id=f.curriculum_id LEFT JOIN public.belts b ON b.id=f.belt_id
   LEFT JOIN public.student_form_progress p ON p.form_id=f.id AND p.student_id=st.id
   WHERE f.published AND c.is_active AND public.lms_belt_allows(c.target_belt,st.current_belt)
    AND (b.id IS NULL OR public.lms_belt_allows(b.belt_name,st.current_belt))));
END $$;

-- quiz-v1: published questions for one scope the student may see. Answers are
-- included because practice quizzes are scored on the device (self-reported).
CREATE OR REPLACE FUNCTION public.portal_student_quiz(p_student text,p_scope text,p_scope_ref text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; allowed boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 SELECT * INTO st FROM public.students WHERE id=p_student AND deleted_at IS NULL;
 IF NOT FOUND THEN RETURN NULL; END IF;
 allowed:=public.lms_quiz_scope_allowed(st,p_scope,p_scope_ref);
 IF NOT allowed THEN RETURN jsonb_build_object('contractVersion','quiz-v1','studentId',st.id,'scope',p_scope,'scopeRef',p_scope_ref,'questions','[]'::jsonb); END IF;
 RETURN jsonb_build_object('contractVersion','quiz-v1','studentId',st.id,'scope',p_scope,'scopeRef',p_scope_ref,
  'questions',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',q.id,'kind',q.kind,'prompt',q.prompt,'choices',q.choices,'answer',q.answer,
    'explanation',q.explanation,'translations',q.translations) ORDER BY q.sort_order,q.created_at),'[]'::jsonb)
   FROM (SELECT * FROM public.quiz_questions WHERE scope=p_scope AND scope_ref=p_scope_ref AND published ORDER BY sort_order,created_at LIMIT 100) q));
END $$;

-- learning-state-v1: goals, the coach's weekly plans, checklist ticks,
-- latest self-checks and best quiz scores.
CREATE OR REPLACE FUNCTION public.portal_student_learning(p_student text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; today date:=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date; monday date;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 SELECT * INTO st FROM public.students WHERE id=p_student AND deleted_at IS NULL;
 IF NOT FOUND THEN RETURN NULL; END IF;
 monday:=today-(extract(isodow FROM today)::integer-1);
 RETURN jsonb_build_object('contractVersion','learning-state-v1','studentId',st.id,'weekStart',monday,
  'goals',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',g.id,'kind',g.kind,'target',g.target,'subjectRef',g.subject_ref,'title',g.title,'setBy',g.set_by,
    'startsOn',g.starts_on,'endsOn',g.ends_on,'status',g.status,'createdAt',g.created_at) ORDER BY g.created_at DESC),'[]'::jsonb)
   FROM public.student_goals g WHERE g.student_id=st.id AND (g.status='active' OR g.updated_at>=now()-interval '30 days')),
  'plans',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',p.id,'weekStart',p.week_start,'items',p.items,'note',p.note,'publishedAt',p.published_at) ORDER BY p.week_start),'[]'::jsonb)
   FROM public.student_learning_plans p WHERE p.student_id=st.id AND p.published_at IS NOT NULL AND p.week_start BETWEEN monday AND monday+7),
  'stepChecks',(SELECT COALESCE(jsonb_agg(jsonb_build_object('lessonId',c.curriculum_id,'stepId',c.step_id,'checked',to_jsonb(c.checked),'updatedAt',c.updated_at)),'[]'::jsonb)
   FROM public.student_step_checks c WHERE c.student_id=st.id),
  'selfAssessments',(SELECT COALESCE(jsonb_agg(jsonb_build_object('subjectType',a.subject_type,'subjectRef',a.subject_ref,'rating',a.rating,'note',a.note,'createdAt',a.created_at) ORDER BY a.created_at DESC),'[]'::jsonb)
   FROM (SELECT DISTINCT ON (subject_type,subject_ref) * FROM public.student_self_assessments WHERE student_id=st.id AND created_at>=now()-interval '90 days'
    ORDER BY subject_type,subject_ref,created_at DESC LIMIT 200) a),
  'quizBest',(SELECT COALESCE(jsonb_agg(jsonb_build_object('scope',x.scope,'scopeRef',x.scope_ref,'bestPercent',x.best,'attempts',x.n,'lastAt',x.last_at)),'[]'::jsonb)
   FROM (SELECT scope,scope_ref,max(round(100.0*score/total))::integer AS best,count(*)::integer AS n,max(created_at) AS last_at
    FROM public.student_quiz_attempts WHERE student_id=st.id GROUP BY scope,scope_ref ORDER BY max(created_at) DESC LIMIT 200) x));
END $$;

-- ===========================================================================
-- 8. Coach attention: a lesson or form a student rated "still learning" (1)
--    three times, or failed its quiz (under 70%) twice, within 14 days.
-- ===========================================================================
CREATE VIEW public.coach_attention_items WITH (security_invoker=true) AS
WITH flagged AS (
 SELECT a.student_id,CASE a.subject_type WHEN 'step' THEN 'lesson' WHEN 'movement' THEN 'form' ELSE a.subject_type END AS subject_type,
  split_part(a.subject_ref,':',1) AS subject_ref,'still_learning'::text AS reason,count(*)::integer AS occurrences,max(a.created_at) AS last_at
 FROM public.student_self_assessments a WHERE a.rating=1 AND a.created_at>=now()-interval '14 days'
 GROUP BY 1,2,3 HAVING count(*)>=3
 UNION ALL
 SELECT q.student_id,q.scope,q.scope_ref,'quiz_failed',count(*)::integer,max(q.created_at)
 FROM public.student_quiz_attempts q WHERE q.score*10<q.total*7 AND q.created_at>=now()-interval '14 days'
 GROUP BY 1,2,3 HAVING count(*)>=2
)
SELECT x.student_id,s.english_name AS student_name,s.current_belt,s.home_branch_id,x.subject_type,x.subject_ref,
 CASE x.subject_type WHEN 'lesson' THEN (SELECT c.title FROM public.curriculum c WHERE x.subject_ref ~ '^[0-9]{1,9}$' AND c.id=x.subject_ref::integer)
  WHEN 'form' THEN (SELECT f.name FROM public.poomsae_forms f WHERE f.id::text=x.subject_ref) ELSE x.subject_ref END AS subject_title,
 x.reason,x.occurrences,x.last_at,
 ARRAY(SELECT en.class_id FROM public.class_enrollments en WHERE en.student_id=x.student_id ORDER BY en.class_id) AS class_ids
FROM flagged x JOIN public.students s ON s.id=x.student_id AND s.deleted_at IS NULL;
REVOKE ALL ON public.coach_attention_items FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.coach_attention_items TO service_role;

-- ===========================================================================
-- Grants: service role only; helpers are internal.
-- ===========================================================================
DO $$ DECLARE f text; BEGIN
 FOREACH f IN ARRAY ARRAY['lms_student_notice_categories()','lms_belt_allows(text,text)','lms_belt_named(text)','lms_staff_student(text)',
  'lms_notify(text,text,text,jsonb,text,text,text)','lms_notice_copy(text,jsonb)','lms_check_plan_items(jsonb)',
  'lms_set_goal(public.students,jsonb,text,uuid)','lms_form_visible(public.students,text)','lms_lesson_visible(public.students,text)','lms_quiz_scope_allowed(public.students,text,text)','portal_save_poomsae_form(uuid,text,uuid,jsonb)','portal_save_quiz_question(uuid,text,uuid,jsonb)',
  'portal_save_learning_plan(uuid,text,text,date,jsonb)','portal_save_student_goal(uuid,text,text,jsonb)','portal_student_forms(text)',
  'portal_student_quiz(text,text,text)','portal_student_learning(text)'] LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC,anon,authenticated',f);
 END LOOP;
 -- The helpers are also granted to the service role: student_portal_record_event
 -- runs as the caller (service role) and uses them.
 FOREACH f IN ARRAY ARRAY['lms_student_notice_categories()','lms_belt_allows(text,text)','lms_belt_named(text)','lms_staff_student(text)',
  'lms_notify(text,text,text,jsonb,text,text,text)','lms_notice_copy(text,jsonb)','lms_check_plan_items(jsonb)',
  'lms_set_goal(public.students,jsonb,text,uuid)','lms_form_visible(public.students,text)','lms_lesson_visible(public.students,text)','lms_quiz_scope_allowed(public.students,text,text)','portal_save_poomsae_form(uuid,text,uuid,jsonb)','portal_save_quiz_question(uuid,text,uuid,jsonb)',
  'portal_save_learning_plan(uuid,text,text,date,jsonb)','portal_save_student_goal(uuid,text,text,jsonb)','portal_student_forms(text)',
  'portal_student_quiz(text,text,text)','portal_student_learning(text)'] LOOP
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role',f);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
