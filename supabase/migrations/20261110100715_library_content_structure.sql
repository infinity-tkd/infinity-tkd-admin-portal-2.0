-- Library content structure (library-v2): admin-managed categories, flexible
-- lesson sections with Khmer and Chinese translations, lessons without a belt
-- yet, a published snapshot for the student feed, and the website import.
-- Additive: existing lessons, curriculum rows and learning-v1 keep working.
-- portal_save_library_asset is replaced from its deployed version
-- (20261102181732, verified identical by md5) with two marked additions.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

-- ===========================================================================
-- 1. Categories (Library → Categories)
-- ===========================================================================
CREATE TABLE public.library_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 2 AND 60),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
 korean_title text CHECK (korean_title IS NULL OR length(korean_title)<=120),
 subtitle text CHECK (subtitle IS NULL OR length(subtitle)<=240),
 description text CHECK (description IS NULL OR length(description)<=2000),
 icon text NOT NULL DEFAULT 'BookOpen' CHECK (icon ~ '^[A-Za-z]{1,40}$'),
 accent_color text NOT NULL DEFAULT '#EF2F38' CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
 library_type text NOT NULL DEFAULT 'Taekwondo' CHECK (library_type IN ('Taekwondo','Fitness','Dance')),
 sort_order integer NOT NULL DEFAULT 100 CHECK (sort_order BETWEEN 1 AND 10000),
 is_active boolean NOT NULL DEFAULT true,
 translations jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(translations)='object' AND octet_length(translations::text)<=20000),
 revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 created_by uuid REFERENCES public.profiles(id),
 updated_by uuid REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX library_categories_created_by_ops_idx ON public.library_categories(created_by);
CREATE INDEX library_categories_updated_by_ops_idx ON public.library_categories(updated_by);

-- ===========================================================================
-- 2. Lesson fields (light: loaded with the library grid)
-- ===========================================================================
ALTER TABLE public.library_assets
 ADD COLUMN category_id uuid REFERENCES public.library_categories(id),
 ADD COLUMN content_kind text NOT NULL DEFAULT 'lesson' CHECK (content_kind IN ('lesson','article')),
 ADD COLUMN slug text CHECK (slug IS NULL OR (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug)<=120)),
 ADD COLUMN korean_name text CHECK (korean_name IS NULL OR length(korean_name)<=200),
 ADD COLUMN romanized text CHECK (romanized IS NULL OR length(romanized)<=200),
 ADD COLUMN summary text CHECK (summary IS NULL OR length(summary)<=4000),
 ADD COLUMN level_note text CHECK (level_note IS NULL OR length(level_note)<=120),
 ADD COLUMN source_key text CHECK (source_key IS NULL OR source_key ~ '^[a-z0-9][a-z0-9:._-]{2,119}$'),
 ADD COLUMN tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags)<=20),
 ADD CONSTRAINT library_assets_slug_key UNIQUE (slug),
 ADD CONSTRAINT library_assets_source_key_key UNIQUE (source_key);
CREATE INDEX library_assets_category_ops_idx ON public.library_assets(category_id);

-- ===========================================================================
-- 3. Draft sections and translations (server only; heavy, loaded on demand)
-- ===========================================================================
CREATE TABLE public.library_asset_content (
 asset_id integer PRIMARY KEY REFERENCES public.library_assets(id) ON DELETE CASCADE,
 sections jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(sections)='array' AND jsonb_array_length(sections)<=80),
 translations jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(translations)='object'),
 sources jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(sources)='array' AND jsonb_array_length(sources)<=20),
 updated_by uuid REFERENCES public.profiles(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT library_asset_content_size CHECK (octet_length(sections::text)+octet_length(translations::text)+octet_length(sources::text)<=3000000)
);
CREATE INDEX library_asset_content_updated_by_ops_idx ON public.library_asset_content(updated_by);

-- ===========================================================================
-- 4. Published snapshot read by the library-v2 student feed
-- ===========================================================================
CREATE TABLE public.library_published_content (
 curriculum_id integer PRIMARY KEY REFERENCES public.curriculum(id) ON DELETE CASCADE,
 asset_id integer NOT NULL UNIQUE REFERENCES public.library_assets(id) ON DELETE CASCADE,
 category_id uuid REFERENCES public.library_categories(id) ON DELETE SET NULL,
 content_kind text NOT NULL CHECK (content_kind IN ('lesson','article')),
 document jsonb NOT NULL CHECK (jsonb_typeof(document)='object'),
 published_revision integer NOT NULL,
 published_by uuid REFERENCES public.profiles(id),
 published_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX library_published_content_category_ops_idx ON public.library_published_content(category_id);
CREATE INDEX library_published_content_published_by_ops_idx ON public.library_published_content(published_by);

ALTER TABLE public.library_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_asset_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_published_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.library_categories, public.library_asset_content, public.library_published_content FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.library_categories, public.library_asset_content, public.library_published_content TO service_role;

-- ===========================================================================
-- 5. Categories: create, update, reorder, delete
-- ===========================================================================
CREATE FUNCTION public.portal_save_library_category(p_actor uuid,p_action text,p_id uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cat public.library_categories; ordered uuid; pos integer:=0; used integer;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 IF p_action NOT IN ('CREATE','UPDATE','DELETE','REORDER') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid category request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('library-categories-write',0));
 IF p_action='REORDER' THEN
  IF jsonb_typeof(p_payload->'order') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'order') NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Send the categories in their new order' USING ERRCODE='22023'; END IF;
  FOR ordered IN SELECT (value#>>'{}')::uuid FROM jsonb_array_elements(p_payload->'order') LOOP
   pos:=pos+1;
   UPDATE public.library_categories SET sort_order=pos*10,updated_by=p_actor,updated_at=now() WHERE id=ordered;
  END LOOP;
  INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LIBRARY_CATEGORY_REORDER',p_actor::text,'library_categories',jsonb_build_object('order',p_payload->'order'));
  RETURN jsonb_build_object('reordered',pos);
 END IF;
 IF p_action IN ('UPDATE','DELETE') THEN
  SELECT * INTO cat FROM public.library_categories WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Category not found' USING ERRCODE='P0002'; END IF;
  IF cat.revision IS DISTINCT FROM (p_payload->>'expectedRevision')::integer THEN RAISE EXCEPTION 'This category changed. Reload before saving.' USING ERRCODE='40001'; END IF;
 END IF;
 IF p_action='DELETE' THEN
  SELECT count(*) INTO used FROM public.library_assets WHERE category_id=cat.id;
  IF used>0 THEN RAISE EXCEPTION '% lessons use this category. Move them first, or hide the category instead.',used USING ERRCODE='22023'; END IF;
  DELETE FROM public.library_categories WHERE id=cat.id;
  INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LIBRARY_CATEGORY_DELETE',p_actor::text,cat.id::text,jsonb_build_object('slug',cat.slug));
  RETURN jsonb_build_object('deleted',cat.id);
 END IF;
 IF COALESCE(p_payload->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(p_payload->>'slug') NOT BETWEEN 2 AND 60 THEN RAISE EXCEPTION 'Use a short web name of lowercase letters, numbers and dashes' USING ERRCODE='22023'; END IF;
 IF length(btrim(COALESCE(p_payload->>'title','')))=0 THEN RAISE EXCEPTION 'Name the category' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(COALESCE(p_payload->'translations','{}'::jsonb)) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid category translations' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.library_categories WHERE slug=p_payload->>'slug' AND id IS DISTINCT FROM cat.id) THEN RAISE EXCEPTION 'Another category already uses the web name "%"',p_payload->>'slug' USING ERRCODE='22023'; END IF;
 IF p_action='CREATE' THEN
  INSERT INTO public.library_categories(slug,title,korean_title,subtitle,description,icon,accent_color,library_type,sort_order,is_active,translations,created_by,updated_by)
  VALUES(p_payload->>'slug',btrim(p_payload->>'title'),NULLIF(btrim(p_payload->>'koreanTitle'),''),NULLIF(btrim(p_payload->>'subtitle'),''),NULLIF(btrim(p_payload->>'description'),''),
   COALESCE(p_payload->>'icon','BookOpen'),COALESCE(p_payload->>'accentColor','#EF2F38'),COALESCE(p_payload->>'libraryType','Taekwondo'),
   LEAST(COALESCE((SELECT max(sort_order) FROM public.library_categories),0)+10,10000),COALESCE((p_payload->>'isActive')::boolean,true),COALESCE(p_payload->'translations','{}'::jsonb),p_actor,p_actor) RETURNING * INTO cat;
 ELSE
  UPDATE public.library_categories SET slug=p_payload->>'slug',title=btrim(p_payload->>'title'),korean_title=NULLIF(btrim(p_payload->>'koreanTitle'),''),subtitle=NULLIF(btrim(p_payload->>'subtitle'),''),
   description=NULLIF(btrim(p_payload->>'description'),''),icon=COALESCE(p_payload->>'icon',icon),accent_color=COALESCE(p_payload->>'accentColor',accent_color),
   library_type=COALESCE(p_payload->>'libraryType',library_type),is_active=COALESCE((p_payload->>'isActive')::boolean,is_active),translations=COALESCE(p_payload->'translations',translations),
   revision=revision+1,updated_by=p_actor,updated_at=now() WHERE id=cat.id RETURNING * INTO cat;
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LIBRARY_CATEGORY_'||p_action,p_actor::text,cat.id::text,jsonb_build_object('slug',cat.slug,'revision',cat.revision));
 RETURN to_jsonb(cat);
END $$;

-- ===========================================================================
-- 6. Lesson content: category, names, sections, translations and sources
-- ===========================================================================
CREATE FUNCTION public.portal_save_library_content(p_actor uuid,p_id integer,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE asset public.library_assets; saved public.library_asset_content; meta jsonb; body jsonb;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR jsonb_typeof(p_payload->'metadata') IS DISTINCT FROM 'object' OR jsonb_typeof(p_payload->'content') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid lesson content request' USING ERRCODE='22023'; END IF;
 meta:=p_payload->'metadata'; body:=p_payload->'content';
 IF jsonb_typeof(COALESCE(body->'sections','[]'::jsonb)) IS DISTINCT FROM 'array' OR jsonb_typeof(COALESCE(body->'translations','{}'::jsonb)) IS DISTINCT FROM 'object' OR jsonb_typeof(COALESCE(body->'sources','[]'::jsonb)) IS DISTINCT FROM 'array'
  OR jsonb_typeof(COALESCE(meta->'tags','[]'::jsonb)) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid lesson content' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('library-curriculum-write',0));
 SELECT * INTO asset FROM public.library_assets WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Library asset not found' USING ERRCODE='P0002'; END IF;
 IF asset.revision IS DISTINCT FROM (p_payload->>'expectedRevision')::integer THEN RAISE EXCEPTION 'This lesson changed. Refresh before saving or publishing again.' USING ERRCODE='40001'; END IF;
 IF meta->>'categoryId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.library_categories WHERE id=(meta->>'categoryId')::uuid) THEN RAISE EXCEPTION 'Choose an existing category' USING ERRCODE='22023'; END IF;
 IF NULLIF(meta->>'slug','') IS NOT NULL AND EXISTS(SELECT 1 FROM public.library_assets WHERE slug=meta->>'slug' AND id<>asset.id) THEN RAISE EXCEPTION 'Another lesson already uses the web name "%"',meta->>'slug' USING ERRCODE='22023'; END IF;
 UPDATE public.library_assets SET category_id=(meta->>'categoryId')::uuid,content_kind=COALESCE(meta->>'kind','lesson'),slug=NULLIF(meta->>'slug',''),
  korean_name=NULLIF(btrim(meta->>'koreanName'),''),romanized=NULLIF(btrim(meta->>'romanized'),''),summary=NULLIF(btrim(meta->>'summary'),''),level_note=NULLIF(btrim(meta->>'levelNote'),''),
  tags=ARRAY(SELECT btrim(value) FROM jsonb_array_elements_text(COALESCE(meta->'tags','[]'::jsonb)) value WHERE btrim(value)<>''),revision=revision+1,updated_at=now()
 WHERE id=asset.id RETURNING * INTO asset;
 INSERT INTO public.library_asset_content(asset_id,sections,translations,sources,updated_by,updated_at)
 VALUES(asset.id,COALESCE(body->'sections','[]'::jsonb),COALESCE(body->'translations','{}'::jsonb),COALESCE(body->'sources','[]'::jsonb),p_actor,now())
 ON CONFLICT (asset_id) DO UPDATE SET sections=EXCLUDED.sections,translations=EXCLUDED.translations,sources=EXCLUDED.sources,updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at
 RETURNING * INTO saved;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LIBRARY_CONTENT_SAVED',p_actor::text,asset.id::text,jsonb_build_object('revision',asset.revision,'sections',jsonb_array_length(saved.sections)));
 RETURN jsonb_build_object('asset',to_jsonb(asset),'content',jsonb_build_object('sections',saved.sections,'translations',saved.translations,'sources',saved.sources,'updatedAt',saved.updated_at));
END $$;

-- ===========================================================================
-- 7. Publishing: deployed function plus the belt guard and the v2 snapshot
-- ===========================================================================
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
   -- library-v2: a lesson needs a belt (or All belts) before students can see it.
   IF asset.target_level='Unassigned' THEN RAISE EXCEPTION 'Choose a belt (or All belts) before publishing this lesson.' USING ERRCODE='22023'; END IF;
   IF trim(projection->>'description')='' AND nullif(projection->>'video_url','') IS NULL AND coalesce(jsonb_array_length(projection->'learning_content'->'instructions'),0)=0 THEN RAISE EXCEPTION 'Add lesson text, video or instructions before publishing.' USING ERRCODE='22023'; END IF;
   IF projection->>'content_type' NOT IN('Taekwondo','Fitness','Dance') OR jsonb_typeof(projection->'learning_content') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Review the public lesson content' USING ERRCODE='22023'; END IF;
   curriculum_category:=CASE WHEN projection->>'content_type'='Fitness' THEN 'Conditioning' WHEN projection->>'content_type'='Dance' THEN 'Demonstration' WHEN asset.tkd_category::text IN('Demonstration','Tricking') THEN asset.tkd_category::text ELSE 'Recognized Poomsae' END;
   UPDATE public.curriculum SET title=asset.title,target_belt=CASE WHEN projection->>'content_type'<>'Taekwondo' THEN 'All' ELSE asset.target_level END,category=curriculum_category,
    description=projection->>'description',video_url=projection->>'video_url',thumbnail_url=projection->>'thumbnail_url',content_type=projection->>'content_type',content_category=projection->>'content_category',learning_content=(projection->'learning_content')||jsonb_build_object('muscleTargets',COALESCE((SELECT jsonb_agg(jsonb_build_object('muscleId',r.muscle_id,'role',r.role) ORDER BY r.muscle_id) FROM public.library_asset_muscles r WHERE r.asset_id=asset.id),'[]'::jsonb)),is_active=true WHERE id=linked_id RETURNING * INTO mirrored;
   UPDATE public.library_assets SET revision=revision+1,published_revision=revision+1,updated_at=now() WHERE id=asset.id RETURNING * INTO asset;
   -- library-v2: snapshot the sections, translations and lesson details students receive.
   INSERT INTO public.library_published_content(curriculum_id,asset_id,category_id,content_kind,document,published_revision,published_by,published_at)
   SELECT linked_id,asset.id,asset.category_id,asset.content_kind,jsonb_build_object('version',1,'slug',asset.slug,'kind',asset.content_kind,'categoryId',asset.category_id,
     'koreanName',asset.korean_name,'romanized',asset.romanized,'summary',asset.summary,'levelNote',asset.level_note,'tags',to_jsonb(asset.tags),
     'sections',COALESCE(c.sections,'[]'::jsonb),'translations',COALESCE(c.translations,'{}'::jsonb),'sources',COALESCE(c.sources,'[]'::jsonb)),asset.revision,p_actor,now()
   FROM (SELECT 1) one LEFT JOIN public.library_asset_content c ON c.asset_id=asset.id
   ON CONFLICT (curriculum_id) DO UPDATE SET asset_id=EXCLUDED.asset_id,category_id=EXCLUDED.category_id,content_kind=EXCLUDED.content_kind,document=EXCLUDED.document,
    published_revision=EXCLUDED.published_revision,published_by=EXCLUDED.published_by,published_at=EXCLUDED.published_at;
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

-- ===========================================================================
-- 8. Website library import (scripts/import-website-library.mjs)
-- ===========================================================================
-- New lessons are created as private drafts with no belt yet. A lesson that
-- matches an existing title keeps its id, belt and staff text, and gains the
-- website guidance it lacks. Items already imported are skipped unless the
-- import asks to overwrite them; categories are added once and never replaced.
CREATE FUNCTION public.portal_import_library_content(p_actor uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cat jsonb; item jsonb; asset public.library_assets; mirrored public.curriculum; created jsonb; existing jsonb; guidance jsonb; k text; category_ref uuid; overwrite boolean; merging boolean;
 added integer:=0; out_created jsonb:='[]'::jsonb; out_merged jsonb:='[]'::jsonb; out_updated jsonb:='[]'::jsonb; out_skipped jsonb:='[]'::jsonb;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR jsonb_typeof(COALESCE(p_payload->'categories','[]'::jsonb)) IS DISTINCT FROM 'array'
  OR jsonb_typeof(COALESCE(p_payload->'items','[]'::jsonb)) IS DISTINCT FROM 'array' OR jsonb_array_length(COALESCE(p_payload->'items','[]'::jsonb))>60 THEN RAISE EXCEPTION 'Invalid library import' USING ERRCODE='22023'; END IF;
 overwrite:=COALESCE((p_payload->>'overwrite')::boolean,false);
 PERFORM pg_advisory_xact_lock(hashtextextended('library-curriculum-write',0));
 FOR cat IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'categories','[]'::jsonb)) LOOP
  INSERT INTO public.library_categories(slug,title,korean_title,subtitle,description,icon,accent_color,library_type,sort_order,is_active,translations,created_by,updated_by)
  VALUES(cat->>'slug',cat->>'title',NULLIF(cat->>'koreanTitle',''),NULLIF(cat->>'subtitle',''),NULLIF(cat->>'description',''),COALESCE(cat->>'icon','BookOpen'),COALESCE(cat->>'accentColor','#EF2F38'),
   COALESCE(cat->>'libraryType','Taekwondo'),COALESCE((cat->>'sortOrder')::integer,100),true,COALESCE(cat->'translations','{}'::jsonb),p_actor,p_actor)
  ON CONFLICT (slug) DO NOTHING;
  IF FOUND THEN added:=added+1; END IF;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'items','[]'::jsonb)) LOOP
  IF COALESCE(item->>'sourceKey','') !~ '^[a-z0-9][a-z0-9:._-]{2,119}$' OR length(btrim(COALESCE(item->>'title','')))=0 OR jsonb_typeof(item->'content') IS DISTINCT FROM 'object'
   OR COALESCE(item->>'kind','lesson') NOT IN ('lesson','article') THEN RAISE EXCEPTION 'Invalid import item %',item->>'sourceKey' USING ERRCODE='22023'; END IF;
  category_ref:=(SELECT id FROM public.library_categories WHERE slug=item->>'categorySlug');
  merging:=false;
  SELECT * INTO asset FROM public.library_assets WHERE source_key=item->>'sourceKey' FOR UPDATE;
  IF asset.id IS NOT NULL AND NOT overwrite THEN out_skipped:=out_skipped||jsonb_build_object('sourceKey',item->>'sourceKey','id',asset.id); CONTINUE; END IF;
  IF asset.id IS NULL AND NULLIF(item->>'mergeTitle','') IS NOT NULL THEN
   SELECT * INTO asset FROM public.library_assets WHERE title=item->>'mergeTitle' AND source_key IS NULL ORDER BY id LIMIT 1 FOR UPDATE;
   merging:=asset.id IS NOT NULL;
  END IF;
  IF asset.id IS NULL THEN
   -- New lesson through the regular create path: a private draft with no belt yet.
   created:=public.portal_save_library_asset(p_actor,'CREATE',NULL,jsonb_build_object('title',btrim(item->>'title'),'description',item->>'description','library_type','Taekwondo',
    'tkd_category',item->>'tkdCategory','fitness_category',NULL,'target_level','Unassigned','video_url',COALESCE(item->>'videoUrl',''),
    'studentProjection',jsonb_build_object('description',COALESCE(item->>'projectionText',''),'video_url',NULLIF(item->>'videoUrl',''),'thumbnail_url',NULL)),gen_random_uuid());
   SELECT * INTO asset FROM public.library_assets WHERE id=(created->'asset'->>'id')::integer FOR UPDATE;
   out_created:=out_created||jsonb_build_object('sourceKey',item->>'sourceKey','id',asset.id);
  ELSIF merging THEN
   -- Existing lesson: keep its id, belt and staff text; add the guidance it lacks.
   IF asset.student_curriculum_id IS NULL THEN
    SELECT * INTO mirrored FROM public.curriculum WHERE id=asset.id AND title=asset.title FOR UPDATE;
    IF FOUND THEN UPDATE public.library_assets SET student_curriculum_id=mirrored.id,published_revision=CASE WHEN mirrored.is_active AND published_revision IS NULL THEN 0 ELSE published_revision END WHERE id=asset.id RETURNING * INTO asset; END IF;
   END IF;
   BEGIN existing:=asset.description::jsonb; EXCEPTION WHEN OTHERS THEN existing:=NULL; END;
   IF jsonb_typeof(existing) IS DISTINCT FROM 'object' THEN existing:=jsonb_build_object('text',COALESCE(asset.description,'')); END IF;
   guidance:=COALESCE(item->'guidance','{}'::jsonb);
   FOR k IN SELECT jsonb_object_keys(guidance) LOOP
    IF existing->k IS NULL OR existing->k IN ('""'::jsonb,'[]'::jsonb,'null'::jsonb) THEN existing:=existing||jsonb_build_object(k,guidance->k); END IF;
   END LOOP;
   UPDATE public.library_assets SET description=existing::text WHERE id=asset.id RETURNING * INTO asset;
   -- A corrupted title is corrected in the draft and in the live lesson students already see.
   IF NULLIF(btrim(item->>'fixedTitle'),'') IS NOT NULL AND item->>'fixedTitle'<>asset.title THEN
    UPDATE public.curriculum SET title=btrim(item->>'fixedTitle') WHERE id=asset.student_curriculum_id AND title=asset.title;
    UPDATE public.library_assets SET title=btrim(item->>'fixedTitle') WHERE id=asset.id RETURNING * INTO asset;
   END IF;
   out_merged:=out_merged||jsonb_build_object('sourceKey',item->>'sourceKey','id',asset.id);
  ELSE
   out_updated:=out_updated||jsonb_build_object('sourceKey',item->>'sourceKey','id',asset.id);
  END IF;
  UPDATE public.library_assets SET source_key=item->>'sourceKey',
   slug=CASE WHEN slug IS NOT NULL THEN slug WHEN NULLIF(item->>'slug','') IS NULL OR EXISTS(SELECT 1 FROM public.library_assets o WHERE o.slug=item->>'slug' AND o.id<>asset.id) THEN NULL ELSE item->>'slug' END,
   category_id=COALESCE(category_id,category_ref),content_kind=COALESCE(item->>'kind','lesson'),
   korean_name=COALESCE(korean_name,NULLIF(item->>'koreanName','')),romanized=COALESCE(romanized,NULLIF(item->>'romanized','')),
   summary=COALESCE(summary,NULLIF(item->>'summary','')),level_note=COALESCE(level_note,NULLIF(item->>'levelNote','')),
   tags=CASE WHEN cardinality(tags)>0 THEN tags ELSE ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'tags','[]'::jsonb))) END,
   revision=revision+1,updated_at=now()
  WHERE id=asset.id RETURNING * INTO asset;
  INSERT INTO public.library_asset_content(asset_id,sections,translations,sources,updated_by,updated_at)
  VALUES(asset.id,COALESCE(item->'content'->'sections','[]'::jsonb),COALESCE(item->'content'->'translations','{}'::jsonb),COALESCE(item->'content'->'sources','[]'::jsonb),p_actor,now())
  ON CONFLICT (asset_id) DO UPDATE SET sections=EXCLUDED.sections,translations=EXCLUDED.translations,sources=EXCLUDED.sources,updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at;
 END LOOP;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('LIBRARY_CONTENT_IMPORTED',p_actor::text,'library_assets',
  jsonb_build_object('source',p_payload->>'source','categoriesAdded',added,'created',jsonb_array_length(out_created),'merged',jsonb_array_length(out_merged),'updated',jsonb_array_length(out_updated),'skipped',jsonb_array_length(out_skipped)));
 RETURN jsonb_build_object('categoriesAdded',added,'created',out_created,'merged',out_merged,'updated',out_updated,'skipped',out_skipped);
END $$;

-- ===========================================================================
-- 9. library-v2 student feed: one page of published lessons (light fields only)
-- ===========================================================================
-- Belt eligibility is applied by the admin portal API (studentLessonEligible), the
-- same rule as learning-v1. Lessons published before library-v2 have no snapshot
-- ("published" is null) and are shown from their learning-v1 guidance.
CREATE FUNCTION public.portal_student_library_page(p_lang text,p_category text,p_kind text,p_pattern text,p_after integer,p_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 IF p_lang NOT IN ('en','km','zh') OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 51 OR (p_kind IS NOT NULL AND p_kind NOT IN ('lesson','article')) OR length(COALESCE(p_pattern,''))>220 THEN
  RAISE EXCEPTION 'Choose supported library filters' USING ERRCODE='22023';
 END IF;
 SELECT COALESCE(jsonb_agg(page.item ORDER BY page.id),'[]'::jsonb) INTO result FROM (
  SELECT c.id,jsonb_build_object('id',c.id,'targetBelt',c.target_belt,'title',c.title,'description',c.description,'videoUrl',c.video_url,'thumbnailUrl',c.thumbnail_url,
   'type',c.content_type,'legacyCategory',COALESCE(c.content_category,c.category),'position',c.sort_order,'durationSeconds',c.duration_seconds,
   'published',CASE WHEN p.curriculum_id IS NULL THEN NULL ELSE jsonb_build_object('category',cat.slug,'kind',p.content_kind,'slug',p.document->>'slug','summary',p.document->>'summary',
     'koreanName',p.document->>'koreanName','romanized',p.document->>'romanized','levelNote',p.document->>'levelNote','tags',COALESCE(p.document->'tags','[]'::jsonb),
     'sectionCount',jsonb_array_length(COALESCE(p.document->'sections','[]'::jsonb)),
     'translation',CASE WHEN p_lang<>'en' THEN jsonb_strip_nulls(jsonb_build_object('title',p.document->'translations'->p_lang->>'title','summary',p.document->'translations'->p_lang->>'summary','levelNote',p.document->'translations'->p_lang->>'levelNote')) END) END) AS item
  FROM public.curriculum c
  LEFT JOIN public.library_published_content p ON p.curriculum_id=c.id
  LEFT JOIN public.library_categories cat ON cat.id=p.category_id
  WHERE c.is_active AND (p_after IS NULL OR c.id>p_after)
   AND (cat.id IS NULL OR cat.is_active)
   AND (p_category IS NULL OR cat.slug=p_category)
   AND (p_kind IS NULL OR COALESCE(p.content_kind,'lesson')=p_kind)
   AND (p_pattern IS NULL OR c.title ILIKE p_pattern OR p.document->>'koreanName' ILIKE p_pattern OR p.document->'translations'->p_lang->>'title' ILIKE p_pattern)
  ORDER BY c.id LIMIT p_limit
 ) page;
 RETURN result;
END $$;

-- ===========================================================================
-- Grants: service role only
-- ===========================================================================
REVOKE ALL ON FUNCTION public.portal_save_library_category(uuid,text,uuid,jsonb), public.portal_save_library_content(uuid,integer,jsonb),
 public.portal_import_library_content(uuid,jsonb), public.portal_save_library_asset(uuid,text,integer,jsonb,uuid),
 public.portal_student_library_page(text,text,text,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_save_library_category(uuid,text,uuid,jsonb), public.portal_save_library_content(uuid,integer,jsonb),
 public.portal_import_library_content(uuid,jsonb), public.portal_save_library_asset(uuid,text,integer,jsonb,uuid),
 public.portal_student_library_page(text,text,text,text,integer,integer) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
