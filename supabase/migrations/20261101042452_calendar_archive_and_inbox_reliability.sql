BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

-- Archive is an explicit, audited withdrawal. Keep event IDs, public history and achievement links.
ALTER TABLE public.academy_events ADD COLUMN archived_at timestamptz,
 ADD COLUMN archived_by uuid REFERENCES public.profiles(id), ADD COLUMN archived_reason text,
 ADD CONSTRAINT academy_events_archive_complete CHECK(
  (archived_at IS NULL AND archived_by IS NULL AND archived_reason IS NULL) OR
  (archived_at IS NOT NULL AND archived_by IS NOT NULL AND archived_reason IS NOT NULL AND length(btrim(archived_reason)) BETWEEN 5 AND 1000));
CREATE INDEX academy_events_archived_by_idx ON public.academy_events(archived_by);

-- Approved public revisions and their associated inbox snapshots remain attributable.
CREATE TRIGGER academy_event_revisions_immutable BEFORE UPDATE OR DELETE ON public.academy_event_revisions FOR EACH ROW EXECUTE FUNCTION public.portal_immutable_transaction();
REVOKE UPDATE ON public.academy_event_revisions FROM service_role;
ALTER TABLE public.portal_notifications ADD CONSTRAINT portal_event_notice_complete CHECK(
 source_type IS DISTINCT FROM 'academy_event' OR
 (category='events' AND source_id IS NOT NULL AND source_revision IS NOT NULL AND source_revision>0 AND subject_student_id IS NOT NULL AND permission_key IS NULL)),
 ADD CONSTRAINT portal_event_notice_revision_fkey FOREIGN KEY(source_id,source_revision) REFERENCES public.academy_event_revisions(event_id,revision) ON DELETE RESTRICT;
DROP INDEX public.portal_notifications_event_idx;
CREATE INDEX portal_notifications_event_idx ON public.portal_notifications(source_id,source_revision);

CREATE FUNCTION public.portal_calendar_notice_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF OLD.source_type='academy_event' AND ROW(NEW.id,NEW.user_id,NEW.source_key,NEW.category,NEW.title,NEW.body,NEW.href,NEW.permission_key,NEW.source_type,NEW.source_id,NEW.source_revision,NEW.subject_student_id,NEW.created_at,NEW.delivered_at)
  IS DISTINCT FROM ROW(OLD.id,OLD.user_id,OLD.source_key,OLD.category,OLD.title,OLD.body,OLD.href,OLD.permission_key,OLD.source_type,OLD.source_id,OLD.source_revision,OLD.subject_student_id,OLD.created_at,OLD.delivered_at) THEN
 RAISE EXCEPTION 'Approved event notification snapshots are immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.portal_calendar_notice_snapshot() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_calendar_notice_snapshot() TO service_role;
CREATE TRIGGER portal_calendar_notice_snapshot BEFORE UPDATE ON public.portal_notifications FOR EACH ROW EXECUTE FUNCTION public.portal_calendar_notice_snapshot();

CREATE OR REPLACE FUNCTION public.portal_calendar_validate(p jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a jsonb; mode text:=p#>>'{audience,mode}';
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR length(btrim(COALESCE(p->>'title','')))=0 OR length(p->>'title')>200
 OR COALESCE(p->>'type','') NOT IN ('holiday','competition','workshop','maintenance','academy','class_change')
 OR COALESCE(p->>'lifecycle','') NOT IN ('scheduled','postponed','cancelled','completed')
 OR COALESCE(p->>'startDate','') !~ '^\d{4}-\d{2}-\d{2}$' OR COALESCE(p->>'endDate','') !~ '^\d{4}-\d{2}-\d{2}$'
 OR (p->>'endDate')::date<(p->>'startDate')::date OR (p->>'endDate')::date-(p->>'startDate')::date>366
 OR length(COALESCE(p->>'description',''))>8000 OR length(COALESCE(p->>'internalNotes',''))>5000
 OR length(COALESCE(p->>'location',''))>240 OR length(COALESCE(p->>'changeReason',''))>1000
 OR COALESCE(mode,'') NOT IN ('all','branches','classes','students','staff')
 OR jsonb_typeof(p->'attachments') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'attachments')>10 THEN
 RAISE EXCEPTION 'Invalid calendar fields' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p->>'timezone') THEN RAISE EXCEPTION 'Invalid event timezone' USING ERRCODE='22023'; END IF;
 IF ((p->>'startsAt') IS NULL) IS DISTINCT FROM ((p->>'endsAt') IS NULL) OR
 ((p->>'startsAt') IS NOT NULL AND (p->>'endsAt')::timestamptz<=(p->>'startsAt')::timestamptz) THEN RAISE EXCEPTION 'Invalid event times' USING ERRCODE='22023'; END IF;
 IF p->>'lifecycle' IN ('cancelled','postponed') AND length(btrim(COALESCE(p->>'changeReason','')))<5 THEN RAISE EXCEPTION 'Explain this cancellation or postponement' USING ERRCODE='22023'; END IF;
 IF p->>'lifecycle'='completed' AND (CASE WHEN p->>'endsAt' IS NOT NULL THEN (p->>'endsAt')::timestamptz>now() ELSE (p->>'endDate')::date>(now() AT TIME ZONE (p->>'timezone'))::date END) THEN RAISE EXCEPTION 'A future event cannot be completed' USING ERRCODE='22023'; END IF;
 IF p->>'startsAt' IS NOT NULL AND (((p->>'startsAt')::timestamptz AT TIME ZONE (p->>'timezone'))::date<>(p->>'startDate')::date OR (((p->>'endsAt')::timestamptz-interval '1 microsecond') AT TIME ZONE (p->>'timezone'))::date<>(p->>'endDate')::date) THEN RAISE EXCEPTION 'Dates must match the timed occurrence' USING ERRCODE='22023'; END IF;
 FOR a IN SELECT value FROM jsonb_array_elements(p->'attachments') LOOP
 IF length(btrim(COALESCE(a->>'label','')))=0 OR length(a->>'label')>120 OR COALESCE(a->>'url','') !~ '^https://' OR length(a->>'url')>2048 THEN RAISE EXCEPTION 'Invalid event attachment' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF mode='branches' AND (jsonb_array_length(p#>'{audience,branchIds}')=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p#>'{audience,branchIds}') v WHERE NOT EXISTS(SELECT 1 FROM public.branches WHERE id=v::integer AND is_active)))
 OR mode='classes' AND (jsonb_array_length(p#>'{audience,classIds}')=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p#>'{audience,classIds}') v WHERE NOT EXISTS(SELECT 1 FROM public.class_sessions WHERE id=v::integer)))
 OR mode='students' AND (jsonb_array_length(p#>'{audience,studentIds}')=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p#>'{audience,studentIds}') v WHERE NOT EXISTS(SELECT 1 FROM public.students WHERE id=v AND deleted_at IS NULL))) THEN RAISE EXCEPTION 'Audience includes an unavailable record' USING ERRCODE='22023'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.portal_calendar_validate(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_calendar_validate(jsonb) TO service_role;

-- Audience follows current effective enrollments; historical rosters do not grant ongoing access.
CREATE OR REPLACE FUNCTION public.portal_calendar_student_matches(p_payload jsonb,p_student text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.students s WHERE s.id=p_student AND s.deleted_at IS NULL
 AND s.student_status IN ('Active','Paused','Inactive','Graduated') AND CASE p_payload#>>'{audience,mode}'
 WHEN 'all' THEN true
 WHEN 'students' THEN COALESCE(p_payload#>'{audience,studentIds}','[]') ? s.id
 WHEN 'branches' THEN EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_payload#>'{audience,branchIds}') b
   WHERE b::integer=s.home_branch_id OR EXISTS(SELECT 1 FROM public.class_enrollments en JOIN public.class_sessions c ON c.id=en.class_id WHERE en.student_id=s.id AND c.branch_id=b::integer AND COALESCE(en.enrollment_date,(en.enrolled_at AT TIME ZONE 'Asia/Phnom_Penh')::date)<=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date))
 WHEN 'classes' THEN EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_payload#>'{audience,classIds}') c WHERE
   EXISTS(SELECT 1 FROM public.class_enrollments en WHERE en.student_id=s.id AND en.class_id=c::integer
    AND COALESCE(en.enrollment_date,(en.enrolled_at AT TIME ZONE 'Asia/Phnom_Penh')::date)<=(now() AT TIME ZONE 'Asia/Phnom_Penh')::date))
 ELSE false END)
$$;
REVOKE ALL ON FUNCTION public.portal_calendar_student_matches(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_calendar_student_matches(jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.portal_calendar_queue(p_actor uuid,p_event uuid) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.academy_events; total integer;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:announcements_send');
 SELECT * INTO e FROM public.academy_events WHERE id=p_event FOR UPDATE;
 IF NOT FOUND OR e.archived_at IS NOT NULL OR e.published_revision IS NULL OR e.revision<>e.published_revision OR e.published_payload#>>'{audience,mode}'='staff' THEN RAISE EXCEPTION 'Publish the current student-facing revision first' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.academy_profile WHERE id='default' AND allow_student_portal_login) THEN RAISE EXCEPTION 'Student portal access is disabled' USING ERRCODE='42501'; END IF;
 INSERT INTO public.portal_notifications(user_id,source_key,category,title,body,href,permission_key,source_type,source_id,source_revision,subject_student_id,delivered_at)
 SELECT p.id,'event:'||e.id||':'||e.published_revision,'events',left(e.published_payload->>'title',240),
  CASE WHEN COALESCE(e.published_payload->>'changeReason','')<>'' THEN left(e.published_payload->>'changeReason',2000) ELSE 'An academy update is available. Open the event for details.' END,
  '/calendar?event='||e.id,NULL,'academy_event',e.id,e.published_revision,s.id,now()
 FROM public.profiles p JOIN public.students s ON (p.student_id=s.id OR s.profile_id=p.id)
 WHERE p.role='Student' AND p.is_active AND NOT p.must_change_password AND s.deleted_at IS NULL
 AND (p.student_id IS NULL OR p.student_id=s.id) AND (s.profile_id IS NULL OR s.profile_id=p.id)
 AND NOT EXISTS(SELECT 1 FROM public.profiles x WHERE x.id<>p.id AND x.student_id=s.id)
 AND NOT EXISTS(SELECT 1 FROM public.students x WHERE x.id<>s.id AND x.profile_id=p.id)
 AND public.portal_calendar_student_matches(e.published_payload,s.id)
 ON CONFLICT(user_id,source_key) DO NOTHING;
 GET DIAGNOSTICS total=ROW_COUNT;
 UPDATE public.academy_events SET last_notified_revision=published_revision WHERE id=e.id AND EXISTS(SELECT 1 FROM public.portal_notifications WHERE source_id=e.id AND source_revision=e.published_revision AND source_type='academy_event');
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.portal_calendar_queue(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_calendar_queue(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.portal_calendar_mutate(p_actor uuid,p_action text,p_id uuid,p_payload jsonb,p_request_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.academy_events; prev public.portal_operation_requests; result jsonb; content jsonb; public_content jsonb; actor_role text; needed text; count_sent integer:=0;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server-only calendar operation' USING ERRCODE='42501'; END IF;
 needed:=CASE p_action WHEN 'create' THEN 'action:events_create' WHEN 'save' THEN 'action:events_edit' WHEN 'publish' THEN 'action:events_publish' WHEN 'notice' THEN 'action:announcements_send' WHEN 'archive' THEN 'action:events_publish' ELSE NULL END;
 IF needed IS NULL OR p_request_key IS NULL THEN RAISE EXCEPTION 'Invalid calendar request' USING ERRCODE='22023'; END IF;
 PERFORM public.portal_assert_actor(p_actor,'page:calendar'); PERFORM public.portal_assert_actor(p_actor,needed);
 SELECT role INTO actor_role FROM public.profiles WHERE id=p_actor;
 IF actor_role='Student' THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE='42501'; END IF;
 IF p_action='archive' AND actor_role NOT IN ('Root','Super Root','Admin') THEN RAISE EXCEPTION 'Administrator access is required to archive an event.' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendar:'||p_request_key,0));
 SELECT * INTO prev FROM public.portal_operation_requests WHERE request_key=p_request_key;
 IF FOUND THEN
 IF prev.actor<>p_actor OR prev.action<>'calendar:'||p_action OR prev.payload IS DISTINCT FROM jsonb_build_object('id',p_id,'data',p_payload-'verifiedAttachments') THEN RAISE EXCEPTION 'Idempotency key mismatch' USING ERRCODE='22023'; END IF;
 RETURN prev.result; END IF;
 IF p_action<>'create' THEN
 SELECT * INTO e FROM public.academy_events WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Event not found' USING ERRCODE='P0002'; END IF;
 IF actor_role NOT IN ('Root','Super Root','Admin') AND e.created_by<>p_actor THEN RAISE EXCEPTION 'Only assigned event owner may change this event' USING ERRCODE='42501'; END IF;
 IF e.archived_at IS NOT NULL THEN RAISE EXCEPTION 'This event is archived and cannot be changed or announced.' USING ERRCODE='40001'; END IF;
 IF e.revision IS DISTINCT FROM (p_payload->>'expectedRevision')::integer THEN RAISE EXCEPTION 'Event changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
 END IF;
 IF p_action IN ('create','save') THEN
 content:=p_payload->'event'; PERFORM public.portal_calendar_validate(content);
 IF p_action='save' AND content->>'type'<>'competition' AND EXISTS(SELECT 1 FROM public.achievements WHERE event_id=e.id) THEN RAISE EXCEPTION 'This competition has linked achievements. Keep its competition type.' USING ERRCODE='22023'; END IF;
 IF p_action='save' AND e.published_revision IS NOT NULL AND
  (content->'startDate' IS DISTINCT FROM e.published_payload->'startDate' OR content->'endDate' IS DISTINCT FROM e.published_payload->'endDate' OR content->'startsAt' IS DISTINCT FROM e.published_payload->'startsAt' OR content->'endsAt' IS DISTINCT FROM e.published_payload->'endsAt' OR content->'audience' IS DISTINCT FROM e.published_payload->'audience' OR content->'lifecycle' IS DISTINCT FROM e.published_payload->'lifecycle')
 AND length(btrim(COALESCE(content->>'changeReason','')))<5 THEN RAISE EXCEPTION 'Explain the published date, status or audience change' USING ERRCODE='22023'; END IF;
 IF p_action='create' THEN
 INSERT INTO public.academy_events(draft,range_start,range_end,created_by,updated_by) VALUES(content,CASE WHEN content->>'startsAt' IS NULL THEN (content->>'startDate')::date ELSE ((content->>'startsAt')::timestamptz AT TIME ZONE 'Asia/Phnom_Penh')::date END,CASE WHEN content->>'endsAt' IS NULL THEN (content->>'endDate')::date+1 ELSE (((content->>'endsAt')::timestamptz-interval '1 microsecond') AT TIME ZONE 'Asia/Phnom_Penh')::date+1 END,p_actor,p_actor) RETURNING * INTO e;
 ELSE
 UPDATE public.academy_events SET draft=content,range_start=CASE WHEN content->>'startsAt' IS NULL THEN (content->>'startDate')::date ELSE ((content->>'startsAt')::timestamptz AT TIME ZONE 'Asia/Phnom_Penh')::date END,range_end=CASE WHEN content->>'endsAt' IS NULL THEN (content->>'endDate')::date+1 ELSE (((content->>'endsAt')::timestamptz-interval '1 microsecond') AT TIME ZONE 'Asia/Phnom_Penh')::date+1 END,revision=revision+1,updated_at=now(),updated_by=p_actor WHERE id=e.id RETURNING * INTO e;
 END IF;
 ELSIF p_action='publish' THEN
 IF e.published_revision=e.revision THEN RAISE EXCEPTION 'No unpublished changes' USING ERRCODE='40001'; END IF;
 IF e.draft->>'type'<>'competition' AND EXISTS(SELECT 1 FROM public.achievements WHERE event_id=e.id) THEN RAISE EXCEPTION 'This competition has linked achievements. Keep its competition type.' USING ERRCODE='22023'; END IF;
 PERFORM public.portal_calendar_validate(e.draft);
 IF p_payload ? 'verifiedAttachments' THEN e.draft:=jsonb_set(e.draft,'{attachments}',p_payload->'verifiedAttachments'); END IF;
 public_content:=e.draft-'internalNotes';
 IF e.published_payload IS NOT NULL AND (e.draft->'startDate' IS DISTINCT FROM e.published_payload->'startDate' OR e.draft->'endDate' IS DISTINCT FROM e.published_payload->'endDate' OR e.draft->'startsAt' IS DISTINCT FROM e.published_payload->'startsAt' OR e.draft->'endsAt' IS DISTINCT FROM e.published_payload->'endsAt') THEN
 e.previous_occurrence:=jsonb_build_object('startDate',e.published_payload->'startDate','endDate',e.published_payload->'endDate','startsAt',e.published_payload->'startsAt','endsAt',e.published_payload->'endsAt'); END IF;
 UPDATE public.academy_events SET draft=e.draft,revision=revision+1,published_revision=revision+1,published_payload=public_content,published_at=now(),published_range_start=range_start,published_range_end=range_end,previous_occurrence=e.previous_occurrence,updated_at=now(),updated_by=p_actor WHERE id=e.id RETURNING * INTO e;
 INSERT INTO public.academy_event_revisions(event_id,revision,public_payload,previous_occurrence,published_by) VALUES(e.id,e.revision,e.published_payload,e.previous_occurrence,p_actor);
 IF COALESCE((p_payload->>'notifyStudents')::boolean,false) THEN count_sent:=public.portal_calendar_queue(p_actor,e.id); END IF;
 ELSIF p_action='notice' THEN count_sent:=public.portal_calendar_queue(p_actor,e.id);
 ELSIF p_action='archive' THEN
 IF jsonb_typeof(p_payload->'reason') IS DISTINCT FROM 'string' OR length(btrim(COALESCE(p_payload->>'reason','')))<5 OR length(btrim(p_payload->>'reason'))>1000 THEN RAISE EXCEPTION 'Explain why this event is being archived (5–1000 characters).' USING ERRCODE='22023'; END IF;
 UPDATE public.academy_events SET archived_at=now(),archived_by=p_actor,archived_reason=btrim(p_payload->>'reason'),revision=revision+1,updated_at=now(),updated_by=p_actor WHERE id=e.id RETURNING * INTO e;
 END IF;
 SELECT * INTO e FROM public.academy_events WHERE id=e.id;
 result:=jsonb_build_object('event',to_jsonb(e),'queued',count_sent,'notificationCount',(SELECT count(*) FROM public.portal_notifications WHERE source_id=e.id AND source_revision=e.published_revision AND source_type='academy_event'));
 INSERT INTO public.portal_operation_requests(request_key,actor,action,payload,result) VALUES(p_request_key,p_actor,'calendar:'||p_action,jsonb_build_object('id',p_id,'data',p_payload-'verifiedAttachments'),result);
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('CALENDAR_'||upper(p_action),p_actor::text,e.id::text,jsonb_build_object('revision',e.revision,'requestKey',p_request_key,'queued',count_sent));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.portal_calendar_mutate(uuid,text,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_calendar_mutate(uuid,text,uuid,jsonb,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.portal_calendar_student_events(p_student text,p_from date,p_to date,p_after uuid DEFAULT NULL,p_id uuid DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS TABLE(id uuid,revision integer,payload jsonb,previous_occurrence jsonb,published_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT e.id,e.published_revision,e.published_payload,e.previous_occurrence,e.published_at
 FROM public.academy_events e WHERE e.archived_at IS NULL AND e.published_revision IS NOT NULL
 AND (p_id IS NULL OR e.id=p_id) AND (p_after IS NULL OR e.id>p_after)
 AND (p_id IS NOT NULL OR (p_to>p_from AND p_to-p_from<=93 AND e.published_range_start<p_to AND e.published_range_end>p_from))
 AND public.portal_calendar_student_matches(e.published_payload,p_student)
 ORDER BY e.id LIMIT LEAST(GREATEST(p_limit,1),51)
$$;
REVOKE ALL ON FUNCTION public.portal_calendar_student_events(text,date,date,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_calendar_student_events(text,date,date,uuid,uuid,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.portal_calendar_inbox(p_user uuid,p_student text,p_action text DEFAULT 'list',p_id uuid DEFAULT NULL,p_before timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE rows jsonb; unread integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server-only inbox' USING ERRCODE='42501'; END IF;
 IF p_action NOT IN ('list','read','dismiss','mark-all') THEN RAISE EXCEPTION 'Invalid inbox action' USING ERRCODE='22023'; END IF;
 IF p_action<>'list' THEN
 UPDATE public.portal_notifications n SET
  read_at=CASE WHEN p_action IN ('read','mark-all') THEN COALESCE(n.read_at,now()) ELSE n.read_at END,
  dismissed_at=CASE WHEN p_action='dismiss' THEN COALESCE(n.dismissed_at,now()) ELSE n.dismissed_at END
 FROM public.academy_events e WHERE n.source_id=e.id AND n.user_id=p_user AND n.subject_student_id=p_student
 AND n.category='events' AND n.source_type='academy_event' AND e.archived_at IS NULL AND n.source_revision<=e.published_revision
 AND n.resolved_at IS NULL AND (p_action='dismiss' OR n.dismissed_at IS NULL)
 AND (p_action='mark-all' OR n.id=p_id) AND public.portal_calendar_student_matches(e.published_payload,p_student);
 IF p_action<>'mark-all' AND NOT FOUND THEN RAISE EXCEPTION 'Notification not available' USING ERRCODE='P0002'; END IF;
 RETURN jsonb_build_object('saved',true);
 END IF;
 SELECT count(*) INTO unread FROM public.portal_notifications n JOIN public.academy_events e ON e.id=n.source_id
 WHERE n.user_id=p_user AND n.subject_student_id=p_student AND n.category='events' AND n.source_type='academy_event'
 AND e.archived_at IS NULL AND n.source_revision<=e.published_revision AND n.resolved_at IS NULL AND n.dismissed_at IS NULL AND n.read_at IS NULL
 AND public.portal_calendar_student_matches(e.published_payload,p_student);
 SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC,t.id DESC),'[]') INTO rows FROM (
 SELECT n.* FROM public.portal_notifications n JOIN public.academy_events e ON e.id=n.source_id
 WHERE n.user_id=p_user AND n.subject_student_id=p_student AND n.category='events' AND n.source_type='academy_event'
 AND e.archived_at IS NULL AND n.source_revision<=e.published_revision AND n.resolved_at IS NULL AND n.dismissed_at IS NULL
 AND (p_before IS NULL OR (n.created_at,n.id)<(p_before,p_before_id)) AND public.portal_calendar_student_matches(e.published_payload,p_student)
 ORDER BY n.created_at DESC,n.id DESC LIMIT 51) t;
 RETURN jsonb_build_object('rows',rows,'unreadCount',unread);
END $$;
REVOKE ALL ON FUNCTION public.portal_calendar_inbox(uuid,text,text,uuid,timestamptz,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_calendar_inbox(uuid,text,text,uuid,timestamptz,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.portal_achievement_event_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE title text; starts_on date;
BEGIN
 IF NEW.event_id IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.event_id IS NOT DISTINCT FROM OLD.event_id THEN NEW.event_name:=OLD.event_name; RETURN NEW; END IF;
 SELECT published_payload->>'title',(published_payload->>'startDate')::date INTO title,starts_on FROM public.academy_events WHERE id=NEW.event_id AND archived_at IS NULL AND published_revision IS NOT NULL AND published_payload->>'type'='competition' FOR KEY SHARE;
 IF title IS NULL THEN RAISE EXCEPTION 'Choose a published competition or enter its name manually' USING ERRCODE='22023'; END IF;
 IF NEW.date<starts_on THEN RAISE EXCEPTION 'Achievement date cannot precede the selected competition. Correct the date or enter the event manually.' USING ERRCODE='22023'; END IF;
 NEW.event_name:=title; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.portal_achievement_event_snapshot() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_achievement_event_snapshot() TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
