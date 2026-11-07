BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Preparation is deliberately separate from the approved student-facing tables.
-- There is no publication operation or baseline/consent seed in this migration.
CREATE TABLE IF NOT EXISTS public.student_portal_admin_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('readiness','ranking')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 120),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 1048576),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  updated_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE INDEX IF NOT EXISTS student_portal_admin_drafts_kind_updated_idx ON public.student_portal_admin_drafts(kind,updated_at DESC,id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS student_portal_admin_drafts_creator_idx ON public.student_portal_admin_drafts(created_by);
CREATE INDEX IF NOT EXISTS student_portal_admin_drafts_updater_idx ON public.student_portal_admin_drafts(updated_by);
ALTER TABLE public.student_portal_admin_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_portal_admin_drafts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.student_portal_admin_drafts TO service_role;

CREATE OR REPLACE FUNCTION public.portal_student_publication_admin(
  p_actor uuid,p_action text,p_data jsonb,p_request_key uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  actor_role text;
  previous public.audit_logs;
  draft public.student_portal_admin_drafts;
  student public.students;
  policy public.student_portal_readiness_policies;
  confirmation public.student_portal_coach_confirmations;
  result jsonb;
  payload jsonb := jsonb_build_object('action',p_action,'data',p_data);
  lesson jsonb;
  rank_start date;
  rank_name text;
  current_time_value timestamptz := clock_timestamp();
  academy_today date := (clock_timestamp() AT TIME ZONE 'Asia/Phnom_Penh')::date;
BEGIN
  PERFORM public.portal_assert_actor(p_actor,'page:lms');
  PERFORM public.portal_assert_actor(p_actor,'action:evaluations_grade');
  SELECT role INTO actor_role FROM public.profiles WHERE id=p_actor;
  IF actor_role NOT IN ('Root','Super Root','Admin','Head Coach','Coach','Assistant Coach') THEN
    RAISE EXCEPTION 'Preparation access denied' USING ERRCODE='42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('save_draft','archive_draft','confirm_lesson','withdraw_confirmation') OR p_request_key IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid preparation request' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('student-publication-admin:'||p_request_key::text,0));
  SELECT * INTO previous FROM public.audit_logs WHERE id=p_request_key;
  IF FOUND THEN
    IF previous.action <> 'STUDENT_PORTAL_ADMIN_'||upper(p_action) OR previous.performed_by<>p_actor::text OR previous.details->'payload' IS DISTINCT FROM payload THEN
      RAISE EXCEPTION 'Preparation request key mismatch' USING ERRCODE='22023';
    END IF;
    RETURN previous.details->'result';
  END IF;

  IF p_action IN ('save_draft','archive_draft') THEN
    IF actor_role NOT IN ('Root','Super Root','Admin','Head Coach') THEN
      RAISE EXCEPTION 'Academy preparation requires an administrator or head coach' USING ERRCODE='42501';
    END IF;
    IF p_data->>'id' IS NOT NULL THEN
      SELECT * INTO draft FROM public.student_portal_admin_drafts WHERE id=(p_data->>'id')::uuid AND archived_at IS NULL FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Draft unavailable' USING ERRCODE='P0002'; END IF;
      IF draft.revision IS DISTINCT FROM (p_data->>'revision')::integer THEN RAISE EXCEPTION 'Draft changed. Reload before saving' USING ERRCODE='40001'; END IF;
    ELSIF p_action='archive_draft' OR (p_data->>'revision')::integer IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION 'Invalid draft revision' USING ERRCODE='22023';
    END IF;
    IF p_action='archive_draft' THEN
      IF length(btrim(COALESCE(p_data->>'reason',''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'A correction reason is required' USING ERRCODE='22023'; END IF;
      UPDATE public.student_portal_admin_drafts SET archived_at=current_time_value,updated_at=current_time_value,updated_by=p_actor,revision=revision+1 WHERE id=draft.id RETURNING * INTO draft;
    ELSE
      IF p_data->>'kind' NOT IN ('readiness','ranking') OR length(btrim(COALESCE(p_data->>'title',''))) NOT BETWEEN 2 AND 120
        OR jsonb_typeof(p_data->'payload') IS DISTINCT FROM 'object' OR octet_length((p_data->'payload')::text)>1048576 THEN
        RAISE EXCEPTION 'Invalid preparation draft' USING ERRCODE='22023';
      END IF;
      IF draft.id IS NOT NULL AND draft.kind<>p_data->>'kind' THEN RAISE EXCEPTION 'Draft kind cannot change' USING ERRCODE='22023'; END IF;
      IF p_data->>'kind'='readiness' THEN
        IF jsonb_typeof(p_data->'payload'->'lessons') IS DISTINCT FROM 'array' OR jsonb_typeof(p_data->'payload'->'skills') IS DISTINCT FROM 'array'
          OR length(btrim(COALESCE(p_data->'payload'->>'targetBelt',''))) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Invalid readiness draft' USING ERRCODE='22023'; END IF;
        FOR lesson IN SELECT value FROM jsonb_array_elements(p_data->'payload'->'lessons') LOOP
          IF NOT EXISTS(SELECT 1 FROM public.curriculum WHERE id=(lesson->>'curriculumId')::integer AND is_active=true) THEN RAISE EXCEPTION 'Draft contains an unavailable curriculum lesson' USING ERRCODE='22023'; END IF;
        END LOOP;
      ELSE
        IF jsonb_typeof(p_data->'payload'->'entries') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'payload'->'entries')>1000 THEN RAISE EXCEPTION 'Invalid ranking draft' USING ERRCODE='22023'; END IF;
        IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_data->'payload'->'entries') e WHERE NOT EXISTS(SELECT 1 FROM public.students s WHERE s.id=e->>'student_id' AND s.deleted_at IS NULL)) THEN RAISE EXCEPTION 'Ranking student unavailable' USING ERRCODE='22023'; END IF;
        IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_data->'payload'->'entries') e GROUP BY e->>'student_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate ranking student' USING ERRCODE='22023'; END IF;
      END IF;
      IF draft.id IS NULL THEN
        INSERT INTO public.student_portal_admin_drafts(kind,title,payload,created_by,updated_by) VALUES(p_data->>'kind',btrim(p_data->>'title'),p_data->'payload',p_actor,p_actor) RETURNING * INTO draft;
      ELSE
        UPDATE public.student_portal_admin_drafts SET title=btrim(p_data->>'title'),payload=p_data->'payload',updated_by=p_actor,updated_at=current_time_value,revision=revision+1 WHERE id=draft.id RETURNING * INTO draft;
      END IF;
    END IF;
    result:=jsonb_build_object('id',draft.id,'revision',draft.revision,'state','draft','archived',draft.archived_at IS NOT NULL);
  ELSIF p_action='confirm_lesson' THEN
    SELECT * INTO student FROM public.students WHERE id=p_data->>'studentId' AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Student unavailable' USING ERRCODE='P0002'; END IF;
    SELECT * INTO policy FROM public.student_portal_readiness_policies WHERE id=(p_data->>'policyId')::uuid FOR SHARE;
    current_time_value:=clock_timestamp();
    academy_today:=(current_time_value AT TIME ZONE 'Asia/Phnom_Penh')::date;
    IF NOT FOUND OR policy.revoked_at IS NOT NULL OR policy.publish_from>current_time_value OR policy.publish_until<=current_time_value OR policy.approved_at>policy.publish_from
      OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=policy.approved_by AND is_active=true AND role IN ('Root','Super Root','Admin','Head Coach')) THEN
      RAISE EXCEPTION 'Choose a currently approved and published readiness policy' USING ERRCODE='22023';
    END IF;
    IF lower(btrim(policy.target_belt))<>lower(btrim(student.current_belt)) THEN RAISE EXCEPTION 'Policy does not match the current student belt' USING ERRCODE='22023'; END IF;
    IF (SELECT count(*) FROM public.student_portal_readiness_policies WHERE lower(btrim(target_belt))=lower(btrim(student.current_belt)) AND revoked_at IS NULL AND publish_from<=current_time_value AND publish_until>current_time_value)>1 THEN
      RAISE EXCEPTION 'Overlapping readiness policies need academy review' USING ERRCODE='22023';
    END IF;
    SELECT belt_level,promotion_date INTO rank_name,rank_start FROM public.belt_histories WHERE student_id=student.id ORDER BY promotion_date DESC,id DESC LIMIT 1;
    IF rank_start IS NULL THEN
      IF lower(btrim(COALESCE(student.initial_belt,'')))=lower(btrim(student.current_belt)) THEN rank_start:=student.registration_date; END IF;
    ELSIF lower(btrim(rank_name))<>lower(btrim(student.current_belt)) THEN
      RAISE EXCEPTION 'Current rank history needs review before confirmation' USING ERRCODE='22023';
    END IF;
    IF rank_start IS NULL OR rank_start>academy_today THEN RAISE EXCEPTION 'Current rank start needs review before confirmation' USING ERRCODE='22023'; END IF;
    IF jsonb_typeof(policy.requirements->'lessons') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Policy lesson mapping needs review' USING ERRCODE='22023'; END IF;
    SELECT value INTO lesson FROM jsonb_array_elements(policy.requirements->'lessons') WHERE value->>'id'=p_data->>'requirementKey';
    IF lesson IS NULL OR (SELECT count(*) FROM jsonb_array_elements(policy.requirements->'lessons') WHERE value->>'id'=p_data->>'requirementKey')<>1
      OR NOT EXISTS(SELECT 1 FROM public.curriculum WHERE id=(lesson->>'curriculumId')::integer AND is_active=true) THEN
      RAISE EXCEPTION 'Choose an active lesson requirement from this exact policy' USING ERRCODE='22023';
    END IF;
    IF (p_data->>'observedNow')::boolean IS DISTINCT FROM true OR COALESCE(p_data->>'result','') NOT IN ('passed','needs_work') OR COALESCE(p_data->>'requirementKey','') !~ '^[a-z0-9_-]{1,60}$' OR length(btrim(COALESCE(p_data->>'reference',''))) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'Record the observed result and genuine evidence reference' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.student_portal_coach_confirmations(student_id,policy_id,requirement_key,result,confirmed_by,confirmed_at,confirmation_reference)
      VALUES(student.id,policy.id,p_data->>'requirementKey',p_data->>'result',p_actor,current_time_value,btrim(p_data->>'reference')) RETURNING * INTO confirmation;
    result:=jsonb_build_object('id',confirmation.id,'confirmedAt',confirmation.confirmed_at,'result',confirmation.result);
  ELSE
    SELECT * INTO confirmation FROM public.student_portal_coach_confirmations WHERE id=(p_data->>'id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Confirmation unavailable' USING ERRCODE='P0002'; END IF;
    IF confirmation.confirmed_by<>p_actor AND actor_role NOT IN ('Root','Super Root','Admin','Head Coach') THEN RAISE EXCEPTION 'Only the recording coach or academy reviewer can withdraw this confirmation' USING ERRCODE='42501'; END IF;
    IF confirmation.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Confirmation already withdrawn' USING ERRCODE='40001'; END IF;
    IF length(btrim(COALESCE(p_data->>'reason',''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'A correction reason is required' USING ERRCODE='22023'; END IF;
    -- Retain the latest result as withdrawn; never delete it or restore an older pass.
    UPDATE public.student_portal_coach_confirmations SET revoked_at=current_time_value WHERE id=confirmation.id;
    result:=jsonb_build_object('id',confirmation.id,'withdrawn',true);
  END IF;
  INSERT INTO public.audit_logs(id,action,performed_by,target_id,details) VALUES(p_request_key,'STUDENT_PORTAL_ADMIN_'||upper(p_action),p_actor::text,result->>'id',jsonb_build_object('payload',payload,'result',result));
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_student_publication_admin(uuid,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_student_publication_admin(uuid,text,jsonb,uuid) TO service_role;
COMMIT;
