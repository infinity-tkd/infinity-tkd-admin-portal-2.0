-- One active plan per student, explicit replacements, and retained assignment history.
ALTER TABLE public.student_training_plans ADD COLUMN IF NOT EXISTS ended_at timestamptz;
ALTER TABLE public.student_training_plans ADD COLUMN IF NOT EXISTS ended_by uuid;
ALTER TABLE public.student_training_plans ADD COLUMN IF NOT EXISTS end_reason text;
ALTER TABLE public.student_training_plans DROP CONSTRAINT IF EXISTS student_training_plans_template_id_fkey;
ALTER TABLE public.student_training_plans ADD CONSTRAINT student_training_plans_template_id_fkey FOREIGN KEY(template_id) REFERENCES public.workout_templates(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS portal_training_one_active ON public.student_training_plans(student_id) WHERE is_active=true;
CREATE INDEX IF NOT EXISTS portal_training_plan_template ON public.student_training_plans(template_id);
CREATE TABLE IF NOT EXISTS public.portal_training_plan_requests (
 request_key uuid PRIMARY KEY,
 actor_id uuid NOT NULL,
 student_id text NOT NULL,
 request_payload jsonb NOT NULL,
 response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portal_training_plan_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_training_plan_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.portal_training_plan_requests TO service_role;
REVOKE INSERT,UPDATE,DELETE ON public.student_training_plans FROM authenticated;

CREATE OR REPLACE FUNCTION public.portal_assign_training_plan(
 p_actor uuid,p_student text,p_action text,p_template uuid,p_expected_plan uuid,p_reason text,p_request_key uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 actor_role text; current_plan uuid; saved public.student_training_plans; template public.workout_templates;
 prior public.portal_training_plan_requests; payload jsonb; response jsonb; structure jsonb; exercise jsonb;
 field text; preparation integer; work integer; rest integer; rounds integer; count_steps integer;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:evaluations_grade');
 IF p_action NOT IN ('ASSIGN','WITHDRAW') OR p_request_key IS NULL OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 OR p_student IS NULL THEN
  RAISE EXCEPTION 'Review the assignment and reason' USING ERRCODE='22023';
 END IF;
 payload:=jsonb_build_object('studentId',p_student,'action',p_action,'templateId',p_template,'expectedActivePlanId',p_expected_plan,'reason',trim(p_reason));
 PERFORM pg_advisory_xact_lock(hashtextextended('student-training-plan:'||p_student,0));
 SELECT * INTO prior FROM public.portal_training_plan_requests WHERE request_key=p_request_key;
 IF FOUND THEN
  IF prior.actor_id IS DISTINCT FROM p_actor OR prior.request_payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'Request key mismatch' USING ERRCODE='22023'; END IF;
  RETURN prior.response;
 END IF;
 PERFORM 1 FROM public.students WHERE id=p_student AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student is unavailable' USING ERRCODE='P0002'; END IF;
 SELECT role INTO actor_role FROM public.profiles WHERE id=p_actor;
 IF actor_role NOT IN ('Root','Super Root','Admin','Head Coach') AND NOT EXISTS(
  SELECT 1 FROM public.class_enrollments e JOIN public.class_sessions c ON c.id=e.class_id
  WHERE e.student_id=p_student AND (c.coach_id=p_actor OR c.head_coach_id=p_actor)
 ) THEN RAISE EXCEPTION 'This student is outside your assigned classes' USING ERRCODE='42501'; END IF;
 SELECT id INTO current_plan FROM public.student_training_plans WHERE student_id=p_student AND is_active=true FOR UPDATE;
 IF current_plan IS DISTINCT FROM p_expected_plan THEN RAISE EXCEPTION 'Training assignment changed. Refresh before saving' USING ERRCODE='40001'; END IF;
 IF p_action='WITHDRAW' THEN
  IF current_plan IS NULL OR p_template IS NOT NULL THEN RAISE EXCEPTION 'Choose the current assignment to withdraw' USING ERRCODE='22023'; END IF;
  UPDATE public.student_training_plans SET is_active=false,ended_at=now(),ended_by=p_actor,end_reason=trim(p_reason) WHERE id=current_plan RETURNING * INTO saved;
 ELSE
  IF EXISTS(SELECT 1 FROM public.students WHERE id=p_student AND student_status='Suspended') THEN RAISE EXCEPTION 'Review the suspended membership before assigning training' USING ERRCODE='22023'; END IF;
  SELECT * INTO template FROM public.workout_templates WHERE id=p_template FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workout template is unavailable' USING ERRCODE='P0002'; END IF;
  structure:=template.structure;
  IF jsonb_typeof(structure) IS DISTINCT FROM 'object' OR jsonb_typeof(structure->'exercises') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Review the workout template structure' USING ERRCODE='22023'; END IF;
  FOREACH field IN ARRAY ARRAY['prepareSeconds','workSeconds','restSeconds','rounds'] LOOP
   IF jsonb_typeof(structure->field) IS DISTINCT FROM 'number' OR (structure->>field)!~'^[0-9]+$' OR length(structure->>field)>5 THEN RAISE EXCEPTION 'Review the workout timing fields' USING ERRCODE='22023'; END IF;
  END LOOP;
  preparation:=(structure->>'prepareSeconds')::integer;work:=(structure->>'workSeconds')::integer;rest:=(structure->>'restSeconds')::integer;rounds:=(structure->>'rounds')::integer;count_steps:=jsonb_array_length(structure->'exercises');
  IF preparation NOT BETWEEN 0 AND 300 OR work NOT BETWEEN 1 AND 3600 OR rest NOT BETWEEN 0 AND 1800 OR rounds NOT BETWEEN 1 AND 20 OR count_steps NOT BETWEEN 1 AND 50 OR preparation+work*rounds*count_steps+rest*(rounds*count_steps-1)>43200 THEN
   RAISE EXCEPTION 'Workout exceeds the supported student training limits' USING ERRCODE='22023';
  END IF;
  FOR exercise IN SELECT value FROM jsonb_array_elements(structure->'exercises') LOOP
   IF jsonb_typeof(exercise) IS DISTINCT FROM 'string' OR length(trim(exercise#>>'{}')) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'Review the workout exercise names' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF current_plan IS NOT NULL THEN UPDATE public.student_training_plans SET is_active=false,ended_at=now(),ended_by=p_actor,end_reason='Replaced: '||trim(p_reason) WHERE id=current_plan; END IF;
  INSERT INTO public.student_training_plans(student_id,template_id,assigned_by,customized_structure,is_active)
  VALUES(p_student,p_template,p_actor,structure||jsonb_build_object('templateSnapshot',jsonb_build_object('id',template.id,'title',template.title,'difficulty',template.difficulty,'duration_mins',template.duration_mins)),true) RETURNING * INTO saved;
 END IF;
 response:=jsonb_build_object('saved',true,'planId',saved.id,'activePlanId',CASE WHEN saved.is_active THEN saved.id ELSE NULL END);
 INSERT INTO public.portal_training_plan_requests(request_key,actor_id,student_id,request_payload,response) VALUES(p_request_key,p_actor,p_student,payload,response);
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('STUDENT_TRAINING_'||p_action,p_actor::text,p_student,jsonb_build_object('planId',saved.id,'templateId',p_template,'previousPlanId',current_plan,'reason',trim(p_reason),'requestKey',p_request_key));
 RETURN response;
END $$;
REVOKE ALL ON FUNCTION public.portal_assign_training_plan(uuid,text,text,uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_assign_training_plan(uuid,text,text,uuid,uuid,text,uuid) TO service_role;
