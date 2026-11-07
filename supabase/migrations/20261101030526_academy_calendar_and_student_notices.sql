BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE TABLE public.academy_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 draft jsonb NOT NULL CHECK(jsonb_typeof(draft)='object'),
 range_start date NOT NULL, range_end date NOT NULL CHECK(range_end>range_start),
 published_revision integer, published_payload jsonb, published_at timestamptz,
 published_range_start date, published_range_end date,
 previous_occurrence jsonb,
 last_notified_revision integer,
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 updated_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((published_revision IS NULL AND published_payload IS NULL AND published_at IS NULL) OR
   (published_revision>0 AND published_revision<=revision AND jsonb_typeof(published_payload)='object' AND published_at IS NOT NULL)),
 CHECK(published_range_end IS NULL OR published_range_end>published_range_start)
);
CREATE INDEX academy_events_period_idx ON public.academy_events(range_start,range_end,id);
CREATE INDEX academy_events_public_period_idx ON public.academy_events(published_range_start,published_range_end,id) WHERE published_revision IS NOT NULL;
CREATE INDEX academy_events_created_by_idx ON public.academy_events(created_by);
CREATE INDEX academy_events_updated_by_idx ON public.academy_events(updated_by);
CREATE TABLE public.academy_event_revisions (
 event_id uuid NOT NULL REFERENCES public.academy_events(id) ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision>0), public_payload jsonb NOT NULL,
 previous_occurrence jsonb, published_by uuid NOT NULL REFERENCES public.profiles(id),
 published_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(event_id,revision)
);
CREATE INDEX academy_event_revisions_actor_idx ON public.academy_event_revisions(published_by);
ALTER TABLE public.academy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_event_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.academy_events,public.academy_event_revisions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.academy_events,public.academy_event_revisions TO service_role;

ALTER TABLE public.achievements ADD COLUMN event_id uuid REFERENCES public.academy_events(id) ON DELETE RESTRICT;
CREATE INDEX achievements_event_id_idx ON public.achievements(event_id) WHERE event_id IS NOT NULL;
ALTER TABLE public.portal_notifications ADD COLUMN source_type text,
 ADD COLUMN source_id uuid REFERENCES public.academy_events(id) ON DELETE RESTRICT,
 ADD COLUMN source_revision integer,
 ADD COLUMN subject_student_id varchar REFERENCES public.students(id) ON DELETE RESTRICT,
 ADD COLUMN delivered_at timestamptz;
CREATE INDEX portal_notifications_event_idx ON public.portal_notifications(source_id,source_revision) WHERE source_type='academy_event';
CREATE INDEX portal_notifications_student_idx ON public.portal_notifications(subject_student_id);
ALTER TABLE public.portal_notifications DROP CONSTRAINT IF EXISTS portal_notifications_category_check;
ALTER TABLE public.portal_notifications ADD CONSTRAINT portal_notifications_category_check CHECK(category IN ('attendance','billing','orders','system','events'));
ALTER TABLE public.portal_notification_preferences DROP CONSTRAINT IF EXISTS portal_notification_preferences_muted_categories_check;
ALTER TABLE public.portal_notification_preferences ADD CONSTRAINT portal_notification_preferences_muted_categories_check CHECK(muted_categories <@ ARRAY['attendance','billing','orders','system','events']::text[]);
ALTER TABLE public.portal_notification_preferences ADD COLUMN student_quiet_start text DEFAULT '22:00', ADD COLUMN student_quiet_end text DEFAULT '07:00';
ALTER TABLE public.portal_push_subscriptions ADD COLUMN app_scope text NOT NULL DEFAULT 'admin' CHECK(app_scope IN ('admin','student'));
ALTER TABLE public.portal_notification_preferences ADD CONSTRAINT student_quiet_window_check CHECK(
 (student_quiet_start IS NULL AND student_quiet_end IS NULL) OR
 (student_quiet_start IS NOT NULL AND student_quiet_end IS NOT NULL AND student_quiet_start<>student_quiet_end AND student_quiet_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND student_quiet_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'));
-- The inbox is server mediated. Recipient ownership alone must not expose staff notices.
REVOKE ALL ON public.portal_notifications FROM anon,authenticated;

INSERT INTO public.role_permissions(role,permission_key,is_granted)
 SELECT r,k,true FROM unnest(ARRAY['Root','Super Root','Admin','Head Coach','Coach','Assistant Coach']) r CROSS JOIN unnest(ARRAY['page:calendar']) k
 ON CONFLICT(role,permission_key) DO NOTHING;
INSERT INTO public.role_permissions(role,permission_key,is_granted)
 SELECT r,k,true FROM unnest(ARRAY['Root','Super Root','Admin','Head Coach']) r CROSS JOIN unnest(ARRAY['action:events_create','action:events_edit']) k
 ON CONFLICT(role,permission_key) DO NOTHING;
INSERT INTO public.role_permissions(role,permission_key,is_granted)
 SELECT r,k,true FROM unnest(ARRAY['Root','Super Root','Admin']) r CROSS JOIN unnest(ARRAY['action:events_publish','action:announcements_send']) k
 ON CONFLICT(role,permission_key) DO NOTHING;

CREATE FUNCTION public.portal_calendar_student_matches(p_payload jsonb,p_student text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.students s WHERE s.id=p_student AND s.deleted_at IS NULL
 AND s.student_status IN ('Active','Paused','Inactive','Graduated') AND CASE p_payload#>>'{audience,mode}'
 WHEN 'all' THEN true
 WHEN 'students' THEN COALESCE(p_payload#>'{audience,studentIds}','[]') ? s.id
 WHEN 'branches' THEN EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_payload#>'{audience,branchIds}') b
   WHERE b::integer=s.home_branch_id OR EXISTS(SELECT 1 FROM public.class_enrollments en JOIN public.class_sessions c ON c.id=en.class_id WHERE en.student_id=s.id AND c.branch_id=b::integer))
 WHEN 'classes' THEN EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_payload#>'{audience,classIds}') c WHERE
   EXISTS(SELECT 1 FROM public.class_enrollments en WHERE en.student_id=s.id AND en.class_id=c::integer) OR
   EXISTS(SELECT 1 FROM public.class_occurrence_roster ro JOIN public.class_occurrences co ON co.id=ro.occurrence_id
    WHERE ro.student_id=s.id AND co.class_id=c::integer AND co.starts_at<COALESCE((p_payload->>'endsAt')::timestamptz,((p_payload->>'endDate')::date+1)::timestamp AT TIME ZONE 'Asia/Phnom_Penh')
      AND co.ends_at>COALESCE((p_payload->>'startsAt')::timestamptz,(p_payload->>'startDate')::timestamp AT TIME ZONE 'Asia/Phnom_Penh')))
 ELSE false END)
$$;
REVOKE ALL ON FUNCTION public.portal_calendar_student_matches(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_calendar_student_matches(jsonb,text) TO service_role;

CREATE FUNCTION public.portal_calendar_validate(p jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a jsonb; mode text:=p#>>'{audience,mode}';
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR length(btrim(COALESCE(p->>'title','')))=0 OR length(p->>'title')>200
 OR COALESCE(p->>'type','') NOT IN ('holiday','competition','workshop','maintenance','academy')
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

CREATE FUNCTION public.portal_calendar_queue(p_actor uuid,p_event uuid) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.academy_events; total integer;
BEGIN
 PERFORM public.portal_assert_actor(p_actor,'action:announcements_send');
 SELECT * INTO e FROM public.academy_events WHERE id=p_event FOR UPDATE;
 IF NOT FOUND OR e.published_revision IS NULL OR e.revision<>e.published_revision OR e.published_payload#>>'{audience,mode}'='staff' THEN RAISE EXCEPTION 'Publish the current student-facing revision first' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.academy_profile WHERE allow_student_portal_login) THEN RAISE EXCEPTION 'Student portal access is disabled' USING ERRCODE='42501'; END IF;
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

CREATE FUNCTION public.portal_calendar_mutate(p_actor uuid,p_action text,p_id uuid,p_payload jsonb,p_request_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.academy_events; prev public.portal_operation_requests; result jsonb; content jsonb; public_content jsonb; actor_role text; needed text; count_sent integer:=0;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server-only calendar operation' USING ERRCODE='42501'; END IF;
 needed:=CASE p_action WHEN 'create' THEN 'action:events_create' WHEN 'save' THEN 'action:events_edit' WHEN 'publish' THEN 'action:events_publish' WHEN 'notice' THEN 'action:announcements_send' ELSE NULL END;
 IF needed IS NULL OR p_request_key IS NULL THEN RAISE EXCEPTION 'Invalid calendar request' USING ERRCODE='22023'; END IF;
 PERFORM public.portal_assert_actor(p_actor,'page:calendar'); PERFORM public.portal_assert_actor(p_actor,needed);
 SELECT role INTO actor_role FROM public.profiles WHERE id=p_actor;
 IF actor_role='Student' THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendar:'||p_request_key,0));
 SELECT * INTO prev FROM public.portal_operation_requests WHERE request_key=p_request_key;
 IF FOUND THEN
 IF prev.actor<>p_actor OR prev.action<>'calendar:'||p_action OR prev.payload IS DISTINCT FROM jsonb_build_object('id',p_id,'data',p_payload-'verifiedAttachments') THEN RAISE EXCEPTION 'Idempotency key mismatch' USING ERRCODE='22023'; END IF;
 RETURN prev.result; END IF;
 IF p_action<>'create' THEN
 SELECT * INTO e FROM public.academy_events WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Event not found' USING ERRCODE='P0002'; END IF;
 IF actor_role NOT IN ('Root','Super Root','Admin') AND e.created_by<>p_actor THEN RAISE EXCEPTION 'Only assigned event owner may change this event' USING ERRCODE='42501'; END IF;
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
 END IF;
 SELECT * INTO e FROM public.academy_events WHERE id=e.id;
 result:=jsonb_build_object('event',to_jsonb(e),'queued',count_sent,'notificationCount',(SELECT count(*) FROM public.portal_notifications WHERE source_id=e.id AND source_revision=e.published_revision AND source_type='academy_event'));
 INSERT INTO public.portal_operation_requests(request_key,actor,action,payload,result) VALUES(p_request_key,p_actor,'calendar:'||p_action,jsonb_build_object('id',p_id,'data',p_payload-'verifiedAttachments'),result);
 INSERT INTO public.audit_logs(action,performed_by,target_id,details) VALUES('CALENDAR_'||upper(p_action),p_actor::text,e.id::text,jsonb_build_object('revision',e.revision,'requestKey',p_request_key,'queued',count_sent));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.portal_calendar_mutate(uuid,text,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_calendar_mutate(uuid,text,uuid,jsonb,uuid) TO service_role;
CREATE FUNCTION public.portal_calendar_student_events(p_student text,p_from date,p_to date,p_after uuid DEFAULT NULL,p_id uuid DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS TABLE(id uuid,revision integer,payload jsonb,previous_occurrence jsonb,published_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT e.id,e.published_revision,e.published_payload,e.previous_occurrence,e.published_at
 FROM public.academy_events e WHERE e.published_revision IS NOT NULL
 AND (p_id IS NULL OR e.id=p_id) AND (p_after IS NULL OR e.id>p_after)
 AND (p_id IS NOT NULL OR (p_to>p_from AND p_to-p_from<=93 AND e.published_range_start<p_to AND e.published_range_end>p_from))
 AND public.portal_calendar_student_matches(e.published_payload,p_student)
 ORDER BY e.id LIMIT LEAST(GREATEST(p_limit,1),51)
$$;
REVOKE ALL ON FUNCTION public.portal_calendar_student_events(text,date,date,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_calendar_student_events(text,date,date,uuid,uuid,integer) TO service_role;

CREATE FUNCTION public.portal_calendar_inbox(p_user uuid,p_student text,p_action text DEFAULT 'list',p_id uuid DEFAULT NULL,p_before timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL)
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
 AND n.category='events' AND n.source_type='academy_event' AND n.source_revision<=e.published_revision
 AND n.resolved_at IS NULL AND n.dismissed_at IS NULL
 AND (p_action='mark-all' OR n.id=p_id) AND public.portal_calendar_student_matches(e.published_payload,p_student);
 IF p_action<>'mark-all' AND NOT FOUND THEN RAISE EXCEPTION 'Notification not available' USING ERRCODE='P0002'; END IF;
 RETURN jsonb_build_object('saved',true);
 END IF;
 SELECT count(*) INTO unread FROM public.portal_notifications n JOIN public.academy_events e ON e.id=n.source_id
 WHERE n.user_id=p_user AND n.subject_student_id=p_student AND n.category='events' AND n.source_type='academy_event'
 AND n.source_revision<=e.published_revision AND n.resolved_at IS NULL AND n.dismissed_at IS NULL AND n.read_at IS NULL
 AND public.portal_calendar_student_matches(e.published_payload,p_student);
 SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC,t.id DESC),'[]') INTO rows FROM (
 SELECT n.* FROM public.portal_notifications n JOIN public.academy_events e ON e.id=n.source_id
 WHERE n.user_id=p_user AND n.subject_student_id=p_student AND n.category='events' AND n.source_type='academy_event'
 AND n.source_revision<=e.published_revision AND n.resolved_at IS NULL AND n.dismissed_at IS NULL
 AND (p_before IS NULL OR (n.created_at,n.id)<(p_before,p_before_id)) AND public.portal_calendar_student_matches(e.published_payload,p_student)
 ORDER BY n.created_at DESC,n.id DESC LIMIT 51) t;
 RETURN jsonb_build_object('rows',rows,'unreadCount',unread);
END $$;
REVOKE ALL ON FUNCTION public.portal_calendar_inbox(uuid,text,text,uuid,timestamptz,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_calendar_inbox(uuid,text,text,uuid,timestamptz,uuid) TO service_role;
CREATE FUNCTION public.portal_calendar_preferences(p_user uuid,p_payload jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server-only preferences' USING ERRCODE='42501'; END IF;
 INSERT INTO public.portal_notification_preferences(user_id,push_enabled,muted_categories,student_quiet_start,student_quiet_end)
 VALUES(p_user,(p_payload->>'pushEnabled')::boolean,CASE WHEN p_payload->'mutedCategories' ? 'events' THEN ARRAY['events']::text[] ELSE '{}'::text[] END,p_payload->>'quietStart',p_payload->>'quietEnd')
 ON CONFLICT(user_id) DO UPDATE SET push_enabled=EXCLUDED.push_enabled,
 muted_categories=ARRAY(SELECT unnest(portal_notification_preferences.muted_categories) EXCEPT SELECT 'events')||EXCLUDED.muted_categories,
 student_quiet_start=EXCLUDED.student_quiet_start,student_quiet_end=EXCLUDED.student_quiet_end,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.portal_calendar_preferences(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_calendar_preferences(uuid,jsonb) TO service_role;
CREATE FUNCTION public.portal_calendar_push_subscription(p_user uuid,p_subscription jsonb,p_remove boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE old_user uuid; existing boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server-only device subscription' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('student-push:'||p_user,0));
 SELECT user_id INTO old_user FROM public.portal_push_subscriptions WHERE endpoint=p_subscription->>'endpoint' FOR UPDATE;
 existing:=FOUND;
 IF existing AND old_user<>p_user THEN RAISE EXCEPTION 'This device subscription belongs to a different account' USING ERRCODE='42501'; END IF;
 IF p_remove THEN DELETE FROM public.portal_push_subscriptions WHERE user_id=p_user AND endpoint=p_subscription->>'endpoint' AND app_scope='student';RETURN;END IF;
 IF NOT existing AND (SELECT count(*) FROM public.portal_push_subscriptions WHERE user_id=p_user AND app_scope='student')>=10 THEN RAISE EXCEPTION 'Device limit reached. Remove an old subscription first.' USING ERRCODE='40001'; END IF;
 INSERT INTO public.portal_push_subscriptions(user_id,endpoint,keys,app_scope) VALUES(p_user,p_subscription->>'endpoint',p_subscription->'keys','student')
 ON CONFLICT(endpoint) DO UPDATE SET keys=EXCLUDED.keys,app_scope='student',updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.portal_calendar_push_subscription(uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_calendar_push_subscription(uuid,jsonb,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
