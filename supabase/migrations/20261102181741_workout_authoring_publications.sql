BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

-- Private authoring is distinct from the legacy published routine reader.
CREATE TABLE public.workout_template_drafts (
 id uuid PRIMARY KEY,
 title text NOT NULL, description text NOT NULL, difficulty text NOT NULL,
 duration_mins integer NOT NULL, creator_name text NOT NULL, structure jsonb NOT NULL,
 revision integer NOT NULL CHECK(revision>0), published_revision integer CHECK(published_revision>=0 AND published_revision<=revision),
 created_by uuid NOT NULL REFERENCES public.profiles(id), updated_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz
);
CREATE TABLE public.portal_workout_commands (
 request_key uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES public.profiles(id),
 payload jsonb NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workout_template_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_workout_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workout_template_drafts,public.portal_workout_commands FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.workout_template_drafts,public.portal_workout_commands TO service_role;
REVOKE INSERT,UPDATE,DELETE ON public.workout_templates FROM anon,authenticated;

CREATE VIEW public.portal_workout_management WITH(security_invoker=true) AS
 SELECT COALESCE(d.id,p.id) id,COALESCE(d.title,p.title) title,COALESCE(d.description,p.description) description,
  COALESCE(d.difficulty,p.difficulty) difficulty,COALESCE(d.duration_mins,p.duration_mins) duration_mins,
  COALESCE(d.creator_name,p.creator_name) creator_name,COALESCE(d.structure,p.structure) structure,
  COALESCE(d.revision,0) revision,CASE WHEN p.id IS NOT NULL THEN COALESCE(d.published_revision,0) ELSE NULL END published_revision
 FROM public.workout_templates p FULL OUTER JOIN (SELECT * FROM public.workout_template_drafts WHERE archived_at IS NULL) d ON d.id=p.id;
REVOKE ALL ON public.portal_workout_management FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.portal_workout_management TO service_role;

CREATE FUNCTION public.portal_save_workout_draft(p_actor uuid,p_action text,p_id uuid,p_expected_revision integer,p_request_key uuid,p_payload jsonb,p_reason text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE prior public.portal_workout_commands; draft public.workout_template_drafts; published public.workout_templates;
 signature jsonb; response jsonb; next_revision integer; s jsonb; intervals integer; duration_seconds integer; exercise jsonb;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 IF p_action IS NULL OR p_action NOT IN('SAVE_DRAFT','PUBLISH','ARCHIVE') OR p_id IS NULL OR p_request_key IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 THEN RAISE EXCEPTION 'Invalid routine command' USING ERRCODE='22023'; END IF;
 signature:=jsonb_build_object('id',p_id,'action',p_action,'revision',p_expected_revision,'template',p_payload,'reason',p_reason);
 PERFORM pg_advisory_xact_lock(hashtextextended('workout-command:'||p_request_key,0));
 SELECT * INTO prior FROM public.portal_workout_commands WHERE request_key=p_request_key;
 IF FOUND THEN
  IF prior.actor_id<>p_actor OR prior.payload IS DISTINCT FROM signature THEN RAISE EXCEPTION 'Routine request key mismatch' USING ERRCODE='22023'; END IF;
  RETURN prior.result;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('workout-authoring:'||p_id,0));
 SELECT * INTO draft FROM public.workout_template_drafts WHERE id=p_id FOR UPDATE;
 SELECT * INTO published FROM public.workout_templates WHERE id=p_id FOR UPDATE;
 IF draft.archived_at IS NOT NULL THEN RAISE EXCEPTION 'This routine draft is archived' USING ERRCODE='22023'; END IF;
 IF COALESCE(draft.revision,0)<>p_expected_revision THEN RAISE EXCEPTION 'Routine changed. Reload before saving' USING ERRCODE='40001'; END IF;
 next_revision:=COALESCE(draft.revision,0)+1;
 IF p_action='ARCHIVE' THEN
  IF published.id IS NOT NULL THEN RAISE EXCEPTION 'Published routines are retained. Save a revised draft instead' USING ERRCODE='22023'; END IF;
  IF draft.id IS NULL THEN RAISE EXCEPTION 'Routine draft unavailable' USING ERRCODE='22023'; END IF;
  UPDATE public.workout_template_drafts SET archived_at=now(),revision=next_revision,updated_at=now(),updated_by=p_actor WHERE id=p_id;
  response:=jsonb_build_object('id',p_id,'archived',true,'revision',next_revision);
 ELSE
  s:=p_payload->'structure';
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR NOT(p_payload ?& ARRAY['title','description','difficulty','creator_name','structure']) OR jsonb_typeof(p_payload->'title') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'description') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'creator_name') IS DISTINCT FROM 'string' OR length(trim(p_payload->>'title')) NOT BETWEEN 1 AND 150 OR length(p_payload->>'description')>10000 OR COALESCE(p_payload->>'difficulty','') NOT IN('Beginner','Intermediate','Advanced','Elite') OR length(trim(p_payload->>'creator_name')) NOT BETWEEN 1 AND 100 OR jsonb_typeof(s) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid routine content' USING ERRCODE='22023'; END IF;
  IF NOT(s ?& ARRAY['routineType','prepareSeconds','workSeconds','restSeconds','rounds','exercises']) OR EXISTS(SELECT 1 FROM jsonb_object_keys(s) key WHERE key NOT IN('routineType','prepareSeconds','workSeconds','restSeconds','rounds','exercises')) OR jsonb_typeof(s->'exercises') IS DISTINCT FROM 'array' OR jsonb_array_length(s->'exercises') NOT BETWEEN 1 AND 50 OR jsonb_typeof(s->'routineType') IS DISTINCT FROM 'string' OR length(trim(s->>'routineType')) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid workout structure' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['prepareSeconds','workSeconds','restSeconds','rounds']) key WHERE jsonb_typeof(s->key) IS DISTINCT FROM 'number') THEN RAISE EXCEPTION 'Invalid workout timing' USING ERRCODE='22023'; END IF;
  IF NOT(s->>'prepareSeconds'~'^\d{1,4}$' AND s->>'workSeconds'~'^\d{1,4}$' AND s->>'restSeconds'~'^\d{1,4}$' AND s->>'rounds'~'^\d{1,2}$') THEN RAISE EXCEPTION 'Invalid workout timing' USING ERRCODE='22023'; END IF;
  IF (s->>'prepareSeconds')::integer NOT BETWEEN 0 AND 300 OR (s->>'workSeconds')::integer NOT BETWEEN 1 AND 3600 OR (s->>'restSeconds')::integer NOT BETWEEN 0 AND 1800 OR (s->>'rounds')::integer NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Invalid workout timing' USING ERRCODE='22023'; END IF;
  FOR exercise IN SELECT value FROM jsonb_array_elements(s->'exercises') LOOP
   IF jsonb_typeof(exercise) IS DISTINCT FROM 'string' OR length(trim(exercise#>>'{}')) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'Invalid workout exercise' USING ERRCODE='22023'; END IF;
  END LOOP;
  intervals:=jsonb_array_length(s->'exercises')*(s->>'rounds')::integer;
  duration_seconds:=(s->>'prepareSeconds')::integer+intervals*(s->>'workSeconds')::integer+greatest(0,intervals-1)*(s->>'restSeconds')::integer;
  IF duration_seconds>43200 THEN RAISE EXCEPTION 'Workout exceeds 12 hours' USING ERRCODE='22023'; END IF;
  IF p_action='PUBLISH' AND length(trim(COALESCE(p_reason,''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Record a publication reason' USING ERRCODE='22023'; END IF;
  INSERT INTO public.workout_template_drafts(id,title,description,difficulty,duration_mins,creator_name,structure,revision,published_revision,created_by,updated_by)
   VALUES(p_id,p_payload->>'title',p_payload->>'description',p_payload->>'difficulty',greatest(1,ceil(duration_seconds/60.0)::integer),p_payload->>'creator_name',s,next_revision,
    CASE WHEN p_action='PUBLISH' THEN next_revision WHEN published.id IS NOT NULL THEN COALESCE(draft.published_revision,0) ELSE NULL END,p_actor,p_actor)
   ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,difficulty=EXCLUDED.difficulty,duration_mins=EXCLUDED.duration_mins,creator_name=EXCLUDED.creator_name,structure=EXCLUDED.structure,revision=EXCLUDED.revision,published_revision=EXCLUDED.published_revision,updated_at=now(),updated_by=p_actor
   RETURNING * INTO draft;
  IF p_action='PUBLISH' THEN
   INSERT INTO public.workout_templates(id,title,description,difficulty,duration_mins,creator_name,structure)
    VALUES(p_id,draft.title,draft.description,draft.difficulty,draft.duration_mins,draft.creator_name,draft.structure)
    ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,difficulty=EXCLUDED.difficulty,duration_mins=EXCLUDED.duration_mins,creator_name=EXCLUDED.creator_name,structure=EXCLUDED.structure;
  END IF;
  response:=jsonb_build_object('id',p_id,'template',to_jsonb(draft),'published',p_action='PUBLISH');
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('WORKOUT_'||p_action,p_actor::text,p_id::text,jsonb_build_object('revision',next_revision,'reason',left(p_reason,500)));
 INSERT INTO public.portal_workout_commands(request_key,actor_id,payload,result) VALUES(p_request_key,p_actor,signature,response);
 RETURN response;
END $$;
REVOKE ALL ON FUNCTION public.portal_save_workout_draft(uuid,text,uuid,integer,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_save_workout_draft(uuid,text,uuid,integer,uuid,jsonb,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
