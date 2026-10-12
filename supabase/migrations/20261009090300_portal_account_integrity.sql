BEGIN;
-- Legacy Auth signup triggers may consume user_metadata. Self-signup never creates staff authority.
CREATE OR REPLACE FUNCTION public.portal_guard_profile_signup() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND session_user NOT IN ('postgres','supabase_admin') THEN
 NEW.role:='Student'; NEW.is_active:=false; NEW.student_id:=NULL; NEW.must_change_password:=false;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS portal_profile_signup ON public.profiles;
CREATE TRIGGER portal_profile_signup BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.portal_guard_profile_signup();
REVOKE ALL ON FUNCTION public.portal_guard_profile_signup() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.portal_archive_user(p_actor uuid,p_target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor_role text; target_role text;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:staff_manage');
 PERFORM pg_advisory_xact_lock(hashtextextended('portal-active-root-authority',0));
 IF p_actor=p_target THEN RAISE EXCEPTION 'Cannot archive your own account' USING ERRCODE='22023'; END IF;
 SELECT role INTO actor_role FROM public.profiles WHERE id=p_actor;
 SELECT role INTO target_role FROM public.profiles WHERE id=p_target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found' USING ERRCODE='22023'; END IF;
 IF target_role IN ('Root','Super Root') AND actor_role NOT IN ('Root','Super Root') THEN RAISE EXCEPTION 'Root account requires Root authority' USING ERRCODE='42501'; END IF;
 IF target_role IN ('Root','Super Root') AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id<>p_target AND is_active AND role IN ('Root','Super Root')) THEN RAISE EXCEPTION 'Keep at least one active Root account' USING ERRCODE='22023'; END IF;
 UPDATE public.profiles SET is_active=false WHERE id=p_target;
 UPDATE public.class_sessions SET coach_id=CASE WHEN coach_id=p_target THEN NULL ELSE coach_id END,head_coach_id=CASE WHEN head_coach_id=p_target THEN NULL ELSE head_coach_id END WHERE coach_id=p_target OR head_coach_id=p_target;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('USER_ARCHIVED',p_actor::text,p_target::text,'{}');
END $$;

CREATE OR REPLACE FUNCTION public.portal_update_user(p_actor uuid,p_target uuid,p_profile jsonb,p_member jsonb,p_address jsonb DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.profiles; target public.profiles; changed public.profiles; m public.members; privileged boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('portal-active-root-authority',0));
 SELECT * INTO actor FROM public.profiles WHERE id=p_actor AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inactive account' USING ERRCODE='42501'; END IF;
 SELECT * INTO target FROM public.profiles WHERE id=p_target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Target missing' USING ERRCODE='22023'; END IF;
 privileged:=actor.role IN ('Root','Super Root') OR COALESCE((SELECT is_granted FROM public.user_permissions WHERE user_id=p_actor AND permission_key='action:staff_manage'),(SELECT is_granted FROM public.role_permissions WHERE role=actor.role AND permission_key='action:staff_manage'),false);
 IF NOT privileged AND p_actor<>p_target THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501'; END IF;
 IF NOT privileged AND p_profile ?| ARRAY['role','is_active','student_id','kukkiwon_id','current_dan','dan_issue_date','dan_certificate_url'] THEN RAISE EXCEPTION 'Protected profile field' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_profile) k WHERE k NOT IN ('email','username','display_name','role','is_active','student_id','kukkiwon_id','current_dan','dan_issue_date','dan_certificate_url','must_change_password')) THEN RAISE EXCEPTION 'Unsupported profile field' USING ERRCODE='22023'; END IF;
 SELECT * INTO changed FROM jsonb_populate_record(target,p_profile);
 IF changed.role<>'Student' AND changed.student_id IS NOT NULL THEN RAISE EXCEPTION 'Clear the student link before changing to a staff role' USING ERRCODE='22023'; END IF;
 IF changed.role='Student' AND changed.student_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.students WHERE profile_id=p_target AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Choose the student record explicitly' USING ERRCODE='22023'; END IF;
 IF (target.role IN ('Root','Super Root') OR changed.role IN ('Root','Super Root')) AND actor.role NOT IN ('Root','Super Root') THEN RAISE EXCEPTION 'Root authority required' USING ERRCODE='42501'; END IF;
 IF target.is_active AND target.role IN ('Root','Super Root') AND (NOT changed.is_active OR changed.role NOT IN ('Root','Super Root')) AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id<>p_target AND is_active AND role IN ('Root','Super Root')) THEN RAISE EXCEPTION 'Keep at least one active Root account' USING ERRCODE='22023'; END IF;
 IF changed.student_id IS DISTINCT FROM target.student_id THEN
 IF changed.role<>'Student' AND changed.student_id IS NOT NULL THEN RAISE EXCEPTION 'Only Student accounts can link a student record' USING ERRCODE='22023'; END IF;
 IF changed.student_id IS NOT NULL THEN
 PERFORM 1 FROM public.students WHERE id=changed.student_id AND (profile_id IS NULL OR profile_id=p_target) AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student is already linked or missing' USING ERRCODE='22023'; END IF;
 END IF;
 UPDATE public.students SET profile_id=NULL WHERE profile_id=p_target;
 UPDATE public.students SET profile_id=p_target WHERE id=changed.student_id;
 END IF;
 UPDATE public.profiles SET email=changed.email,username=changed.username,display_name=changed.display_name,role=changed.role,is_active=changed.is_active,student_id=changed.student_id,kukkiwon_id=changed.kukkiwon_id,current_dan=changed.current_dan,dan_issue_date=changed.dan_issue_date,dan_certificate_url=changed.dan_certificate_url,must_change_password=changed.must_change_password WHERE id=p_target;
 SELECT * INTO m FROM public.members WHERE id=p_target FOR UPDATE;
 IF FOUND THEN
 SELECT * INTO m FROM jsonb_populate_record(m,p_member);
 UPDATE public.members SET khmer_name=m.khmer_name,english_name=m.english_name,gender=m.gender,dob=m.dob,phone=m.phone,emergency_contact_name=m.emergency_contact_name,emergency_contact_phone=m.emergency_contact_phone,emergency_contact_relation=m.emergency_contact_relation,medical_notes=m.medical_notes,allergies=m.allergies,profile_picture_path=m.profile_picture_path,nationality=m.nationality WHERE id=p_target;
 IF p_address IS NOT NULL THEN
 UPDATE public.member_addresses SET address_line1=p_address->>'address_line1',address_line2=p_address->>'address_line2',district_commune=p_address->>'district_commune',state_province_city=p_address->>'state_province_city',postal_code=p_address->>'postal_code',country=p_address->>'country' WHERE member_id=p_target AND is_primary=true;
 IF NOT FOUND THEN INSERT INTO public.member_addresses(member_id,address_line1,address_line2,district_commune,state_province_city,postal_code,country,is_primary) VALUES(p_target,p_address->>'address_line1',p_address->>'address_line2',p_address->>'district_commune',p_address->>'state_province_city',p_address->>'postal_code',p_address->>'country',true); END IF;
 END IF; END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('USER_UPDATED',p_actor::text,p_target::text,jsonb_build_object('fields',ARRAY(SELECT jsonb_object_keys(p_profile))));
END $$;
REVOKE ALL ON FUNCTION public.portal_archive_user(uuid,uuid),public.portal_update_user(uuid,uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_archive_user(uuid,uuid),public.portal_update_user(uuid,uuid,jsonb,jsonb,jsonb) TO service_role;

CREATE TABLE IF NOT EXISTS public.client_telemetry(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),details jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.client_telemetry ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS portal_telemetry_date ON public.client_telemetry(created_at);
REVOKE ALL ON public.client_telemetry FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.client_telemetry TO service_role;
COMMIT;
