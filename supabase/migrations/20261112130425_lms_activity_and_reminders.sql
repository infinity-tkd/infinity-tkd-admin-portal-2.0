-- LMS activity and reminders (docs/STUDENT_PORTAL_LMS_DESIGN_2026-11-12.md):
-- seven new activity kinds in student_portal_record_event (with the library's
-- belt rule), the notices-v2 inbox that also lists LMS notices, LMS phone alerts
-- (off until the student portal is ready), reminder settings, staff
-- announcements, and portal_lms_run_reminders for the scheduled job.
-- Replaced from their deployed versions (live md5 checked before writing):
--   student_portal_record_event  f2c4120e21db6f761fca212bca6cc41e
--   portal_push_eligible         43b6a5e34668e531894d599e9875ecdf
--   portal_calendar_preferences  f634213fd9c2ab216e50602746ec0729
-- portal_calendar_inbox is unchanged: today's student inbox keeps working
-- exactly as before until the student portal moves to portal_student_inbox.
-- Requires 20261112090000_lms_learning_records and 20261112090100_lms_tasks_and_rewards.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

-- ===========================================================================
-- 1. Student activity: seven new kinds
-- ===========================================================================
ALTER TABLE public.student_portal_events DROP CONSTRAINT student_portal_events_kind_check;
ALTER TABLE public.student_portal_events ADD CONSTRAINT student_portal_events_kind_check CHECK (kind = ANY (ARRAY['lesson','workout','template','stat',
 'step_check','self_assessment','quiz_attempt','form_practice','form_ready','assignment_progress','goal']::text[]));
CREATE INDEX student_portal_events_student_kind_idx ON public.student_portal_events(student_id,kind,created_at);

-- True when a published lesson has a technique-steps step with this id.
CREATE OR REPLACE FUNCTION public.lms_step_exists(p_lesson integer,p_step text) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.library_published_content pc
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(pc.document->'sections')='array' THEN pc.document->'sections' ELSE '[]'::jsonb END) s
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s->'items')='array' THEN s->'items' ELSE '[]'::jsonb END) i
  WHERE pc.curriculum_id=p_lesson AND s->>'type'='technique-steps' AND i->>'id'=p_step) $$;

-- A whole number from a payload field, or NULL when absent; raises when malformed.
CREATE OR REPLACE FUNCTION public.lms_int(p_payload jsonb,p_key text,p_min integer,p_max integer) RETURNS integer
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
 IF NOT p_payload ? p_key OR jsonb_typeof(p_payload->p_key)='null' THEN RETURN NULL; END IF;
 IF jsonb_typeof(p_payload->p_key)<>'number' OR (p_payload->>p_key)::numeric<>floor((p_payload->>p_key)::numeric) OR (p_payload->>p_key)::numeric NOT BETWEEN p_min AND p_max THEN
  RAISE EXCEPTION 'Invalid %',p_key USING ERRCODE='22023'; END IF;
 RETURN (p_payload->>p_key)::integer;
END $$;

create or replace function public.student_portal_record_event(p_actor uuid, p_student text, p_request uuid, p_kind text, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare actor public.profiles; athlete public.students; existing public.student_portal_events; result public.student_portal_events;
 lesson public.curriculum; repetitions integer; completed boolean;
 -- LMS
 form public.poomsae_forms; sa public.student_assignments; asg public.assignments; ref text; v_rating integer; v_score integer; v_total integer; v_seconds integer;
 v_checked smallint[]; v_missed uuid[]; v_reps integer; v_status text; v_parts text[];
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server only' using errcode='42501'; end if;
 select * into actor from public.profiles where id=p_actor and role='Student' and is_active=true and must_change_password=false for share;
 if not found then raise exception 'Account ineligible' using errcode='42501'; end if;
 select * into athlete from public.students where id=p_student and deleted_at is null and student_status in ('Active','Paused') for share;
 if not found or not (coalesce(athlete.profile_id=p_actor,false) or coalesce(actor.student_id=p_student,false)) then raise exception 'Student mismatch' using errcode='42501'; end if;
 if (athlete.profile_id is not null and athlete.profile_id<>p_actor) or (actor.student_id is not null and actor.student_id<>p_student)
 or exists(select 1 from public.students where profile_id=p_actor and id<>p_student) then raise exception 'Contradictory identity links' using errcode='42501'; end if;
 if p_request is null or p_kind is null or p_payload is null or p_kind not in ('lesson','workout','template','stat',
  'step_check','self_assessment','quiz_attempt','form_practice','form_ready','assignment_progress','goal')
  or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>65536 then raise exception 'Invalid event' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text||p_request::text,0));
 select * into existing from public.student_portal_events where actor_id=p_actor and request_key=p_request;
 if found then
  if existing.student_id<>p_student or existing.kind<>p_kind or existing.payload<>p_payload then raise exception 'Request key reused' using errcode='22023'; end if;
  return to_jsonb(existing);
 end if;
 if p_kind='lesson' then
  select * into lesson from public.curriculum where id=(p_payload->>'lessonId')::integer and is_active=true for share;
  if not found then raise exception 'Lesson unavailable' using errcode='22023'; end if;
  -- LMS: the library's belt rule. 'All', 'All Belts', 'All Levels' and 'Beginner'
  -- in any case or spacing are open to every belt (was an exact-word match).
  if not public.lms_belt_allows(lesson.target_belt,athlete.current_belt) then raise exception 'Lesson unavailable for belt' using errcode='42501'; end if;
  repetitions:=coalesce((p_payload->>'repetitionsCount')::integer,0);
  if repetitions not between 0 and 10000 then raise exception 'Invalid repetitions' using errcode='22023'; end if;
  completed:=coalesce((p_payload->>'completed')::boolean,false);
  insert into public.student_portal_progress(student_id,curriculum_id,completed,repetition_count)
  values(p_student,lesson.id,completed,repetitions)
  on conflict(student_id,curriculum_id) do update set
   completed=public.student_portal_progress.completed or excluded.completed,
   repetition_count=least(1000000,public.student_portal_progress.repetition_count+excluded.repetition_count),updated_at=now();
 elsif p_kind='step_check' then
  -- {lessonId, stepId, checked:[0,2]}: ticks on one technique step's checklist.
  lesson:=public.lms_lesson_visible(athlete,p_payload->>'lessonId');
  if lesson.id is null then raise exception 'Lesson unavailable' using errcode='22023'; end if;
  ref:=p_payload->>'stepId';
  if ref is null or ref !~ '^[a-z0-9][a-z0-9-]{0,59}$' or not public.lms_step_exists(lesson.id,ref) then raise exception 'Step unavailable' using errcode='22023'; end if;
  if jsonb_typeof(p_payload->'checked') is distinct from 'array' or jsonb_array_length(p_payload->'checked')>50
   or exists(select 1 from jsonb_array_elements(p_payload->'checked') x where jsonb_typeof(x)<>'number' or (x#>>'{}') !~ '^[0-9]{1,2}$' or (x#>>'{}')::integer>49) then
   raise exception 'Invalid checklist' using errcode='22023'; end if;
  v_checked:=array(select distinct (x#>>'{}')::smallint from jsonb_array_elements(p_payload->'checked') x order by 1);
  insert into public.student_step_checks(student_id,curriculum_id,step_id,checked) values(p_student,lesson.id,ref,v_checked)
  on conflict(student_id,curriculum_id,step_id) do update set checked=excluded.checked,updated_at=now();
 elsif p_kind='self_assessment' then
  -- {subjectType, subjectRef, rating 1-4, note?}: self-reported, never changes a coach grade.
  ref:=p_payload->>'subjectRef'; v_rating:=public.lms_int(p_payload,'rating',1,4);
  if v_rating is null or ref is null or length(ref)>120 or length(coalesce(p_payload->>'note',''))>500 then raise exception 'Invalid self-check' using errcode='22023'; end if;
  v_parts:=string_to_array(ref,':');
  if not coalesce(case p_payload->>'subjectType'
   when 'lesson' then (public.lms_lesson_visible(athlete,ref)).id is not null
   when 'step' then cardinality(v_parts)=2 and (public.lms_lesson_visible(athlete,v_parts[1])).id is not null and public.lms_step_exists(v_parts[1]::integer,v_parts[2])
   when 'form' then (public.lms_form_visible(athlete,ref)).id is not null
   when 'movement' then cardinality(v_parts)=2 and v_parts[2] ~ '^[0-9]{1,3}$' and v_parts[2]::integer between 1 and coalesce((public.lms_form_visible(athlete,v_parts[1])).movement_count,0)
   else false end,false) then raise exception 'Subject unavailable' using errcode='22023'; end if;
  if (select count(*) from public.student_self_assessments where student_id=p_student and created_at>=now()-interval '1 day')>=200 then raise exception 'Too many self-checks today' using errcode='22023'; end if;
  insert into public.student_self_assessments(student_id,subject_type,subject_ref,rating,note)
  values(p_student,p_payload->>'subjectType',ref,v_rating,nullif(btrim(coalesce(p_payload->>'note','')),''));
 elsif p_kind='quiz_attempt' then
  -- {scope, scopeRef, score, total, missed:[questionId]}
  ref:=p_payload->>'scopeRef'; v_total:=public.lms_int(p_payload,'total',1,200); v_score:=public.lms_int(p_payload,'score',0,200);
  if v_total is null or v_score is null or v_score>v_total or ref is null or not public.lms_quiz_scope_allowed(athlete,p_payload->>'scope',ref) then raise exception 'Quiz unavailable' using errcode='22023'; end if;
  if p_payload ? 'missed' and (jsonb_typeof(p_payload->'missed')<>'array' or jsonb_array_length(p_payload->'missed')>200
   or exists(select 1 from jsonb_array_elements(p_payload->'missed') x where jsonb_typeof(x)<>'string' or (x#>>'{}') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) then
   raise exception 'Invalid missed questions' using errcode='22023'; end if;
  v_missed:=array(select distinct (x#>>'{}')::uuid from jsonb_array_elements(coalesce(p_payload->'missed','[]'::jsonb)) x);
  insert into public.student_quiz_attempts(student_id,scope,scope_ref,score,total,missed) values(p_student,p_payload->>'scope',ref,v_score,v_total,v_missed);
  if p_payload->>'scope'='form' then
   insert into public.student_form_progress(student_id,form_id,best_quiz_percent) values(p_student,ref::uuid,round(100.0*v_score/v_total))
   on conflict(student_id,form_id) do update set best_quiz_percent=greatest(coalesce(public.student_form_progress.best_quiz_percent,0),excluded.best_quiz_percent),updated_at=now();
  end if;
 elsif p_kind in ('form_practice','form_ready') then
  form:=public.lms_form_visible(athlete,p_payload->>'formId');
  if form.id is null then raise exception 'Form unavailable' using errcode='22023'; end if;
  if p_kind='form_practice' then
   -- {formId, mode: guided|free, movements, durationSeconds}
   v_seconds:=coalesce(public.lms_int(p_payload,'durationSeconds',0,7200),0);
   if coalesce(p_payload->>'mode','') not in ('guided','free') or coalesce(public.lms_int(p_payload,'movements',0,200),0)>form.movement_count then raise exception 'Invalid form practice' using errcode='22023'; end if;
   insert into public.student_form_progress(student_id,form_id,status,practice_count,practice_seconds,last_practised_at) values(p_student,form.id,'practising',1,v_seconds,now())
   on conflict(student_id,form_id) do update set practice_count=least(1000000,public.student_form_progress.practice_count+1),
    practice_seconds=least(100000000,public.student_form_progress.practice_seconds+excluded.practice_seconds),last_practised_at=now(),
    status=case when public.student_form_progress.status='learning' then 'practising' else public.student_form_progress.status end,updated_at=now();
  else
   -- {formId}: the student asks a coach to check the form (Coaching -> Review queue).
   select status into v_status from public.student_form_progress where student_id=p_student and form_id=form.id for update;
   if v_status='mastered' then raise exception 'This form is already mastered' using errcode='22023'; end if;
   insert into public.student_form_progress(student_id,form_id,status,review_requested_at) values(p_student,form.id,'ready_for_review',now())
   on conflict(student_id,form_id) do update set status='ready_for_review',review_requested_at=now(),updated_at=now();
  end if;
 elsif p_kind='assignment_progress' then
  -- {assignmentId, reps}: reps logged against a practice assignment.
  if coalesce(p_payload->>'assignmentId','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Assignment unavailable' using errcode='22023'; end if;
  select * into asg from public.assignments where id=(p_payload->>'assignmentId')::uuid;
  select * into sa from public.student_assignments where assignment_id=asg.id and student_id=p_student for update;
  if asg.id is null or sa.assignment_id is null or asg.status<>'published' or asg.kind<>'practice' then raise exception 'Assignment unavailable' using errcode='P0002'; end if;
  if sa.status not in ('open','in_progress') then raise exception 'This assignment is already handed in' using errcode='22023'; end if;
  v_reps:=coalesce(public.lms_int(p_payload,'reps',0,10000),0);
  update public.student_assignments set progress=jsonb_build_object('reps',least(1000000,coalesce((progress->>'reps')::integer,0)+v_reps),'sessions',least(10000,coalesce((progress->>'sessions')::integer,0)+1)),
   status='in_progress',updated_at=now() where assignment_id=asg.id and student_id=p_student;
 elsif p_kind='goal' then
  -- {kind, target, subjectRef?, title?, endsOn?} sets a goal; {goalId, status: done|dropped} closes one the student set.
  if p_payload ? 'goalId' then
   if coalesce(p_payload->>'status','') not in ('done','dropped') then raise exception 'Invalid goal' using errcode='22023'; end if;
   update public.student_goals set status=p_payload->>'status',updated_at=now() where id::text=p_payload->>'goalId' and student_id=p_student and set_by='student' and status='active';
   if not found then raise exception 'Goal unavailable' using errcode='P0002'; end if;
  else
   perform public.lms_set_goal(athlete,p_payload,'student',null);
  end if;
 end if;
 insert into public.student_portal_events(actor_id,student_id,request_key,kind,payload) values(p_actor,p_student,p_request,p_kind,p_payload) returning * into result;
 -- LMS: challenge progress, practice assignments, achievements and points.
 if p_kind in ('lesson','workout','quiz_attempt','form_practice','assignment_progress') then perform public.student_portal_evaluate_rewards(p_student); end if;
 return to_jsonb(result);
end $$;

-- ===========================================================================
-- 2. Phone alerts: LMS notices reach students once the academy switches on
--    academy_profile.student_lms_push_enabled (after the student portal's
--    service worker accepts sourceType 'lms'). Academy events are unchanged.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.portal_push_eligible(p_notification uuid,p_subscription uuid) RETURNS boolean
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE eligible boolean;
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'Server-only push eligibility' USING ERRCODE='42501'; END IF;
 SELECT EXISTS(
  SELECT 1 FROM public.portal_notifications n
  JOIN public.portal_push_subscriptions sub ON sub.user_id=n.user_id
  JOIN public.profiles p ON p.id=n.user_id
  JOIN public.portal_notification_preferences pref ON pref.user_id=p.id
  WHERE n.id=p_notification AND sub.id=p_subscription
  AND p.is_active AND NOT p.must_change_password AND pref.push_enabled
  AND n.read_at IS NULL AND n.dismissed_at IS NULL AND n.resolved_at IS NULL
  AND n.created_at>=now()-interval '2 days'
  AND NOT n.category=ANY(pref.muted_categories)
  AND CASE WHEN p.role='Student' THEN
   sub.app_scope='student' AND n.permission_key IS NULL
   AND EXISTS(SELECT 1 FROM public.academy_profile WHERE id='default' AND allow_student_portal_login)
   AND (pref.student_quiet_start IS NULL OR CASE WHEN pref.student_quiet_start<pref.student_quiet_end
     THEN to_char(now() AT TIME ZONE 'Asia/Phnom_Penh','HH24:MI')<pref.student_quiet_start OR to_char(now() AT TIME ZONE 'Asia/Phnom_Penh','HH24:MI')>=pref.student_quiet_end
     ELSE to_char(now() AT TIME ZONE 'Asia/Phnom_Penh','HH24:MI')<pref.student_quiet_start AND to_char(now() AT TIME ZONE 'Asia/Phnom_Penh','HH24:MI')>=pref.student_quiet_end END)
   AND ((n.category='events' AND n.source_type='academy_event'
     AND EXISTS(SELECT 1 FROM public.students st JOIN public.academy_events e ON e.id=n.source_id
      WHERE st.id=n.subject_student_id AND e.archived_at IS NULL AND e.published_revision IS NOT NULL
      AND (p.student_id=st.id OR st.profile_id=p.id)
      AND (p.student_id IS NULL OR p.student_id=st.id) AND (st.profile_id IS NULL OR st.profile_id=p.id)
      AND NOT EXISTS(SELECT 1 FROM public.profiles other WHERE other.id<>p.id AND other.student_id=st.id)
      AND NOT EXISTS(SELECT 1 FROM public.students other WHERE other.id<>st.id AND other.profile_id=p.id)
      AND public.portal_calendar_student_matches(e.published_payload,st.id)))
    -- LMS: reminders, feedback, achievements and announcements.
    OR (n.source_type='lms'
     AND EXISTS(SELECT 1 FROM public.academy_profile WHERE id='default' AND student_lms_push_enabled)
     AND EXISTS(SELECT 1 FROM public.students st WHERE st.id=n.subject_student_id AND st.deleted_at IS NULL
      AND (p.student_id=st.id OR st.profile_id=p.id)
      AND (p.student_id IS NULL OR p.student_id=st.id) AND (st.profile_id IS NULL OR st.profile_id=p.id)
      AND NOT EXISTS(SELECT 1 FROM public.profiles other WHERE other.id<>p.id AND other.student_id=st.id)
      AND NOT EXISTS(SELECT 1 FROM public.students other WHERE other.id<>st.id AND other.profile_id=p.id))))
  ELSE p.role IN('Root','Super Root','Admin','Head Coach','Coach','Assistant Coach') AND sub.app_scope='admin'
   AND n.source_type IS DISTINCT FROM 'academy_event' AND n.source_type IS DISTINCT FROM 'lms'
   AND (n.permission_key IS NULL OR p.role IN('Root','Super Root') OR COALESCE(
     (SELECT is_granted FROM public.user_permissions WHERE user_id=p.id AND permission_key=n.permission_key),
     (SELECT is_granted FROM public.role_permissions WHERE role=p.role AND permission_key=n.permission_key),false))
   AND (pref.quiet_start=pref.quiet_end OR CASE WHEN pref.quiet_start<pref.quiet_end
     THEN extract(hour FROM now() AT TIME ZONE 'Asia/Phnom_Penh')<pref.quiet_start OR extract(hour FROM now() AT TIME ZONE 'Asia/Phnom_Penh')>=pref.quiet_end
     ELSE extract(hour FROM now() AT TIME ZONE 'Asia/Phnom_Penh')<pref.quiet_start AND extract(hour FROM now() AT TIME ZONE 'Asia/Phnom_Penh')>=pref.quiet_end END)
  END
 ) INTO eligible;
 RETURN eligible;
END $$;

-- ===========================================================================
-- 3. notices-v2 inbox: academy events (same rules as portal_calendar_inbox)
--    plus LMS notices from the last 90 days. LMS rows carry topic = category,
--    sourceId = the related record (or the notice) and sourceRevision 1.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.lms_inbox_visible(n public.portal_notifications,p_user uuid,p_student text) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT n.user_id=p_user AND n.subject_student_id=p_student AND n.resolved_at IS NULL AND (
  (n.category='events' AND n.source_type='academy_event' AND EXISTS(SELECT 1 FROM public.academy_events e WHERE e.id=n.source_id
    AND e.archived_at IS NULL AND n.source_revision<=e.published_revision AND public.portal_calendar_student_matches(e.published_payload,p_student)))
  OR (n.source_type='lms' AND n.created_at>=now()-interval '90 days')) $$;

CREATE OR REPLACE FUNCTION public.portal_student_inbox(p_user uuid,p_student text,p_action text,p_id uuid,p_before timestamptz,p_before_id uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE rows jsonb; unread integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server-only inbox' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('list','read','dismiss','mark-all') THEN RAISE EXCEPTION 'Invalid inbox action' USING ERRCODE='22023'; END IF;
 IF p_action<>'list' THEN
  UPDATE public.portal_notifications n SET
   read_at=CASE WHEN p_action IN ('read','mark-all') THEN COALESCE(n.read_at,now()) ELSE n.read_at END,
   dismissed_at=CASE WHEN p_action='dismiss' THEN COALESCE(n.dismissed_at,now()) ELSE n.dismissed_at END
  WHERE n.user_id=p_user AND n.subject_student_id=p_student AND (p_action='dismiss' OR n.dismissed_at IS NULL)
   AND (p_action='mark-all' OR n.id=p_id) AND public.lms_inbox_visible(n,p_user,p_student);
  IF p_action<>'mark-all' AND NOT FOUND THEN RAISE EXCEPTION 'Notification not available' USING ERRCODE='P0002'; END IF;
  RETURN jsonb_build_object('saved',true);
 END IF;
 SELECT count(*) INTO unread FROM public.portal_notifications n
 WHERE n.user_id=p_user AND n.subject_student_id=p_student AND n.dismissed_at IS NULL AND n.read_at IS NULL AND public.lms_inbox_visible(n,p_user,p_student);
 SELECT COALESCE(jsonb_agg(t.item ORDER BY t.created_at DESC,t.id DESC),'[]'::jsonb) INTO rows FROM (
  SELECT n.created_at,n.id,to_jsonb(n)||jsonb_build_object(
    'topic',COALESCE(n.topic,CASE WHEN n.source_type='lms' THEN n.category END),
    'source_id',COALESCE(n.source_id,CASE WHEN n.subject_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN n.subject_ref::uuid END,n.id),
    'source_revision',COALESCE(n.source_revision,1)) AS item
  FROM public.portal_notifications n
  WHERE n.user_id=p_user AND n.subject_student_id=p_student AND n.dismissed_at IS NULL
   AND (p_before IS NULL OR (n.created_at,n.id)<(p_before,p_before_id)) AND public.lms_inbox_visible(n,p_user,p_student)
  ORDER BY n.created_at DESC,n.id DESC LIMIT 51) t;
 RETURN jsonb_build_object('contractVersion','notices-v2','rows',rows,'unreadCount',unread);
END $$;

-- ===========================================================================
-- 4. Notice settings: every student category can be muted; the daily practice
--    time, practice days and class reminder hours are optional keys, so a
--    client that does not send them keeps the saved values.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.portal_calendar_preferences(p_user uuid,p_payload jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE muted text[]; categories text[]:=public.lms_student_notice_categories(); days smallint[]; hours smallint;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server-only preferences' USING ERRCODE='42501'; END IF;
 muted:=ARRAY(SELECT DISTINCT c FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p_payload->'mutedCategories')='array' THEN p_payload->'mutedCategories' ELSE '[]'::jsonb END) c
  WHERE c=ANY(categories) ORDER BY c);
 IF p_payload ? 'practiceReminderTime' AND jsonb_typeof(p_payload->'practiceReminderTime')<>'null'
  AND COALESCE(p_payload->>'practiceReminderTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'Choose a reminder time such as 18:30' USING ERRCODE='22023'; END IF;
 IF p_payload ? 'practiceDays' AND jsonb_typeof(p_payload->'practiceDays')<>'null' THEN
  IF jsonb_typeof(p_payload->'practiceDays')<>'array' OR jsonb_array_length(p_payload->'practiceDays') NOT BETWEEN 1 AND 7
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'practiceDays') d WHERE (d#>>'{}') NOT IN ('1','2','3','4','5','6','7')) THEN
   RAISE EXCEPTION 'Choose practice days from Monday (1) to Sunday (7)' USING ERRCODE='22023'; END IF;
  days:=ARRAY(SELECT DISTINCT (d#>>'{}')::smallint FROM jsonb_array_elements(p_payload->'practiceDays') d ORDER BY 1);
 END IF;
 IF p_payload ? 'classReminderHours' THEN
  IF COALESCE(p_payload->>'classReminderHours','') !~ '^[0-9]{1,2}$' OR (p_payload->>'classReminderHours')::integer>24 THEN RAISE EXCEPTION 'Choose 0 to 24 hours before class' USING ERRCODE='22023'; END IF;
  hours:=(p_payload->>'classReminderHours')::smallint;
 END IF;
 INSERT INTO public.portal_notification_preferences(user_id,push_enabled,muted_categories,student_quiet_start,student_quiet_end,practice_reminder_time,practice_days,class_reminder_hours)
 VALUES(p_user,(p_payload->>'pushEnabled')::boolean,muted,p_payload->>'quietStart',p_payload->>'quietEnd',(p_payload->>'practiceReminderTime')::time,days,COALESCE(hours,2))
 ON CONFLICT(user_id) DO UPDATE SET push_enabled=EXCLUDED.push_enabled,
  muted_categories=ARRAY(SELECT unnest(portal_notification_preferences.muted_categories) EXCEPT SELECT unnest(categories))||EXCLUDED.muted_categories,
  student_quiet_start=EXCLUDED.student_quiet_start,student_quiet_end=EXCLUDED.student_quiet_end,
  practice_reminder_time=CASE WHEN p_payload ? 'practiceReminderTime' THEN EXCLUDED.practice_reminder_time ELSE portal_notification_preferences.practice_reminder_time END,
  practice_days=CASE WHEN p_payload ? 'practiceDays' THEN EXCLUDED.practice_days ELSE portal_notification_preferences.practice_days END,
  class_reminder_hours=CASE WHEN p_payload ? 'classReminderHours' THEN EXCLUDED.class_reminder_hours ELSE portal_notification_preferences.class_reminder_hours END,
  updated_at=now();
END $$;

-- ===========================================================================
-- 5. Staff announcements to everyone, belts, branches, classes or students
-- ===========================================================================
CREATE TABLE public.lms_announcements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
 body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
 translations jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(translations)='object' AND octet_length(translations::text)<=12000),  -- {"km":{"title","body"},"zh":{...}}
 audience jsonb NOT NULL CHECK (jsonb_typeof(audience)='object' AND octet_length(audience::text)<=8000),
 recipients integer NOT NULL DEFAULT 0,
 sent_by uuid NOT NULL REFERENCES public.profiles(id),
 sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lms_announcements_sent_by_ops_idx ON public.lms_announcements(sent_by);
CREATE INDEX lms_announcements_sent_at_idx ON public.lms_announcements(sent_at DESC);

CREATE OR REPLACE FUNCTION public.portal_send_announcement(p_actor uuid,p_request uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.lms_announcements; st public.students; key text; total integer:=0; copy jsonb;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:announcements_send');
 IF p_request IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid announcement' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM public.lms_announcements WHERE request_key=p_request;
 IF FOUND THEN RETURN to_jsonb(a); END IF;
 IF length(btrim(COALESCE(p_payload->>'title',''))) NOT BETWEEN 1 AND 160 OR length(btrim(COALESCE(p_payload->>'body',''))) NOT BETWEEN 1 AND 2000 THEN
  RAISE EXCEPTION 'Write a title (up to 160 characters) and a message (up to 2000)' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(p_payload->'audience') IS DISTINCT FROM 'object' OR NOT EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload->'audience')) THEN RAISE EXCEPTION 'Choose who receives the announcement' USING ERRCODE='22023'; END IF;
 FOR key IN SELECT jsonb_object_keys(p_payload->'audience') LOOP
  IF key NOT IN ('all','belts','branches','classes','students') THEN RAISE EXCEPTION 'Choose who receives the announcement' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF jsonb_typeof(COALESCE(p_payload->'translations','{}'::jsonb))<>'object' THEN RAISE EXCEPTION 'Invalid translations' USING ERRCODE='22023'; END IF;
 INSERT INTO public.lms_announcements(request_key,title,body,translations,audience,sent_by)
 VALUES(p_request,btrim(p_payload->>'title'),btrim(p_payload->>'body'),COALESCE(p_payload->'translations','{}'::jsonb),p_payload->'audience',p_actor) RETURNING * INTO a;
 copy:=jsonb_build_object('en',jsonb_build_object('title',a.title,'body',a.body),
  'kh',jsonb_build_object('title',a.translations#>>'{km,title}','body',a.translations#>>'{km,body}'),
  'zh',jsonb_build_object('title',a.translations#>>'{zh,title}','body',a.translations#>>'{zh,body}'));
 FOR st IN SELECT * FROM public.students WHERE deleted_at IS NULL AND student_status IN ('Active','Paused') LOOP
  CONTINUE WHEN NOT public.lms_student_in_audience(st,a.audience);
  total:=total+public.lms_notify(st.id,'announcement','announcement:'||a.id,copy,'/notices',a.id::text,'announcement');
 END LOOP;
 UPDATE public.lms_announcements SET recipients=total WHERE id=a.id RETURNING * INTO a;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LMS_ANNOUNCEMENT',p_actor::text,a.id::text,jsonb_build_object('title',a.title,'audience',a.audience,'recipients',total));
 RETURN to_jsonb(a);
END $$;

-- ===========================================================================
-- 6. Reminders. portal_lms_run_reminders is called by the notifications job
--    (every minute is fine: every reminder has a source_key, so a rerun never
--    sends twice). Times are Asia/Phnom_Penh. Daily steps run once a day.
-- ===========================================================================
CREATE TABLE public.lms_job_marks (
 mark text PRIMARY KEY CHECK (length(mark) BETWEEN 1 AND 120),
 created_at timestamptz NOT NULL DEFAULT now()
);

-- Student accounts that receive LMS notices, with their reminder settings.
CREATE OR REPLACE FUNCTION public.lms_portal_accounts() RETURNS TABLE(user_id uuid,student_id varchar,current_belt varchar,class_hours smallint,practice_time time,practice_days smallint[])
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT p.id,s.id,s.current_belt,COALESCE(pref.class_reminder_hours,2::smallint),pref.practice_reminder_time,pref.practice_days
 FROM public.profiles p JOIN public.students s ON (p.student_id=s.id OR s.profile_id=p.id)
 LEFT JOIN public.portal_notification_preferences pref ON pref.user_id=p.id
 WHERE p.role='Student' AND p.is_active AND NOT p.must_change_password AND s.deleted_at IS NULL AND s.student_status IN ('Active','Paused')
 AND (p.student_id IS NULL OR p.student_id=s.id) AND (s.profile_id IS NULL OR s.profile_id=p.id)
 AND NOT EXISTS(SELECT 1 FROM public.profiles x WHERE x.id<>p.id AND x.student_id=s.id)
 AND NOT EXISTS(SELECT 1 FROM public.students x WHERE x.id<>s.id AND x.profile_id=p.id) $$;

CREATE OR REPLACE FUNCTION public.lms_once(p_mark text) RETURNS boolean
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE n integer;
BEGIN
 INSERT INTO public.lms_job_marks(mark) VALUES(p_mark) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n=1;
END $$;

CREATE OR REPLACE FUNCTION public.portal_lms_run_reminders(p_now timestamptz DEFAULT now()) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tz constant text:='Asia/Phnom_Penh'; local_now timestamp:=p_now AT TIME ZONE 'Asia/Phnom_Penh'; today date:=(p_now AT TIME ZONE 'Asia/Phnom_Penh')::date;
 hm time:=(p_now AT TIME ZONE 'Asia/Phnom_Penh')::time; r record; c record; n_class integer:=0; n_exam integer:=0; n_due integer:=0; n_practice integer:=0;
 n_streak integer:=0; n_material integer:=0; n_missed integer:=0; n_fanout integer:=0; n_rewards integer:=0; streak integer; fresh integer; days integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.academy_profile WHERE id='default' AND allow_student_portal_login) THEN RETURN jsonb_build_object('skipped','student portal access is off'); END IF;
 -- Upcoming class: class_reminder_hours before a dated class on the roster (0 = off).
 FOR r IN SELECT a.student_id,o.id,o.class_name,o.starts_at FROM public.lms_portal_accounts() a
  JOIN public.class_occurrence_roster ro ON ro.student_id=a.student_id JOIN public.class_occurrences o ON o.id=ro.occurrence_id
  WHERE a.class_hours>0 AND o.status='scheduled' AND o.starts_at>p_now AND o.starts_at<=p_now+make_interval(hours=>a.class_hours::integer) LOOP
  n_class:=n_class+public.lms_notify(r.student_id,'class_reminder','class_reminder:'||r.id,
   public.lms_notice_copy('class_reminder',jsonb_build_object('title',r.class_name,'when',to_char(r.starts_at AT TIME ZONE tz,'HH24:MI'))),'/schedule',r.id::text);
 END LOOP;
 -- Belt exam: 14, 3 and 1 days before, from 08:00, for registered or eligible students.
 IF hm>='08:00' THEN
  FOR r IN SELECT a.student_id,e.id,e.exam_date,(e.exam_date-today) AS d FROM public.lms_portal_accounts() a
   JOIN public.students s ON s.id=a.student_id
   JOIN public.grading_events e ON e.published_at IS NOT NULL AND e.cancelled_at IS NULL AND e.syllabus_id IS NOT NULL AND (e.exam_date-today) IN (14,3,1)
   WHERE EXISTS(SELECT 1 FROM public.grading_candidates gc WHERE gc.event_id=e.id AND gc.student_id=s.id AND gc.status NOT IN ('withdrawn','declined','requested'))
    OR (e.kind='color' AND (e.branch_id IS NULL OR e.branch_id=s.home_branch_id)
     AND EXISTS(SELECT 1 FROM public.belts cur JOIN public.belts nxt ON nxt.belt_order=cur.belt_order+1 WHERE cur.id=s.belt_id AND nxt.id=e.target_belt_id)
     AND public.portal_belt_test_eligibility(s.id,e.syllabus_id)->>'status'='eligible') LOOP
   n_exam:=n_exam+public.lms_notify(r.student_id,'exam_reminder','exam_reminder:'||r.id||':'||r.student_id||':'||r.d||'d',
    public.lms_notice_copy('exam_reminder',jsonb_build_object('n',r.d::text,'when',to_char(r.exam_date,'Mon DD, YYYY'))),'/belt-journey',r.id::text);
  END LOOP;
 END IF;
 -- Assignment deadline: 48 h and 12 h before the due time, while not handed in.
 FOR r IN SELECT a.student_id,g.id,g.title,g.due_at,CASE WHEN p_now>=g.due_at-interval '12 hours' THEN '12h' ELSE '48h' END AS lead
  FROM public.lms_portal_accounts() a JOIN public.student_assignments sa ON sa.student_id=a.student_id AND sa.status IN ('open','in_progress')
  JOIN public.assignments g ON g.id=sa.assignment_id AND g.status='published' AND g.due_at IS NOT NULL
  WHERE p_now>=g.due_at-interval '48 hours' AND p_now<g.due_at LOOP
  n_due:=n_due+public.lms_notify(r.student_id,'assignment_due','assignment_due:'||r.id||':'||r.lead,
   public.lms_notice_copy('assignment_due',jsonb_build_object('title',r.title,'when',to_char(r.due_at AT TIME ZONE tz,'Mon DD HH24:MI'))),'/tasks',r.id::text);
 END LOOP;
 -- Daily practice: at the student's time on their chosen days (off until a time is set),
 -- within 3 hours of it, unless they have already practised today.
 FOR r IN SELECT a.student_id FROM public.lms_portal_accounts() a
  WHERE a.practice_time IS NOT NULL AND (a.practice_days IS NULL OR extract(isodow FROM today)::smallint=ANY(a.practice_days))
   AND hm>=a.practice_time AND hm<CASE WHEN a.practice_time>='21:00' THEN '23:59:59'::time ELSE a.practice_time+interval '3 hours' END
   AND NOT EXISTS(SELECT 1 FROM public.lms_practice_days(a.student_id,today,today) d) LOOP
  n_practice:=n_practice+public.lms_notify(r.student_id,'practice_reminder','practice_reminder:'||today,public.lms_notice_copy('practice_reminder'),'/practice',NULL);
 END LOOP;
 -- Training streak: from 19:00, a streak of 3+ days and nothing logged today.
 -- (Nested IFs: the once-a-day mark is taken only after the hour is reached.)
 IF hm>='19:00' THEN IF public.lms_once('streak:'||today) THEN
  FOR r IN SELECT DISTINCT a.student_id FROM public.lms_portal_accounts() a
   WHERE EXISTS(SELECT 1 FROM public.student_portal_events e WHERE e.student_id=a.student_id AND e.created_at>=p_now-interval '2 days') LOOP
   CONTINUE WHEN EXISTS(SELECT 1 FROM public.lms_practice_days(r.student_id,today,today) d);
   streak:=public.lms_current_streak(r.student_id,today);
   CONTINUE WHEN streak<3;
   n_streak:=n_streak+public.lms_notify(r.student_id,'streak_reminder','streak_reminder:'||today,public.lms_notice_copy('streak_reminder',jsonb_build_object('n',streak::text)),'/practice',NULL);
  END LOOP;
 END IF; END IF;
 -- New learning material: one digest a day from 17:00 for lessons published
 -- since the previous digest that are open to the student's belt.
 IF hm>='17:00' THEN IF public.lms_once('new_material:'||today) THEN
  FOR r IN SELECT DISTINCT a.student_id,a.current_belt FROM public.lms_portal_accounts() a LOOP
   SELECT count(*) INTO fresh FROM public.library_published_content pc JOIN public.curriculum cu ON cu.id=pc.curriculum_id
   WHERE cu.is_active AND pc.published_at>=((today-1)::timestamp+time '17:00') AT TIME ZONE tz AND pc.published_at<p_now
    AND public.lms_belt_allows(cu.target_belt,r.current_belt);
   CONTINUE WHEN fresh=0;
   n_material:=n_material+public.lms_notify(r.student_id,'new_material','new_material:'||today,public.lms_notice_copy('new_material',jsonb_build_object('n',fresh::text)),'/learn',NULL);
  END LOOP;
 END IF; END IF;
 -- Daily, from 08:00: missed class yesterday, assignment targets, rewards, tidy-up.
 IF hm>='08:00' THEN IF public.lms_once('daily:'||today) THEN
  FOR r IN SELECT DISTINCT a.student_id,o.id,(o.starts_at AT TIME ZONE tz)::date AS day FROM public.lms_portal_accounts() a
   JOIN public.attendance at ON at.student_id=a.student_id AND at.status='Absent' AND at.occurrence_id IS NOT NULL
   JOIN public.class_occurrences o ON o.id=at.occurrence_id WHERE (o.starts_at AT TIME ZONE tz)::date=today-1 LOOP
   n_missed:=n_missed+public.lms_notify(r.student_id,'missed_class','missed_class:'||r.id,public.lms_notice_copy('missed_class',jsonb_build_object('when',to_char(r.day,'Mon DD'))),'/learn',r.id::text);
  END LOOP;
  -- Students who joined a class, belt or branch since an assignment was published.
  FOR c IN SELECT id FROM public.assignments WHERE status='published' AND (due_at IS NULL OR due_at>p_now) LOOP
   n_fanout:=n_fanout+public.lms_assignment_fanout(c.id);
  END LOOP;
  -- Monthly attendance and any rule that depends on time passing.
  FOR r IN SELECT DISTINCT a.student_id FROM public.lms_portal_accounts() a LOOP
   PERFORM public.student_portal_evaluate_rewards(r.student_id); n_rewards:=n_rewards+1;
  END LOOP;
  UPDATE public.challenges SET status='closed',updated_at=now() WHERE status='published' AND ends_on<today;
  DELETE FROM public.lms_job_marks WHERE created_at<p_now-interval '60 days';
 END IF; END IF;
 RETURN jsonb_build_object('classReminders',n_class,'examReminders',n_exam,'assignmentReminders',n_due,'practiceReminders',n_practice,
  'streakReminders',n_streak,'newMaterial',n_material,'missedClass',n_missed,'assignmentsFannedOut',n_fanout,'rewardsChecked',n_rewards);
END $$;

-- ===========================================================================
-- Grants: service role only.
-- ===========================================================================
DO $$ DECLARE t text; f text; BEGIN
 FOREACH t IN ARRAY ARRAY['lms_announcements','lms_job_marks'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
 FOREACH f IN ARRAY ARRAY['lms_step_exists(integer,text)','lms_int(jsonb,text,integer,integer)','student_portal_record_event(uuid,text,uuid,text,jsonb)',
  'portal_push_eligible(uuid,uuid)','lms_inbox_visible(public.portal_notifications,uuid,text)','portal_student_inbox(uuid,text,text,uuid,timestamptz,uuid)',
  'portal_calendar_preferences(uuid,jsonb)','portal_send_announcement(uuid,uuid,jsonb)','lms_portal_accounts()','lms_once(text)','portal_lms_run_reminders(timestamptz)'] LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC,anon,authenticated',f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role',f);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
