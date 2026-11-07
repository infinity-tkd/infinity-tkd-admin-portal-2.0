BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

-- Select deliverable work, rather than the newest inbox page. A completed or
-- deferred delivery must not keep older eligible notices out of the worker.
CREATE FUNCTION public.portal_push_eligible(p_notification uuid,p_subscription uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE eligible boolean;
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'Server-only push eligibility' USING ERRCODE='42501'; END IF;
 SELECT EXISTS(
  SELECT 1 FROM public.portal_notifications n
  JOIN public.portal_push_subscriptions sub ON sub.user_id=n.user_id
  JOIN public.profiles p ON p.id=n.user_id
  JOIN public.portal_notification_preferences pref ON pref.user_id=p.id
  WHERE n.id=p_notification AND sub.id=p_subscription
  AND p.is_active AND NOT p.must_change_password AND pref.push_enabled
  AND n.read_at IS NULL AND n.dismissed_at IS NULL AND n.resolved_at IS NULL
  AND n.created_at>=now()-interval '2 days'
  AND NOT n.category=ANY(pref.muted_categories)
  AND CASE WHEN p.role='Student' THEN
   sub.app_scope='student' AND n.category='events' AND n.source_type='academy_event'
   AND n.permission_key IS NULL
   AND EXISTS(SELECT 1 FROM public.academy_profile WHERE id='default' AND allow_student_portal_login)
   AND (pref.student_quiet_start IS NULL OR CASE WHEN pref.student_quiet_start<pref.student_quiet_end
     THEN to_char(now() AT TIME ZONE 'Asia/Phnom_Penh','HH24:MI')<pref.student_quiet_start OR to_char(now() AT TIME ZONE 'Asia/Phnom_Penh','HH24:MI')>=pref.student_quiet_end
     ELSE to_char(now() AT TIME ZONE 'Asia/Phnom_Penh','HH24:MI')<pref.student_quiet_start AND to_char(now() AT TIME ZONE 'Asia/Phnom_Penh','HH24:MI')>=pref.student_quiet_end END)
   AND EXISTS(SELECT 1 FROM public.students st JOIN public.academy_events e ON e.id=n.source_id
     WHERE st.id=n.subject_student_id AND e.archived_at IS NULL AND e.published_revision IS NOT NULL
     AND (p.student_id=st.id OR st.profile_id=p.id)
     AND (p.student_id IS NULL OR p.student_id=st.id) AND (st.profile_id IS NULL OR st.profile_id=p.id)
     AND NOT EXISTS(SELECT 1 FROM public.profiles other WHERE other.id<>p.id AND other.student_id=st.id)
     AND NOT EXISTS(SELECT 1 FROM public.students other WHERE other.id<>st.id AND other.profile_id=p.id)
     AND public.portal_calendar_student_matches(e.published_payload,st.id))
  ELSE p.role IN('Root','Super Root','Admin','Head Coach','Coach','Assistant Coach') AND sub.app_scope='admin'
   AND n.source_type IS DISTINCT FROM 'academy_event'
   AND (n.permission_key IS NULL OR p.role IN('Root','Super Root') OR COALESCE(
     (SELECT is_granted FROM public.user_permissions WHERE user_id=p.id AND permission_key=n.permission_key),
     (SELECT is_granted FROM public.role_permissions WHERE role=p.role AND permission_key=n.permission_key),false))
   AND (pref.quiet_start=pref.quiet_end OR CASE WHEN pref.quiet_start<pref.quiet_end
     THEN extract(hour FROM now() AT TIME ZONE 'Asia/Phnom_Penh')<pref.quiet_start OR extract(hour FROM now() AT TIME ZONE 'Asia/Phnom_Penh')>=pref.quiet_end
     ELSE extract(hour FROM now() AT TIME ZONE 'Asia/Phnom_Penh')<pref.quiet_start AND extract(hour FROM now() AT TIME ZONE 'Asia/Phnom_Penh')>=pref.quiet_end END)
  END
 ) INTO eligible;
 RETURN eligible;
END $$;

CREATE FUNCTION public.portal_push_candidates(p_user uuid,p_subscription uuid,p_limit integer DEFAULT 20)
RETURNS SETOF public.portal_notifications LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'Server-only push candidates' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT n.* FROM public.portal_notifications n
 LEFT JOIN public.portal_push_deliveries d ON d.notification_id=n.id AND d.subscription_id=p_subscription
 WHERE n.user_id=p_user AND n.created_at>=now()-interval '2 days'
 AND n.read_at IS NULL AND n.dismissed_at IS NULL AND n.resolved_at IS NULL
 AND public.portal_push_eligible(n.id,p_subscription)
 AND (d.notification_id IS NULL OR (d.sent_at IS NULL AND d.dead_at IS NULL AND d.attempts<5
   AND d.next_attempt_at<=now() AND (d.lease_until IS NULL OR d.lease_until<now())))
 ORDER BY n.created_at,n.id LIMIT LEAST(GREATEST(p_limit,1),20);
END $$;

CREATE OR REPLACE FUNCTION public.portal_claim_push(p_notification uuid,p_subscription uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE claimed uuid;
BEGIN
 IF current_user <> 'service_role' THEN RAISE EXCEPTION 'Server-only push claim' USING ERRCODE='42501'; END IF;
 -- Recheck account, current audience, consent and quiet hours at dispatch.
 IF NOT public.portal_push_eligible(p_notification,p_subscription) THEN RETURN false; END IF;
 INSERT INTO public.portal_push_deliveries(notification_id,subscription_id)
 VALUES(p_notification,p_subscription) ON CONFLICT DO NOTHING;
 UPDATE public.portal_push_deliveries SET lease_until=now()+interval '2 minutes',attempts=attempts+1
 WHERE notification_id=p_notification AND subscription_id=p_subscription AND sent_at IS NULL AND dead_at IS NULL
 AND attempts<5 AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now())
 AND public.portal_push_eligible(p_notification,p_subscription)
 RETURNING notification_id INTO claimed;
 RETURN claimed IS NOT NULL;
END $$;

REVOKE ALL ON FUNCTION public.portal_push_eligible(uuid,uuid),public.portal_push_candidates(uuid,uuid,integer),public.portal_claim_push(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_push_eligible(uuid,uuid),public.portal_push_candidates(uuid,uuid,integer),public.portal_claim_push(uuid,uuid) TO service_role;

CREATE INDEX portal_student_progress_curriculum ON public.student_portal_progress(curriculum_id);
CREATE INDEX portal_coach_confirmation_policy ON public.student_portal_coach_confirmations(policy_id);
CREATE INDEX portal_coach_confirmation_actor ON public.student_portal_coach_confirmations(confirmed_by);
CREATE INDEX portal_ranking_approval_actor ON public.student_portal_ranking_publications(approved_by);
CREATE INDEX portal_readiness_approval_actor ON public.student_portal_readiness_policies(approved_by);
-- The pre-existing template_id index already covers the same FK and query.
DROP INDEX public.portal_training_plan_template;
COMMIT;
