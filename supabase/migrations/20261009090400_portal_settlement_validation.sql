BEGIN;
-- Carry legacy secondary contacts into the modern fields once, before removing read fallbacks.
UPDATE public.partners SET secondary_contact_name=COALESCE(secondary_contact_name,secondary_contacts->0->>'name'),secondary_contact_phone=COALESCE(secondary_contact_phone,secondary_contacts->0->>'phone'),secondary_contact_telegram=COALESCE(secondary_contact_telegram,secondary_contacts->0->>'telegram') WHERE jsonb_typeof(secondary_contacts)='array';
-- Preserve legacy records for reconciliation; all new MOU writes must have coherent dates.
ALTER TABLE public.partners ADD CONSTRAINT portal_partner_dates CHECK(mou_signed_date IS NULL OR mou_expiry_date IS NULL OR mou_expiry_date>=mou_signed_date) NOT VALID;
-- This portal records complete monthly settlements. Partial collections require
-- an allocation ledger and must never masquerade as a fully paid month.
CREATE OR REPLACE FUNCTION public.portal_validate_tuition_settlement() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE student public.students; plan public.scholarships; config public.academy_profile;
 expected numeric; starts date; billing_month integer;
BEGIN
 SELECT * INTO student FROM public.students WHERE id=NEW.student_id AND deleted_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student is missing or archived' USING ERRCODE='22023'; END IF;
 SELECT * INTO plan FROM public.scholarships WHERE id=student.scholarship_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student tuition plan is missing' USING ERRCODE='22023'; END IF;
 SELECT * INTO config FROM public.academy_profile WHERE id='default';
 expected:=CASE WHEN plan.type_name='Early Group Student' THEN COALESCE(config.early_group_tuition_usd,25)
 ELSE round(COALESCE(config.standard_tuition_usd,45)*(100-greatest(0,least(100,plan.discount_percentage)))/100,2) END;
 SELECT min(enrollment_date) INTO starts FROM public.class_enrollments WHERE student_id=student.id;
 starts:=COALESCE(starts,student.registration_date);
 billing_month:=array_position(ARRAY['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],NEW.for_month);
 IF billing_month IS NULL OR make_date(NEW.year,billing_month,1)<date_trunc('month',starts)::date THEN
 RAISE EXCEPTION 'Billing month precedes enrollment or is invalid' USING ERRCODE='22023'; END IF;
 IF NEW.amount_usd>0 AND NEW.amount_usd<>expected THEN
 RAISE EXCEPTION 'Full monthly tuition is % USD; partial or excess settlements are not supported',expected USING ERRCODE='22023'; END IF;
 IF NEW.amount_usd=0 AND NEW.payment_method<>'Waived' THEN RAISE EXCEPTION 'A zero payment requires an explicit waiver' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS portal_tuition_settlement ON public.payment_transactions;
CREATE TRIGGER portal_tuition_settlement BEFORE INSERT ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.portal_validate_tuition_settlement();
REVOKE ALL ON FUNCTION public.portal_validate_tuition_settlement() FROM PUBLIC,anon,authenticated;

-- Promotion history and the student's displayed belt change in the same transaction.
-- Preserve a migrated student's starting belt before their first new promotion.
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS initial_belt varchar(30);
UPDATE public.students s SET initial_belt='White' WHERE initial_belt IS NULL AND EXISTS(SELECT 1 FROM public.belt_histories h WHERE h.student_id=s.id);
CREATE OR REPLACE FUNCTION public.portal_guard_student_identity() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND pg_trigger_depth()<=1 AND
 (NEW.id IS DISTINCT FROM OLD.id OR NEW.profile_id IS DISTINCT FROM OLD.profile_id OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.initial_belt IS DISTINCT FROM OLD.initial_belt OR
 NEW.current_belt IS DISTINCT FROM OLD.current_belt AND EXISTS(SELECT 1 FROM public.belt_histories WHERE student_id=OLD.id)) THEN
 RAISE EXCEPTION 'Student identity and recorded belt changes require trusted operations' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.portal_lock_promotion_student() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sid text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.student_id IS DISTINCT FROM OLD.student_id THEN RAISE EXCEPTION 'A promotion cannot move to another student' USING ERRCODE='22023'; END IF;
 sid:=CASE WHEN TG_OP='DELETE' THEN OLD.student_id ELSE NEW.student_id END;
 PERFORM 1 FROM public.students WHERE id=sid AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student is missing or archived' USING ERRCODE='22023'; END IF;
 UPDATE public.students SET initial_belt=COALESCE(initial_belt,current_belt,'White') WHERE id=sid;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.portal_sync_promotion_belt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sid text; latest text;
BEGIN
 sid:=CASE WHEN TG_OP='DELETE' THEN OLD.student_id ELSE NEW.student_id END;
 SELECT belt_level INTO latest FROM public.belt_histories WHERE student_id=sid ORDER BY promotion_date DESC,id DESC LIMIT 1;
 UPDATE public.students SET current_belt=COALESCE(latest,initial_belt,'White'),updated_at=now() WHERE id=sid;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS portal_lock_promotion ON public.belt_histories;
DROP TRIGGER IF EXISTS portal_sync_promotion ON public.belt_histories;
CREATE TRIGGER portal_lock_promotion BEFORE INSERT OR UPDATE OR DELETE ON public.belt_histories FOR EACH ROW EXECUTE FUNCTION public.portal_lock_promotion_student();
CREATE TRIGGER portal_sync_promotion AFTER INSERT OR UPDATE OR DELETE ON public.belt_histories FOR EACH ROW EXECUTE FUNCTION public.portal_sync_promotion_belt();
REVOKE ALL ON FUNCTION public.portal_lock_promotion_student(),public.portal_sync_promotion_belt() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.portal_reconcile_belts(p_actor uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s record; latest text; changes jsonb:='[]'; scanned integer:=0;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:evaluations_grade');
 FOR s IN SELECT * FROM public.students WHERE deleted_at IS NULL ORDER BY id FOR UPDATE LOOP
 scanned:=scanned+1;
 SELECT belt_level INTO latest FROM public.belt_histories WHERE student_id=s.id ORDER BY promotion_date DESC,id DESC LIMIT 1;
 latest:=COALESCE(latest,s.initial_belt,s.current_belt,'White');
 IF s.current_belt IS DISTINCT FROM latest THEN
 UPDATE public.students SET current_belt=latest,updated_at=now() WHERE id=s.id;
 changes:=changes||jsonb_build_array(s.english_name||' ('||s.id||'): '||s.current_belt||' to '||latest);
 END IF;
 END LOOP;
 INSERT INTO public.audit_logs(action,performed_by,details) VALUES('BELTS_RECONCILED',p_actor::text,jsonb_build_object('corrected',jsonb_array_length(changes)));
 RETURN jsonb_build_object('success',true,'scanned',scanned,'corrected',jsonb_array_length(changes),'details',changes);
END $$;
REVOKE ALL ON FUNCTION public.portal_reconcile_belts(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_reconcile_belts(uuid) TO service_role;

-- Class edits validate the merged record, including single-field time edits.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid='public.class_enrollments'::regclass AND i.indisunique AND i.indisvalid AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indnkeyatts=2 AND i.indkey::smallint[] @> (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid='public.class_enrollments'::regclass AND attname IN ('student_id','class_id'))) THEN
 CREATE UNIQUE INDEX IF NOT EXISTS portal_unique_enrollment ON public.class_enrollments(student_id,class_id);
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.portal_validate_class() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 IF NEW.start_time>=NEW.end_time OR NEW.capacity<0 OR NEW.capacity>500 THEN RAISE EXCEPTION 'Invalid class times or capacity' USING ERRCODE='22023'; END IF;
 IF NEW.days_of_week IS NULL OR cardinality(NEW.days_of_week) NOT BETWEEN 1 AND 7 OR NOT NEW.days_of_week::text[] <@ ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']::text[] THEN RAISE EXCEPTION 'Invalid class weekdays' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO n FROM public.class_enrollments e JOIN public.students s ON s.id=e.student_id WHERE e.class_id=NEW.id AND s.deleted_at IS NULL AND s.student_status='Active';
 IF n>NEW.capacity THEN RAISE EXCEPTION 'Capacity cannot be less than the active enrollment count' USING ERRCODE='22023'; END IF;
 IF NEW.coach_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.coach_id AND is_active=true AND role<>'Student') THEN RAISE EXCEPTION 'Coach must be an active staff account' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS portal_validate_class ON public.class_sessions;
CREATE TRIGGER portal_validate_class BEFORE INSERT OR UPDATE ON public.class_sessions FOR EACH ROW EXECUTE FUNCTION public.portal_validate_class();
CREATE OR REPLACE FUNCTION public.portal_validate_reactivation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c record; n integer;
BEGIN
 IF NEW.student_status='Active' AND NEW.deleted_at IS NULL AND (OLD.student_status IS DISTINCT FROM 'Active' OR OLD.deleted_at IS NOT NULL) THEN
 FOR c IN SELECT cs.id,cs.capacity FROM public.class_sessions cs WHERE EXISTS(SELECT 1 FROM public.class_enrollments WHERE student_id=NEW.id AND class_id=cs.id) ORDER BY cs.id FOR UPDATE LOOP
 SELECT count(*) INTO n FROM public.class_enrollments e JOIN public.students s ON s.id=e.student_id WHERE e.class_id=c.id AND s.id<>NEW.id AND s.student_status='Active' AND s.deleted_at IS NULL;
 IF n>=c.capacity THEN RAISE EXCEPTION 'Reactivation would exceed class capacity. Change the enrollment first' USING ERRCODE='22023'; END IF;
 END LOOP;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS portal_validate_reactivation ON public.students;
CREATE TRIGGER portal_validate_reactivation BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.portal_validate_reactivation();
REVOKE ALL ON FUNCTION public.portal_validate_class(),public.portal_validate_reactivation() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.portal_set_user_permissions(p_actor uuid,p_user uuid,p_updates jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item record;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:staff_manage');
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role IN ('Root','Super Root')) THEN RAISE EXCEPTION 'Root authority required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Target account not found' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(p_updates) IS DISTINCT FROM 'array' OR jsonb_array_length(p_updates) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid permission batch' USING ERRCODE='22023'; END IF;
 IF (SELECT count(DISTINCT value->>'permissionKey') FROM jsonb_array_elements(p_updates))<>jsonb_array_length(p_updates) THEN RAISE EXCEPTION 'Duplicate permission keys' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT value AS data FROM jsonb_array_elements(p_updates) LOOP
 IF NOT EXISTS(SELECT 1 FROM public.role_permissions WHERE permission_key=item.data->>'permissionKey') OR jsonb_typeof(item.data->'isGranted') NOT IN ('boolean','null') THEN RAISE EXCEPTION 'Unknown permission or invalid value' USING ERRCODE='22023'; END IF;
 IF item.data->'isGranted'='null'::jsonb THEN DELETE FROM public.user_permissions WHERE user_id=p_user AND permission_key=item.data->>'permissionKey';
 ELSE INSERT INTO public.user_permissions(user_id,permission_key,is_granted,updated_by,updated_at) VALUES(p_user,item.data->>'permissionKey',(item.data->>'isGranted')::boolean,p_actor,now()) ON CONFLICT(user_id,permission_key) DO UPDATE SET is_granted=EXCLUDED.is_granted,updated_by=p_actor,updated_at=now(); END IF;
 END LOOP;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('USER_PERMISSIONS_UPDATED',p_actor::text,p_user::text,jsonb_build_object('changes',p_updates));
END $$;
REVOKE ALL ON FUNCTION public.portal_set_user_permissions(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_set_user_permissions(uuid,uuid,jsonb) TO service_role;
COMMIT;
