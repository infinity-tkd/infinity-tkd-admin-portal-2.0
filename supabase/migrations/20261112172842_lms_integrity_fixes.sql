-- LMS integrity fixes from the deep check (12 Nov 2026):
-- 1. Deleting an unpublished library lesson that LMS records point at failed
--    with a raw foreign-key error. It now explains what blocks it, and removes
--    the lesson's own quiz questions when nothing does.
-- 2. Deleting a form that an open assignment or challenge uses left a dangling
--    link; it is now refused with a message.
-- 3. Withdrawing an already withdrawn submission said "reviewed"; a repeat
--    withdraw is now a no-op (a double tap on a phone).
-- Active goals that pointed at a deleted lesson or form are dropped.
-- student_portal_withdraw_submission is replaced from 20261112130410
-- (md5 554354bf240060ff9ef01a86211e112a) with one marked addition.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

CREATE OR REPLACE FUNCTION public.lms_guard_lesson_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.poomsae_forms WHERE curriculum_id=OLD.id) THEN
  RAISE EXCEPTION 'A poomsae form uses this lesson. Delete the form in Coaching first' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.student_step_checks WHERE curriculum_id=OLD.id)
  OR EXISTS(SELECT 1 FROM public.student_self_assessments WHERE subject_type IN ('lesson','step') AND split_part(subject_ref,':',1)=OLD.id::text)
  OR EXISTS(SELECT 1 FROM public.student_quiz_attempts WHERE scope='lesson' AND scope_ref=OLD.id::text) THEN
  RAISE EXCEPTION 'This lesson has student practice history and cannot be deleted' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.assignments WHERE status<>'closed' AND ((subject_type='lesson' AND subject_ref=OLD.id::text)
   OR (kind='quiz' AND target->>'scope'='lesson' AND target->>'scopeRef'=OLD.id::text)))
  OR EXISTS(SELECT 1 FROM public.challenges WHERE status<>'closed' AND ((subject_type='lesson' AND subject_ref=OLD.id::text) OR (subject_type='quiz' AND subject_ref='lesson:'||OLD.id))) THEN
  RAISE EXCEPTION 'An assignment or challenge uses this lesson. Close it first' USING ERRCODE='22023'; END IF;
 DELETE FROM public.quiz_questions WHERE scope='lesson' AND scope_ref=OLD.id::text;
 UPDATE public.student_goals SET status='dropped',updated_at=now() WHERE status='active' AND kind='lesson' AND subject_ref=OLD.id::text;
 RETURN OLD;
END $$;
CREATE TRIGGER lms_guard_lesson_delete BEFORE DELETE ON public.curriculum FOR EACH ROW EXECUTE FUNCTION public.lms_guard_lesson_delete();

CREATE OR REPLACE FUNCTION public.lms_guard_form_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.assignments WHERE status<>'closed' AND ((subject_type='form' AND subject_ref=OLD.id::text)
   OR (kind='quiz' AND target->>'scope'='form' AND target->>'scopeRef'=OLD.id::text)))
  OR EXISTS(SELECT 1 FROM public.challenges WHERE status<>'closed' AND ((subject_type='form' AND subject_ref=OLD.id::text) OR (subject_type='quiz' AND subject_ref='form:'||OLD.id))) THEN
  RAISE EXCEPTION 'An assignment or challenge uses this form. Close it first' USING ERRCODE='23503'; END IF;
 UPDATE public.student_goals SET status='dropped',updated_at=now() WHERE status='active' AND kind='form' AND subject_ref=OLD.id::text;
 RETURN OLD;
END $$;
CREATE TRIGGER lms_guard_form_delete BEFORE DELETE ON public.poomsae_forms FOR EACH ROW EXECUTE FUNCTION public.lms_guard_form_delete();

-- Withdraws a submission not yet reviewed. The video is removed by the cleanup job.
CREATE OR REPLACE FUNCTION public.student_portal_withdraw_submission(p_actor uuid,p_student text,p_submission uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE st public.students; s public.student_submissions;
BEGIN
 st:=public.student_portal_assert_student(p_actor,p_student);
 SELECT * INTO s FROM public.student_submissions WHERE id=p_submission AND student_id=st.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found' USING ERRCODE='P0002'; END IF;
 -- Integrity fix: a repeated withdraw returns the withdrawn submission.
 IF s.status='withdrawn' THEN RETURN jsonb_build_object('submission',to_jsonb(s)-'request_key'-'actor_id'); END IF;
 IF s.status NOT IN ('uploading','submitted') THEN RAISE EXCEPTION 'A reviewed submission cannot be withdrawn' USING ERRCODE='22023'; END IF;
 UPDATE public.student_submissions SET status='withdrawn',updated_at=now() WHERE id=s.id RETURNING * INTO s;
 IF s.assignment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.student_submissions x WHERE x.assignment_id=s.assignment_id AND x.student_id=st.id AND x.status='submitted') THEN
  UPDATE public.student_assignments SET status=CASE WHEN progress='{}'::jsonb THEN 'open' ELSE 'in_progress' END,updated_at=now() WHERE assignment_id=s.assignment_id AND student_id=st.id AND status='submitted';
 END IF;
 RETURN jsonb_build_object('submission',to_jsonb(s)-'request_key'-'actor_id');
END $$;

REVOKE ALL ON FUNCTION public.lms_guard_lesson_delete() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.lms_guard_form_delete() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
