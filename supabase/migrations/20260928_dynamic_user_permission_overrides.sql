-- =====================================================================
-- INFINITY TKD 2.0 - DYNAMIC USER-SPECIFIC PERMISSION OVERRIDES
-- Allows System Owner (Root / Super Root) to grant or revoke specific
-- permissions for any individual user account.
-- Target: Supabase / PostgreSQL (public schema)
-- Date: 2026-09-28
-- =====================================================================

-- 0. RESOLVER HELPER (Guarantees auth_role exists)
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

-- 1. USER PERMISSIONS OVERRIDES TABLE
CREATE TABLE IF NOT EXISTS public.user_permissions (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_key VARCHAR(100) NOT NULL,
    is_granted BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, permission_key)
);

-- 2. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- 3. POLICIES
-- All users can read their permissions for frontend UI & component guards
DROP POLICY IF EXISTS "user_permissions_select_policy" ON public.user_permissions;
CREATE POLICY "user_permissions_select_policy"
ON public.user_permissions
FOR SELECT
TO authenticated, anon
USING (true);

-- Strictly Root & Super Root can mutate individual user permissions
DROP POLICY IF EXISTS "user_permissions_write_policy" ON public.user_permissions;
CREATE POLICY "user_permissions_write_policy"
ON public.user_permissions
FOR ALL
TO authenticated
USING (public.auth_role() IN ('Root', 'Super Root'))
WITH CHECK (public.auth_role() IN ('Root', 'Super Root'));

-- 4. PERMISSIONS GRANT
GRANT SELECT ON public.user_permissions TO anon;
GRANT ALL ON public.user_permissions TO authenticated, service_role;
