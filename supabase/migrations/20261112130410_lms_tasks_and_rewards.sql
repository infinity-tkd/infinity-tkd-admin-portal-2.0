-- LMS tasks and rewards (docs/STUDENT_PORTAL_LMS_DESIGN_2026-11-12.md, phases 4-5):
-- the achievement catalogue and awards, a personal points ledger (never ranked),
-- assignments with targeting, weekly challenges, video consent, submissions
-- with coach reviews, the private student-submissions bucket, coach form review
-- (only a coach marks a form mastered), student_portal_evaluate_rewards and the
-- tasks-v1, submissions-v1 and achievements-v1 feeds.
-- Decisions (12 Nov 2026): coaches and above (action:curriculum_edit) create,
-- publish and review; "Belt Exam Ready" is signed off by a coach; videos are
-- kept 90 days after review; guardians consent in the portal at the first
-- upload, and staff can record consent given on paper.
-- Requires 20261112090000_lms_learning_records.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

-- Normalised belt name, as in lms_belt_allows.
CREATE OR REPLACE FUNCTION public.lms_belt_key(p_name text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT regexp_replace(replace(lower(COALESCE(p_name,'')),'belt',''),'[^a-z0-9]','','g') $$;

-- ===========================================================================
-- 1. Achievements and points
-- ===========================================================================
CREATE TABLE public.achievement_definitions (
 code text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_]{1,59}$'),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
 description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 500),
 icon text NOT NULL DEFAULT 'Medal' CHECK (icon ~ '^[A-Za-z]{1,40}$'),  -- the library category icon names
 rule jsonb NOT NULL CHECK (jsonb_typeof(rule)='object' AND octet_length(rule::text)<=2000 AND rule->>'kind' IN
  ('lessons_completed','streak_days','forms_mastered','category_completed','sessions_total','attendance_month','quiz_passed','challenges_completed','manual')),
 points smallint NOT NULL DEFAULT 0 CHECK (points BETWEEN 0 AND 1000),
 repeats text NOT NULL DEFAULT 'once' CHECK (repeats IN ('once','monthly','per_belt')),
 translations jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(translations)='object' AND octet_length(translations::text)<=8000),
 sort_order integer NOT NULL DEFAULT 100 CHECK (sort_order BETWEEN 1 AND 100000),
 active boolean NOT NULL DEFAULT true,
 revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 created_by uuid REFERENCES public.profiles(id),
 updated_by uuid REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT achievement_definitions_monthly CHECK (rule->>'kind'<>'attendance_month' OR repeats='monthly')
);
CREATE INDEX achievement_definitions_created_by_ops_idx ON public.achievement_definitions(created_by);
CREATE INDEX achievement_definitions_updated_by_ops_idx ON public.achievement_definitions(updated_by);

CREATE TABLE public.student_achievements (
 student_id varchar NOT NULL REFERENCES public.students(id),
 code text NOT NULL REFERENCES public.achievement_definitions(code) ON UPDATE CASCADE,
 period text NOT NULL DEFAULT '' CHECK (length(period)<=40),  -- '' once, '2026-11' monthly, a belt name per belt
 earned_at timestamptz NOT NULL DEFAULT now(),
 evidence jsonb CHECK (evidence IS NULL OR octet_length(evidence::text)<=4000),  -- what counted, for the coach
 awarded_by uuid REFERENCES public.profiles(id),  -- set for coach sign-offs
 seen_at timestamptz,  -- the portal cheers once, then sets this
 PRIMARY KEY (student_id,code,period)
);
CREATE INDEX student_achievements_code_idx ON public.student_achievements(code);
CREATE INDEX student_achievements_awarded_by_ops_idx ON public.student_achievements(awarded_by);

CREATE TABLE public.student_points (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 student_id varchar NOT NULL REFERENCES public.students(id),
 delta integer NOT NULL CHECK (delta BETWEEN 1 AND 100000),
 reason text NOT NULL CHECK (reason IN ('assignment','challenge','achievement')),
 ref text NOT NULL CHECK (length(ref) BETWEEN 1 AND 160),  -- the source row's id
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (student_id,reason,ref)  -- never awarded twice
);

-- The seven example achievements from the design. "Belt Exam Ready" is a coach
-- sign-off (rule 'manual'), once per belt.
INSERT INTO public.achievement_definitions(code,title,description,icon,rule,points,repeats,sort_order,translations) VALUES
 ('lessons_10','First 10 Lessons Completed','Complete 10 lessons in the library.','BookOpen','{"kind":"lessons_completed","min":10}',50,'once',10,
  '{"km":{"title":"បញ្ចប់មេរៀន 10 ដំបូង","description":"បញ្ចប់មេរៀនចំនួន 10 ក្នុងបណ្ណាល័យ។"},"zh":{"title":"完成前 10 节课","description":"在课程库中完成 10 节课。"}}'),
 ('streak_7','7-Day Practice Streak','Practise 7 days in a row.','Fire','{"kind":"streak_days","min":7}',30,'once',20,
  '{"km":{"title":"ហាត់ជាប់គ្នា 7 ថ្ងៃ","description":"ហាត់ 7 ថ្ងៃជាប់ៗគ្នា។"},"zh":{"title":"连续练习 7 天","description":"连续 7 天练习。"}}'),
 ('poomsae_beginner','Poomsae Beginner','Have your first form marked mastered by a coach.','Medal','{"kind":"forms_mastered","min":1}',50,'once',30,
  '{"km":{"title":"អ្នកចាប់ផ្តើមពុំសេ","description":"គ្រូបង្វឹកបញ្ជាក់ថាអ្នកស្ទាត់ពុំសេដំបូងរបស់អ្នក។"},"zh":{"title":"品势入门","description":"教练确认你掌握了第一个套路。"}}'),
 ('kicking_master','Kicking Technique Master','Complete every kicking lesson open to your belt.','Lightning','{"kind":"category_completed","categories":["kicking-fundamentals","kicking-advanced"]}',100,'per_belt',40,
  '{"km":{"title":"អ្នកជំនាញបច្ចេកទេសទាត់","description":"បញ្ចប់មេរៀនទាត់ទាំងអស់សម្រាប់ខ្សែក្រវាត់របស់អ្នក។"},"zh":{"title":"踢技大师","description":"完成你的腰带可学的所有踢技课程。"}}'),
 ('sessions_100','100 Home Practice Sessions','Log 100 practice sessions at home.','Barbell','{"kind":"sessions_total","min":100}',100,'once',50,
  '{"km":{"title":"ហាត់នៅផ្ទះ 100 ដង","description":"កត់ត្រាការហាត់នៅផ្ទះចំនួន 100 ដង។"},"zh":{"title":"在家练习 100 次","description":"记录 100 次在家练习。"}}'),
 ('belt_exam_ready','Belt Exam Ready','Your coach confirms you are ready for your next belt test.','Target','{"kind":"manual"}',50,'per_belt',60,
  '{"km":{"title":"ត្រៀមខ្លួនប្រឡងខ្សែក្រវាត់","description":"គ្រូបង្វឹកបញ្ជាក់ថាអ្នកត្រៀមខ្លួនរួចសម្រាប់ការប្រឡងខ្សែក្រវាត់បន្ទាប់។"},"zh":{"title":"晋级考核准备就绪","description":"教练确认你已准备好参加下一次晋级考核。"}}'),
 ('attendance_month','Perfect Attendance Month','Present or late at every class on your schedule for a month.','Star','{"kind":"attendance_month"}',40,'monthly',70,
  '{"km":{"title":"វត្តមានពេញមួយខែ","description":"មករៀនគ្រប់ថ្នាក់ក្នុងកាលវិភាគរបស់អ្នកពេញមួយខែ។"},"zh":{"title":"全勤月","description":"一个月内出席所有排定的课程。"}}');

-- ===========================================================================
-- 2. Assignments and challenges
-- ===========================================================================
CREATE TABLE public.assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
 instructions text NOT NULL CHECK (length(btrim(instructions)) BETWEEN 1 AND 4000),
 kind text NOT NULL CHECK (kind IN ('practice','video','written','quiz','form')),
 subject_type text CHECK (subject_type IS NULL OR subject_type IN ('lesson','form')),
 subject_ref text CHECK (subject_ref IS NULL OR length(subject_ref) BETWEEN 1 AND 80),
 target jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(target)='object' AND octet_length(target::text)<=2000),  -- {"reps":50} | {"sessions":3} | {"scope","scopeRef","passPercent"}
 due_at timestamptz,
 points smallint NOT NULL DEFAULT 0 CHECK (points BETWEEN 0 AND 1000),
 rubric jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(rubric)='array' AND jsonb_array_length(rubric)<=20),
 translations jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(translations)='object' AND octet_length(translations::text)<=20000),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
 revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 updated_by uuid REFERENCES public.profiles(id),
 published_at timestamptz,
 closed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT assignments_subject CHECK ((subject_type IS NULL)=(subject_ref IS NULL))
);
CREATE INDEX assignments_status_idx ON public.assignments(status,due_at);
CREATE INDEX assignments_created_by_ops_idx ON public.assignments(created_by);
CREATE INDEX assignments_updated_by_ops_idx ON public.assignments(updated_by);

CREATE TABLE public.assignment_targets (
 assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
 target_type text NOT NULL CHECK (target_type IN ('student','class','belt','branch','all')),
 target_ref text NOT NULL DEFAULT '' CHECK (length(target_ref)<=80 AND ((target_type='all')=(target_ref=''))),  -- student id, class id, belt name, branch id; '' for all
 PRIMARY KEY (assignment_id,target_type,target_ref)
);

CREATE TABLE public.student_assignments (  -- one row per student, written when the assignment is published
 assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
 student_id varchar NOT NULL REFERENCES public.students(id),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','submitted','reviewed','done','excused')),
 progress jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(progress)='object' AND octet_length(progress::text)<=2000),  -- {"reps":30,"sessions":2}
 assigned_at timestamptz NOT NULL DEFAULT now(),
 done_at timestamptz,
 note text CHECK (note IS NULL OR length(note)<=500),  -- staff note, e.g. why excused
 updated_by uuid REFERENCES public.profiles(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (assignment_id,student_id)
);
CREATE INDEX student_assignments_student_idx ON public.student_assignments(student_id,status);
CREATE INDEX student_assignments_updated_by_ops_idx ON public.student_assignments(updated_by);

CREATE TABLE public.challenges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
 description text CHECK (description IS NULL OR length(description)<=2000),
 goal_kind text NOT NULL CHECK (goal_kind IN ('reps','sessions','streak_days','minutes','quiz_pass','form_mastered')),
 goal_target integer NOT NULL CHECK (goal_target BETWEEN 1 AND 100000),
 subject_type text CHECK (subject_type IS NULL OR subject_type IN ('lesson','form','quiz')),
 subject_ref text CHECK (subject_ref IS NULL OR length(subject_ref) BETWEEN 1 AND 120),  -- lesson 12 for "50 front kicks"; quiz 'terminology:General'
 starts_on date NOT NULL,
 ends_on date NOT NULL,
 audience jsonb NOT NULL DEFAULT '{"all":true}'::jsonb CHECK (jsonb_typeof(audience)='object' AND octet_length(audience::text)<=8000),  -- {"belts":["White","Yellow"]}
 points smallint NOT NULL DEFAULT 0 CHECK (points BETWEEN 0 AND 1000),
 badge_code text REFERENCES public.achievement_definitions(code) ON UPDATE CASCADE,
 translations jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(translations)='object' AND octet_length(translations::text)<=20000),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
 revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 updated_by uuid REFERENCES public.profiles(id),
 published_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT challenges_window CHECK (ends_on>=starts_on AND ends_on<=starts_on+366),
 CONSTRAINT challenges_subject CHECK ((subject_type IS NULL)=(subject_ref IS NULL))
);
CREATE INDEX challenges_status_idx ON public.challenges(status,starts_on,ends_on);
CREATE INDEX challenges_badge_ops_idx ON public.challenges(badge_code);
CREATE INDEX challenges_created_by_ops_idx ON public.challenges(created_by);
CREATE INDEX challenges_updated_by_ops_idx ON public.challenges(updated_by);

CREATE TABLE public.student_challenge_progress (
 challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
 student_id varchar NOT NULL REFERENCES public.students(id),
 progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100000000),
 completed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (challenge_id,student_id)
);
CREATE INDEX student_challenge_progress_student_idx ON public.student_challenge_progress(student_id);

-- ===========================================================================
-- 3. Video consent, submissions and coach reviews
-- ===========================================================================
CREATE TABLE public.student_video_consents (
 student_id varchar PRIMARY KEY REFERENCES public.students(id),
 guardian_name text NOT NULL CHECK (length(btrim(guardian_name)) BETWEEN 2 AND 120),
 relationship text NOT NULL CHECK (relationship IN ('parent','guardian','self')),
 source text NOT NULL CHECK (source IN ('portal','staff')),
 consented_by uuid REFERENCES public.profiles(id),  -- the portal account that agreed
 recorded_by uuid REFERENCES public.profiles(id),  -- staff who recorded consent given on paper
 consented_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 policy_version text NOT NULL DEFAULT 'video-v1' CHECK (policy_version ~ '^[a-z0-9.-]{1,20}$'),
 CONSTRAINT student_video_consents_actor CHECK ((source='portal' AND consented_by IS NOT NULL) OR (source='staff' AND recorded_by IS NOT NULL))
);
CREATE INDEX student_video_consents_consented_by_ops_idx ON public.student_video_consents(consented_by);
CREATE INDEX student_video_consents_recorded_by_ops_idx ON public.student_video_consents(recorded_by);

CREATE TABLE public.student_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 student_id varchar NOT NULL REFERENCES public.students(id),
 request_key uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES public.profiles(id),
 assignment_id uuid REFERENCES public.assignments(id),
 subject_type text CHECK (subject_type IS NULL OR subject_type IN ('lesson','form')),
 subject_ref text CHECK (subject_ref IS NULL OR length(subject_ref) BETWEEN 1 AND 80),
 kind text NOT NULL CHECK (kind IN ('video','text','practice')),
 text_answer text CHECK (text_answer IS NULL OR length(text_answer)<=4000),
 video_path text CHECK (video_path IS NULL OR video_path ~ '^[A-Za-z0-9-]{1,40}/[0-9a-f-]{36}\.(mp4|webm|mov)$'),  -- student-submissions/<student>/<id>.mp4
 mime_type text CHECK (mime_type IS NULL OR mime_type IN ('video/mp4','video/webm','video/quicktime')),
 bytes bigint CHECK (bytes IS NULL OR bytes BETWEEN 1 AND 209715200),  -- 200 MB
 video_seconds smallint CHECK (video_seconds IS NULL OR video_seconds BETWEEN 1 AND 180),
 status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading','submitted','reviewed','returned','withdrawn','expired')),
 consent_by uuid REFERENCES public.profiles(id),  -- the account that agreed to the recording
 consent_at timestamptz,
 submitted_at timestamptz,
 reviewed_at timestamptz,
 delete_video_after date,  -- review date + 90 days
 video_deleted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (student_id,request_key),
 CONSTRAINT student_submissions_shape CHECK ((kind<>'video' OR consent_at IS NOT NULL) AND (kind<>'text' OR text_answer IS NOT NULL)
  AND (kind='video' OR video_path IS NULL) AND ((subject_type IS NULL)=(subject_ref IS NULL)))
);
CREATE INDEX student_submissions_student_idx ON public.student_submissions(student_id,created_at DESC);
CREATE INDEX student_submissions_queue_idx ON public.student_submissions(status,submitted_at) WHERE status='submitted';
CREATE INDEX student_submissions_retention_idx ON public.student_submissions(delete_video_after) WHERE video_path IS NOT NULL;
CREATE INDEX student_submissions_assignment_ops_idx ON public.student_submissions(assignment_id);
CREATE INDEX student_submissions_actor_ops_idx ON public.student_submissions(actor_id);
CREATE INDEX student_submissions_consent_by_ops_idx ON public.student_submissions(consent_by);

CREATE TABLE public.submission_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 submission_id uuid NOT NULL REFERENCES public.student_submissions(id),
 reviewer_id uuid NOT NULL REFERENCES public.profiles(id),
 decision text NOT NULL DEFAULT 'accepted' CHECK (decision IN ('accepted','returned')),
 grade text CHECK (grade IS NULL OR grade IN ('Needs Work','Developing','Proficient','Outstanding')),
 rubric jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(rubric)='array' AND jsonb_array_length(rubric)<=20),  -- [{"item":"Stance","grade":"Developing","note":"..."}]
 feedback text CHECK (feedback IS NULL OR length(feedback)<=4000),
 moments jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(moments)='array' AND jsonb_array_length(moments)<=50),  -- [{"second":12,"note":"Pivot the supporting foot"}]
 visible_to_student boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX submission_reviews_submission_idx ON public.submission_reviews(submission_id,created_at);
CREATE INDEX submission_reviews_reviewer_ops_idx ON public.submission_reviews(reviewer_id);

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['achievement_definitions','student_achievements','student_points','assignments','assignment_targets','student_assignments',
  'challenges','student_challenge_progress','student_video_consents','student_submissions','submission_reviews'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;

-- Private bucket: no storage policies, so only the service role (both portals'
-- servers) reads or writes. Uploads and playback use short signed URLs.
DO $$ BEGIN
 IF to_regclass('storage.buckets') IS NOT NULL THEN
  EXECUTE $q$INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
   VALUES('student-submissions','student-submissions',false,209715200,ARRAY['video/mp4','video/webm','video/quicktime'])
   ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=209715200,allowed_mime_types=ARRAY['video/mp4','video/webm','video/quicktime']$q$;
 END IF;
END $$;

-- ===========================================================================
-- 4. Audiences and progress
-- ===========================================================================
-- Challenge audience: {"all":true} or any of belts, branches, classes, students.
CREATE OR REPLACE FUNCTION public.lms_student_in_audience(p_student public.students,p_audience jsonb) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT p_student.deleted_at IS NULL AND (COALESCE(p_audience->>'all','false')='true'
  OR (jsonb_typeof(p_audience->'belts')='array' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_audience->'belts') b WHERE public.lms_belt_key(b)=public.lms_belt_key(p_student.current_belt)))
  OR (jsonb_typeof(p_audience->'branches')='array' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_audience->'branches') b WHERE b=p_student.home_branch_id::text))
  OR (jsonb_typeof(p_audience->'classes')='array' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_audience->'classes') c JOIN public.class_enrollments en ON en.class_id::text=c WHERE en.student_id=p_student.id))
  OR (jsonb_typeof(p_audience->'students')='array' AND p_audience->'students' ? p_student.id)) $$;

-- Students an assignment's targets reach: active students, plus paused ones named directly.
CREATE OR REPLACE FUNCTION public.lms_assignment_students(p_assignment uuid) RETURNS SETOF varchar
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT s.id FROM public.students s WHERE s.deleted_at IS NULL AND EXISTS(
  SELECT 1 FROM public.assignment_targets t WHERE t.assignment_id=p_assignment
  AND (s.student_status='Active' OR (t.target_type='student' AND s.student_status='Paused'))
  AND (t.target_type='all' OR (t.target_type='student' AND t.target_ref=s.id)
   OR (t.target_type='branch' AND t.target_ref=s.home_branch_id::text)
   OR (t.target_type='belt' AND public.lms_belt_key(t.target_ref)=public.lms_belt_key(s.current_belt))
   OR (t.target_type='class' AND EXISTS(SELECT 1 FROM public.class_enrollments en WHERE en.student_id=s.id AND en.class_id::text=t.target_ref)))) $$;

-- Writes one row per reached student; removes untouched rows of students no longer reached.
CREATE OR REPLACE FUNCTION public.lms_assignment_fanout(p_assignment uuid) RETURNS integer
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE added integer;
BEGIN
 INSERT INTO public.student_assignments(assignment_id,student_id) SELECT p_assignment,s FROM public.lms_assignment_students(p_assignment) s ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS added=ROW_COUNT;
 DELETE FROM public.student_assignments sa WHERE sa.assignment_id=p_assignment AND sa.status='open' AND sa.progress='{}'::jsonb
  AND sa.student_id NOT IN (SELECT s FROM public.lms_assignment_students(p_assignment) s)
  AND NOT EXISTS(SELECT 1 FROM public.student_submissions x WHERE x.assignment_id=p_assignment AND x.student_id=sa.student_id);
 RETURN added;
END $$;

-- Practice days: days (Asia/Phnom_Penh) with lesson, workout, form or quiz activity.
CREATE OR REPLACE FUNCTION public.lms_practice_days(p_student text,p_from date,p_to date,p_lesson text DEFAULT NULL) RETURNS SETOF date
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT DISTINCT (e.created_at AT TIME ZONE 'Asia/Phnom_Penh')::date FROM public.student_portal_events e
 WHERE e.student_id=p_student AND e.created_at>=(p_from::timestamp AT TIME ZONE 'Asia/Phnom_Penh') AND e.created_at<((p_to+1)::timestamp AT TIME ZONE 'Asia/Phnom_Penh')
  AND (CASE WHEN p_lesson IS NULL THEN e.kind IN ('lesson','workout','form_practice','quiz_attempt') ELSE e.kind='lesson' AND e.payload->>'lessonId'=p_lesson END) $$;

-- Longest run of consecutive practice days in a window.
CREATE OR REPLACE FUNCTION public.lms_longest_streak(p_student text,p_from date,p_to date,p_lesson text DEFAULT NULL) RETURNS integer
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT COALESCE(max(n),0)::integer FROM (SELECT count(*) AS n FROM (SELECT d,d-(row_number() OVER (ORDER BY d))::integer AS grp
  FROM public.lms_practice_days(p_student,p_from,p_to,p_lesson) d) x GROUP BY grp) y $$;

-- Consecutive practice days ending today, or yesterday when nothing is logged yet today.
CREATE OR REPLACE FUNCTION public.lms_current_streak(p_student text,p_today date) RETURNS integer
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE days date[]; d date; n integer:=0;
BEGIN
 days:=ARRAY(SELECT x FROM public.lms_practice_days(p_student,p_today-400,p_today) x ORDER BY x DESC);
 d:=CASE WHEN p_today=ANY(days) THEN p_today ELSE p_today-1 END;
 WHILE d=ANY(days) LOOP n:=n+1; d:=d-1; END LOOP;
 RETURN n;
END $$;

-- Challenge progress, counted from recorded activity inside the challenge window.
CREATE OR REPLACE FUNCTION public.lms_challenge_progress(p_student public.students,p_challenge public.challenges) RETURNS integer
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE c public.challenges:=p_challenge; from_ts timestamptz:=(c.starts_on::timestamp AT TIME ZONE 'Asia/Phnom_Penh'); to_ts timestamptz:=((c.ends_on+1)::timestamp AT TIME ZONE 'Asia/Phnom_Penh');
 lesson text:=CASE WHEN c.subject_type='lesson' THEN c.subject_ref END; v integer;
BEGIN
 CASE c.goal_kind
  WHEN 'reps' THEN
   SELECT COALESCE(sum(LEAST(GREATEST(COALESCE((e.payload->>'repetitionsCount')::integer,0),0),10000)),0) INTO v FROM public.student_portal_events e
   WHERE e.student_id=p_student.id AND e.kind='lesson' AND e.created_at>=from_ts AND e.created_at<to_ts AND (lesson IS NULL OR e.payload->>'lessonId'=lesson);
  WHEN 'sessions' THEN
   SELECT count(*) INTO v FROM public.student_portal_events e
   WHERE e.student_id=p_student.id AND e.created_at>=from_ts AND e.created_at<to_ts
    AND (CASE WHEN lesson IS NULL THEN e.kind IN ('lesson','workout','form_practice') ELSE e.kind='lesson' AND e.payload->>'lessonId'=lesson END);
  WHEN 'streak_days' THEN v:=public.lms_longest_streak(p_student.id,c.starts_on,c.ends_on,lesson);
  WHEN 'minutes' THEN
   SELECT COALESCE(sum(LEAST(GREATEST(COALESCE((e.payload->>'durationSeconds')::integer,0),0),14400)),0)/60 INTO v FROM public.student_portal_events e
   WHERE e.student_id=p_student.id AND e.kind IN ('lesson','workout','form_practice') AND e.created_at>=from_ts AND e.created_at<to_ts;
  WHEN 'quiz_pass' THEN
   SELECT count(*) INTO v FROM public.student_quiz_attempts q
   WHERE q.student_id=p_student.id AND q.created_at>=from_ts AND q.created_at<to_ts AND q.score*10>=q.total*7
    AND (c.subject_type IS DISTINCT FROM 'quiz' OR q.scope||':'||q.scope_ref=c.subject_ref);
  WHEN 'form_mastered' THEN
   SELECT count(*) INTO v FROM public.student_form_progress p
   WHERE p.student_id=p_student.id AND p.status='mastered' AND p.mastered_at>=from_ts AND p.mastered_at<to_ts
    AND (c.subject_type IS DISTINCT FROM 'form' OR p.form_id::text=c.subject_ref);
 END CASE;
 RETURN COALESCE(v,0);
END $$;

-- Points are a personal total, written once per source row.
CREATE OR REPLACE FUNCTION public.lms_add_points(p_student text,p_points integer,p_reason text,p_ref text) RETURNS void
LANGUAGE sql SET search_path='' AS $$
 INSERT INTO public.student_points(student_id,delta,reason,ref) SELECT p_student,p_points,p_reason,p_ref WHERE COALESCE(p_points,0)>0
 ON CONFLICT (student_id,reason,ref) DO NOTHING $$;

-- Awards an achievement once per period, with its points and a notice.
CREATE OR REPLACE FUNCTION public.lms_award(p_student text,p_code text,p_period text,p_evidence jsonb,p_by uuid DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.achievement_definitions; inserted integer;
BEGIN
 SELECT * INTO d FROM public.achievement_definitions WHERE code=p_code;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO public.student_achievements(student_id,code,period,evidence,awarded_by) VALUES(p_student,p_code,COALESCE(p_period,''),p_evidence,p_by) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT;
 IF inserted=0 THEN RETURN false; END IF;
 PERFORM public.lms_add_points(p_student,d.points,'achievement',p_code||':'||COALESCE(p_period,''));
 PERFORM public.lms_notify(p_student,'achievement','achievement:'||p_code||':'||COALESCE(p_period,''),
  public.lms_notice_copy('achievement',jsonb_build_object('title',d.title,'titleKh',d.translations#>>'{km,title}','titleZh',d.translations#>>'{zh,title}')),
  '/achievements',p_code,'achievement');
 RETURN true;
END $$;

-- Achievement rule metrics. Monthly definitions count inside their month.
CREATE OR REPLACE FUNCTION public.lms_rule_met(p_student public.students,p_def public.achievement_definitions,p_period text) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE kind text:=p_def.rule->>'kind'; need integer:=GREATEST(COALESCE((p_def.rule->>'min')::integer,1),1); v integer;
 m_from timestamptz; m_to timestamptz; today date:=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date;
BEGIN
 IF p_def.repeats='monthly' THEN
  m_from:=((p_period||'-01')::date::timestamp AT TIME ZONE 'Asia/Phnom_Penh'); m_to:=(((p_period||'-01')::date+interval '1 month')::timestamp AT TIME ZONE 'Asia/Phnom_Penh');
 END IF;
 CASE kind
  WHEN 'lessons_completed' THEN SELECT count(*) INTO v FROM public.student_portal_progress p WHERE p.student_id=p_student.id AND p.completed AND (m_from IS NULL OR (p.updated_at>=m_from AND p.updated_at<m_to));
  WHEN 'streak_days' THEN v:=CASE WHEN m_from IS NULL THEN public.lms_longest_streak(p_student.id,today-400,today) ELSE public.lms_longest_streak(p_student.id,(m_from AT TIME ZONE 'Asia/Phnom_Penh')::date,(m_to AT TIME ZONE 'Asia/Phnom_Penh')::date-1) END;
  WHEN 'forms_mastered' THEN SELECT count(*) INTO v FROM public.student_form_progress p WHERE p.student_id=p_student.id AND p.status='mastered' AND (m_from IS NULL OR (p.mastered_at>=m_from AND p.mastered_at<m_to));
  WHEN 'sessions_total' THEN SELECT count(*) INTO v FROM public.student_portal_events e WHERE e.student_id=p_student.id AND e.kind IN ('lesson','workout','form_practice') AND (m_from IS NULL OR (e.created_at>=m_from AND e.created_at<m_to));
  WHEN 'quiz_passed' THEN SELECT count(*) INTO v FROM public.student_quiz_attempts q WHERE q.student_id=p_student.id
   AND q.score*100>=q.total*LEAST(GREATEST(COALESCE((p_def.rule->>'percent')::integer,70),1),100) AND (m_from IS NULL OR (q.created_at>=m_from AND q.created_at<m_to));
  WHEN 'challenges_completed' THEN SELECT count(*) INTO v FROM public.student_challenge_progress p WHERE p.student_id=p_student.id AND p.completed_at IS NOT NULL AND (m_from IS NULL OR (p.completed_at>=m_from AND p.completed_at<m_to));
  WHEN 'category_completed' THEN
   -- Every published lesson in the categories that is open to the student's belt, at least one.
   SELECT CASE WHEN count(*)>0 AND bool_and(COALESCE(pr.completed,false)) THEN 1 ELSE 0 END INTO v
   FROM public.library_assets a JOIN public.library_categories cat ON cat.id=a.category_id JOIN public.curriculum c ON c.id=a.student_curriculum_id
   LEFT JOIN public.student_portal_progress pr ON pr.student_id=p_student.id AND pr.curriculum_id=c.id
   WHERE cat.slug IN (SELECT jsonb_array_elements_text(COALESCE(p_def.rule->'categories','[]'::jsonb))) AND c.is_active AND a.content_kind='lesson'
    AND public.lms_belt_allows(c.target_belt,p_student.current_belt);
   need:=1;
  WHEN 'attendance_month' THEN
   -- Present or Late at every dated class on the student's roster that month, at least one.
   SELECT CASE WHEN count(*)>0 AND bool_and(EXISTS(SELECT 1 FROM public.attendance at WHERE at.student_id=p_student.id AND at.occurrence_id=o.id AND at.status IN ('Present','Late'))) THEN 1 ELSE 0 END INTO v
   FROM public.class_occurrence_roster r JOIN public.class_occurrences o ON o.id=r.occurrence_id
   WHERE r.student_id=p_student.id AND o.status IS DISTINCT FROM 'cancelled' AND o.starts_at>=m_from AND o.starts_at<m_to AND o.starts_at<now();
   need:=1;
  ELSE v:=0;
 END CASE;
 RETURN COALESCE(v,0)>=need;
END $$;

-- Recounts challenge progress, completes practice and quiz assignments, and
-- awards achievements and points. Safe to run any number of times.
CREATE OR REPLACE FUNCTION public.student_portal_evaluate_rewards(p_student text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; c public.challenges; d public.achievement_definitions; a public.assignments; sa public.student_assignments;
 today date:=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date; prog integer; v_period text; met boolean; done_count integer:=0; challenge_count integer:=0;
 awarded text[]:='{}'; reps integer; sessions integer; best integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 SELECT * INTO st FROM public.students WHERE id=p_student AND deleted_at IS NULL;
 IF NOT FOUND THEN RETURN NULL; END IF;
 -- 1. Challenges running today that reach this student.
 FOR c IN SELECT * FROM public.challenges WHERE status='published' AND starts_on<=today AND ends_on>=today LOOP
  CONTINUE WHEN NOT public.lms_student_in_audience(st,c.audience);
  CONTINUE WHEN EXISTS(SELECT 1 FROM public.student_challenge_progress WHERE challenge_id=c.id AND student_id=st.id AND completed_at IS NOT NULL);
  prog:=public.lms_challenge_progress(st,c);
  INSERT INTO public.student_challenge_progress(challenge_id,student_id,progress,completed_at)
  VALUES(c.id,st.id,prog,CASE WHEN prog>=c.goal_target THEN now() END)
  ON CONFLICT (challenge_id,student_id) DO UPDATE SET progress=EXCLUDED.progress,completed_at=EXCLUDED.completed_at,updated_at=now();
  IF prog>=c.goal_target THEN
   challenge_count:=challenge_count+1;
   PERFORM public.lms_add_points(st.id,c.points,'challenge',c.id::text);
   IF c.badge_code IS NOT NULL THEN
    SELECT * INTO d FROM public.achievement_definitions WHERE code=c.badge_code;
    v_period:=CASE d.repeats WHEN 'monthly' THEN to_char(today,'YYYY-MM') WHEN 'per_belt' THEN st.current_belt ELSE '' END;
    IF public.lms_award(st.id,c.badge_code,v_period,jsonb_build_object('challengeId',c.id,'title',c.title)) THEN awarded:=awarded||c.badge_code; END IF;
   END IF;
  END IF;
 END LOOP;
 -- 2. Practice and quiz assignments that are now met.
 FOR sa IN SELECT x.* FROM public.student_assignments x JOIN public.assignments y ON y.id=x.assignment_id
  WHERE x.student_id=st.id AND x.status IN ('open','in_progress') AND y.status='published' AND y.kind IN ('practice','quiz') LOOP
  SELECT * INTO a FROM public.assignments WHERE id=sa.assignment_id;
  IF a.kind='practice' THEN
   reps:=COALESCE((sa.progress->>'reps')::integer,0); sessions:=COALESCE((sa.progress->>'sessions')::integer,0);
   met:=(a.target ? 'reps' AND reps>=(a.target->>'reps')::integer) OR (a.target ? 'sessions' AND sessions>=(a.target->>'sessions')::integer);
  ELSE
   SELECT max(round(100.0*q.score/q.total))::integer INTO best FROM public.student_quiz_attempts q
   WHERE q.student_id=st.id AND q.scope=a.target->>'scope' AND q.scope_ref=a.target->>'scopeRef' AND q.created_at>=COALESCE(a.published_at,a.created_at);
   met:=COALESCE(best,-1)>=COALESCE((a.target->>'passPercent')::integer,70);
   IF best IS NOT NULL THEN UPDATE public.student_assignments SET progress=jsonb_build_object('bestPercent',best),status=CASE WHEN status='open' THEN 'in_progress' ELSE status END,updated_at=now()
    WHERE assignment_id=a.id AND student_id=st.id; END IF;
  END IF;
  IF COALESCE(met,false) THEN
   UPDATE public.student_assignments SET status='done',done_at=now(),updated_at=now() WHERE assignment_id=a.id AND student_id=st.id;
   PERFORM public.lms_add_points(st.id,a.points,'assignment',a.id::text);
   done_count:=done_count+1;
  END IF;
 END LOOP;
 -- 3. Automatic achievements ('manual' ones are coach sign-offs).
 FOR d IN SELECT * FROM public.achievement_definitions WHERE active AND rule->>'kind'<>'manual' ORDER BY sort_order LOOP
  v_period:=CASE d.repeats WHEN 'monthly' THEN CASE WHEN d.rule->>'kind'='attendance_month' THEN to_char(today-interval '1 month','YYYY-MM') ELSE to_char(today,'YYYY-MM') END
   WHEN 'per_belt' THEN st.current_belt ELSE '' END;
  CONTINUE WHEN EXISTS(SELECT 1 FROM public.student_achievements WHERE student_id=st.id AND code=d.code AND student_achievements.period=v_period);
  IF public.lms_rule_met(st,d,v_period) AND public.lms_award(st.id,d.code,v_period,jsonb_build_object('rule',d.rule)) THEN awarded:=awarded||d.code; END IF;
 END LOOP;
 RETURN jsonb_build_object('studentId',st.id,'challengesCompleted',challenge_count,'assignmentsDone',done_count,'achievements',to_jsonb(awarded),
  'points',(SELECT COALESCE(sum(delta),0) FROM public.student_points WHERE student_id=st.id));
END $$;

-- ===========================================================================
-- 5. Staff: assignments, challenges, reviews, achievements, consent
--    (Coaches and above: action:curriculum_edit, checked here)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.lms_check_targets(p_targets jsonb) RETURNS void
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE t jsonb; kind text; ref text;
BEGIN
 IF jsonb_typeof(p_targets) IS DISTINCT FROM 'array' OR jsonb_array_length(p_targets) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Choose who gets this assignment' USING ERRCODE='22023'; END IF;
 FOR t IN SELECT value FROM jsonb_array_elements(p_targets) LOOP
  kind:=t->>'type'; ref:=COALESCE(t->>'ref','');
  IF kind='all' AND ref='' THEN CONTINUE;
  ELSIF kind='student' AND EXISTS(SELECT 1 FROM public.students WHERE id=ref AND deleted_at IS NULL) THEN CONTINUE;
  ELSIF kind='class' AND ref ~ '^[0-9]{1,9}$' AND EXISTS(SELECT 1 FROM public.class_sessions WHERE id=ref::integer) THEN CONTINUE;
  ELSIF kind='belt' AND EXISTS(SELECT 1 FROM public.belts WHERE belt_name=ref) THEN CONTINUE;
  ELSIF kind='branch' AND ref ~ '^[0-9]{1,9}$' AND EXISTS(SELECT 1 FROM public.branches WHERE id=ref::integer) THEN CONTINUE;
  END IF;
  RAISE EXCEPTION 'A target is no longer available: % %',kind,ref USING ERRCODE='22023';
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.lms_check_subject(p_type text,p_ref text) RETURNS void
LANGUAGE plpgsql STABLE SET search_path='' AS $$
BEGIN
 IF p_type IS NULL AND p_ref IS NULL THEN RETURN; END IF;
 IF p_type='lesson' AND p_ref ~ '^[0-9]{1,9}$' AND EXISTS(SELECT 1 FROM public.curriculum WHERE id=p_ref::integer) THEN RETURN; END IF;
 IF p_type='form' AND EXISTS(SELECT 1 FROM public.poomsae_forms WHERE id::text=p_ref) THEN RETURN; END IF;
 IF p_type='quiz' AND split_part(p_ref,':',1) IN ('form','lesson','belt','terminology') AND length(split_part(p_ref,':',2))>0 THEN RETURN; END IF;
 RAISE EXCEPTION 'Choose a published lesson or a registered form' USING ERRCODE='22023';
END $$;

CREATE OR REPLACE FUNCTION public.portal_save_assignment(p_actor uuid,p_action text,p_id uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.assignments; t jsonb; added integer:=0; v_kind text; v_target jsonb; item jsonb;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 IF p_action IS NULL OR p_action NOT IN ('CREATE','UPDATE','PUBLISH','CLOSE','REOPEN','DELETE') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid assignment request' USING ERRCODE='22023'; END IF;
 IF p_action<>'CREATE' THEN
  SELECT * INTO a FROM public.assignments WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found' USING ERRCODE='P0002'; END IF;
  IF a.revision IS DISTINCT FROM (p_payload->>'expectedRevision')::integer THEN RAISE EXCEPTION 'This assignment changed. Reload before saving' USING ERRCODE='40001'; END IF;
 END IF;
 IF p_action IN ('CREATE','UPDATE') THEN
  v_kind:=p_payload->>'kind'; v_target:=COALESCE(p_payload->'target','{}'::jsonb);
  IF v_kind IS NULL OR v_kind NOT IN ('practice','video','written','quiz','form') THEN RAISE EXCEPTION 'Choose the kind of assignment' USING ERRCODE='22023'; END IF;
  IF p_action='UPDATE' AND a.status<>'draft' AND v_kind<>a.kind THEN RAISE EXCEPTION 'A published assignment keeps its kind' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(v_target)<>'object' THEN RAISE EXCEPTION 'Invalid target' USING ERRCODE='22023'; END IF;
  IF v_kind='practice' AND NOT ((v_target ? 'reps' AND (v_target->>'reps') ~ '^[0-9]{1,6}$' AND (v_target->>'reps')::integer BETWEEN 1 AND 100000)
   OR (v_target ? 'sessions' AND (v_target->>'sessions') ~ '^[0-9]{1,3}$' AND (v_target->>'sessions')::integer BETWEEN 1 AND 100)) THEN
   RAISE EXCEPTION 'Set the reps or sessions to reach' USING ERRCODE='22023'; END IF;
  IF v_kind='quiz' AND NOT (v_target->>'scope' IN ('form','lesson','belt','terminology') AND length(COALESCE(v_target->>'scopeRef',''))>0
   AND COALESCE(v_target->>'passPercent','70') ~ '^[0-9]{1,3}$' AND COALESCE((v_target->>'passPercent')::integer,70) BETWEEN 1 AND 100) THEN
   RAISE EXCEPTION 'Choose the quiz and the pass mark' USING ERRCODE='22023'; END IF;
  IF v_kind='form' AND p_payload->>'subjectType' IS DISTINCT FROM 'form' THEN RAISE EXCEPTION 'Choose the form to perform' USING ERRCODE='22023'; END IF;
  PERFORM public.lms_check_subject(p_payload->>'subjectType',NULLIF(p_payload->>'subjectRef',''));
  IF jsonb_typeof(COALESCE(p_payload->'rubric','[]'::jsonb))<>'array' OR jsonb_array_length(COALESCE(p_payload->'rubric','[]'::jsonb))>20 THEN RAISE EXCEPTION 'Up to 20 rubric items' USING ERRCODE='22023'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'rubric','[]'::jsonb)) LOOP
   IF jsonb_typeof(item)<>'object' OR length(btrim(COALESCE(item->>'item','')))NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Name each rubric item' USING ERRCODE='22023'; END IF;
  END LOOP;
  PERFORM public.lms_check_targets(p_payload->'targets');
  IF jsonb_typeof(COALESCE(p_payload->'translations','{}'::jsonb))<>'object' THEN RAISE EXCEPTION 'Invalid translations' USING ERRCODE='22023'; END IF;
  IF p_action='CREATE' THEN
   INSERT INTO public.assignments(title,instructions,kind,subject_type,subject_ref,target,due_at,points,rubric,translations,created_by,updated_by)
   VALUES(btrim(p_payload->>'title'),btrim(p_payload->>'instructions'),v_kind,p_payload->>'subjectType',NULLIF(p_payload->>'subjectRef',''),v_target,
    NULLIF(p_payload->>'dueAt','')::timestamptz,COALESCE((p_payload->>'points')::smallint,0),COALESCE(p_payload->'rubric','[]'::jsonb),COALESCE(p_payload->'translations','{}'::jsonb),p_actor,p_actor) RETURNING * INTO a;
  ELSE
   UPDATE public.assignments SET title=btrim(p_payload->>'title'),instructions=btrim(p_payload->>'instructions'),kind=v_kind,subject_type=p_payload->>'subjectType',
    subject_ref=NULLIF(p_payload->>'subjectRef',''),target=v_target,due_at=NULLIF(p_payload->>'dueAt','')::timestamptz,points=COALESCE((p_payload->>'points')::smallint,0),
    rubric=COALESCE(p_payload->'rubric','[]'::jsonb),translations=COALESCE(p_payload->'translations','{}'::jsonb),revision=revision+1,updated_by=p_actor,updated_at=now()
   WHERE id=a.id RETURNING * INTO a;
  END IF;
  DELETE FROM public.assignment_targets WHERE assignment_id=a.id;
  INSERT INTO public.assignment_targets(assignment_id,target_type,target_ref)
  SELECT DISTINCT a.id,x->>'type',COALESCE(x->>'ref','') FROM jsonb_array_elements(p_payload->'targets') x;
  IF a.status='published' THEN added:=public.lms_assignment_fanout(a.id); END IF;
 ELSIF p_action='PUBLISH' THEN
  IF a.status<>'draft' THEN RAISE EXCEPTION 'Only a draft can be published' USING ERRCODE='22023'; END IF;
  IF a.due_at IS NOT NULL AND a.due_at<=now() THEN RAISE EXCEPTION 'Move the due date into the future before publishing' USING ERRCODE='22023'; END IF;
  UPDATE public.assignments SET status='published',published_at=now(),revision=revision+1,updated_by=p_actor,updated_at=now() WHERE id=a.id RETURNING * INTO a;
  added:=public.lms_assignment_fanout(a.id);
 ELSIF p_action='CLOSE' THEN
  IF a.status<>'published' THEN RAISE EXCEPTION 'Only a published assignment can be closed' USING ERRCODE='22023'; END IF;
  UPDATE public.assignments SET status='closed',closed_at=now(),revision=revision+1,updated_by=p_actor,updated_at=now() WHERE id=a.id RETURNING * INTO a;
 ELSIF p_action='REOPEN' THEN
  IF a.status<>'closed' THEN RAISE EXCEPTION 'Only a closed assignment can be reopened' USING ERRCODE='22023'; END IF;
  UPDATE public.assignments SET status='published',closed_at=NULL,revision=revision+1,updated_by=p_actor,updated_at=now() WHERE id=a.id RETURNING * INTO a;
  added:=public.lms_assignment_fanout(a.id);
 ELSE
  IF EXISTS(SELECT 1 FROM public.student_submissions WHERE assignment_id=a.id) OR EXISTS(SELECT 1 FROM public.student_assignments WHERE assignment_id=a.id AND (status<>'open' OR progress<>'{}'::jsonb)) THEN
   RAISE EXCEPTION 'Students have already started this assignment. Close it instead' USING ERRCODE='23503'; END IF;
  DELETE FROM public.assignments WHERE id=a.id;
  INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_ASSIGNMENT_DELETE',p_actor::text,a.id::text,jsonb_build_object('title',a.title));
  RETURN jsonb_build_object('deleted',a.id);
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_ASSIGNMENT_'||p_action,p_actor::text,a.id::text,jsonb_build_object('title',a.title,'status',a.status,'revision',a.revision,'studentsAdded',added));
 RETURN to_jsonb(a)||jsonb_build_object('studentsAdded',added,'students',(SELECT count(*) FROM public.student_assignments WHERE assignment_id=a.id));
END $$;

CREATE OR REPLACE FUNCTION public.portal_set_student_assignment(p_actor uuid,p_assignment uuid,p_student text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sa public.student_assignments; a public.assignments; v_status text:=p_payload->>'status';
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 IF v_status IS NULL OR v_status NOT IN ('done','excused','open') OR length(COALESCE(p_payload->>'note',''))>500 THEN RAISE EXCEPTION 'Choose done, excused or open' USING ERRCODE='22023'; END IF;
 SELECT * INTO sa FROM public.student_assignments WHERE assignment_id=p_assignment AND student_id=p_student FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This student does not have the assignment' USING ERRCODE='P0002'; END IF;
 SELECT * INTO a FROM public.assignments WHERE id=p_assignment;
 UPDATE public.student_assignments SET status=v_status,done_at=CASE WHEN v_status='done' THEN COALESCE(done_at,now()) END,
  note=NULLIF(btrim(COALESCE(p_payload->>'note','')),''),updated_by=p_actor,updated_at=now()
 WHERE assignment_id=p_assignment AND student_id=p_student RETURNING * INTO sa;
 IF v_status='done' THEN PERFORM public.lms_add_points(p_student,a.points,'assignment',a.id::text);
 ELSE DELETE FROM public.student_points WHERE student_id=p_student AND reason='assignment' AND ref=a.id::text; END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_ASSIGNMENT_STUDENT',p_actor::text,p_student,jsonb_build_object('assignmentId',a.id,'status',v_status));
 RETURN to_jsonb(sa);
END $$;

CREATE OR REPLACE FUNCTION public.portal_save_challenge(p_actor uuid,p_action text,p_id uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.challenges; kind text; subject text; ref text; key text;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 IF p_action IS NULL OR p_action NOT IN ('CREATE','UPDATE','PUBLISH','CLOSE','DELETE') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid challenge request' USING ERRCODE='22023'; END IF;
 IF p_action<>'CREATE' THEN
  SELECT * INTO c FROM public.challenges WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found' USING ERRCODE='P0002'; END IF;
  IF c.revision IS DISTINCT FROM (p_payload->>'expectedRevision')::integer THEN RAISE EXCEPTION 'This challenge changed. Reload before saving' USING ERRCODE='40001'; END IF;
 END IF;
 IF p_action IN ('CREATE','UPDATE') THEN
  kind:=p_payload->>'goalKind'; subject:=p_payload->>'subjectType'; ref:=NULLIF(p_payload->>'subjectRef','');
  IF kind IS NULL OR kind NOT IN ('reps','sessions','streak_days','minutes','quiz_pass','form_mastered') THEN RAISE EXCEPTION 'Choose what the challenge counts' USING ERRCODE='22023'; END IF;
  IF p_action='UPDATE' AND c.status<>'draft' AND (kind<>c.goal_kind OR (p_payload->>'goalTarget')::integer<>c.goal_target) THEN RAISE EXCEPTION 'A published challenge keeps its goal' USING ERRCODE='22023'; END IF;
  IF (subject='lesson' AND kind NOT IN ('reps','sessions','streak_days')) OR (subject='form' AND kind<>'form_mastered') OR (subject='quiz' AND kind<>'quiz_pass') THEN
   RAISE EXCEPTION 'This goal cannot be limited to that subject' USING ERRCODE='22023'; END IF;
  PERFORM public.lms_check_subject(subject,ref);
  IF jsonb_typeof(COALESCE(p_payload->'audience','{"all":true}'::jsonb))<>'object' THEN RAISE EXCEPTION 'Choose who takes part' USING ERRCODE='22023'; END IF;
  FOR key IN SELECT jsonb_object_keys(COALESCE(p_payload->'audience','{"all":true}'::jsonb)) LOOP
   IF key NOT IN ('all','belts','branches','classes','students') THEN RAISE EXCEPTION 'Choose who takes part' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF p_payload->>'badgeCode' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.achievement_definitions WHERE code=p_payload->>'badgeCode') THEN RAISE EXCEPTION 'Choose a badge from the catalogue' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(COALESCE(p_payload->'translations','{}'::jsonb))<>'object' THEN RAISE EXCEPTION 'Invalid translations' USING ERRCODE='22023'; END IF;
  IF p_action='CREATE' THEN
   INSERT INTO public.challenges(title,description,goal_kind,goal_target,subject_type,subject_ref,starts_on,ends_on,audience,points,badge_code,translations,created_by,updated_by)
   VALUES(btrim(p_payload->>'title'),NULLIF(btrim(COALESCE(p_payload->>'description','')),''),kind,(p_payload->>'goalTarget')::integer,subject,ref,
    (p_payload->>'startsOn')::date,(p_payload->>'endsOn')::date,COALESCE(p_payload->'audience','{"all":true}'::jsonb),COALESCE((p_payload->>'points')::smallint,0),
    p_payload->>'badgeCode',COALESCE(p_payload->'translations','{}'::jsonb),p_actor,p_actor) RETURNING * INTO c;
  ELSE
   UPDATE public.challenges SET title=btrim(p_payload->>'title'),description=NULLIF(btrim(COALESCE(p_payload->>'description','')),''),goal_kind=kind,
    goal_target=(p_payload->>'goalTarget')::integer,subject_type=subject,subject_ref=ref,starts_on=(p_payload->>'startsOn')::date,ends_on=(p_payload->>'endsOn')::date,
    audience=COALESCE(p_payload->'audience','{"all":true}'::jsonb),points=COALESCE((p_payload->>'points')::smallint,0),badge_code=p_payload->>'badgeCode',
    translations=COALESCE(p_payload->'translations','{}'::jsonb),revision=revision+1,updated_by=p_actor,updated_at=now() WHERE id=c.id RETURNING * INTO c;
  END IF;
 ELSIF p_action='PUBLISH' THEN
  IF c.status<>'draft' THEN RAISE EXCEPTION 'Only a draft can be published' USING ERRCODE='22023'; END IF;
  IF c.ends_on<(now() AT TIME ZONE 'Asia/Phnom_Penh')::date THEN RAISE EXCEPTION 'This challenge has already ended' USING ERRCODE='22023'; END IF;
  UPDATE public.challenges SET status='published',published_at=now(),revision=revision+1,updated_by=p_actor,updated_at=now() WHERE id=c.id RETURNING * INTO c;
 ELSIF p_action='CLOSE' THEN
  IF c.status<>'published' THEN RAISE EXCEPTION 'Only a published challenge can be closed' USING ERRCODE='22023'; END IF;
  UPDATE public.challenges SET status='closed',revision=revision+1,updated_by=p_actor,updated_at=now() WHERE id=c.id RETURNING * INTO c;
 ELSE
  IF EXISTS(SELECT 1 FROM public.student_challenge_progress WHERE challenge_id=c.id AND progress>0) THEN RAISE EXCEPTION 'Students have progress on this challenge. Close it instead' USING ERRCODE='23503'; END IF;
  DELETE FROM public.challenges WHERE id=c.id;
  INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_CHALLENGE_DELETE',p_actor::text,c.id::text,jsonb_build_object('title',c.title));
  RETURN jsonb_build_object('deleted',c.id);
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_CHALLENGE_'||p_action,p_actor::text,c.id::text,jsonb_build_object('title',c.title,'status',c.status,'revision',c.revision));
 RETURN to_jsonb(c);
END $$;

-- Coach review of a form: only a coach marks a form mastered.
CREATE OR REPLACE FUNCTION public.portal_review_form(p_actor uuid,p_student text,p_form uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; f public.poomsae_forms; decision text:=p_payload->>'decision'; note text:=NULLIF(btrim(COALESCE(p_payload->>'note','')),''); p public.student_form_progress;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 IF decision IS NULL OR decision NOT IN ('mastered','practising','learning') OR length(COALESCE(note,''))>1000 THEN RAISE EXCEPTION 'Choose mastered, keep practising or still learning' USING ERRCODE='22023'; END IF;
 st:=public.lms_staff_student(p_student);
 SELECT * INTO f FROM public.poomsae_forms WHERE id=p_form;
 IF NOT FOUND THEN RAISE EXCEPTION 'Form not found' USING ERRCODE='P0002'; END IF;
 INSERT INTO public.student_form_progress(student_id,form_id,status,reviewed_by,reviewed_at,review_note,mastered_by,mastered_at)
 VALUES(st.id,f.id,decision,p_actor,now(),note,CASE WHEN decision='mastered' THEN p_actor END,CASE WHEN decision='mastered' THEN now() END)
 ON CONFLICT (student_id,form_id) DO UPDATE SET status=EXCLUDED.status,reviewed_by=EXCLUDED.reviewed_by,reviewed_at=EXCLUDED.reviewed_at,review_note=EXCLUDED.review_note,
  mastered_by=CASE WHEN EXCLUDED.status='mastered' THEN COALESCE(student_form_progress.mastered_by,EXCLUDED.mastered_by) END,
  mastered_at=CASE WHEN EXCLUDED.status='mastered' THEN COALESCE(student_form_progress.mastered_at,EXCLUDED.mastered_at) END,updated_at=now()
 RETURNING * INTO p;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_FORM_REVIEW',p_actor::text,st.id,jsonb_build_object('formId',f.id,'decision',decision));
 PERFORM public.lms_notify(st.id,'feedback','form_review:'||f.id||':'||extract(epoch FROM p.reviewed_at)::bigint,public.lms_notice_copy('feedback'),'/forms',f.id::text,'form_review');
 PERFORM public.student_portal_evaluate_rewards(st.id);
 RETURN to_jsonb(p);
END $$;

CREATE OR REPLACE FUNCTION public.portal_review_submission(p_actor uuid,p_submission uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.student_submissions; r public.submission_reviews; a public.assignments; decision text:=COALESCE(p_payload->>'decision','accepted'); item jsonb;
 visible boolean:=COALESCE((p_payload->>'visibleToStudent')::boolean,true); today date:=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 IF decision NOT IN ('accepted','returned') THEN RAISE EXCEPTION 'Choose accept or return' USING ERRCODE='22023'; END IF;
 IF p_payload->>'grade' IS NOT NULL AND p_payload->>'grade' NOT IN ('Needs Work','Developing','Proficient','Outstanding') THEN RAISE EXCEPTION 'Use the 4-level grade scale' USING ERRCODE='22023'; END IF;
 IF length(COALESCE(p_payload->>'feedback',''))>4000 THEN RAISE EXCEPTION 'Keep feedback under 4000 characters' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(COALESCE(p_payload->'rubric','[]'::jsonb))<>'array' OR jsonb_array_length(COALESCE(p_payload->'rubric','[]'::jsonb))>20 THEN RAISE EXCEPTION 'Up to 20 rubric lines' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'rubric','[]'::jsonb)) LOOP
  IF jsonb_typeof(item)<>'object' OR length(btrim(COALESCE(item->>'item',''))) NOT BETWEEN 1 AND 120 OR length(COALESCE(item->>'note',''))>500
   OR (item->>'grade' IS NOT NULL AND item->>'grade' NOT IN ('Needs Work','Developing','Proficient','Outstanding')) THEN RAISE EXCEPTION 'Check each rubric line' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF jsonb_typeof(COALESCE(p_payload->'moments','[]'::jsonb))<>'array' OR jsonb_array_length(COALESCE(p_payload->'moments','[]'::jsonb))>50 THEN RAISE EXCEPTION 'Up to 50 timed notes' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'moments','[]'::jsonb)) LOOP
  IF jsonb_typeof(item)<>'object' OR jsonb_typeof(item->'second')<>'number' OR (item->>'second')::numeric NOT BETWEEN 0 AND 600 OR length(btrim(COALESCE(item->>'note',''))) NOT BETWEEN 1 AND 500 THEN
   RAISE EXCEPTION 'Each timed note needs a time and a note' USING ERRCODE='22023'; END IF;
 END LOOP;
 SELECT * INTO s FROM public.student_submissions WHERE id=p_submission FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found' USING ERRCODE='P0002'; END IF;
 IF s.status NOT IN ('submitted','reviewed','returned') THEN RAISE EXCEPTION 'This submission cannot be reviewed now' USING ERRCODE='22023'; END IF;
 INSERT INTO public.submission_reviews(submission_id,reviewer_id,decision,grade,rubric,feedback,moments,visible_to_student)
 VALUES(s.id,p_actor,decision,p_payload->>'grade',COALESCE(p_payload->'rubric','[]'::jsonb),NULLIF(btrim(COALESCE(p_payload->>'feedback','')),''),COALESCE(p_payload->'moments','[]'::jsonb),visible) RETURNING * INTO r;
 UPDATE public.student_submissions SET status=CASE WHEN decision='returned' THEN 'returned' ELSE 'reviewed' END,reviewed_at=now(),
  delete_video_after=CASE WHEN video_path IS NOT NULL THEN today+90 END,updated_at=now() WHERE id=s.id RETURNING * INTO s;
 IF s.assignment_id IS NOT NULL THEN
  SELECT * INTO a FROM public.assignments WHERE id=s.assignment_id;
  UPDATE public.student_assignments SET status=CASE WHEN decision='accepted' THEN 'done' ELSE 'open' END,done_at=CASE WHEN decision='accepted' THEN COALESCE(done_at,now()) END,updated_by=p_actor,updated_at=now()
  WHERE assignment_id=a.id AND student_id=s.student_id AND status NOT IN ('excused');
  IF decision='accepted' THEN PERFORM public.lms_add_points(s.student_id,a.points,'assignment',a.id::text); END IF;
 END IF;
 IF visible THEN PERFORM public.lms_notify(s.student_id,'feedback','feedback:'||r.id,public.lms_notice_copy('feedback'),'/feedback',s.id::text,'submission_review'); END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_SUBMISSION_REVIEW',p_actor::text,s.student_id,jsonb_build_object('submissionId',s.id,'reviewId',r.id,'decision',decision,'grade',r.grade));
 RETURN jsonb_build_object('submission',to_jsonb(s),'review',to_jsonb(r));
END $$;

CREATE OR REPLACE FUNCTION public.portal_save_achievement_definition(p_actor uuid,p_action text,p_code text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.achievement_definitions; v_rule jsonb:=p_payload->'rule';
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 IF p_action IS NULL OR p_action NOT IN ('CREATE','UPDATE','DELETE') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid achievement request' USING ERRCODE='22023'; END IF;
 IF p_action<>'CREATE' THEN
  SELECT * INTO d FROM public.achievement_definitions WHERE code=p_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Achievement not found' USING ERRCODE='P0002'; END IF;
  IF d.revision IS DISTINCT FROM (p_payload->>'expectedRevision')::integer THEN RAISE EXCEPTION 'This achievement changed. Reload before saving' USING ERRCODE='40001'; END IF;
 END IF;
 IF p_action='DELETE' THEN
  IF EXISTS(SELECT 1 FROM public.student_achievements WHERE code=d.code) OR EXISTS(SELECT 1 FROM public.challenges WHERE badge_code=d.code) THEN
   RAISE EXCEPTION 'Students have earned this achievement or a challenge uses it. Turn it off instead' USING ERRCODE='23503'; END IF;
  DELETE FROM public.achievement_definitions WHERE code=d.code;
  INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_ACHIEVEMENT_DELETE',p_actor::text,d.code,'{}'::jsonb);
  RETURN jsonb_build_object('deleted',d.code);
 END IF;
 IF jsonb_typeof(v_rule) IS DISTINCT FROM 'object' OR v_rule->>'kind' IS NULL THEN RAISE EXCEPTION 'Choose how the achievement is earned' USING ERRCODE='22023'; END IF;
 IF v_rule ? 'min' AND NOT (v_rule->>'min' ~ '^[0-9]{1,6}$' AND (v_rule->>'min')::integer BETWEEN 1 AND 100000) THEN RAISE EXCEPTION 'Choose a whole-number minimum' USING ERRCODE='22023'; END IF;
 IF v_rule->>'kind'='category_completed' AND NOT (jsonb_typeof(v_rule->'categories')='array' AND jsonb_array_length(v_rule->'categories') BETWEEN 1 AND 20
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_rule->'categories') x WHERE NOT EXISTS(SELECT 1 FROM public.library_categories WHERE slug=x))) THEN
  RAISE EXCEPTION 'Choose the library categories to complete' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(COALESCE(p_payload->'translations','{}'::jsonb))<>'object' THEN RAISE EXCEPTION 'Invalid translations' USING ERRCODE='22023'; END IF;
 IF p_action='CREATE' THEN
  INSERT INTO public.achievement_definitions(code,title,description,icon,rule,points,repeats,translations,sort_order,active,created_by,updated_by)
  VALUES(p_code,btrim(p_payload->>'title'),btrim(p_payload->>'description'),p_payload->>'icon',v_rule,COALESCE((p_payload->>'points')::smallint,0),COALESCE(p_payload->>'repeats','once'),
   COALESCE(p_payload->'translations','{}'::jsonb),LEAST(100000,COALESCE((SELECT max(sort_order) FROM public.achievement_definitions),0)+10),COALESCE((p_payload->>'active')::boolean,true),p_actor,p_actor)
  RETURNING * INTO d;
 ELSE
  UPDATE public.achievement_definitions SET title=btrim(p_payload->>'title'),description=btrim(p_payload->>'description'),icon=p_payload->>'icon',rule=v_rule,
   points=COALESCE((p_payload->>'points')::smallint,0),repeats=COALESCE(p_payload->>'repeats','once'),translations=COALESCE(p_payload->'translations','{}'::jsonb),
   active=COALESCE((p_payload->>'active')::boolean,true),revision=revision+1,updated_by=p_actor,updated_at=now() WHERE code=d.code RETURNING * INTO d;
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_ACHIEVEMENT_'||p_action,p_actor::text,d.code,jsonb_build_object('active',d.active,'revision',d.revision));
 RETURN to_jsonb(d);
END $$;

-- Coach sign-off ("Belt Exam Ready") and corrections. A per-belt award defaults
-- to the student's next belt.
CREATE OR REPLACE FUNCTION public.portal_award_achievement(p_actor uuid,p_action text,p_student text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; d public.achievement_definitions; v_period text; note text:=NULLIF(btrim(COALESCE(p_payload->>'note','')),''); next_b public.belts; done boolean;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 IF p_action IS NULL OR p_action NOT IN ('AWARD','REVOKE') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR length(COALESCE(note,''))>500 THEN RAISE EXCEPTION 'Invalid award request' USING ERRCODE='22023'; END IF;
 st:=public.lms_staff_student(p_student);
 SELECT * INTO d FROM public.achievement_definitions WHERE code=p_payload->>'code';
 IF NOT FOUND THEN RAISE EXCEPTION 'Achievement not found' USING ERRCODE='P0002'; END IF;
 v_period:=NULLIF(btrim(COALESCE(p_payload->>'period','')),'');
 IF v_period IS NULL THEN
  IF d.repeats='per_belt' THEN
   SELECT * INTO next_b FROM public.belts WHERE belt_order=(public.lms_belt_named(st.current_belt)).belt_order+1;
   v_period:=COALESCE(next_b.belt_name,st.current_belt);
  ELSIF d.repeats='monthly' THEN v_period:=to_char(now() AT TIME ZONE 'Asia/Phnom_Penh','YYYY-MM');
  ELSE v_period:=''; END IF;
 END IF;
 IF p_action='AWARD' THEN
  IF NOT d.active THEN RAISE EXCEPTION 'Turn this achievement on before awarding it' USING ERRCODE='22023'; END IF;
  done:=public.lms_award(st.id,d.code,v_period,jsonb_build_object('note',note,'signedOff',true),p_actor);
  IF NOT done THEN RAISE EXCEPTION 'The student already has this achievement for %',CASE WHEN v_period='' THEN 'good' ELSE v_period END USING ERRCODE='23505'; END IF;
 ELSE
  DELETE FROM public.student_achievements WHERE student_id=st.id AND code=d.code AND student_achievements.period=v_period;
  IF NOT FOUND THEN RAISE EXCEPTION 'The student does not have this achievement' USING ERRCODE='P0002'; END IF;
  DELETE FROM public.student_points WHERE student_id=st.id AND reason='achievement' AND ref=d.code||':'||v_period;
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_ACHIEVEMENT_'||p_action,p_actor::text,st.id,jsonb_build_object('code',d.code,'period',v_period,'note',note));
 RETURN jsonb_build_object('studentId',st.id,'code',d.code,'period',v_period,'awarded',p_action='AWARD');
END $$;

-- Staff record a guardian's consent given on paper, or withdraw consent.
CREATE OR REPLACE FUNCTION public.portal_record_video_consent(p_actor uuid,p_student text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; c public.student_video_consents;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 st:=public.lms_staff_student(p_student);
 IF COALESCE((p_payload->>'revoke')::boolean,false) THEN
  UPDATE public.student_video_consents SET revoked_at=now() WHERE student_id=st.id AND revoked_at IS NULL RETURNING * INTO c;
  IF NOT FOUND THEN RAISE EXCEPTION 'There is no active consent to withdraw' USING ERRCODE='P0002'; END IF;
 ELSE
  IF length(btrim(COALESCE(p_payload->>'guardianName',''))) NOT BETWEEN 2 AND 120 OR COALESCE(p_payload->>'relationship','') NOT IN ('parent','guardian','self') THEN
   RAISE EXCEPTION 'Enter who gave consent and their relationship' USING ERRCODE='22023'; END IF;
  IF p_payload->>'relationship'='self' AND age((now() AT TIME ZONE 'Asia/Phnom_Penh')::date,st.dob)<interval '18 years' THEN RAISE EXCEPTION 'A guardian gives consent for students under 18' USING ERRCODE='22023'; END IF;
  INSERT INTO public.student_video_consents(student_id,guardian_name,relationship,source,consented_by,recorded_by,consented_at,revoked_at)
  VALUES(st.id,btrim(p_payload->>'guardianName'),p_payload->>'relationship','staff',NULL,p_actor,now(),NULL)
  ON CONFLICT (student_id) DO UPDATE SET guardian_name=EXCLUDED.guardian_name,relationship=EXCLUDED.relationship,source='staff',consented_by=NULL,recorded_by=p_actor,consented_at=now(),revoked_at=NULL
  RETURNING * INTO c;
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_VIDEO_CONSENT',p_actor::text,st.id,jsonb_build_object('source','staff','revoked',c.revoked_at IS NOT NULL));
 RETURN to_jsonb(c);
END $$;

-- ===========================================================================
-- 6. Student writes (server only; the student portal's server passes the
--    signed-in account and student after checking the session)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.student_portal_video_consent(p_actor uuid,p_student text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; c public.student_video_consents;
BEGIN
 st:=public.student_portal_assert_student(p_actor,p_student);
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid consent' USING ERRCODE='22023'; END IF;
 IF COALESCE((p_payload->>'agree')::boolean,false) THEN
  IF length(btrim(COALESCE(p_payload->>'guardianName',''))) NOT BETWEEN 2 AND 120 OR COALESCE(p_payload->>'relationship','') NOT IN ('parent','guardian','self') THEN
   RAISE EXCEPTION 'Enter your name and how you are related to the student' USING ERRCODE='22023'; END IF;
  IF p_payload->>'relationship'='self' AND age((now() AT TIME ZONE 'Asia/Phnom_Penh')::date,st.dob)<interval '18 years' THEN RAISE EXCEPTION 'A parent or guardian must agree for students under 18' USING ERRCODE='22023'; END IF;
  INSERT INTO public.student_video_consents(student_id,guardian_name,relationship,source,consented_by,recorded_by,consented_at,revoked_at)
  VALUES(st.id,btrim(p_payload->>'guardianName'),p_payload->>'relationship','portal',p_actor,NULL,now(),NULL)
  ON CONFLICT (student_id) DO UPDATE SET guardian_name=EXCLUDED.guardian_name,relationship=EXCLUDED.relationship,source='portal',consented_by=p_actor,recorded_by=NULL,consented_at=now(),revoked_at=NULL
  RETURNING * INTO c;
 ELSE
  UPDATE public.student_video_consents SET revoked_at=now() WHERE student_id=st.id AND revoked_at IS NULL RETURNING * INTO c;
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_VIDEO_CONSENT',p_actor::text,st.id,jsonb_build_object('source','portal','revoked',c.revoked_at IS NOT NULL));
 RETURN jsonb_build_object('studentId',st.id,'consented',c.student_id IS NOT NULL AND c.revoked_at IS NULL,'guardianName',c.guardian_name,'relationship',c.relationship,'consentedAt',c.consented_at);
END $$;

-- Step 1 of a submission. Text and practice submissions are submitted at once;
-- a video is created as 'uploading' with the storage path for a signed upload.
CREATE OR REPLACE FUNCTION public.student_portal_start_submission(p_actor uuid,p_student text,p_request uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; s public.student_submissions; a public.assignments; sa public.student_assignments; consent public.student_video_consents;
 v_kind text:=p_payload->>'kind'; ext text; v_id uuid:=gen_random_uuid(); v_subject_type text; v_subject_ref text; today date:=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date;
BEGIN
 st:=public.student_portal_assert_student(p_actor,p_student);
 IF p_request IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR v_kind IS NULL OR v_kind NOT IN ('video','text','practice') THEN RAISE EXCEPTION 'Invalid submission' USING ERRCODE='22023'; END IF;
 SELECT * INTO s FROM public.student_submissions WHERE student_id=st.id AND request_key=p_request;
 IF FOUND THEN
  IF s.kind<>v_kind OR s.assignment_id IS DISTINCT FROM NULLIF(p_payload->>'assignmentId','')::uuid THEN RAISE EXCEPTION 'Request key reused' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('submission',to_jsonb(s)-'request_key'-'actor_id','bucket','student-submissions','uploadPath',CASE WHEN s.status='uploading' THEN s.video_path END);
 END IF;
 IF p_payload->>'assignmentId' IS NOT NULL THEN
  SELECT * INTO a FROM public.assignments WHERE id=(p_payload->>'assignmentId')::uuid;
  SELECT * INTO sa FROM public.student_assignments WHERE assignment_id=a.id AND student_id=st.id FOR UPDATE;
  IF a.id IS NULL OR sa.assignment_id IS NULL OR a.status<>'published' THEN RAISE EXCEPTION 'This assignment is not open' USING ERRCODE='P0002'; END IF;
  IF sa.status IN ('done','excused','submitted','reviewed') THEN RAISE EXCEPTION 'This assignment is already handed in' USING ERRCODE='22023'; END IF;
  IF NOT ((a.kind IN ('video','form') AND v_kind='video') OR (a.kind='written' AND v_kind='text') OR (a.kind='practice' AND v_kind IN ('practice','video'))) THEN
   RAISE EXCEPTION 'This assignment needs a % answer',CASE a.kind WHEN 'written' THEN 'written' WHEN 'practice' THEN 'practice' ELSE 'video' END USING ERRCODE='22023'; END IF;
  v_subject_type:=a.subject_type; v_subject_ref:=a.subject_ref;
 ELSE
  -- A video of a lesson or form sent for feedback without an assignment.
  v_subject_type:=p_payload->>'subjectType'; v_subject_ref:=p_payload->>'subjectRef';
  IF v_kind<>'video' OR v_subject_type IS NULL OR v_subject_type NOT IN ('lesson','form')
   OR (v_subject_type='lesson' AND (public.lms_lesson_visible(st,v_subject_ref)).id IS NULL)
   OR (v_subject_type='form' AND (public.lms_form_visible(st,v_subject_ref)).id IS NULL) THEN RAISE EXCEPTION 'Choose an assignment, or a lesson or form to send' USING ERRCODE='22023'; END IF;
 END IF;
 IF v_kind='text' AND length(btrim(COALESCE(p_payload->>'textAnswer',''))) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Write your answer (up to 4000 characters)' USING ERRCODE='22023'; END IF;
 IF v_kind='video' THEN
  SELECT * INTO consent FROM public.student_video_consents WHERE student_id=st.id AND revoked_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'A parent or guardian must agree to video uploads first' USING ERRCODE='42501'; END IF;
  ext:=CASE p_payload->>'mimeType' WHEN 'video/mp4' THEN 'mp4' WHEN 'video/webm' THEN 'webm' WHEN 'video/quicktime' THEN 'mov' END;
  IF ext IS NULL THEN RAISE EXCEPTION 'Upload an MP4, WebM or MOV video' USING ERRCODE='22023'; END IF;
  IF COALESCE(p_payload->>'bytes','') !~ '^[0-9]{1,9}$' OR (p_payload->>'bytes')::bigint NOT BETWEEN 1 AND 209715200 THEN RAISE EXCEPTION 'Videos can be up to 200 MB' USING ERRCODE='22023'; END IF;
  IF p_payload ? 'videoSeconds' AND NOT (COALESCE(p_payload->>'videoSeconds','') ~ '^[0-9]{1,3}$' AND (p_payload->>'videoSeconds')::integer BETWEEN 1 AND 180) THEN RAISE EXCEPTION 'Videos can be up to 3 minutes long' USING ERRCODE='22023'; END IF;
  IF (SELECT count(*) FROM public.student_submissions WHERE student_id=st.id AND kind='video' AND created_at>=(today::timestamp AT TIME ZONE 'Asia/Phnom_Penh'))>=10 THEN
   RAISE EXCEPTION 'You can upload up to 10 videos a day' USING ERRCODE='22023'; END IF;
 END IF;
 INSERT INTO public.student_submissions(id,student_id,request_key,actor_id,assignment_id,subject_type,subject_ref,kind,text_answer,video_path,mime_type,bytes,video_seconds,status,consent_by,consent_at,submitted_at)
 VALUES(v_id,st.id,p_request,p_actor,a.id,v_subject_type,v_subject_ref,v_kind,CASE WHEN v_kind='text' THEN btrim(p_payload->>'textAnswer') END,
  CASE WHEN v_kind='video' THEN st.id||'/'||v_id||'.'||ext END,CASE WHEN v_kind='video' THEN p_payload->>'mimeType' END,CASE WHEN v_kind='video' THEN (p_payload->>'bytes')::bigint END,
  CASE WHEN v_kind='video' THEN (p_payload->>'videoSeconds')::smallint END,CASE WHEN v_kind='video' THEN 'uploading' ELSE 'submitted' END,
  CASE WHEN v_kind='video' THEN consent.consented_by END,CASE WHEN v_kind='video' THEN consent.consented_at END,CASE WHEN v_kind<>'video' THEN now() END)
 RETURNING * INTO s;
 IF a.id IS NOT NULL AND s.status='submitted' THEN UPDATE public.student_assignments SET status='submitted',updated_at=now() WHERE assignment_id=a.id AND student_id=st.id; END IF;
 RETURN jsonb_build_object('submission',to_jsonb(s)-'request_key'-'actor_id','bucket','student-submissions','uploadPath',CASE WHEN s.status='uploading' THEN s.video_path END);
END $$;

-- Step 2 for a video: the file is in storage, so the submission is handed in.
CREATE OR REPLACE FUNCTION public.student_portal_finish_submission(p_actor uuid,p_student text,p_submission uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; s public.student_submissions; size bigint; mime text; stored boolean:=true; seconds integer;
BEGIN
 st:=public.student_portal_assert_student(p_actor,p_student);
 SELECT * INTO s FROM public.student_submissions WHERE id=p_submission AND student_id=st.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found' USING ERRCODE='P0002'; END IF;
 IF s.status<>'uploading' THEN RETURN jsonb_build_object('submission',to_jsonb(s)-'request_key'-'actor_id'); END IF;
 IF s.created_at<now()-interval '2 hours' THEN
  UPDATE public.student_submissions SET status='expired',updated_at=now() WHERE id=s.id;
  RAISE EXCEPTION 'The upload window closed. Please start the upload again' USING ERRCODE='22023';
 END IF;
 IF to_regclass('storage.objects') IS NOT NULL THEN
  EXECUTE 'SELECT (metadata->>''size'')::bigint,metadata->>''mimetype'' FROM storage.objects WHERE bucket_id=$1 AND name=$2' INTO size,mime USING 'student-submissions',s.video_path;
  stored:=size IS NOT NULL;
 END IF;
 IF NOT stored THEN RAISE EXCEPTION 'The video has not finished uploading' USING ERRCODE='P0002'; END IF;
 IF size>209715200 OR (mime IS NOT NULL AND mime<>s.mime_type) THEN RAISE EXCEPTION 'The uploaded file does not match the video that was started' USING ERRCODE='22023'; END IF;
 IF p_payload ? 'videoSeconds' THEN
  IF NOT (COALESCE(p_payload->>'videoSeconds','') ~ '^[0-9]{1,3}$' AND (p_payload->>'videoSeconds')::integer BETWEEN 1 AND 180) THEN RAISE EXCEPTION 'Videos can be up to 3 minutes long' USING ERRCODE='22023'; END IF;
  seconds:=(p_payload->>'videoSeconds')::integer;
 END IF;
 UPDATE public.student_submissions SET status='submitted',submitted_at=now(),bytes=COALESCE(size,bytes),video_seconds=COALESCE(seconds,video_seconds),updated_at=now() WHERE id=s.id RETURNING * INTO s;
 IF s.assignment_id IS NOT NULL THEN UPDATE public.student_assignments SET status='submitted',updated_at=now() WHERE assignment_id=s.assignment_id AND student_id=st.id AND status IN ('open','in_progress'); END IF;
 RETURN jsonb_build_object('submission',to_jsonb(s)-'request_key'-'actor_id');
END $$;

-- Withdraws a submission not yet reviewed. The video is removed by the cleanup job.
CREATE OR REPLACE FUNCTION public.student_portal_withdraw_submission(p_actor uuid,p_student text,p_submission uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; s public.student_submissions;
BEGIN
 st:=public.student_portal_assert_student(p_actor,p_student);
 SELECT * INTO s FROM public.student_submissions WHERE id=p_submission AND student_id=st.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found' USING ERRCODE='P0002'; END IF;
 IF s.status NOT IN ('uploading','submitted') THEN RAISE EXCEPTION 'A reviewed submission cannot be withdrawn' USING ERRCODE='22023'; END IF;
 UPDATE public.student_submissions SET status='withdrawn',updated_at=now() WHERE id=s.id RETURNING * INTO s;
 IF s.assignment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.student_submissions x WHERE x.assignment_id=s.assignment_id AND x.student_id=st.id AND x.status='submitted') THEN
  UPDATE public.student_assignments SET status=CASE WHEN progress='{}'::jsonb THEN 'open' ELSE 'in_progress' END,updated_at=now() WHERE assignment_id=s.assignment_id AND student_id=st.id AND status='submitted';
 END IF;
 RETURN jsonb_build_object('submission',to_jsonb(s)-'request_key'-'actor_id');
END $$;

-- The portal shows each new award once, then marks it seen.
CREATE OR REPLACE FUNCTION public.student_portal_mark_achievements_seen(p_actor uuid,p_student text,p_items jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; n integer;
BEGIN
 st:=public.student_portal_assert_student(p_actor,p_student);
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)>100 THEN RAISE EXCEPTION 'Invalid achievements' USING ERRCODE='22023'; END IF;
 UPDATE public.student_achievements a SET seen_at=now() FROM jsonb_array_elements(p_items) x
 WHERE a.student_id=st.id AND a.code=x->>'code' AND a.period=COALESCE(x->>'period','') AND a.seen_at IS NULL;
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN jsonb_build_object('marked',n);
END $$;

-- ===========================================================================
-- 7. Student feeds (server only)
-- ===========================================================================
-- tasks-v1: open and recent assignments and challenges with the student's progress.
CREATE OR REPLACE FUNCTION public.portal_student_tasks(p_student text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; today date:=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 SELECT * INTO st FROM public.students WHERE id=p_student AND deleted_at IS NULL;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('contractVersion','tasks-v1','studentId',st.id,
  'assignments',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'instructions',a.instructions,'kind',a.kind,
    'subjectType',a.subject_type,'subjectRef',a.subject_ref,'target',a.target,'dueAt',a.due_at,'points',a.points,'rubric',a.rubric,'translations',a.translations,
    'assignmentStatus',a.status,'status',sa.status,'progress',sa.progress,'assignedAt',sa.assigned_at,'doneAt',sa.done_at,
    'lastSubmission',(SELECT jsonb_build_object('id',x.id,'kind',x.kind,'status',x.status,'submittedAt',x.submitted_at) FROM public.student_submissions x
      WHERE x.assignment_id=a.id AND x.student_id=st.id ORDER BY x.created_at DESC LIMIT 1))
    ORDER BY a.due_at NULLS LAST,a.published_at DESC),'[]'::jsonb)
   FROM (SELECT * FROM public.student_assignments WHERE student_id=st.id) sa JOIN public.assignments a ON a.id=sa.assignment_id
   WHERE a.status='published' OR (a.status='closed' AND a.closed_at>=now()-interval '30 days')),
  'challenges',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'description',c.description,'goalKind',c.goal_kind,'goalTarget',c.goal_target,
    'subjectType',c.subject_type,'subjectRef',c.subject_ref,'startsOn',c.starts_on,'endsOn',c.ends_on,'points',c.points,'badgeCode',c.badge_code,'translations',c.translations,
    'status',c.status,'progress',COALESCE(p.progress,0),'completedAt',p.completed_at) ORDER BY c.ends_on,c.title),'[]'::jsonb)
   FROM public.challenges c LEFT JOIN public.student_challenge_progress p ON p.challenge_id=c.id AND p.student_id=st.id
   WHERE c.status IN ('published','closed') AND c.starts_on<=today+7 AND c.ends_on>=today-14 AND public.lms_student_in_audience(st,c.audience)));
END $$;

-- submissions-v1: the student's submissions with the reviews shown to them.
CREATE OR REPLACE FUNCTION public.portal_student_submissions(p_student text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 SELECT * INTO st FROM public.students WHERE id=p_student AND deleted_at IS NULL;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('contractVersion','submissions-v1','studentId',st.id,
  'consent',(SELECT jsonb_build_object('consented',c.revoked_at IS NULL,'guardianName',c.guardian_name,'relationship',c.relationship,'source',c.source,'consentedAt',c.consented_at)
   FROM public.student_video_consents c WHERE c.student_id=st.id),
  'submissions',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'assignmentId',s.assignment_id,'assignmentTitle',a.title,'subjectType',s.subject_type,'subjectRef',s.subject_ref,
    'kind',s.kind,'textAnswer',s.text_answer,'hasVideo',s.video_path IS NOT NULL AND s.status IN ('submitted','reviewed','returned'),'videoSeconds',s.video_seconds,
    'status',s.status,'createdAt',s.created_at,'submittedAt',s.submitted_at,'reviewedAt',s.reviewed_at,'videoDeletesOn',s.delete_video_after,
    'reviews',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',r.id,'decision',r.decision,'grade',r.grade,'rubric',r.rubric,'feedback',r.feedback,'moments',r.moments,
      'coach',(SELECT display_name FROM public.profiles WHERE id=r.reviewer_id),'createdAt',r.created_at) ORDER BY r.created_at),'[]'::jsonb)
     FROM public.submission_reviews r WHERE r.submission_id=s.id AND r.visible_to_student)) ORDER BY s.created_at DESC),'[]'::jsonb)
   FROM (SELECT * FROM public.student_submissions WHERE student_id=st.id AND status<>'uploading' ORDER BY created_at DESC LIMIT 100) s
   LEFT JOIN public.assignments a ON a.id=s.assignment_id));
END $$;

-- achievements-v1: the catalogue, the student's awards and personal points total.
CREATE OR REPLACE FUNCTION public.portal_student_achievements(p_student text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 SELECT * INTO st FROM public.students WHERE id=p_student AND deleted_at IS NULL;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('contractVersion','achievements-v1','studentId',st.id,
  'catalogue',(SELECT COALESCE(jsonb_agg(jsonb_build_object('code',d.code,'title',d.title,'description',d.description,'icon',d.icon,'points',d.points,'repeats',d.repeats,
    'ruleKind',d.rule->>'kind','target',CASE WHEN d.rule ? 'min' THEN (d.rule->>'min')::integer END,'translations',d.translations) ORDER BY d.sort_order,d.code),'[]'::jsonb)
   FROM public.achievement_definitions d WHERE d.active),
  'earned',(SELECT COALESCE(jsonb_agg(jsonb_build_object('code',a.code,'period',a.period,'earnedAt',a.earned_at,'seenAt',a.seen_at,'signedOff',a.awarded_by IS NOT NULL) ORDER BY a.earned_at DESC),'[]'::jsonb)
   FROM public.student_achievements a WHERE a.student_id=st.id),
  'points',jsonb_build_object('total',(SELECT COALESCE(sum(delta),0) FROM public.student_points WHERE student_id=st.id),
   'recent',(SELECT COALESCE(jsonb_agg(jsonb_build_object('delta',x.delta,'reason',x.reason,'ref',x.ref,'createdAt',x.created_at) ORDER BY x.created_at DESC),'[]'::jsonb)
    FROM (SELECT * FROM public.student_points WHERE student_id=st.id ORDER BY created_at DESC LIMIT 20) x)));
END $$;

-- ===========================================================================
-- 8. Video retention (nightly): videos 90 days after review, withdrawn and
--    abandoned uploads. The job deletes the files, then marks them deleted.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.portal_lms_videos_to_delete(p_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'path',s.video_path)),'[]'::jsonb) FROM (
  SELECT id,video_path FROM public.student_submissions WHERE video_path IS NOT NULL AND video_deleted_at IS NULL
  AND ((delete_video_after IS NOT NULL AND delete_video_after<=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date)
   OR status IN ('withdrawn','expired') OR (status='uploading' AND created_at<now()-interval '1 day'))
  ORDER BY created_at LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),200)) s);
END $$;

CREATE OR REPLACE FUNCTION public.portal_lms_videos_deleted(p_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 UPDATE public.student_submissions SET video_path=NULL,video_deleted_at=now(),status=CASE WHEN status='uploading' THEN 'expired' ELSE status END,updated_at=now()
 WHERE id=ANY(p_ids) AND video_path IS NOT NULL;
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n;
END $$;

-- ===========================================================================
-- Grants: service role only.
-- ===========================================================================
DO $$ DECLARE f text; BEGIN
 FOREACH f IN ARRAY ARRAY['lms_belt_key(text)','lms_student_in_audience(public.students,jsonb)','lms_assignment_students(uuid)','lms_assignment_fanout(uuid)',
  'lms_practice_days(text,date,date,text)','lms_longest_streak(text,date,date,text)','lms_current_streak(text,date)','lms_challenge_progress(public.students,public.challenges)',
  'lms_add_points(text,integer,text,text)','lms_award(text,text,text,jsonb,uuid)','lms_rule_met(public.students,public.achievement_definitions,text)',
  'student_portal_evaluate_rewards(text)','lms_check_targets(jsonb)','lms_check_subject(text,text)','portal_save_assignment(uuid,text,uuid,jsonb)',
  'portal_set_student_assignment(uuid,uuid,text,jsonb)','portal_save_challenge(uuid,text,uuid,jsonb)','portal_review_form(uuid,text,uuid,jsonb)',
  'portal_review_submission(uuid,uuid,jsonb)','portal_save_achievement_definition(uuid,text,text,jsonb)','portal_award_achievement(uuid,text,text,jsonb)',
  'portal_record_video_consent(uuid,text,jsonb)','student_portal_video_consent(uuid,text,jsonb)','student_portal_start_submission(uuid,text,uuid,jsonb)',
  'student_portal_finish_submission(uuid,text,uuid,jsonb)','student_portal_withdraw_submission(uuid,text,uuid)','student_portal_mark_achievements_seen(uuid,text,jsonb)',
  'portal_student_tasks(text)','portal_student_submissions(text)','portal_student_achievements(text)','portal_lms_videos_to_delete(integer)','portal_lms_videos_deleted(uuid[])'] LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC,anon,authenticated',f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role',f);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
