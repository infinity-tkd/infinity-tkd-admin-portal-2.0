-- Authoring stays private until an explicit, version-checked publication.
-- Existing lesson snapshots and student progress are not rewritten.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public.library_assets
 ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN published_revision integer,
 ADD COLUMN student_curriculum_id integer UNIQUE REFERENCES public.curriculum(id);
ALTER TABLE public.library_assets ALTER COLUMN video_url TYPE text,ALTER COLUMN thumbnail_url TYPE text;
ALTER TABLE public.curriculum
 ADD COLUMN content_type text NOT NULL DEFAULT 'Taekwondo' CHECK(content_type IN('Taekwondo','Fitness','Dance')),
 ADD COLUMN content_category text,
 ADD COLUMN learning_content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(learning_content)='object');
CREATE INDEX portal_library_catalog_updated ON public.library_assets(updated_at DESC,id DESC);

CREATE OR REPLACE FUNCTION public.portal_save_library_asset(p_actor uuid,p_action text,p_id integer,p_payload jsonb,p_request_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE asset public.library_assets; desired public.library_assets; mirrored public.curriculum; relation jsonb; projection jsonb; maximum_id integer; has_history boolean; expected integer; linked_id integer; curriculum_category text;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 PERFORM pg_advisory_xact_lock(hashtextextended('library-curriculum-write',0));
 IF p_action NOT IN('CREATE','UPDATE','DELETE','PUBLISH','UNPUBLISH') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid library request' USING ERRCODE='22023'; END IF;
 projection:=p_payload->'studentProjection';
 IF p_action IN('CREATE','UPDATE','PUBLISH') AND (jsonb_typeof(projection) IS DISTINCT FROM 'object' OR jsonb_typeof(projection->'description') IS DISTINCT FROM 'string' OR coalesce(jsonb_typeof(projection->'video_url'),'missing') NOT IN('string','null') OR coalesce(jsonb_typeof(projection->'thumbnail_url'),'missing') NOT IN('string','null')) THEN RAISE EXCEPTION 'Invalid public lesson projection' USING ERRCODE='22023'; END IF;
 IF p_action='CREATE' THEN
  IF p_request_key IS NULL THEN RAISE EXCEPTION 'Request key required' USING ERRCODE='22023'; END IF;
  SELECT * INTO asset FROM public.library_assets WHERE request_key=p_request_key;
  IF FOUND THEN
   IF asset.created_by IS DISTINCT FROM p_actor OR asset.request_payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Idempotency key mismatch' USING ERRCODE='22023'; END IF;
   SELECT * INTO mirrored FROM public.curriculum WHERE id=asset.student_curriculum_id;
   RETURN jsonb_build_object('asset',to_jsonb(asset),'studentLesson',to_jsonb(mirrored),'relations',COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM public.library_asset_muscles r WHERE asset_id=asset.id),'[]'::jsonb));
  END IF;
  SELECT * INTO desired FROM jsonb_populate_record(NULL::public.library_assets,p_payload);
  SELECT GREATEST(COALESCE((SELECT max(id) FROM public.library_assets),0),COALESCE((SELECT max(id) FROM public.curriculum),0)) INTO maximum_id;
  PERFORM setval(pg_get_serial_sequence('public.library_assets','id'),GREATEST(maximum_id,1),maximum_id>0);
  INSERT INTO public.library_assets(title,description,library_type,tkd_category,fitness_category,target_level,video_url,thumbnail_url,request_key,request_payload,created_by)
   VALUES(desired.title,desired.description,desired.library_type,desired.tkd_category,desired.fitness_category,desired.target_level,desired.video_url,projection->>'thumbnail_url',p_request_key,p_payload,p_actor) RETURNING * INTO asset;
 ELSE
  SELECT * INTO asset FROM public.library_assets WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Library asset not found' USING ERRCODE='P0002'; END IF;
  expected:=(p_payload->>'expectedRevision')::integer;
  IF expected IS DISTINCT FROM asset.revision THEN RAISE EXCEPTION 'This lesson changed. Refresh before saving or publishing again.' USING ERRCODE='40001'; END IF;
 END IF;

 -- Link a legacy matching identity only when that record is deliberately edited.
 -- A conflicting curriculum identity is never overwritten to resolve a title clash.
 linked_id:=asset.student_curriculum_id;
 IF linked_id IS NULL THEN
  SELECT * INTO mirrored FROM public.curriculum WHERE id=asset.id FOR UPDATE;
  IF FOUND AND mirrored.title IS DISTINCT FROM asset.title THEN RAISE EXCEPTION 'Library/curriculum ID conflict. Reconcile the lesson identity before editing.' USING ERRCODE='22023'; END IF;
  IF FOUND THEN linked_id:=mirrored.id; END IF;
 END IF;
 IF linked_id IS NULL THEN
  curriculum_category:=CASE WHEN asset.library_type='Fitness' THEN 'Conditioning' WHEN asset.target_level='Dance' THEN 'Demonstration' WHEN asset.tkd_category::text IN('Demonstration','Tricking') THEN asset.tkd_category::text ELSE 'Recognized Poomsae' END;
  INSERT INTO public.curriculum(id,title,target_belt,category,is_active)
   VALUES(asset.id,asset.title,CASE WHEN asset.library_type='Fitness' OR asset.target_level IN('All','Dance','Fitness') THEN 'All' ELSE asset.target_level END,curriculum_category,false) RETURNING * INTO mirrored;
  linked_id:=mirrored.id;
 END IF;
 SELECT * INTO mirrored FROM public.curriculum WHERE id=linked_id FOR UPDATE;
 IF asset.student_curriculum_id IS NULL THEN UPDATE public.library_assets SET student_curriculum_id=linked_id,published_revision=CASE WHEN mirrored.is_active AND published_revision IS NULL THEN 0 ELSE published_revision END WHERE id=asset.id RETURNING * INTO asset; END IF;

 IF p_action='DELETE' THEN
  IF mirrored.is_active THEN RAISE EXCEPTION 'Unpublish this lesson before deleting its draft.' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.lms_progress WHERE curriculum_id=linked_id) THEN RAISE EXCEPTION 'This asset has student progress and cannot be deleted' USING ERRCODE='22023'; END IF;
  IF to_regclass('public.student_portal_progress') IS NOT NULL THEN
   EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.student_portal_progress WHERE curriculum_id=$1)' INTO has_history USING linked_id;
   IF has_history THEN RAISE EXCEPTION 'This lesson has student practice history and cannot be deleted' USING ERRCODE='22023'; END IF;
  END IF;
  IF to_regclass('public.student_portal_readiness_policies') IS NOT NULL THEN
   EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.student_portal_readiness_policies p CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.requirements->''lessons'')=''array'' THEN p.requirements->''lessons'' ELSE ''[]''::jsonb END) lesson WHERE lesson->>''curriculumId''=$1::text)' INTO has_history USING linked_id;
   IF has_history THEN RAISE EXCEPTION 'This lesson is referenced by a readiness policy and cannot be deleted' USING ERRCODE='22023'; END IF;
  END IF;
  DELETE FROM public.library_asset_muscles WHERE asset_id=asset.id;
  DELETE FROM public.library_assets WHERE id=asset.id;
  DELETE FROM public.curriculum WHERE id=linked_id;
  INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LIBRARY_ASSET_DELETED',p_actor::text,asset.id::text,'{}');
  RETURN jsonb_build_object('deleted',asset.id);
 END IF;
 IF p_action='UPDATE' THEN
  SELECT * INTO desired FROM jsonb_populate_record(NULL::public.library_assets,p_payload);
  UPDATE public.library_assets SET title=desired.title,description=desired.description,library_type=desired.library_type,tkd_category=desired.tkd_category,fitness_category=desired.fitness_category,target_level=desired.target_level,video_url=desired.video_url,thumbnail_url=projection->>'thumbnail_url',revision=revision+1,updated_at=now() WHERE id=asset.id RETURNING * INTO asset;
 END IF;
 IF asset.title IS NULL OR trim(asset.title)='' OR asset.library_type NOT IN('Fitness','Taekwondo') OR asset.target_level IS NULL OR trim(asset.target_level)='' THEN RAISE EXCEPTION 'Invalid library asset fields' USING ERRCODE='22023'; END IF;

 IF p_action IN('PUBLISH','UNPUBLISH') THEN
  IF length(trim(coalesce(p_payload->>'reason','')))<5 OR length(p_payload->>'reason')>500 THEN RAISE EXCEPTION 'A publication reason is required' USING ERRCODE='22023'; END IF;
  IF p_action='PUBLISH' THEN
   IF trim(projection->>'description')='' AND nullif(projection->>'video_url','') IS NULL AND coalesce(jsonb_array_length(projection->'learning_content'->'instructions'),0)=0 THEN RAISE EXCEPTION 'Add lesson text, video or instructions before publishing.' USING ERRCODE='22023'; END IF;
   IF projection->>'content_type' NOT IN('Taekwondo','Fitness','Dance') OR jsonb_typeof(projection->'learning_content') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Review the public lesson content' USING ERRCODE='22023'; END IF;
   curriculum_category:=CASE WHEN projection->>'content_type'='Fitness' THEN 'Conditioning' WHEN projection->>'content_type'='Dance' THEN 'Demonstration' WHEN asset.tkd_category::text IN('Demonstration','Tricking') THEN asset.tkd_category::text ELSE 'Recognized Poomsae' END;
   UPDATE public.curriculum SET title=asset.title,target_belt=CASE WHEN projection->>'content_type'<>'Taekwondo' THEN 'All' ELSE asset.target_level END,category=curriculum_category,
    description=projection->>'description',video_url=projection->>'video_url',thumbnail_url=projection->>'thumbnail_url',content_type=projection->>'content_type',content_category=projection->>'content_category',learning_content=(projection->'learning_content')||jsonb_build_object('muscleTargets',COALESCE((SELECT jsonb_agg(jsonb_build_object('muscleId',r.muscle_id,'role',r.role) ORDER BY r.muscle_id) FROM public.library_asset_muscles r WHERE r.asset_id=asset.id),'[]'::jsonb)),is_active=true WHERE id=linked_id RETURNING * INTO mirrored;
   UPDATE public.library_assets SET revision=revision+1,published_revision=revision+1,updated_at=now() WHERE id=asset.id RETURNING * INTO asset;
  ELSE
   UPDATE public.curriculum SET is_active=false WHERE id=linked_id RETURNING * INTO mirrored;
   UPDATE public.library_assets SET revision=revision+1,updated_at=now() WHERE id=asset.id RETURNING * INTO asset;
  END IF;
 END IF;
 IF p_action IN('CREATE','UPDATE') AND p_payload ? 'muscleRelations' THEN
  IF jsonb_typeof(p_payload->'muscleRelations') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'muscleRelations')>100 THEN RAISE EXCEPTION 'Invalid muscle relations' USING ERRCODE='22023'; END IF;
  DELETE FROM public.library_asset_muscles WHERE asset_id=asset.id;
  FOR relation IN SELECT value FROM jsonb_array_elements(p_payload->'muscleRelations') LOOP
   IF relation->>'role' NOT IN('Primary','Secondary') OR NOT EXISTS(SELECT 1 FROM public.muscles WHERE id=(relation->>'muscleId')::integer) THEN RAISE EXCEPTION 'Invalid muscle relation' USING ERRCODE='22023'; END IF;
   INSERT INTO public.library_asset_muscles(asset_id,muscle_id,role) VALUES(asset.id,(relation->>'muscleId')::integer,relation->>'role');
  END LOOP;
 END IF;
 PERFORM setval(pg_get_serial_sequence('public.curriculum','id'),GREATEST(COALESCE((SELECT max(id) FROM public.curriculum),1),1),true);
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LIBRARY_ASSET_'||p_action,p_actor::text,asset.id::text,jsonb_build_object('revision',asset.revision,'reason',p_payload->>'reason'));
 RETURN jsonb_build_object('asset',to_jsonb(asset),'studentLesson',to_jsonb(mirrored),'relations',COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM public.library_asset_muscles r WHERE asset_id=asset.id),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.portal_save_library_asset(uuid,text,integer,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_save_library_asset(uuid,text,integer,jsonb,uuid) TO service_role;

CREATE FUNCTION public.portal_library_catalog(p_actor uuid,p_search text,p_state text,p_limit integer,p_offset integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 IF length(coalesce(p_search,''))>100 OR p_state IS NULL OR p_state NOT IN('all','draft','published','changes','legacy') OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000 THEN RAISE EXCEPTION 'Invalid library filters' USING ERRCODE='22023'; END IF;
 WITH catalog AS (
  SELECT a.id,a.title,a.library_type,a.target_level,a.revision,a.published_revision,a.updated_at,coalesce(c.is_active,false) active,
   CASE WHEN NOT coalesce(c.is_active,false) THEN 'draft' WHEN a.published_revision IS NULL OR a.published_revision=0 THEN 'legacy' WHEN a.published_revision=a.revision THEN 'published' ELSE 'changes' END state
  FROM public.library_assets a LEFT JOIN public.curriculum c ON c.id=coalesce(a.student_curriculum_id,a.id) AND (a.student_curriculum_id IS NOT NULL OR c.title=a.title)
  WHERE position(lower(coalesce(p_search,'')) in lower(a.title))>0
 ), page AS (SELECT * FROM catalog WHERE p_state='all' OR state=p_state ORDER BY updated_at DESC,id DESC LIMIT p_limit+1 OFFSET p_offset)
 SELECT jsonb_build_object('contractVersion','academy-library-v1','offset',p_offset,'hasMore',count(*)>p_limit,'items',coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'libraryType',library_type,'targetLevel',target_level,'revision',revision,'publishedRevision',published_revision,'updatedAt',updated_at,'isPublished',active,'state',state) ORDER BY updated_at DESC,id DESC) FILTER(WHERE rownum<=p_limit),'[]'::jsonb)) INTO result FROM (SELECT *,row_number()OVER(ORDER BY updated_at DESC,id DESC) rownum FROM page) rows;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.portal_library_catalog(uuid,text,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_library_catalog(uuid,text,text,integer,integer) TO service_role;

-- Official grading refers to a published snapshot, never a private authored draft.
CREATE OR REPLACE FUNCTION public.portal_set_video_progress(p_actor uuid,p_student text,p_asset integer,p_completed boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE asset public.library_assets; lesson public.curriculum; result public.lms_progress; linked_id integer;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:evaluations_grade');
 IF p_completed IS NULL THEN RAISE EXCEPTION 'Choose a completion state' USING ERRCODE='22023'; END IF;
 SELECT * INTO asset FROM public.library_assets WHERE id=p_asset FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Library asset not found' USING ERRCODE='P0002'; END IF;
 linked_id:=coalesce(asset.student_curriculum_id,asset.id);
 SELECT * INTO lesson FROM public.curriculum WHERE id=linked_id FOR SHARE;
 IF NOT FOUND OR (asset.student_curriculum_id IS NULL AND lesson.title IS DISTINCT FROM asset.title) THEN RAISE EXCEPTION 'Library/curriculum link needs reconciliation' USING ERRCODE='22023'; END IF;
 IF p_completed AND NOT lesson.is_active THEN RAISE EXCEPTION 'Publish this lesson before recording completion.' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.students WHERE id=p_student AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Student not found or archived' USING ERRCODE='P0002'; END IF;
 IF p_completed THEN
  INSERT INTO public.lms_progress(student_id,curriculum_id,status,last_watched_at,completed_at) VALUES(p_student,linked_id,'Completed',now(),now())
  ON CONFLICT(student_id,curriculum_id) DO UPDATE SET status='Completed',last_watched_at=EXCLUDED.last_watched_at,completed_at=COALESCE(public.lms_progress.completed_at,EXCLUDED.completed_at) RETURNING * INTO result;
 ELSE
  UPDATE public.lms_progress SET status='Not Started',completed_at=NULL WHERE student_id=p_student AND curriculum_id=linked_id RETURNING * INTO result;
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('VIDEO_PROGRESS_UPDATED',p_actor::text,p_student,jsonb_build_object('assetId',p_asset,'curriculumId',linked_id,'completed',p_completed));
 RETURN COALESCE(to_jsonb(result),jsonb_build_object('student_id',p_student,'curriculum_id',linked_id));
END $$;
REVOKE ALL ON FUNCTION public.portal_set_video_progress(uuid,text,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_set_video_progress(uuid,text,integer,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
