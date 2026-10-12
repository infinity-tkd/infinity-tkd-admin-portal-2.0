-- Each tournament edit (including removals) commits once or rolls back in full.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE OR REPLACE FUNCTION public.portal_save_achievements(
  p_actor uuid, p_student text, p_entries jsonb, p_deleted_ids jsonb, p_request_key uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  entry jsonb;
  item public.achievements;
  previous public.audit_logs;
  payload jsonb := jsonb_build_object('entries', p_entries, 'deletedIds', p_deleted_ids);
  saved jsonb := '[]'::jsonb;
  result jsonb;
  target_id integer;
  removed integer[];
  modified integer[];
BEGIN
  PERFORM public.portal_assert_actor(p_actor, 'action:student_edit');
  IF p_request_key IS NULL OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_deleted_ids) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid achievement request' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_entries) > 100 OR jsonb_array_length(p_deleted_ids) > 100
    OR jsonb_array_length(p_entries) + jsonb_array_length(p_deleted_ids) = 0 THEN
    RAISE EXCEPTION 'Invalid achievement batch size' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('achievement-request:' || p_request_key::text, 0));
  SELECT * INTO previous FROM public.audit_logs WHERE id = p_request_key;
  IF FOUND THEN
    IF previous.action <> 'ACHIEVEMENTS_SAVED' OR previous.performed_by <> p_actor::text
      OR previous.target_id IS DISTINCT FROM p_student OR previous.details->'payload' IS DISTINCT FROM payload THEN
      RAISE EXCEPTION 'Idempotency key mismatch' USING ERRCODE = '22023';
    END IF;
    RETURN previous.details->'result';
  END IF;
  PERFORM 1 FROM public.students WHERE id = p_student AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0002'; END IF;
  SELECT COALESCE(array_agg(value::integer), '{}'::integer[]) INTO removed FROM jsonb_array_elements_text(p_deleted_ids);
  SELECT COALESCE(array_agg((value->>'id')::integer), '{}'::integer[]) INTO modified
    FROM jsonb_array_elements(p_entries) WHERE value ? 'id';
  IF EXISTS(SELECT 1 FROM unnest(removed) id GROUP BY id HAVING count(*) > 1)
    OR EXISTS(SELECT 1 FROM unnest(modified) id GROUP BY id HAVING count(*) > 1)
    OR removed && modified THEN RAISE EXCEPTION 'Duplicate achievement changes' USING ERRCODE = '22023'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(removed || modified) AS requested(id) WHERE requested.id IS NULL OR requested.id <= 0
    OR NOT EXISTS(SELECT 1 FROM public.achievements a WHERE a.id = requested.id AND a.student_id = p_student)) THEN
    RAISE EXCEPTION 'Achievement not found for this student' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM public.achievements WHERE id = ANY(removed) AND student_id = p_student;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
    IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR trim(COALESCE(entry->>'eventName','')) = ''
      OR trim(COALESCE(entry->>'category','')) = '' OR trim(COALESCE(entry->>'division','')) = ''
      OR COALESCE(entry->>'medalRank','') NOT IN ('Gold','Silver','Bronze','Participation','Fourth Place')
      OR COALESCE(entry->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'Invalid achievement fields' USING ERRCODE = '22023';
    END IF;
    IF (entry->>'date')::date < '1900-01-01'::date OR (entry->>'date')::date > (now() AT TIME ZONE 'Asia/Phnom_Penh')::date THEN
      RAISE EXCEPTION 'Invalid achievement date' USING ERRCODE = '22023';
    END IF;
    target_id := (entry->>'id')::integer;
    IF target_id IS NULL THEN
      INSERT INTO public.achievements(student_id,event_name,date,category,division,medal_rank,notes,age_division,belt_division)
        VALUES(p_student,trim(entry->>'eventName'),(entry->>'date')::date,trim(entry->>'category'),trim(entry->>'division'),
          entry->>'medalRank',entry->>'notes',entry->>'ageDivision',entry->>'beltDivision') RETURNING * INTO item;
    ELSE
      UPDATE public.achievements SET event_name=trim(entry->>'eventName'),date=(entry->>'date')::date,
        category=trim(entry->>'category'),division=trim(entry->>'division'),medal_rank=entry->>'medalRank',
        notes=entry->>'notes',age_division=entry->>'ageDivision',belt_division=entry->>'beltDivision'
        WHERE id=target_id AND student_id=p_student RETURNING * INTO item;
      IF NOT FOUND THEN RAISE EXCEPTION 'Achievement no longer exists' USING ERRCODE = 'P0002'; END IF;
    END IF;
    saved := saved || jsonb_build_array(to_jsonb(item));
  END LOOP;
  result := jsonb_build_object('records',saved,'deletedIds',p_deleted_ids);
  INSERT INTO public.audit_logs(id,action,performed_by,target_id,details)
    VALUES(p_request_key,'ACHIEVEMENTS_SAVED',p_actor::text,p_student,jsonb_build_object('payload',payload,'result',result));
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.portal_save_achievements(uuid,text,jsonb,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_save_achievements(uuid,text,jsonb,jsonb,uuid) TO service_role;
REVOKE INSERT,UPDATE,DELETE ON public.achievements FROM authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
