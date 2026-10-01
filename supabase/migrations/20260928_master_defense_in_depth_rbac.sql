-- =====================================================================
-- INFINITY TKD 2.0 - MASTER DEFENSE-IN-DEPTH RBAC & RLS ARCHITECTURE
-- Execution Target: Supabase / PostgreSQL (public schema)
-- Date: 2026-09-28
--
-- Security Authority:
--   1. Database Level: Enforces absolute Row Level Security (RLS) and
--      automatic sync of roles to auth.users.raw_app_meta_data (custom claims).
--   2. Backend Level: Route handlers & Middleware verify caller and session claims.
--   3. Frontend Level: UI decluttering only (zero security reliance).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. SCHEMA HARMONIZATION & CONSTRAINT SYNCHRONIZATION
-- ---------------------------------------------------------------------

-- A. Synchronize profiles.role CHECK constraint to include 'Super Root'
DO $$
BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
        CHECK (role::text = ANY (ARRAY['Root'::character varying, 'Super Root'::character varying, 'Admin'::character varying, 'Head Coach'::character varying, 'Coach'::character varying, 'Assistant Coach'::character varying, 'Student'::character varying]::text[]));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- B. Synchronize students.student_status CHECK constraint to include 'Paused'
DO $$
BEGIN
    ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_student_status_check;
    ALTER TABLE public.students ADD CONSTRAINT students_student_status_check 
        CHECK (student_status::text = ANY (ARRAY['Active'::character varying, 'Paused'::character varying, 'Inactive'::character varying, 'Suspended'::character varying, 'Graduated'::character varying]::text[]));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- C. Ensure unique constraint on lms_progress for upsert conflict resolution
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'lms_progress_student_curriculum_unique'
    ) THEN
        ALTER TABLE public.lms_progress 
            ADD CONSTRAINT lms_progress_student_curriculum_unique UNIQUE (student_id, curriculum_id);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ---------------------------------------------------------------------
-- 1. AUTOMATIC PROFILE ROLE -> AUTH APP_METADATA TRIGGER
-- ---------------------------------------------------------------------
-- Keeps auth.users.raw_app_meta_data in sync with public.profiles.role,
-- allowing RLS to evaluate roles directly from auth.jwt() with 0 table joins!

CREATE OR REPLACE FUNCTION public.sync_profile_role_to_auth_app_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    UPDATE auth.users
    SET raw_app_meta_data = 
        COALESCE(raw_app_meta_data, '{}'::jsonb) || 
        jsonb_build_object(
            'role', NEW.role,
            'is_active', NEW.is_active,
            'student_id', NEW.student_id
        )
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_role_to_auth_app_metadata ON public.profiles;
CREATE TRIGGER trg_sync_profile_role_to_auth_app_metadata
AFTER INSERT OR UPDATE OF role, is_active, student_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_role_to_auth_app_metadata();

-- Backfill existing profiles into auth.users.raw_app_meta_data
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, role, is_active, student_id FROM public.profiles LOOP
        UPDATE auth.users
        SET raw_app_meta_data = 
            COALESCE(raw_app_meta_data, '{}'::jsonb) || 
            jsonb_build_object(
                'role', r.role,
                'is_active', r.is_active,
                'student_id', r.student_id
            )
        WHERE id = r.id;
    END LOOP;
END;
$$;

-- ---------------------------------------------------------------------
-- 2. HIGH-PERFORMANCE ZERO-RECURSION SECURITY HELPER FUNCTIONS
-- ---------------------------------------------------------------------

-- Returns caller's role (checking JWT app_metadata first, fallback to profiles)
CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT COALESCE(
        auth.jwt() -> 'app_metadata' ->> 'role',
        (SELECT role FROM public.profiles WHERE id = auth.uid())
    );
$$;

-- Returns caller's active status
CREATE OR REPLACE FUNCTION public.auth_is_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'is_active')::boolean,
        (SELECT is_active FROM public.profiles WHERE id = auth.uid()),
        true
    );
$$;

-- Root & Super Root & Admin
CREATE OR REPLACE FUNCTION public.is_admin_or_root()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT public.auth_is_active() 
       AND public.auth_role() IN ('Root', 'Super Root', 'Admin');
$$;

-- Elevated Staff: Root, Super Root, Admin, Head Coach
CREATE OR REPLACE FUNCTION public.is_elevated_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT public.auth_is_active() 
       AND public.auth_role() IN ('Root', 'Super Root', 'Admin', 'Head Coach');
$$;

-- Coaches and Leadership: Root, Super Root, Admin, Head Coach, Coach
CREATE OR REPLACE FUNCTION public.is_coach_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT public.auth_is_active() 
       AND public.auth_role() IN ('Root', 'Super Root', 'Admin', 'Head Coach', 'Coach');
$$;

-- All Staff: Root, Super Root, Admin, Head Coach, Coach, Assistant Coach
CREATE OR REPLACE FUNCTION public.is_dojo_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT public.auth_is_active() 
       AND public.auth_role() IN ('Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach');
$$;

-- Verifies if caller owns a specific student record
CREATE OR REPLACE FUNCTION public.is_current_student(sid TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.students s
        WHERE (
            LOWER(s.id) = LOWER(sid)
            OR REPLACE(LOWER(s.id), '-', '_') = REPLACE(LOWER(sid), '-', '_')
        )
        AND (
            s.profile_id = auth.uid()
            OR s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
            OR (auth.jwt() -> 'app_metadata' ->> 'student_id') = s.id
            OR EXISTS (
                SELECT 1 FROM public.profiles p 
                WHERE p.id = auth.uid() 
                AND (
                    LOWER(p.student_id) = LOWER(s.id)
                    OR REPLACE(LOWER(p.username), '_', '-') = REPLACE(LOWER(s.id), '_', '-')
                )
            )
        )
    );
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.auth_role() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_active() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_root() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_elevated_staff() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_coach_or_above() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_dojo_staff() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_current_student(TEXT) TO authenticated, anon;

-- ---------------------------------------------------------------------
-- 3. ENABLE RLS ACROSS ALL SYSTEM TABLES
-- ---------------------------------------------------------------------

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.member_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scholarships ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.belts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.belt_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.belt_techniques ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.curriculum ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.library_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.library_asset_muscles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.muscles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lms_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_physical_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_body_compositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.academy_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pos_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pos_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.biomechanical_skill_linkage ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 4. TABLE POLICIES: 1. PROFILES
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile or admins read all" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow anon read profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select_policy"
ON public.profiles
FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Users can update own profile or admins update all" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "profiles_update_policy"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    public.is_admin_or_root()
    OR (
        id = auth.uid() 
        AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()) -- Prevents self role-escalation
        AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid()) -- Prevents self un-banning
    )
)
WITH CHECK (
    public.is_admin_or_root()
    OR (
        id = auth.uid() 
        AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
        AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid())
    )
);

DROP POLICY IF EXISTS "Allow profile insert" ON public.profiles;
CREATE POLICY "profiles_insert_policy"
ON public.profiles
FOR INSERT
TO authenticated, anon
WITH CHECK (
    public.is_admin_or_root()
    OR auth.uid() = id
    OR auth.role() = 'service_role'
);

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "profiles_delete_policy"
ON public.profiles
FOR DELETE
TO authenticated
USING (
    public.auth_role() IN ('Root', 'Super Root')
);

-- ---------------------------------------------------------------------
-- 5. TABLE POLICIES: 2. STUDENTS & STUDENT ADDRESSES
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff or student self can select students" ON public.students;
CREATE POLICY "students_select_policy"
ON public.students
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR profile_id = auth.uid()
    OR public.is_current_student(id)
);

DROP POLICY IF EXISTS "Elevated staff can modify students" ON public.students;
CREATE POLICY "students_insert_policy"
ON public.students
FOR INSERT
TO authenticated
WITH CHECK (public.is_elevated_staff());

CREATE POLICY "students_update_policy"
ON public.students
FOR UPDATE
TO authenticated
USING (public.is_elevated_staff())
WITH CHECK (public.is_elevated_staff());

CREATE POLICY "students_delete_policy"
ON public.students
FOR DELETE
TO authenticated
USING (public.is_admin_or_root());

-- Student Addresses
DROP POLICY IF EXISTS "Strict student addresses access" ON public.student_addresses;
DROP POLICY IF EXISTS "Elevated staff manage student addresses" ON public.student_addresses;

CREATE POLICY "student_addresses_select_policy"
ON public.student_addresses
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

CREATE POLICY "student_addresses_write_policy"
ON public.student_addresses
FOR ALL
TO authenticated
USING (public.is_elevated_staff())
WITH CHECK (public.is_elevated_staff());

-- ---------------------------------------------------------------------
-- 6. TABLE POLICIES: 3. MEMBERS & MEMBER ADDRESSES
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff or member self can select members" ON public.members;
DROP POLICY IF EXISTS "members_select_policy" ON public.members;
CREATE POLICY "members_select_policy"
ON public.members
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR id = auth.uid()
);

DROP POLICY IF EXISTS "members_insert_policy" ON public.members;
CREATE POLICY "members_insert_policy"
ON public.members
FOR INSERT
TO authenticated
WITH CHECK (public.is_elevated_staff());

DROP POLICY IF EXISTS "members_update_policy" ON public.members;
CREATE POLICY "members_update_policy"
ON public.members
FOR UPDATE
TO authenticated
USING (public.is_elevated_staff() OR id = auth.uid())
WITH CHECK (public.is_elevated_staff() OR id = auth.uid());

DROP POLICY IF EXISTS "members_delete_policy" ON public.members;
CREATE POLICY "members_delete_policy"
ON public.members
FOR DELETE
TO authenticated
USING (public.is_admin_or_root());

-- Member Addresses
DROP POLICY IF EXISTS "Strict member addresses access" ON public.member_addresses;
DROP POLICY IF EXISTS "member_addresses_select_policy" ON public.member_addresses;
CREATE POLICY "member_addresses_select_policy"
ON public.member_addresses
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR member_id = auth.uid()
);

DROP POLICY IF EXISTS "member_addresses_write_policy" ON public.member_addresses;
CREATE POLICY "member_addresses_write_policy"
ON public.member_addresses
FOR ALL
TO authenticated
USING (public.is_elevated_staff() OR member_id = auth.uid())
WITH CHECK (public.is_elevated_staff() OR member_id = auth.uid());

-- ---------------------------------------------------------------------
-- 7. TABLE POLICIES: 4. PAYMENTS & FINANCIALS (ZERO COACH ACCESS)
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Payments access control" ON public.payments;
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;

-- SELECT: Admins can view all, Students can view ONLY their own tuition bills
CREATE POLICY "payments_select_policy"
ON public.payments
FOR SELECT
TO authenticated
USING (
    public.is_admin_or_root()
    OR public.is_current_student(student_id)
);

-- WRITE (INSERT, UPDATE, DELETE): Strictly Admins / Root
CREATE POLICY "payments_insert_policy"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_root());

CREATE POLICY "payments_update_policy"
ON public.payments
FOR UPDATE
TO authenticated
USING (public.is_admin_or_root())
WITH CHECK (public.is_admin_or_root());

CREATE POLICY "payments_delete_policy"
ON public.payments
FOR DELETE
TO authenticated
USING (public.is_admin_or_root());

-- ---------------------------------------------------------------------
-- 8. TABLE POLICIES: 5. ATTENDANCE
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Attendance access control" ON public.attendance;
DROP POLICY IF EXISTS "Staff can mark attendance" ON public.attendance;

CREATE POLICY "attendance_select_policy"
ON public.attendance
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

CREATE POLICY "attendance_insert_policy"
ON public.attendance
FOR INSERT
TO authenticated
WITH CHECK (public.is_dojo_staff());

CREATE POLICY "attendance_update_policy"
ON public.attendance
FOR UPDATE
TO authenticated
USING (public.is_dojo_staff())
WITH CHECK (public.is_dojo_staff());

CREATE POLICY "attendance_delete_policy"
ON public.attendance
FOR DELETE
TO authenticated
USING (public.is_elevated_staff());

-- ---------------------------------------------------------------------
-- 8. TABLE POLICIES: 5. BELT HISTORIES & PROMOTIONS
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Belt histories access control" ON public.belt_histories;
DROP POLICY IF EXISTS "Staff can manage belt histories" ON public.belt_histories;

CREATE POLICY "belt_histories_select_policy"
ON public.belt_histories
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

CREATE POLICY "belt_histories_write_policy"
ON public.belt_histories
FOR ALL
TO authenticated
USING (public.is_coach_or_above())
WITH CHECK (public.is_coach_or_above());

-- ---------------------------------------------------------------------
-- 9. TABLE POLICIES: 6. EVALUATIONS & BODY COMPOSITIONS
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Physical evaluations access control" ON public.student_physical_evaluations;
DROP POLICY IF EXISTS "Staff manage physical evaluations" ON public.student_physical_evaluations;

CREATE POLICY "physical_evaluations_select_policy"
ON public.student_physical_evaluations
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

CREATE POLICY "physical_evaluations_write_policy"
ON public.student_physical_evaluations
FOR ALL
TO authenticated
USING (public.is_coach_or_above())
WITH CHECK (public.is_coach_or_above());

DROP POLICY IF EXISTS "Body composition access control" ON public.student_body_compositions;
DROP POLICY IF EXISTS "Staff insert update body compositions" ON public.student_body_compositions;
DROP POLICY IF EXISTS "Staff manage body compositions" ON public.student_body_compositions;

CREATE POLICY "body_compositions_select_policy"
ON public.student_body_compositions
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

CREATE POLICY "body_compositions_write_policy"
ON public.student_body_compositions
FOR ALL
TO authenticated
USING (public.is_coach_or_above())
WITH CHECK (public.is_coach_or_above());

-- ---------------------------------------------------------------------
-- 10. TABLE POLICIES: 7. CURRICULUM, LIBRARY ASSETS & ANATOMY
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow select library_assets" ON public.library_assets;
DROP POLICY IF EXISTS "Allow staff manage library_assets" ON public.library_assets;

CREATE POLICY "library_assets_select_policy"
ON public.library_assets
FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "library_assets_write_policy"
ON public.library_assets
FOR ALL
TO authenticated
USING (public.is_coach_or_above())
WITH CHECK (public.is_coach_or_above());

-- Curriculum mirror table
DROP POLICY IF EXISTS "curriculum_select" ON public.curriculum;
CREATE POLICY "curriculum_select_policy" ON public.curriculum FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "curriculum_write_policy" ON public.curriculum FOR ALL TO authenticated USING (public.is_coach_or_above()) WITH CHECK (public.is_coach_or_above());

-- Belt Techniques
DROP POLICY IF EXISTS "Allow select belt_techniques" ON public.belt_techniques;
CREATE POLICY "belt_techniques_select_policy" ON public.belt_techniques FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "belt_techniques_write_policy" ON public.belt_techniques FOR ALL TO authenticated USING (public.is_coach_or_above()) WITH CHECK (public.is_coach_or_above());

-- Workout Templates
DROP POLICY IF EXISTS "workout_templates_select" ON public.workout_templates;
CREATE POLICY "workout_templates_select_policy" ON public.workout_templates FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "workout_templates_write_policy" ON public.workout_templates FOR ALL TO authenticated USING (public.is_coach_or_above()) WITH CHECK (public.is_coach_or_above());

-- Anatomy & Muscles
DROP POLICY IF EXISTS "Allow select muscles" ON public.muscles;
CREATE POLICY "muscles_select_policy" ON public.muscles FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "muscles_write_policy" ON public.muscles FOR ALL TO authenticated USING (public.is_coach_or_above()) WITH CHECK (public.is_coach_or_above());

DROP POLICY IF EXISTS "Allow select library_asset_muscles" ON public.library_asset_muscles;
CREATE POLICY "asset_muscles_select_policy" ON public.library_asset_muscles FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "asset_muscles_write_policy" ON public.library_asset_muscles FOR ALL TO authenticated USING (public.is_coach_or_above()) WITH CHECK (public.is_coach_or_above());

DROP POLICY IF EXISTS "Allow select biomechanical_skill_linkage" ON public.biomechanical_skill_linkage;
DROP POLICY IF EXISTS "biomechanical_skill_linkage_select_policy" ON public.biomechanical_skill_linkage;
CREATE POLICY "biomechanical_skill_linkage_select_policy" ON public.biomechanical_skill_linkage FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "biomechanical_skill_linkage_write_policy" ON public.biomechanical_skill_linkage;
CREATE POLICY "biomechanical_skill_linkage_write_policy" ON public.biomechanical_skill_linkage FOR ALL TO authenticated USING (public.is_coach_or_above()) WITH CHECK (public.is_coach_or_above());

-- ---------------------------------------------------------------------
-- 11. TABLE POLICIES: 8. LMS PROGRESS
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Lms progress access control" ON public.lms_progress;
DROP POLICY IF EXISTS "Allow manage lms_progress" ON public.lms_progress;

CREATE POLICY "lms_progress_select_policy"
ON public.lms_progress
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

CREATE POLICY "lms_progress_write_policy"
ON public.lms_progress
FOR ALL
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
)
WITH CHECK (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

-- ---------------------------------------------------------------------
-- 12. TABLE POLICIES: 9. DOJO OPERATIONAL INFRASTRUCTURE
-- ---------------------------------------------------------------------

-- Classes
DROP POLICY IF EXISTS "classes_select" ON public.class_sessions;
CREATE POLICY "class_sessions_select_policy" ON public.class_sessions FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "class_sessions_write_policy" ON public.class_sessions FOR ALL TO authenticated USING (public.is_admin_or_root()) WITH CHECK (public.is_admin_or_root());

-- Class Enrollments
DROP POLICY IF EXISTS "Class enrollments access control" ON public.class_enrollments;
CREATE POLICY "class_enrollments_select_policy"
ON public.class_enrollments
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

CREATE POLICY "class_enrollments_write_policy"
ON public.class_enrollments
FOR ALL
TO authenticated
USING (public.is_elevated_staff())
WITH CHECK (public.is_elevated_staff());

-- Branches & Belts & Scholarships
DROP POLICY IF EXISTS "branches_select" ON public.branches;
CREATE POLICY "branches_select_policy" ON public.branches FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "branches_write_policy" ON public.branches FOR ALL TO authenticated USING (public.is_admin_or_root()) WITH CHECK (public.is_admin_or_root());

DROP POLICY IF EXISTS "belts_select" ON public.belts;
CREATE POLICY "belts_select_policy" ON public.belts FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "belts_write_policy" ON public.belts FOR ALL TO authenticated USING (public.is_admin_or_root()) WITH CHECK (public.is_admin_or_root());

DROP POLICY IF EXISTS "scholarships_select" ON public.scholarships;
CREATE POLICY "scholarships_select_policy" ON public.scholarships FOR SELECT TO authenticated USING (true);
CREATE POLICY "scholarships_write_policy" ON public.scholarships FOR ALL TO authenticated USING (public.is_admin_or_root()) WITH CHECK (public.is_admin_or_root());

-- Achievements
DROP POLICY IF EXISTS "Achievements access control" ON public.achievements;
DROP POLICY IF EXISTS "Staff can manage achievements" ON public.achievements;
CREATE POLICY "achievements_select_policy" ON public.achievements FOR SELECT TO authenticated USING (public.is_dojo_staff() OR public.is_current_student(student_id));
CREATE POLICY "achievements_write_policy" ON public.achievements FOR ALL TO authenticated USING (public.is_dojo_staff()) WITH CHECK (public.is_dojo_staff());

-- ---------------------------------------------------------------------
-- 13. TABLE POLICIES: 10. ACADEMY PROFILE & AUDIT LOGS
-- ---------------------------------------------------------------------

-- Ensure Academy Profile table exists
CREATE TABLE IF NOT EXISTS public.academy_profile (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
    academy_name VARCHAR(255) NOT NULL DEFAULT 'Infinity Taekwondo Academy',
    legal_name VARCHAR(255) DEFAULT 'Infinity Martial Arts Club Co., Ltd.',
    tagline VARCHAR(255) DEFAULT 'Discipline, Honor, Excellence · Martial Arts & Character Building',
    logo_url TEXT DEFAULT '/logo.svg',
    website_url TEXT DEFAULT 'https://infinitytkd.com',
    portal_url TEXT DEFAULT 'https://infinitytkd.com/lms',
    tax_id VARCHAR(100) DEFAULT '',
    contact_phone VARCHAR(50) DEFAULT '+855 12 888 999',
    support_email VARCHAR(255) DEFAULT 'contact@infinitytkd.com',
    primary_address TEXT DEFAULT 'Street 2004, Sen Sok, Phnom Penh, Cambodia',
    default_branch_id INT REFERENCES public.branches(id) ON DELETE SET NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    currency_symbol VARCHAR(10) NOT NULL DEFAULT '$',
    tuition_grace_period_days INT NOT NULL DEFAULT 5,
    tax_rate_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    date_format VARCHAR(20) NOT NULL DEFAULT 'YYYY-MM-DD',
    default_class_duration_mins INT NOT NULL DEFAULT 60,
    exam_passing_score INT NOT NULL DEFAULT 70,
    min_attendance_exam_pct INT NOT NULL DEFAULT 80,
    allow_student_portal_login BOOLEAN NOT NULL DEFAULT true,
    enable_audio_chimes BOOLEAN NOT NULL DEFAULT true,
    facebook_url TEXT DEFAULT 'https://facebook.com/infinitytaekwondo',
    telegram_channel TEXT DEFAULT 'https://t.me/infinitytkd',
    instagram_url TEXT DEFAULT 'https://instagram.com/infinitytaekwondo',
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.academy_profile (id, academy_name)
VALUES ('default', 'Infinity Taekwondo Academy')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.academy_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public and authenticated can read academy profile" ON public.academy_profile;
DROP POLICY IF EXISTS "Admins can update academy profile" ON public.academy_profile;
DROP POLICY IF EXISTS "Admins can insert academy profile" ON public.academy_profile;
DROP POLICY IF EXISTS "academy_profile_select_policy" ON public.academy_profile;
DROP POLICY IF EXISTS "academy_profile_insert_policy" ON public.academy_profile;
DROP POLICY IF EXISTS "academy_profile_update_policy" ON public.academy_profile;

CREATE POLICY "academy_profile_select_policy" ON public.academy_profile FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "academy_profile_insert_policy" ON public.academy_profile FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_root());
CREATE POLICY "academy_profile_update_policy" ON public.academy_profile FOR UPDATE TO authenticated USING (public.is_admin_or_root()) WITH CHECK (public.is_admin_or_root());
REVOKE DELETE ON public.academy_profile FROM authenticated, anon, public;

-- Ensure Audit Logs table exists before applying policies
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

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Immutable Trigger: Block any UPDATE or DELETE operation on audit_logs
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are strictly prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_log_mutation
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- Audit Logs Policies
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authorized callers can append audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;

CREATE POLICY "audit_logs_select_policy"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.is_admin_or_root());

CREATE POLICY "audit_logs_insert_policy"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM authenticated, anon, public;

-- ---------------------------------------------------------------------
-- 14. TABLE POLICIES: 11. POS & PRO-SHOP (CONDITIONAL ON TABLE PRESENCE)
-- ---------------------------------------------------------------------

DO $$
BEGIN
    -- Products
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        EXECUTE 'ALTER TABLE public.products ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "products_select" ON public.products';
        EXECUTE 'DROP POLICY IF EXISTS "products_select_policy" ON public.products';
        EXECUTE 'DROP POLICY IF EXISTS "products_write_policy" ON public.products';
        EXECUTE 'CREATE POLICY "products_select_policy" ON public.products FOR SELECT TO authenticated, anon USING (true)';
        EXECUTE 'CREATE POLICY "products_write_policy" ON public.products FOR ALL TO authenticated USING (public.is_admin_or_root()) WITH CHECK (public.is_admin_or_root())';
    END IF;

    -- Product Variants
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_variants') THEN
        EXECUTE 'ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "product_variants_select" ON public.product_variants';
        EXECUTE 'DROP POLICY IF EXISTS "product_variants_select_policy" ON public.product_variants';
        EXECUTE 'DROP POLICY IF EXISTS "product_variants_write_policy" ON public.product_variants';
        EXECUTE 'CREATE POLICY "product_variants_select_policy" ON public.product_variants FOR SELECT TO authenticated, anon USING (true)';
        EXECUTE 'CREATE POLICY "product_variants_write_policy" ON public.product_variants FOR ALL TO authenticated USING (public.is_admin_or_root()) WITH CHECK (public.is_admin_or_root())';
    END IF;

    -- POS Orders
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pos_orders') THEN
        EXECUTE 'ALTER TABLE public.pos_orders ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "pos_orders_select" ON public.pos_orders';
        EXECUTE 'DROP POLICY IF EXISTS "pos_orders_select_policy" ON public.pos_orders';
        EXECUTE 'DROP POLICY IF EXISTS "pos_orders_insert" ON public.pos_orders';
        EXECUTE 'DROP POLICY IF EXISTS "pos_orders_insert_policy" ON public.pos_orders';
        EXECUTE 'DROP POLICY IF EXISTS "pos_orders_update" ON public.pos_orders';
        EXECUTE 'DROP POLICY IF EXISTS "pos_orders_update_policy" ON public.pos_orders';
        EXECUTE 'DROP POLICY IF EXISTS "pos_orders_delete" ON public.pos_orders';
        EXECUTE 'DROP POLICY IF EXISTS "pos_orders_delete_policy" ON public.pos_orders';

        EXECUTE 'CREATE POLICY "pos_orders_select_policy" ON public.pos_orders FOR SELECT TO authenticated USING (public.is_dojo_staff() OR public.is_current_student(student_id))';
        EXECUTE 'CREATE POLICY "pos_orders_insert_policy" ON public.pos_orders FOR INSERT TO authenticated WITH CHECK (public.is_dojo_staff() OR public.is_current_student(student_id))';
        EXECUTE 'CREATE POLICY "pos_orders_update_policy" ON public.pos_orders FOR UPDATE TO authenticated USING (public.is_dojo_staff()) WITH CHECK (public.is_dojo_staff())';
        EXECUTE 'CREATE POLICY "pos_orders_delete_policy" ON public.pos_orders FOR DELETE TO authenticated USING (public.is_admin_or_root())';
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 15. PERMISSIONS RE-GRANTING & CLEANUP
-- ---------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'curriculum') THEN
        EXECUTE 'GRANT SELECT ON public.curriculum TO anon';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'library_assets') THEN
        EXECUTE 'GRANT SELECT ON public.library_assets TO anon';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'muscles') THEN
        EXECUTE 'GRANT SELECT ON public.muscles TO anon';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'belt_techniques') THEN
        EXECUTE 'GRANT SELECT ON public.belt_techniques TO anon';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'branches') THEN
        EXECUTE 'GRANT SELECT ON public.branches TO anon';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'academy_profile') THEN
        EXECUTE 'GRANT SELECT ON public.academy_profile TO anon';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'biomechanical_skill_linkage') THEN
        EXECUTE 'GRANT SELECT ON public.biomechanical_skill_linkage TO anon';
    END IF;
END $$;
