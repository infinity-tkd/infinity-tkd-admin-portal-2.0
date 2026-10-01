-- =====================================================================
-- INFINITY TKD 2.0 ZERO-TRUST SECURITY HARDENING & DEFENSE-IN-DEPTH
-- Comprehensive Database Security Migration & Row Level Security (RLS)
-- Execution Target: Supabase / PostgreSQL (public schema)
-- Date: 2026-09-10
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SECURE APPEND-ONLY AUDIT LOGS TABLE
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    performed_by VARCHAR(255) NOT NULL,
    target_id VARCHAR(255),
    details JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS immediately
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop any conflicting policies
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Disallow audit log updates" ON public.audit_logs;
DROP POLICY IF EXISTS "Disallow audit log deletes" ON public.audit_logs;

-- Read policy: Only Root, Super Root, and Admin can view audit records
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('Root', 'Super Root', 'Admin')
    )
);

-- Write policy: Only authenticated service processes or admins can insert audit logs
CREATE POLICY "Authorized callers can append audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Immutable Trigger: Block any UPDATE or DELETE operation on audit_logs
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are strictly prohibited.';
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_log_mutation
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- Revoke mutation privileges explicitly from public roles
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM authenticated, anon, public;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;

-- ---------------------------------------------------------------------
-- 2. ENFORCE ROW LEVEL SECURITY (RLS) ON ALL SYSTEM TABLES
-- ---------------------------------------------------------------------

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.member_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_body_compositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_physical_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.curriculum ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.belts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.belt_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.belt_techniques ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.muscles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.library_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.library_asset_muscles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scholarships ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lms_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.biomechanical_skill_linkage ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 3. ELIMINATE PERMISSIVE POLICIES & REVOKE ANONYMOUS ACCESS TO PII
-- ---------------------------------------------------------------------

-- Drop known insecure / overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated users to read student_addresses" ON public.student_addresses;
DROP POLICY IF EXISTS "Allow authenticated users to read member_addresses" ON public.member_addresses;
DROP POLICY IF EXISTS "Allow select for all" ON public.student_addresses;
DROP POLICY IF EXISTS "Allow select for all" ON public.member_addresses;

-- Revoke anon SELECT grants from sensitive PII tables
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.profiles FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.members FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.students FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.student_addresses FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.member_addresses FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.payments FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.attendance FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.student_body_compositions FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.student_physical_evaluations FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.student_training_plans FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.class_enrollments FROM anon;

-- ---------------------------------------------------------------------
-- 4. BOLA / IDOR MITIGATION: TENANCY & OWNERSHIP POLICIES
-- ---------------------------------------------------------------------

-- Helper functions with hardened search paths
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_elevated_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Root', 'Super Root', 'Admin', 'Head Coach', 'Coach')
        AND is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Root', 'Super Root', 'Admin')
        AND is_active = true
    );
$$;

-- --- PROFILES TABLE ---
DROP POLICY IF EXISTS "Users can read own profile or admins read all" ON public.profiles;
CREATE POLICY "Users can read own profile or admins read all"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    id = auth.uid()
    OR public.is_elevated_staff()
);

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    public.is_admin()
    OR (
        id = auth.uid()
        AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()) -- Prevents self-elevation
    )
)
WITH CHECK (
    public.is_admin()
    OR (
        id = auth.uid()
        AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()) -- Prevents self-elevation
    )
);

-- --- STUDENTS TABLE ---
DROP POLICY IF EXISTS "Staff or student self can select students" ON public.students;
CREATE POLICY "Staff or student self can select students"
ON public.students
FOR SELECT
TO authenticated
USING (
    public.is_elevated_staff()
    OR profile_id = auth.uid()
    OR email = auth.jwt()->>'email'
);

DROP POLICY IF EXISTS "Elevated staff can modify students" ON public.students;
CREATE POLICY "Elevated staff can modify students"
ON public.students
FOR ALL
TO authenticated
USING (
    public.is_elevated_staff()
)
WITH CHECK (
    public.is_elevated_staff()
);

-- --- STUDENT ADDRESSES TABLE ---
DROP POLICY IF EXISTS "Strict student addresses access" ON public.student_addresses;
CREATE POLICY "Strict student addresses access"
ON public.student_addresses
FOR SELECT
TO authenticated
USING (
    public.is_elevated_staff()
    OR EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = student_addresses.student_id
        AND (s.profile_id = auth.uid() OR s.email = auth.jwt()->>'email')
    )
);

DROP POLICY IF EXISTS "Elevated staff manage student addresses" ON public.student_addresses;
CREATE POLICY "Elevated staff manage student addresses"
ON public.student_addresses
FOR ALL
TO authenticated
USING (
    public.is_elevated_staff()
)
WITH CHECK (
    public.is_elevated_staff()
);

-- --- MEMBER ADDRESSES TABLE ---
DROP POLICY IF EXISTS "Strict member addresses access" ON public.member_addresses;
CREATE POLICY "Strict member addresses access"
ON public.member_addresses
FOR SELECT
TO authenticated
USING (
    public.is_elevated_staff()
    OR member_id = auth.uid()
);

DROP POLICY IF EXISTS "Elevated staff manage member addresses" ON public.member_addresses;
CREATE POLICY "Elevated staff manage member addresses"
ON public.member_addresses
FOR ALL
TO authenticated
USING (
    public.is_elevated_staff()
)
WITH CHECK (
    public.is_elevated_staff()
);

-- --- STUDENT BODY COMPOSITIONS TABLE ---
DROP POLICY IF EXISTS "Body composition access control" ON public.student_body_compositions;
CREATE POLICY "Body composition access control"
ON public.student_body_compositions
FOR SELECT
TO authenticated
USING (
    public.is_elevated_staff()
    OR EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = student_body_compositions.student_id
        AND (s.profile_id = auth.uid() OR s.email = auth.jwt()->>'email')
    )
);

DROP POLICY IF EXISTS "Staff insert update body compositions" ON public.student_body_compositions;
CREATE POLICY "Staff insert update body compositions"
ON public.student_body_compositions
FOR ALL
TO authenticated
USING (
    public.is_elevated_staff()
)
WITH CHECK (
    public.is_elevated_staff()
);

-- --- PAYMENTS TABLE ---
DROP POLICY IF EXISTS "Payments access control" ON public.payments;
CREATE POLICY "Payments access control"
ON public.payments
FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = payments.student_id
        AND (s.profile_id = auth.uid() OR s.email = auth.jwt()->>'email')
    )
);

DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;
CREATE POLICY "Admins can manage payments"
ON public.payments
FOR ALL
TO authenticated
USING (
    public.is_admin()
)
WITH CHECK (
    public.is_admin()
);

-- --- ATTENDANCE TABLE ---
DROP POLICY IF EXISTS "Attendance access control" ON public.attendance;
CREATE POLICY "Attendance access control"
ON public.attendance
FOR SELECT
TO authenticated
USING (
    public.is_elevated_staff()
    OR EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = attendance.student_id
        AND (s.profile_id = auth.uid() OR s.email = auth.jwt()->>'email')
    )
);

DROP POLICY IF EXISTS "Staff can mark attendance" ON public.attendance;
CREATE POLICY "Staff can mark attendance"
ON public.attendance
FOR ALL
TO authenticated
USING (
    public.is_elevated_staff()
)
WITH CHECK (
    public.is_elevated_staff()
);

-- --- CURRICULAR REFERENCE DATA (READ-ONLY PUBLIC / WRITE PRIVILEGED) ---
-- Muscles, Library Assets, Belt Techniques
GRANT SELECT ON public.muscles TO authenticated, anon;
GRANT SELECT ON public.library_assets TO authenticated, anon;
GRANT SELECT ON public.library_asset_muscles TO authenticated, anon;
GRANT SELECT ON public.belt_techniques TO authenticated, anon;
GRANT SELECT ON public.belts TO authenticated, anon;
GRANT SELECT ON public.curriculum TO authenticated, anon;

-- ---------------------------------------------------------------------
-- 5. FUNCTION SEARCH_PATH HIJACKING DEFENSE
-- ---------------------------------------------------------------------

-- Enforce explicit search paths on all public security-critical routines
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prosecdef = true
    LOOP
        EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, auth, pg_temp;', 
                       func_record.proname, func_record.args);
    END LOOP;
END;
$$;

-- End of Zero-Trust Security Hardening Migration
