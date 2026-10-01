-- =====================================================================
-- FIX: INFINITE RECURSION IN RLS POLICIES (PROFILES, LIBRARY_ASSETS, LMS)
-- Target: Supabase / PostgreSQL (public schema)
-- Date: 2026-09-14
--
-- Root Cause:
--   Policies on `profiles` called `is_elevated_staff()` or queried `profiles`
--   which triggered self-referencing infinite recursion (PostgreSQL error 42P17).
--   Because `library_assets`, `lms_progress`, `muscles`, `belt_techniques`,
--   and `student_physical_evaluations` had policies referencing `profiles`,
--   they ALSO failed with "infinite recursion detected in policy for relation profiles",
--   causing Member page, E-learning page, and Academy Library page to return 0 rows.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. FIX HELPER FUNCTIONS (SECURITY DEFINER + EXPLICIT SEARCH PATH)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_dojo_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_elevated_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Root', 'Super Root', 'Admin', 'Head Coach', 'Coach')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_current_student(sid TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
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

GRANT EXECUTE ON FUNCTION public.is_dojo_staff() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_elevated_staff() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_current_student(TEXT) TO authenticated, anon;

-- ---------------------------------------------------------------------
-- 2. FIX PROFILES TABLE RLS (BREAK THE RECURSION CYCLE)
-- ---------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop all conflicting recursive policies
DROP POLICY IF EXISTS "Users can read own profile or admins read all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "Staff or student self can select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow anon read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile or admins update all" ON public.profiles;

-- Allow authenticated and anon users to read profiles (non-recursive: USING true)
-- Profiles only contains public metadata (id, username, email, display_name, role, is_active, student_id)
CREATE POLICY "Allow select profiles"
ON public.profiles
FOR SELECT
TO authenticated, anon
USING (true);

-- Allow admins/elevated staff or self to update own profile
CREATE POLICY "Users can update own profile or admins update all"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    id = auth.uid()
    OR public.is_elevated_staff()
)
WITH CHECK (
    id = auth.uid()
    OR public.is_elevated_staff()
);

-- Allow service role and insert for registration
DROP POLICY IF EXISTS "Allow profile insert" ON public.profiles;
CREATE POLICY "Allow profile insert"
ON public.profiles
FOR INSERT
TO authenticated, anon
WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- ---------------------------------------------------------------------
-- 3. FIX LIBRARY_ASSETS TABLE RLS (ACADEMY LIBRARY & E-LEARNING)
-- ---------------------------------------------------------------------

ALTER TABLE public.library_assets ENABLE ROW LEVEL SECURITY;

-- Drop all conflicting policies
DROP POLICY IF EXISTS "Allow select for all" ON public.library_assets;
DROP POLICY IF EXISTS "Allow select for authenticated" ON public.library_assets;
DROP POLICY IF EXISTS "Allow write for elevated roles" ON public.library_assets;
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.library_assets;
DROP POLICY IF EXISTS "Allow modify for coaches" ON public.library_assets;
DROP POLICY IF EXISTS "library_assets_select" ON public.library_assets;

-- Allow all authenticated and anonymous users to view curriculum library assets
CREATE POLICY "Allow select library_assets"
ON public.library_assets
FOR SELECT
TO authenticated, anon
USING (true);

-- Allow coaches and admins to insert/update/delete library assets
CREATE POLICY "Allow staff manage library_assets"
ON public.library_assets
FOR ALL
TO authenticated
USING (public.is_dojo_staff())
WITH CHECK (public.is_dojo_staff());

GRANT SELECT ON public.library_assets TO authenticated, anon;
GRANT ALL ON public.library_assets TO authenticated;

-- ---------------------------------------------------------------------
-- 4. FIX LMS_PROGRESS TABLE RLS (E-LEARNING COMPLETION PROGRESS)
-- ---------------------------------------------------------------------

ALTER TABLE public.lms_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lms progress access control" ON public.lms_progress;
DROP POLICY IF EXISTS "Students can record own video progress" ON public.lms_progress;
DROP POLICY IF EXISTS "lms_progress_select" ON public.lms_progress;

CREATE POLICY "Lms progress access control"
ON public.lms_progress
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

CREATE POLICY "Allow manage lms_progress"
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

GRANT ALL ON public.lms_progress TO authenticated;

-- ---------------------------------------------------------------------
-- 5. FIX REFERENCE TABLES: MUSCLES, ASSET_MUSCLES, BELT_TECHNIQUES
-- ---------------------------------------------------------------------

ALTER TABLE public.muscles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "muscles_select" ON public.muscles;
DROP POLICY IF EXISTS "Allow authenticated read muscles" ON public.muscles;
CREATE POLICY "Allow select muscles" ON public.muscles FOR SELECT TO authenticated, anon USING (true);
GRANT SELECT ON public.muscles TO authenticated, anon;
GRANT ALL ON public.muscles TO authenticated;

ALTER TABLE public.library_asset_muscles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "library_asset_muscles_select" ON public.library_asset_muscles;
DROP POLICY IF EXISTS "Allow authenticated read library_asset_muscles" ON public.library_asset_muscles;
CREATE POLICY "Allow select library_asset_muscles" ON public.library_asset_muscles FOR SELECT TO authenticated, anon USING (true);
GRANT SELECT ON public.library_asset_muscles TO authenticated, anon;
GRANT ALL ON public.library_asset_muscles TO authenticated;

ALTER TABLE public.belt_techniques ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "belt_techniques_select" ON public.belt_techniques;
DROP POLICY IF EXISTS "Allow authenticated read belt_techniques" ON public.belt_techniques;
CREATE POLICY "Allow select belt_techniques" ON public.belt_techniques FOR SELECT TO authenticated, anon USING (true);
GRANT SELECT ON public.belt_techniques TO authenticated, anon;
GRANT ALL ON public.belt_techniques TO authenticated;

-- ---------------------------------------------------------------------
-- 6. FIX EVALUATIONS & BIOMETRICS TABLES
-- ---------------------------------------------------------------------

ALTER TABLE public.student_physical_evaluations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Physical evaluations access control" ON public.student_physical_evaluations;
CREATE POLICY "Physical evaluations access control"
ON public.student_physical_evaluations
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

CREATE POLICY "Staff manage physical evaluations"
ON public.student_physical_evaluations
FOR ALL
TO authenticated
USING (public.is_dojo_staff())
WITH CHECK (public.is_dojo_staff());

GRANT ALL ON public.student_physical_evaluations TO authenticated;

ALTER TABLE public.student_body_compositions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Body composition access control" ON public.student_body_compositions;
CREATE POLICY "Body composition access control"
ON public.student_body_compositions
FOR SELECT
TO authenticated
USING (
    public.is_dojo_staff()
    OR public.is_current_student(student_id)
);

CREATE POLICY "Staff manage body compositions"
ON public.student_body_compositions
FOR ALL
TO authenticated
USING (public.is_dojo_staff())
WITH CHECK (public.is_dojo_staff());

GRANT ALL ON public.student_body_compositions TO authenticated;

-- ---------------------------------------------------------------------
-- 7. FIX CIRCULAR & FOREIGN KEY TIMING ISSUES IN SYNC TRIGGERS
-- ---------------------------------------------------------------------

-- Drop old BEFORE triggers that caused foreign-key violations on insert
DROP TRIGGER IF EXISTS trg_sync_profile_student_link ON public.profiles;
DROP TRIGGER IF EXISTS trg_sync_student_profile_link ON public.students;

-- Trigger Function A: Safe AFTER trigger on profiles with pg_trigger_depth guard
CREATE OR REPLACE FUNCTION public.fn_sync_profile_student_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    matched_student_id VARCHAR(50);
BEGIN
    -- Prevent circular cascade
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF NEW.role = 'Student' THEN
        -- Explicit student_id provided
        IF NEW.student_id IS NOT NULL AND NEW.student_id <> '' THEN
            UPDATE public.students
            SET profile_id = NEW.id
            WHERE LOWER(id) = LOWER(NEW.student_id)
              AND (profile_id IS NULL OR profile_id <> NEW.id);
        ELSE
            -- Auto-match against students table by username or email
            SELECT id INTO matched_student_id
            FROM public.students
            WHERE (
                REPLACE(REPLACE(LOWER(id), '-', ''), '_', '') = REPLACE(REPLACE(LOWER(NEW.username), '-', ''), '_', '')
                OR (NEW.email IS NOT NULL AND NEW.email <> '' AND LOWER(email) = LOWER(NEW.email))
            )
            ORDER BY 
                CASE WHEN REPLACE(REPLACE(LOWER(id), '-', ''), '_', '') = REPLACE(REPLACE(LOWER(NEW.username), '-', ''), '_', '') THEN 1 ELSE 2 END
            LIMIT 1;

            IF matched_student_id IS NOT NULL THEN
                UPDATE public.students
                SET profile_id = NEW.id
                WHERE id = matched_student_id
                  AND (profile_id IS NULL OR profile_id <> NEW.id);

                IF NEW.student_id IS NULL OR NEW.student_id = '' THEN
                    UPDATE public.profiles
                    SET student_id = matched_student_id
                    WHERE id = NEW.id AND (student_id IS NULL OR student_id = '');
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger Function B: Safe AFTER trigger on students with pg_trigger_depth guard
CREATE OR REPLACE FUNCTION public.fn_sync_student_profile_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    matched_profile_id UUID;
BEGIN
    -- Prevent circular cascade
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF NEW.profile_id IS NOT NULL THEN
        -- Sync profile's student_id
        UPDATE public.profiles
        SET student_id = NEW.id
        WHERE id = NEW.profile_id
          AND (student_id IS NULL OR student_id <> NEW.id);
    ELSE
        -- Auto-match against profiles table
        SELECT id INTO matched_profile_id
        FROM public.profiles
        WHERE role = 'Student'
          AND (
              REPLACE(REPLACE(LOWER(username), '-', ''), '_', '') = REPLACE(REPLACE(LOWER(NEW.id), '-', ''), '_', '')
              OR (NEW.email IS NOT NULL AND NEW.email <> '' AND LOWER(email) = LOWER(NEW.email))
          )
        LIMIT 1;

        IF matched_profile_id IS NOT NULL THEN
            UPDATE public.students
            SET profile_id = matched_profile_id
            WHERE id = NEW.id
              AND (profile_id IS NULL OR profile_id <> matched_profile_id);

            UPDATE public.profiles
            SET student_id = NEW.id
            WHERE id = matched_profile_id
              AND (student_id IS NULL OR student_id <> NEW.id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Re-create as AFTER triggers so rows are already committed to their primary tables
CREATE TRIGGER trg_sync_profile_student_link
AFTER INSERT OR UPDATE OF student_id, username, email, role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_profile_student_link();

CREATE TRIGGER trg_sync_student_profile_link
AFTER INSERT OR UPDATE OF profile_id, email ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_student_profile_link();

-- ---------------------------------------------------------------------
-- 8. RETROACTIVE SYNC FOR EXISTING STUDENTS & PROFILES
-- ---------------------------------------------------------------------

-- Link orphaned students to matching profiles
UPDATE public.students s
SET profile_id = p.id
FROM public.profiles p
WHERE (
    (s.profile_id IS NULL OR s.profile_id <> p.id)
    AND (
        LOWER(p.student_id) = LOWER(s.id)
        OR REPLACE(REPLACE(LOWER(p.username), '-', ''), '_', '') = REPLACE(REPLACE(LOWER(s.id), '-', ''), '_', '')
        OR (s.email IS NOT NULL AND s.email <> '' AND LOWER(p.email) = LOWER(s.email))
    )
);

-- Link orphaned profiles to matching students
UPDATE public.profiles p
SET student_id = s.id
FROM public.students s
WHERE (
    (p.student_id IS NULL OR p.student_id = '')
    AND (
        p.id = s.profile_id
        OR REPLACE(REPLACE(LOWER(p.username), '-', ''), '_', '') = REPLACE(REPLACE(LOWER(s.id), '-', ''), '_', '')
        OR (p.email IS NOT NULL AND p.email <> '' AND LOWER(p.email) = LOWER(s.email))
    )
);
