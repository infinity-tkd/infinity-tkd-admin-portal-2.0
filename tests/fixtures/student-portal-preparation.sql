CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.role',true) $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text NOT NULL,is_active boolean NOT NULL DEFAULT true,must_change_password boolean NOT NULL DEFAULT false);
CREATE TABLE public.role_permissions(role text,permission_key text,is_granted boolean,PRIMARY KEY(role,permission_key));
CREATE TABLE public.user_permissions(user_id uuid,permission_key text,is_granted boolean,PRIMARY KEY(user_id,permission_key));
CREATE TABLE public.students(id text PRIMARY KEY,current_belt text NOT NULL,initial_belt text,registration_date date NOT NULL,deleted_at timestamptz);
CREATE TABLE public.belt_histories(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,student_id text,belt_level text,promotion_date date);
CREATE TABLE public.curriculum(id integer PRIMARY KEY,is_active boolean NOT NULL);
CREATE TABLE public.audit_logs(id uuid PRIMARY KEY,action text NOT NULL,performed_by text NOT NULL,target_id text,details jsonb NOT NULL);
CREATE TABLE public.student_portal_readiness_policies(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),target_belt text NOT NULL,version text NOT NULL,requirements jsonb NOT NULL,
 approval_reference text NOT NULL,approved_by uuid NOT NULL REFERENCES public.profiles(id),approved_at timestamptz NOT NULL,
 publish_from timestamptz NOT NULL,publish_until timestamptz NOT NULL,revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(publish_until>publish_from),CHECK(approved_at<=publish_from),UNIQUE(target_belt,version)
);
CREATE TABLE public.student_portal_ranking_publications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,season_start date NOT NULL,season_end date NOT NULL,
 methodology text NOT NULL DEFAULT 'medal_order',entries jsonb NOT NULL,approval_reference text NOT NULL,
 approved_by uuid NOT NULL REFERENCES public.profiles(id),approved_at timestamptz NOT NULL,publish_from timestamptz NOT NULL,
 publish_until timestamptz NOT NULL,revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.student_portal_coach_confirmations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id text NOT NULL REFERENCES public.students(id),
 policy_id uuid NOT NULL REFERENCES public.student_portal_readiness_policies(id),requirement_key text NOT NULL,
 result text NOT NULL CHECK(result IN('passed','needs_work')),confirmed_by uuid NOT NULL REFERENCES public.profiles(id),
 confirmed_at timestamptz NOT NULL,confirmation_reference text NOT NULL,revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.student_portal_readiness_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_portal_ranking_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_portal_coach_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_portal_readiness_policies,public.student_portal_ranking_publications,public.student_portal_coach_confirmations FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public,auth TO service_role;
GRANT SELECT ON public.profiles,public.students,public.belt_histories,public.curriculum,public.student_portal_readiness_policies,public.student_portal_ranking_publications TO service_role;
GRANT UPDATE ON public.students,public.student_portal_readiness_policies TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.student_portal_coach_confirmations TO service_role;
GRANT SELECT,INSERT ON public.audit_logs TO service_role;
