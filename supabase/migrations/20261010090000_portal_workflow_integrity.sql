BEGIN;

CREATE OR REPLACE FUNCTION public.portal_update_student_with_enrollment(p_actor uuid,p_id text,p_changes jsonb,p_address jsonb,p_enrollment bigint,p_enrollment_date date) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.portal_update_student(p_actor,p_id,p_changes,p_address);
 IF p_enrollment_date IS NOT NULL THEN
  IF p_enrollment IS NULL OR p_enrollment_date<'1900-01-01'::date OR p_enrollment_date>(now() AT TIME ZONE 'Asia/Phnom_Penh')::date THEN RAISE EXCEPTION 'Invalid enrollment date request' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM public.class_enrollments WHERE id=p_enrollment AND student_id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student enrollment not found. Refresh before editing' USING ERRCODE='P0002'; END IF;
  UPDATE public.class_enrollments SET enrollment_date=p_enrollment_date WHERE id=p_enrollment;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.portal_update_student_with_enrollment(uuid,text,jsonb,jsonb,bigint,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_update_student_with_enrollment(uuid,text,jsonb,jsonb,bigint,date) TO service_role;

-- Delete a class only if its historical attendance is safe. Any later FK failure
-- rolls back enrollment deletion as well. Direct client deletes cannot bypass this.
CREATE OR REPLACE FUNCTION public.portal_delete_class(p_actor uuid,p_class_id integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:schedule_manage');
 PERFORM 1 FROM public.class_sessions WHERE id=p_class_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Class not found' USING ERRCODE='P0002'; END IF;
 IF EXISTS(SELECT 1 FROM public.attendance WHERE class_id=p_class_id) THEN
  RAISE EXCEPTION 'This class has attendance history and cannot be deleted. Keep the class to preserve its records' USING ERRCODE='22023';
 END IF;
 DELETE FROM public.class_enrollments WHERE class_id=p_class_id;
 DELETE FROM public.class_sessions WHERE id=p_class_id;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('CLASS_DELETED',p_actor::text,p_class_id::text,'{}');
END $$;
REVOKE DELETE ON public.class_sessions FROM authenticated;
REVOKE ALL ON FUNCTION public.portal_delete_class(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_delete_class(uuid,integer) TO service_role;

-- A measurement and the student's latest height/weight commit together. Older
-- measurements remain in history without overwriting a newer measurement.
ALTER TABLE public.student_body_compositions ADD COLUMN IF NOT EXISTS request_key uuid;
ALTER TABLE public.student_body_compositions ADD COLUMN IF NOT EXISTS request_payload jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS portal_body_composition_request ON public.student_body_compositions(request_key) WHERE request_key IS NOT NULL;
CREATE OR REPLACE FUNCTION public.portal_record_body_composition(p_actor uuid,p_payload jsonb,p_request_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE measurement public.student_body_compositions; latest public.student_body_compositions; field text; amount numeric;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:student_edit');
 IF p_request_key IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid measurement request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('body-composition:'||p_request_key::text,0));
 SELECT * INTO measurement FROM public.student_body_compositions WHERE request_key=p_request_key;
 IF FOUND THEN
  IF measurement.recorded_by<>p_actor OR measurement.request_payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Idempotency key mismatch' USING ERRCODE='22023'; END IF;
  SELECT * INTO latest FROM public.student_body_compositions WHERE student_id=measurement.student_id ORDER BY recorded_date DESC,created_at DESC,id DESC LIMIT 1;
  RETURN jsonb_build_object('measurement',to_jsonb(measurement),'latest',to_jsonb(latest));
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('student_id','recorded_date','height_cm','weight_kg','body_fat_percentage','skeletal_muscle_mass_kg','neck_cm','shoulder_width_cm','chest_cm','waist_cm','hips_cm','left_arm_cm','right_arm_cm','left_thigh_cm','right_thigh_cm','left_calf_cm','right_calf_cm')) THEN RAISE EXCEPTION 'Unsupported measurement field' USING ERRCODE='22023'; END IF;
 SELECT * INTO measurement FROM jsonb_populate_record(NULL::public.student_body_compositions,p_payload);
 IF measurement.height_cm IS NULL OR measurement.height_cm<=0 OR measurement.height_cm>300 OR measurement.weight_kg IS NULL OR measurement.weight_kg<=0 OR measurement.weight_kg>600 THEN RAISE EXCEPTION 'Invalid height or weight' USING ERRCODE='22023'; END IF;
 FOREACH field IN ARRAY ARRAY['body_fat_percentage','skeletal_muscle_mass_kg','neck_cm','shoulder_width_cm','chest_cm','waist_cm','hips_cm','left_arm_cm','right_arm_cm','left_thigh_cm','right_thigh_cm','left_calf_cm','right_calf_cm'] LOOP
  amount:=(p_payload->>field)::numeric;
  IF amount IS NOT NULL AND (amount<0 OR amount>CASE WHEN field='body_fat_percentage' THEN 100 ELSE 500 END OR amount::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Invalid measurement: %',field USING ERRCODE='22023'; END IF;
 END LOOP;
 measurement.recorded_date:=COALESCE(measurement.recorded_date,(now() AT TIME ZONE 'Asia/Phnom_Penh')::date);
 IF measurement.recorded_date<'1900-01-01'::date OR measurement.recorded_date>(now() AT TIME ZONE 'Asia/Phnom_Penh')::date THEN RAISE EXCEPTION 'Invalid measurement date' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM public.students WHERE id=measurement.student_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student not found or archived' USING ERRCODE='22023'; END IF;
 INSERT INTO public.student_body_compositions(student_id,recorded_date,height_cm,weight_kg,body_fat_percentage,skeletal_muscle_mass_kg,neck_cm,shoulder_width_cm,chest_cm,waist_cm,hips_cm,left_arm_cm,right_arm_cm,left_thigh_cm,right_thigh_cm,left_calf_cm,right_calf_cm,recorded_by,request_key,request_payload)
 VALUES(measurement.student_id,measurement.recorded_date,measurement.height_cm,measurement.weight_kg,measurement.body_fat_percentage,measurement.skeletal_muscle_mass_kg,measurement.neck_cm,measurement.shoulder_width_cm,measurement.chest_cm,measurement.waist_cm,measurement.hips_cm,measurement.left_arm_cm,measurement.right_arm_cm,measurement.left_thigh_cm,measurement.right_thigh_cm,measurement.left_calf_cm,measurement.right_calf_cm,p_actor,p_request_key,p_payload) RETURNING * INTO measurement;
 SELECT * INTO latest FROM public.student_body_compositions WHERE student_id=measurement.student_id ORDER BY recorded_date DESC,created_at DESC,id DESC LIMIT 1;
 UPDATE public.students SET height_cm=latest.height_cm,weight_kg=latest.weight_kg,updated_at=now() WHERE id=measurement.student_id;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('BODY_COMPOSITION_RECORDED',p_actor::text,measurement.student_id,jsonb_build_object('measurementId',measurement.id));
 RETURN jsonb_build_object('measurement',to_jsonb(measurement),'latest',to_jsonb(latest));
END $$;
REVOKE INSERT,UPDATE,DELETE ON public.student_body_compositions FROM authenticated;
REVOKE ALL ON FUNCTION public.portal_record_body_composition(uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_record_body_composition(uuid,jsonb,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.portal_validate_payment_method() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.payment_method='Waived' AND NEW.amount_usd<>0 THEN RAISE EXCEPTION 'A waiver must have zero value' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER portal_payment_method BEFORE INSERT ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.portal_validate_payment_method();
REVOKE ALL ON FUNCTION public.portal_validate_payment_method() FROM PUBLIC,anon,authenticated;

-- A household collection is one transaction with a permanent batch receipt.
CREATE TABLE IF NOT EXISTS public.household_payment_batches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_key uuid NOT NULL UNIQUE,
 household_id uuid NOT NULL REFERENCES public.households(id),recorded_by uuid NOT NULL REFERENCES public.profiles(id),
 guardian_name text NOT NULL,payment_method text NOT NULL,external_reference text,
 receipt_number text NOT NULL UNIQUE DEFAULT ('FAMILY-'||replace(gen_random_uuid()::text,'-','')),
 request_payload jsonb NOT NULL,transactions jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS portal_family_external_reference ON public.household_payment_batches(payment_method,external_reference) WHERE external_reference IS NOT NULL;
ALTER TABLE public.household_payment_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY portal_family_payment_read ON public.household_payment_batches FOR SELECT TO authenticated USING(public.portal_has_permission('page:financials') OR public.portal_has_permission('action:finance_record_payment'));
REVOKE ALL ON public.household_payment_batches FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.household_payment_batches TO authenticated;
GRANT ALL ON public.household_payment_batches TO service_role;
CREATE TRIGGER portal_family_payment_immutable BEFORE UPDATE OR DELETE ON public.household_payment_batches FOR EACH ROW EXECUTE FUNCTION public.portal_immutable_transaction();
CREATE OR REPLACE FUNCTION public.portal_record_household_payment(p_actor uuid,p_household uuid,p_entries jsonb,p_method text,p_reference text,p_request_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE batch public.household_payment_batches; guardian text; entry record; collected jsonb; transactions jsonb:='[]'; payload jsonb; reference text;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:finance_record_payment');
 reference:=NULLIF(trim(p_reference),'');
 IF p_request_key IS NULL OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array' OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 50 OR p_method NOT IN ('Cash','Bank Transfer','Credit Card','ABA Bank KHQR') THEN RAISE EXCEPTION 'Invalid family payment' USING ERRCODE='22023'; END IF;
 IF p_method<>'Cash' AND (reference IS NULL OR length(reference) NOT BETWEEN 3 AND 100) THEN RAISE EXCEPTION 'Enter the verified bank or card payment reference' USING ERRCODE='22023'; END IF;
 IF (SELECT count(DISTINCT value->>'studentId') FROM jsonb_array_elements(p_entries))<>jsonb_array_length(p_entries) THEN RAISE EXCEPTION 'Choose one tuition month per student' USING ERRCODE='22023'; END IF;
 SELECT jsonb_agg(value ORDER BY value->>'studentId') INTO p_entries FROM jsonb_array_elements(p_entries);
 payload:=jsonb_build_object('householdId',p_household,'entries',p_entries,'method',p_method,'reference',reference);
 PERFORM pg_advisory_xact_lock(hashtextextended('family-payment:'||p_request_key::text,0));
 SELECT * INTO batch FROM public.household_payment_batches WHERE request_key=p_request_key;
 IF FOUND THEN
  IF batch.recorded_by<>p_actor OR batch.request_payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'Idempotency key mismatch' USING ERRCODE='22023'; END IF;
  RETURN to_jsonb(batch);
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_household::text,0));
 SELECT guardian_name INTO guardian FROM public.households WHERE id=p_household FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Household not found' USING ERRCODE='P0002'; END IF;
 FOR entry IN SELECT value AS data FROM jsonb_array_elements(p_entries) ORDER BY value->>'studentId' LOOP
  IF NOT EXISTS(SELECT 1 FROM public.household_students h JOIN public.students s ON s.id=h.student_id WHERE h.household_id=p_household AND h.student_id=entry.data->>'studentId' AND s.deleted_at IS NULL AND s.student_status='Active') THEN RAISE EXCEPTION 'A selected student is no longer active or linked to this household' USING ERRCODE='22023'; END IF;
  IF (entry.data->>'amount')::numeric<=0 THEN RAISE EXCEPTION 'Use the individual waiver workflow for zero tuition' USING ERRCODE='22023'; END IF;
  collected:=public.portal_record_payment(p_actor,entry.data->>'studentId',(entry.data->>'year')::integer,entry.data->>'month',(entry.data->>'amount')::numeric,p_method,md5('family:'||p_request_key::text||':'||(entry.data->>'studentId'))::uuid);
  collected:=collected||jsonb_build_object('student_name',(SELECT english_name FROM public.students WHERE id=entry.data->>'studentId'));
  transactions:=transactions||jsonb_build_array(collected);
 END LOOP;
 INSERT INTO public.household_payment_batches(request_key,household_id,recorded_by,guardian_name,payment_method,external_reference,request_payload,transactions) VALUES(p_request_key,p_household,p_actor,guardian,p_method,reference,payload,transactions) RETURNING * INTO batch;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('HOUSEHOLD_PAYMENT_RECORDED',p_actor::text,p_household::text,jsonb_build_object('batchId',batch.id,'receipt',batch.receipt_number,'students',jsonb_array_length(transactions)));
 RETURN to_jsonb(batch);
END $$;
REVOKE ALL ON FUNCTION public.portal_record_household_payment(uuid,uuid,jsonb,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_record_household_payment(uuid,uuid,jsonb,text,text,uuid) TO service_role;
-- Library and LMS records used to be saved separately, sometimes overwriting an
-- unrelated curriculum row with the same numeric ID. Keep existing mismatches
-- untouched and reject them for manual reconciliation.
ALTER TABLE public.library_assets ADD COLUMN IF NOT EXISTS request_key uuid;
ALTER TABLE public.library_assets ADD COLUMN IF NOT EXISTS request_payload jsonb;
ALTER TABLE public.library_assets ADD COLUMN IF NOT EXISTS created_by uuid;
CREATE UNIQUE INDEX IF NOT EXISTS portal_library_request ON public.library_assets(request_key) WHERE request_key IS NOT NULL;
INSERT INTO public.curriculum(id,title,target_belt,category,is_active)
 SELECT a.id,a.title,CASE WHEN a.library_type='Fitness' OR a.target_level IN ('All','Dance','Fitness') THEN 'White' ELSE a.target_level END,
 CASE WHEN a.tkd_category::text IN ('Demonstration','Tricking') THEN a.tkd_category::text ELSE 'Recognized Poomsae' END,true
 FROM public.library_assets a WHERE NOT EXISTS(SELECT 1 FROM public.curriculum c WHERE c.id=a.id);
SELECT setval(pg_get_serial_sequence('public.curriculum','id'),GREATEST(COALESCE((SELECT max(id) FROM public.curriculum),0),1),EXISTS(SELECT 1 FROM public.curriculum));
CREATE OR REPLACE FUNCTION public.portal_save_library_asset(p_actor uuid,p_action text,p_id integer,p_payload jsonb,p_request_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE asset public.library_assets; desired public.library_assets; mirrored public.curriculum; old_title text; relation jsonb; curriculum_category text; maximum_id integer;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:curriculum_edit');
 PERFORM pg_advisory_xact_lock(hashtextextended('library-curriculum-write',0));
 IF p_action NOT IN ('CREATE','UPDATE','DELETE') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid library request' USING ERRCODE='22023'; END IF;
 SELECT * INTO desired FROM jsonb_populate_record(NULL::public.library_assets,p_payload);
 IF p_action='CREATE' THEN
  IF p_request_key IS NULL THEN RAISE EXCEPTION 'Request key required' USING ERRCODE='22023'; END IF;
  SELECT * INTO asset FROM public.library_assets WHERE request_key=p_request_key;
  IF FOUND THEN
   IF asset.created_by IS DISTINCT FROM p_actor OR asset.request_payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Idempotency key mismatch' USING ERRCODE='22023'; END IF;
   RETURN jsonb_build_object('asset',to_jsonb(asset),'relations',COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM public.library_asset_muscles r WHERE asset_id=asset.id),'[]'::jsonb));
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
 INSERT INTO public.curriculum(id,title,target_belt,category,is_active) VALUES(asset.id,mirrored.title,mirrored.target_belt,mirrored.category,true)
 ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,target_belt=EXCLUDED.target_belt,category=EXCLUDED.category;
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
 RETURN jsonb_build_object('asset',to_jsonb(asset),'relations',COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM public.library_asset_muscles r WHERE asset_id=asset.id),'[]'::jsonb));
END $$;
REVOKE INSERT,UPDATE,DELETE ON public.library_assets,public.library_asset_muscles,public.curriculum FROM authenticated;
REVOKE ALL ON FUNCTION public.portal_save_library_asset(uuid,text,integer,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_save_library_asset(uuid,text,integer,jsonb,uuid) TO service_role;

DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid='public.lms_progress'::regclass AND i.indisunique AND i.indisvalid AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indnkeyatts=2 AND i.indkey::smallint[] @> (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid='public.lms_progress'::regclass AND attname IN ('student_id','curriculum_id'))) THEN
 CREATE UNIQUE INDEX IF NOT EXISTS portal_lms_student_asset ON public.lms_progress(student_id,curriculum_id);
 END IF;
END $$;
REVOKE INSERT,UPDATE,DELETE ON public.lms_progress FROM authenticated;
CREATE OR REPLACE FUNCTION public.portal_set_video_progress(p_actor uuid,p_student text,p_asset integer,p_completed boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE asset public.library_assets; result public.lms_progress;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:evaluations_grade');
 SELECT * INTO asset FROM public.library_assets WHERE id=p_asset FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Library asset not found' USING ERRCODE='P0002'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.curriculum WHERE id=p_asset AND title=asset.title) THEN RAISE EXCEPTION 'Library/curriculum link needs reconciliation' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.students WHERE id=p_student AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Student not found or archived' USING ERRCODE='P0002'; END IF;
 IF p_completed THEN
  INSERT INTO public.lms_progress(student_id,curriculum_id,status,last_watched_at,completed_at) VALUES(p_student,p_asset,'Completed',now(),now())
  ON CONFLICT(student_id,curriculum_id) DO UPDATE SET status='Completed',last_watched_at=EXCLUDED.last_watched_at,completed_at=COALESCE(public.lms_progress.completed_at,EXCLUDED.completed_at) RETURNING * INTO result;
 ELSE
  UPDATE public.lms_progress SET status='Not Started',completed_at=NULL WHERE student_id=p_student AND curriculum_id=p_asset RETURNING * INTO result;
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('VIDEO_PROGRESS_UPDATED',p_actor::text,p_student,jsonb_build_object('assetId',p_asset,'completed',p_completed));
 RETURN COALESCE(to_jsonb(result),jsonb_build_object('student_id',p_student,'curriculum_id',p_asset));
END $$;
REVOKE ALL ON FUNCTION public.portal_set_video_progress(uuid,text,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_set_video_progress(uuid,text,integer,boolean) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
