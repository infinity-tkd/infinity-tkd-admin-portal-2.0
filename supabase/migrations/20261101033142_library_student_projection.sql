-- Future library saves mirror only allowed public lesson text/media. No backfill or publication-state changes.
CREATE OR REPLACE FUNCTION public.portal_save_library_asset(p_actor uuid,p_action text,p_id integer,p_payload jsonb,p_request_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE asset public.library_assets; desired public.library_assets; mirrored public.curriculum; old_title text; relation jsonb; curriculum_category text; maximum_id integer; projection jsonb; has_history boolean;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 PERFORM pg_advisory_xact_lock(hashtextextended('library-curriculum-write',0));
 IF p_action NOT IN ('CREATE','UPDATE','DELETE') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid library request' USING ERRCODE='22023'; END IF;
 projection:=p_payload->'studentProjection';
 IF p_payload ? 'studentProjection' AND (jsonb_typeof(projection) IS DISTINCT FROM 'object' OR jsonb_typeof(projection->'description') IS DISTINCT FROM 'string' OR coalesce(jsonb_typeof(projection->'video_url'),'missing') NOT IN ('string','null') OR coalesce(jsonb_typeof(projection->'thumbnail_url'),'missing') NOT IN ('string','null')) THEN
 RAISE EXCEPTION 'Invalid public lesson projection' USING ERRCODE='22023'; END IF;
 SELECT * INTO desired FROM jsonb_populate_record(NULL::public.library_assets,p_payload);
 IF p_action='CREATE' THEN
  IF p_request_key IS NULL THEN RAISE EXCEPTION 'Request key required' USING ERRCODE='22023'; END IF;
  SELECT * INTO asset FROM public.library_assets WHERE request_key=p_request_key;
  IF FOUND THEN
   IF asset.created_by IS DISTINCT FROM p_actor OR (asset.request_payload-'studentProjection') IS DISTINCT FROM (p_payload-'studentProjection') THEN RAISE EXCEPTION 'Idempotency key mismatch' USING ERRCODE='22023'; END IF;
   SELECT * INTO mirrored FROM public.curriculum WHERE id=asset.id;
   RETURN jsonb_build_object('asset',to_jsonb(asset),'studentLesson',to_jsonb(mirrored),'relations',COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM public.library_asset_muscles r WHERE asset_id=asset.id),'[]'::jsonb));
  END IF;
  SELECT GREATEST(COALESCE((SELECT max(id) FROM public.library_assets),0),COALESCE((SELECT max(id) FROM public.curriculum),0)) INTO maximum_id;
  PERFORM setval(pg_get_serial_sequence('public.library_assets','id'),GREATEST(maximum_id,1),maximum_id>0);
  INSERT INTO public.library_assets(title,description,library_type,tkd_category,fitness_category,target_level,video_url,request_key,request_payload,created_by)
  VALUES(desired.title,desired.description,desired.library_type,desired.tkd_category,desired.fitness_category,desired.target_level,desired.video_url,p_request_key,p_payload,p_actor) RETURNING * INTO asset;
 ELSE
  SELECT * INTO asset FROM public.library_assets WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Library asset not found' USING ERRCODE='P0002'; END IF;
  old_title:=asset.title;
  PERFORM 1 FROM public.curriculum WHERE id=p_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.curriculum WHERE id=p_id AND title<>old_title) THEN RAISE EXCEPTION 'Library/curriculum ID conflict. Reconcile these records before editing or deleting' USING ERRCODE='22023'; END IF;
  IF p_action='DELETE' THEN
   IF EXISTS(SELECT 1 FROM public.lms_progress WHERE curriculum_id=p_id) THEN RAISE EXCEPTION 'This asset has student progress and cannot be deleted' USING ERRCODE='22023'; END IF;
   IF to_regclass('public.student_portal_progress') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.student_portal_progress WHERE curriculum_id=$1)' INTO has_history USING p_id;
    IF has_history THEN RAISE EXCEPTION 'This lesson has student practice history and cannot be deleted' USING ERRCODE='22023'; END IF;
   END IF;
   IF to_regclass('public.student_portal_readiness_policies') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.student_portal_readiness_policies p CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.requirements->''lessons'')=''array'' THEN p.requirements->''lessons'' ELSE ''[]''::jsonb END) lesson WHERE lesson->>''curriculumId''=$1::text)' INTO has_history USING p_id;
    IF has_history THEN RAISE EXCEPTION 'This lesson is referenced by a readiness policy and cannot be deleted' USING ERRCODE='22023'; END IF;
   END IF;
   DELETE FROM public.library_asset_muscles WHERE asset_id=p_id;
   DELETE FROM public.library_assets WHERE id=p_id;
   DELETE FROM public.curriculum WHERE id=p_id;
   INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LIBRARY_ASSET_DELETED',p_actor::text,p_id::text,'{}');
   RETURN jsonb_build_object('deleted',p_id);
  END IF;
  UPDATE public.library_assets SET title=desired.title,description=desired.description,library_type=desired.library_type,tkd_category=desired.tkd_category,fitness_category=desired.fitness_category,target_level=desired.target_level,video_url=desired.video_url WHERE id=p_id RETURNING * INTO asset;
 END IF;
 IF asset.title IS NULL OR trim(asset.title)='' OR asset.library_type NOT IN ('Fitness','Taekwondo') OR asset.target_level IS NULL OR trim(asset.target_level)='' THEN RAISE EXCEPTION 'Invalid library asset fields' USING ERRCODE='22023'; END IF;
 curriculum_category:=CASE WHEN asset.tkd_category::text IN ('Demonstration','Tricking') THEN asset.tkd_category::text ELSE 'Recognized Poomsae' END;
 SELECT * INTO mirrored FROM jsonb_populate_record(NULL::public.curriculum,jsonb_build_object('title',asset.title,'target_belt',CASE WHEN asset.library_type='Fitness' OR asset.target_level IN ('All','Dance','Fitness') THEN 'White' ELSE asset.target_level END,'category',curriculum_category));
 IF p_payload ? 'studentProjection' THEN
  UPDATE public.library_assets SET thumbnail_url=projection->>'thumbnail_url' WHERE id=asset.id RETURNING * INTO asset;
 END IF;
 INSERT INTO public.curriculum(id,title,target_belt,category,is_active,description,video_url,thumbnail_url)
 VALUES(asset.id,mirrored.title,mirrored.target_belt,mirrored.category,true,projection->>'description',projection->>'video_url',projection->>'thumbnail_url')
 ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,target_belt=EXCLUDED.target_belt,category=public.curriculum.category,
 description=CASE WHEN p_payload ? 'studentProjection' THEN EXCLUDED.description ELSE public.curriculum.description END,
 video_url=CASE WHEN p_payload ? 'studentProjection' THEN EXCLUDED.video_url ELSE public.curriculum.video_url END,
 thumbnail_url=CASE WHEN p_payload ? 'studentProjection' THEN EXCLUDED.thumbnail_url ELSE public.curriculum.thumbnail_url END RETURNING * INTO mirrored;
 PERFORM setval(pg_get_serial_sequence('public.curriculum','id'),GREATEST(COALESCE((SELECT max(id) FROM public.curriculum),1),1),true);
 IF p_payload ? 'muscleRelations' THEN
  IF jsonb_typeof(p_payload->'muscleRelations') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'muscleRelations')>100 THEN RAISE EXCEPTION 'Invalid muscle relations' USING ERRCODE='22023'; END IF;
  DELETE FROM public.library_asset_muscles WHERE asset_id=asset.id;
  FOR relation IN SELECT value FROM jsonb_array_elements(p_payload->'muscleRelations') LOOP
   IF relation->>'role' NOT IN ('Primary','Secondary') OR NOT EXISTS(SELECT 1 FROM public.muscles WHERE id=(relation->>'muscleId')::integer) THEN RAISE EXCEPTION 'Invalid muscle relation' USING ERRCODE='22023'; END IF;
   INSERT INTO public.library_asset_muscles(asset_id,muscle_id,role) VALUES(asset.id,(relation->>'muscleId')::integer,relation->>'role');
  END LOOP;
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LIBRARY_ASSET_'||p_action,p_actor::text,asset.id::text,'{}');
 RETURN jsonb_build_object('asset',to_jsonb(asset),'studentLesson',to_jsonb(mirrored),'relations',COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM public.library_asset_muscles r WHERE asset_id=asset.id),'[]'::jsonb));
END $$;
REVOKE INSERT,UPDATE,DELETE ON public.library_assets,public.library_asset_muscles,public.curriculum FROM authenticated;
REVOKE ALL ON FUNCTION public.portal_save_library_asset(uuid,text,integer,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_save_library_asset(uuid,text,integer,jsonb,uuid) TO service_role;
