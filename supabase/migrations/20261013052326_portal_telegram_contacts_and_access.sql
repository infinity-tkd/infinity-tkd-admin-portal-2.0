-- Applied live as 20261013052326: optional contacts, compatible IDs and access policies.
BEGIN;
-- Allocate IDs on the server in the format enforced by the installed schema.
-- Sequence allocation is safe across concurrent requests and never reuses an ID.
CREATE SEQUENCE IF NOT EXISTS public.portal_student_number_seq AS bigint MINVALUE 1 MAXVALUE 99999999999999;
REVOKE ALL ON SEQUENCE public.portal_student_number_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.portal_student_number_seq TO service_role;
DO $$
DECLARE existing_max bigint; sequence_value bigint;
BEGIN
 SELECT COALESCE(max(substring(id FROM 7)::bigint),0) INTO existing_max
 FROM public.students WHERE id ~ '^STU-[MF]-[0-9]{1,14}$';
 SELECT last_value INTO sequence_value FROM public.portal_student_number_seq;
 IF existing_max >= sequence_value THEN
   PERFORM setval('public.portal_student_number_seq',existing_max,true);
 END IF;
END $$;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS telegram_username text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS telegram_username text;
COMMENT ON COLUMN public.students.telegram_username IS 'Public Telegram contact username; not an authentication identity.';
COMMENT ON COLUMN public.members.telegram_username IS 'Public Telegram contact username; not an authentication identity.';

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS portal_student_telegram_username;
ALTER TABLE public.students ADD CONSTRAINT portal_student_telegram_username CHECK
 (telegram_username IS NULL OR telegram_username ~ '^[a-z][a-z0-9_]{4,31}$');
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS portal_member_telegram_username;
ALTER TABLE public.members ADD CONSTRAINT portal_member_telegram_username CHECK
 (telegram_username IS NULL OR telegram_username ~ '^[a-z][a-z0-9_]{4,31}$');

-- Contact details participate in the existing student and member transactions.
CREATE OR REPLACE FUNCTION public.portal_create_student(p_actor uuid,p_student jsonb,p_address jsonb DEFAULT NULL,p_class_id integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.students; eid bigint; student_number bigint;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:student_create');
 PERFORM pg_advisory_xact_lock(hashtextextended(lower(p_student->>'english_name')||COALESCE(p_student->>'dob','')||COALESCE(p_student->>'gender',''),0));
 LOOP
   student_number:=nextval('public.portal_student_number_seq'::regclass);
   p_student:=p_student||jsonb_build_object('id','STU-'||CASE WHEN p_student->>'gender'='Male' THEN 'M' ELSE 'F' END||'-'||student_number::text);
   EXIT WHEN NOT EXISTS(SELECT 1 FROM public.students WHERE id=p_student->>'id');
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.students WHERE lower(english_name)=lower(p_student->>'english_name') AND dob=(p_student->>'dob')::date AND gender=p_student->>'gender' AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Student already registered' USING ERRCODE='23505'; END IF;
 SELECT * INTO s FROM jsonb_populate_record(NULL::public.students,p_student);
 INSERT INTO public.students(id,khmer_name,english_name,gender,dob,registration_date,scholarship_id,height_cm,weight_kg,home_branch_id,current_belt,student_status,email,phone,telegram_username,emergency_contact_name,emergency_contact_phone,emergency_contact_relation,medical_notes,allergies,nationality,profile_picture_path,esign_path,kukkiwon_id,notes)
 VALUES(s.id,s.khmer_name,s.english_name,s.gender,s.dob,s.registration_date,s.scholarship_id,s.height_cm,s.weight_kg,s.home_branch_id,s.current_belt,s.student_status,s.email,s.phone,s.telegram_username,s.emergency_contact_name,s.emergency_contact_phone,s.emergency_contact_relation,s.medical_notes,s.allergies,s.nationality,s.profile_picture_path,s.esign_path,s.kukkiwon_id,s.notes);
 IF p_address IS NOT NULL THEN INSERT INTO public.student_addresses(student_id,address_line1,address_line2,district_commune,state_province_city,postal_code,country,is_primary)
 VALUES(s.id,p_address->>'address_line1',p_address->>'address_line2',p_address->>'district_commune',p_address->>'state_province_city',p_address->>'postal_code',p_address->>'country',true); END IF;
 IF p_class_id IS NOT NULL THEN INSERT INTO public.class_enrollments(student_id,class_id,enrollment_date) VALUES(s.id,p_class_id,s.registration_date) RETURNING id INTO eid; END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('STUDENT_REGISTERED',p_actor::text,s.id,jsonb_build_object('class_id',p_class_id));
 RETURN jsonb_build_object('id',s.id,'enrollmentId',eid);
END $$;

CREATE OR REPLACE FUNCTION public.portal_update_student(p_actor uuid,p_id text,p_changes jsonb,p_address jsonb DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.students;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:student_edit');
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_changes) k WHERE k NOT IN('khmer_name','english_name','gender','dob','registration_date','scholarship_id','height_cm','weight_kg','home_branch_id','current_belt','student_status','email','phone','telegram_username','emergency_contact_name','emergency_contact_phone','emergency_contact_relation','medical_notes','allergies','nationality','profile_picture_path','esign_path','kukkiwon_id','notes','status_reason','status_changed_at','pause_end_date')) THEN RAISE EXCEPTION 'Unsupported student field' USING ERRCODE='22023'; END IF;
 SELECT * INTO s FROM public.students WHERE id=p_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student not found' USING ERRCODE='22023'; END IF;
 SELECT * INTO s FROM jsonb_populate_record(s,p_changes);
 UPDATE public.students SET khmer_name=s.khmer_name,english_name=s.english_name,gender=s.gender,dob=s.dob,registration_date=s.registration_date,scholarship_id=s.scholarship_id,height_cm=s.height_cm,weight_kg=s.weight_kg,home_branch_id=s.home_branch_id,current_belt=s.current_belt,student_status=s.student_status,email=s.email,phone=s.phone,telegram_username=s.telegram_username,emergency_contact_name=s.emergency_contact_name,emergency_contact_phone=s.emergency_contact_phone,emergency_contact_relation=s.emergency_contact_relation,medical_notes=s.medical_notes,allergies=s.allergies,nationality=s.nationality,profile_picture_path=s.profile_picture_path,esign_path=s.esign_path,kukkiwon_id=s.kukkiwon_id,notes=s.notes,status_reason=s.status_reason,status_changed_at=s.status_changed_at,pause_end_date=s.pause_end_date,updated_at=now() WHERE id=p_id;
 IF p_changes ? 'english_name' THEN UPDATE public.profiles SET display_name=s.english_name WHERE id=s.profile_id; END IF;
 -- Contact email and login identity are separate. Pausing training does not suspend portal login.
 IF s.student_status='Suspended' THEN UPDATE public.profiles SET is_active=false WHERE id=s.profile_id; END IF;
 IF p_address IS NOT NULL THEN
 UPDATE public.student_addresses SET address_line1=p_address->>'address_line1',address_line2=p_address->>'address_line2',district_commune=p_address->>'district_commune',state_province_city=p_address->>'state_province_city',postal_code=p_address->>'postal_code',country=p_address->>'country' WHERE student_id=p_id AND is_primary=true;
 IF NOT FOUND THEN INSERT INTO public.student_addresses(student_id,address_line1,address_line2,district_commune,state_province_city,postal_code,country,is_primary) VALUES(p_id,p_address->>'address_line1',p_address->>'address_line2',p_address->>'district_commune',p_address->>'state_province_city',p_address->>'postal_code',p_address->>'country',true); END IF; END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('STUDENT_UPDATED',p_actor::text,p_id,jsonb_build_object('fields',ARRAY(SELECT jsonb_object_keys(p_changes))));
END $$;

CREATE OR REPLACE FUNCTION public.portal_provision_user(p_actor uuid,p_profile jsonb,p_member jsonb DEFAULT NULL,p_address jsonb DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.profiles; m public.members; actor_role text;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:staff_manage');
 SELECT role INTO actor_role FROM public.profiles WHERE id=p_actor;
 SELECT * INTO p FROM jsonb_populate_record(NULL::public.profiles,p_profile);
 IF p.role<>'Student' AND p.student_id IS NOT NULL THEN RAISE EXCEPTION 'Only Student accounts can link a student record' USING ERRCODE='22023'; END IF;
 IF p.role IN ('Root','Super Root') AND actor_role NOT IN ('Root','Super Root') THEN RAISE EXCEPTION 'Root role requires Root authority' USING ERRCODE='42501'; END IF;
 IF p.role='Student' THEN
 PERFORM 1 FROM public.students WHERE id=p.student_id AND profile_id IS NULL AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student is absent, archived, or already linked' USING ERRCODE='22023'; END IF;
 END IF;
 INSERT INTO public.profiles(id,username,email,display_name,role,is_active,student_id,must_change_password) VALUES(p.id,p.username,p.email,p.display_name,p.role,p.is_active,p.student_id,p.role<>'Student')
 ON CONFLICT(id) DO UPDATE SET username=EXCLUDED.username,email=EXCLUDED.email,display_name=EXCLUDED.display_name,role=EXCLUDED.role,is_active=EXCLUDED.is_active,student_id=EXCLUDED.student_id,must_change_password=EXCLUDED.must_change_password;
 IF p.role='Student' THEN UPDATE public.students SET profile_id=p.id WHERE id=p.student_id;
 ELSE
 SELECT * INTO m FROM jsonb_populate_record(NULL::public.members,p_member);
 INSERT INTO public.members(id,khmer_name,english_name,gender,dob,phone,telegram_username,emergency_contact_name,emergency_contact_phone,emergency_contact_relation,medical_notes,allergies,profile_picture_path,nationality) VALUES(p.id,m.khmer_name,m.english_name,m.gender,m.dob,m.phone,m.telegram_username,m.emergency_contact_name,m.emergency_contact_phone,m.emergency_contact_relation,m.medical_notes,m.allergies,m.profile_picture_path,m.nationality)
 ON CONFLICT(id) DO UPDATE SET khmer_name=EXCLUDED.khmer_name,english_name=EXCLUDED.english_name,gender=EXCLUDED.gender,dob=EXCLUDED.dob,phone=EXCLUDED.phone,telegram_username=EXCLUDED.telegram_username,emergency_contact_name=EXCLUDED.emergency_contact_name,emergency_contact_phone=EXCLUDED.emergency_contact_phone,emergency_contact_relation=EXCLUDED.emergency_contact_relation,medical_notes=EXCLUDED.medical_notes,allergies=EXCLUDED.allergies,profile_picture_path=EXCLUDED.profile_picture_path,nationality=EXCLUDED.nationality;
 IF p_address IS NOT NULL THEN INSERT INTO public.member_addresses(member_id,address_line1,address_line2,district_commune,state_province_city,postal_code,country,is_primary) VALUES(p.id,p_address->>'line1',p_address->>'line2',p_address->>'city',p_address->>'stateProvince',p_address->>'postalCode',COALESCE(p_address->>'country','Cambodia'),true); END IF;
 END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('USER_PROVISIONED',p_actor::text,p.id::text,jsonb_build_object('role',p.role));
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
 UPDATE public.members SET khmer_name=m.khmer_name,english_name=m.english_name,gender=m.gender,dob=m.dob,phone=m.phone,telegram_username=m.telegram_username,emergency_contact_name=m.emergency_contact_name,emergency_contact_phone=m.emergency_contact_phone,emergency_contact_relation=m.emergency_contact_relation,medical_notes=m.medical_notes,allergies=m.allergies,profile_picture_path=m.profile_picture_path,nationality=m.nationality WHERE id=p_target;
 IF p_address IS NOT NULL THEN
 UPDATE public.member_addresses SET address_line1=p_address->>'address_line1',address_line2=p_address->>'address_line2',district_commune=p_address->>'district_commune',state_province_city=p_address->>'state_province_city',postal_code=p_address->>'postal_code',country=p_address->>'country' WHERE member_id=p_target AND is_primary=true;
 IF NOT FOUND THEN INSERT INTO public.member_addresses(member_id,address_line1,address_line2,district_commune,state_province_city,postal_code,country,is_primary) VALUES(p_target,p_address->>'address_line1',p_address->>'address_line2',p_address->>'district_commune',p_address->>'state_province_city',p_address->>'postal_code',p_address->>'country',true); END IF;
 END IF; END IF;
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('USER_UPDATED',p_actor::text,p_target::text,jsonb_build_object('fields',ARRAY(SELECT jsonb_object_keys(p_profile))));
END $$;

-- Staff with every operational permission removed must not retain blanket roster access.
-- Dashboard, attendance, scheduling, finance, LMS and POS still need student identities.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public'
   AND tablename IN ('students','student_addresses','class_enrollments') AND cmd='SELECT' LOOP
  EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);
 END LOOP;
END $$;
CREATE POLICY portal_student_read ON public.students FOR SELECT TO authenticated USING (
 (SELECT public.is_dojo_staff() AND (
   public.portal_has_permission('page:directory') OR public.portal_has_permission('page:dashboard')
   OR public.portal_has_permission('page:attendance') OR public.portal_has_permission('page:schedule')
   OR public.portal_has_permission('page:financials') OR public.portal_has_permission('page:lms')
   OR public.portal_has_permission('page:pos') OR public.portal_has_permission('action:student_edit')
   OR public.portal_has_permission('action:student_create')))
 OR public.is_current_student(id)
);
CREATE POLICY portal_address_read ON public.student_addresses FOR SELECT TO authenticated USING (
 public.portal_has_permission('page:directory') OR public.portal_has_permission('action:student_edit')
 OR public.is_current_student(student_id)
);
CREATE POLICY portal_enrollment_read ON public.class_enrollments FOR SELECT TO authenticated USING (
 (SELECT public.is_dojo_staff() AND (
   public.portal_has_permission('page:directory') OR public.portal_has_permission('page:dashboard')
   OR public.portal_has_permission('page:attendance') OR public.portal_has_permission('page:schedule')
   OR public.portal_has_permission('page:financials') OR public.portal_has_permission('page:lms')
   OR public.portal_has_permission('action:student_edit') OR public.portal_has_permission('action:schedule_manage')))
 OR public.is_current_student(student_id)
);

REVOKE ALL ON FUNCTION public.portal_create_student(uuid,jsonb,jsonb,integer),
 public.portal_update_student(uuid,text,jsonb,jsonb),
 public.portal_provision_user(uuid,jsonb,jsonb,jsonb),
 public.portal_update_user(uuid,uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_create_student(uuid,jsonb,jsonb,integer),
 public.portal_update_student(uuid,text,jsonb,jsonb),
 public.portal_provision_user(uuid,jsonb,jsonb,jsonb),
 public.portal_update_user(uuid,uuid,jsonb,jsonb,jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
