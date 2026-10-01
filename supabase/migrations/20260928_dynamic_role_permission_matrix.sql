-- =====================================================================
-- INFINITY TKD 2.0 - DYNAMIC ROLE-BASED ACCESS CONTROL (RBAC) MATRIX
-- Grants System Owner (Root / Super Root) full capability to dynamically
-- toggle page, feature, and action permissions for every role.
-- Target: Supabase / PostgreSQL (public schema)
-- Date: 2026-09-28
-- =====================================================================

-- 0. HELPER FUNCTION TO GET CALLER ROLE
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

GRANT EXECUTE ON FUNCTION public.auth_role() TO authenticated, anon;

-- 1. CREATE ROLE PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role VARCHAR(50) NOT NULL,
    permission_key VARCHAR(100) NOT NULL,
    is_granted BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    PRIMARY KEY (role, permission_key)
);

-- 2. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 3. POLICIES
-- All authenticated users can read permissions to compute their client-side UI rights
DROP POLICY IF EXISTS "role_permissions_select_policy" ON public.role_permissions;
CREATE POLICY "role_permissions_select_policy"
ON public.role_permissions
FOR SELECT
TO authenticated, anon
USING (true);

-- Strictly Root and Super Root can insert, update, or delete role permissions
DROP POLICY IF EXISTS "role_permissions_write_policy" ON public.role_permissions;
CREATE POLICY "role_permissions_write_policy"
ON public.role_permissions
FOR ALL
TO authenticated
USING (public.auth_role() IN ('Root', 'Super Root'))
WITH CHECK (public.auth_role() IN ('Root', 'Super Root'));

-- 4. SEED BASELINE PERMISSIONS (DEFAULT MATRIX)
INSERT INTO public.role_permissions (role, permission_key, is_granted) VALUES
    -- ROOT (Always granted full rights)
    ('Root', 'page:dashboard', true),
    ('Root', 'page:pos', true),
    ('Root', 'page:financials', true),
    ('Root', 'page:directory', true),
    ('Root', 'page:attendance', true),
    ('Root', 'page:schedule', true),
    ('Root', 'page:lms', true),
    ('Root', 'page:library', true),
    ('Root', 'page:staff', true),
    ('Root', 'page:settings', true),
    ('Root', 'action:pos_create_order', true),
    ('Root', 'action:pos_manage_inventory', true),
    ('Root', 'action:pos_cancel_order', true),
    ('Root', 'action:student_create', true),
    ('Root', 'action:student_edit', true),
    ('Root', 'action:student_delete', true),
    ('Root', 'action:attendance_mark', true),
    ('Root', 'action:attendance_delete', true),
    ('Root', 'action:evaluations_grade', true),
    ('Root', 'action:curriculum_edit', true),
    ('Root', 'action:finance_record_payment', true),
    ('Root', 'action:schedule_manage', true),
    ('Root', 'action:staff_manage', true),

    -- ADMIN
    ('Admin', 'page:dashboard', true),
    ('Admin', 'page:pos', true),
    ('Admin', 'page:financials', true),
    ('Admin', 'page:directory', true),
    ('Admin', 'page:attendance', true),
    ('Admin', 'page:schedule', true),
    ('Admin', 'page:lms', true),
    ('Admin', 'page:library', true),
    ('Admin', 'page:staff', true),
    ('Admin', 'page:settings', true),
    ('Admin', 'action:pos_create_order', true),
    ('Admin', 'action:pos_manage_inventory', true),
    ('Admin', 'action:pos_cancel_order', true),
    ('Admin', 'action:student_create', true),
    ('Admin', 'action:student_edit', true),
    ('Admin', 'action:student_delete', false),
    ('Admin', 'action:attendance_mark', true),
    ('Admin', 'action:attendance_delete', true),
    ('Admin', 'action:evaluations_grade', true),
    ('Admin', 'action:curriculum_edit', true),
    ('Admin', 'action:finance_record_payment', true),
    ('Admin', 'action:schedule_manage', true),
    ('Admin', 'action:staff_manage', false),

    -- HEAD COACH
    ('Head Coach', 'page:dashboard', true),
    ('Head Coach', 'page:pos', true),
    ('Head Coach', 'page:financials', false),
    ('Head Coach', 'page:directory', true),
    ('Head Coach', 'page:attendance', true),
    ('Head Coach', 'page:schedule', true),
    ('Head Coach', 'page:lms', true),
    ('Head Coach', 'page:library', true),
    ('Head Coach', 'page:staff', true),
    ('Head Coach', 'page:settings', false),
    ('Head Coach', 'action:pos_create_order', true),
    ('Head Coach', 'action:pos_manage_inventory', false),
    ('Head Coach', 'action:pos_cancel_order', false),
    ('Head Coach', 'action:student_create', true),
    ('Head Coach', 'action:student_edit', true),
    ('Head Coach', 'action:student_delete', false),
    ('Head Coach', 'action:attendance_mark', true),
    ('Head Coach', 'action:attendance_delete', true),
    ('Head Coach', 'action:evaluations_grade', true),
    ('Head Coach', 'action:curriculum_edit', true),
    ('Head Coach', 'action:finance_record_payment', false),
    ('Head Coach', 'action:schedule_manage', true),
    ('Head Coach', 'action:staff_manage', false),

    -- COACH
    ('Coach', 'page:dashboard', true),
    ('Coach', 'page:pos', false),
    ('Coach', 'page:financials', false),
    ('Coach', 'page:directory', true),
    ('Coach', 'page:attendance', true),
    ('Coach', 'page:schedule', true),
    ('Coach', 'page:lms', true),
    ('Coach', 'page:library', true),
    ('Coach', 'page:staff', false),
    ('Coach', 'page:settings', false),
    ('Coach', 'action:pos_create_order', false),
    ('Coach', 'action:pos_manage_inventory', false),
    ('Coach', 'action:pos_cancel_order', false),
    ('Coach', 'action:student_create', false),
    ('Coach', 'action:student_edit', false),
    ('Coach', 'action:student_delete', false),
    ('Coach', 'action:attendance_mark', true),
    ('Coach', 'action:attendance_delete', false),
    ('Coach', 'action:evaluations_grade', true),
    ('Coach', 'action:curriculum_edit', true),
    ('Coach', 'action:finance_record_payment', false),
    ('Coach', 'action:schedule_manage', false),
    ('Coach', 'action:staff_manage', false),

    -- ASSISTANT COACH
    ('Assistant Coach', 'page:dashboard', true),
    ('Assistant Coach', 'page:pos', false),
    ('Assistant Coach', 'page:financials', false),
    ('Assistant Coach', 'page:directory', true),
    ('Assistant Coach', 'page:attendance', true),
    ('Assistant Coach', 'page:schedule', true),
    ('Assistant Coach', 'page:lms', true),
    ('Assistant Coach', 'page:library', true),
    ('Assistant Coach', 'page:staff', false),
    ('Assistant Coach', 'page:settings', false),
    ('Assistant Coach', 'action:pos_create_order', false),
    ('Assistant Coach', 'action:pos_manage_inventory', false),
    ('Assistant Coach', 'action:pos_cancel_order', false),
    ('Assistant Coach', 'action:student_create', false),
    ('Assistant Coach', 'action:student_edit', false),
    ('Assistant Coach', 'action:student_delete', false),
    ('Assistant Coach', 'action:attendance_mark', true),
    ('Assistant Coach', 'action:attendance_delete', false),
    ('Assistant Coach', 'action:evaluations_grade', false),
    ('Assistant Coach', 'action:curriculum_edit', false),
    ('Assistant Coach', 'action:finance_record_payment', false),
    ('Assistant Coach', 'action:schedule_manage', false),
    ('Assistant Coach', 'action:staff_manage', false),

    -- STUDENT
    ('Student', 'page:dashboard', false),
    ('Student', 'page:pos', false),
    ('Student', 'page:financials', false),
    ('Student', 'page:directory', false),
    ('Student', 'page:attendance', false),
    ('Student', 'page:schedule', false),
    ('Student', 'page:lms', true),
    ('Student', 'page:library', true),
    ('Student', 'page:staff', false),
    ('Student', 'page:settings', false),
    ('Student', 'action:pos_create_order', false),
    ('Student', 'action:pos_manage_inventory', false),
    ('Student', 'action:pos_cancel_order', false),
    ('Student', 'action:student_create', false),
    ('Student', 'action:student_edit', false),
    ('Student', 'action:student_delete', false),
    ('Student', 'action:attendance_mark', false),
    ('Student', 'action:attendance_delete', false),
    ('Student', 'action:evaluations_grade', false),
    ('Student', 'action:curriculum_edit', false),
    ('Student', 'action:finance_record_payment', false),
    ('Student', 'action:schedule_manage', false),
    ('Student', 'action:staff_manage', false)
ON CONFLICT (role, permission_key) DO NOTHING;

GRANT SELECT ON public.role_permissions TO anon;
GRANT ALL ON public.role_permissions TO authenticated, service_role;
