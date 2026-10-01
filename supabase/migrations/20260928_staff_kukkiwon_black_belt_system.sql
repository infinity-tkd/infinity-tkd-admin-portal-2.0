-- =====================================================================
-- INFINITY TKD 2.0 - KUKKIWON BLACK BELT & PROMOTION ELIGIBILITY ENGINE
-- Tracks Dan ranks (1st to 9th Dan), Kukkiwon IDs, Dan issue dates,
-- Dan promotion history from 1st Dan up, and calculates automated
-- promotion legitimacy based on Kukkiwon World Taekwondo Headquarters
-- time-in-grade waiting rules and minimum age standards.
-- Target: Supabase / PostgreSQL (public schema)
-- Date: 2026-09-28
-- =====================================================================

-- 0. RESOLVER HELPER: auth_role()
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

-- 1. EXTEND PROFILES TABLE WITH KUKKIWON DAN CREDENTIALS
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS kukkiwon_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS current_dan INT CHECK (current_dan BETWEEN 1 AND 9),
ADD COLUMN IF NOT EXISTS dan_issue_date DATE,
ADD COLUMN IF NOT EXISTS dan_certificate_url TEXT;

-- Index for speedy lookups
CREATE INDEX IF NOT EXISTS idx_profiles_current_dan ON public.profiles(current_dan);
CREATE INDEX IF NOT EXISTS idx_profiles_kukkiwon_id ON public.profiles(kukkiwon_id);

-- 2. CREATE STAFF DAN HISTORY TABLE (From 1st Dan Up)
CREATE TABLE IF NOT EXISTS public.staff_dan_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    dan_level INT NOT NULL CHECK (dan_level BETWEEN 1 AND 9),
    issue_date DATE NOT NULL,
    certificate_no VARCHAR(50),
    certificate_url TEXT,
    examiner_name VARCHAR(100),
    location VARCHAR(150) DEFAULT 'Infinity Taekwondo Academy',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_staff_dan_user_level UNIQUE (user_id, dan_level)
);

CREATE INDEX IF NOT EXISTS idx_staff_dan_history_user ON public.staff_dan_history(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_dan_history_level ON public.staff_dan_history(dan_level);
CREATE INDEX IF NOT EXISTS idx_staff_dan_history_date ON public.staff_dan_history(issue_date);

-- 3. AUTOMATIC SYNC TRIGGER
-- Keeps profiles.current_dan and profiles.dan_issue_date automatically in sync
-- with the highest verified Dan record in staff_dan_history.
CREATE OR REPLACE FUNCTION public.trg_sync_staff_latest_dan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    target_user_id UUID;
    highest_record RECORD;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_user_id := OLD.user_id;
    ELSE
        target_user_id := NEW.user_id;
    END IF;

    -- Find the Dan history record with the highest dan_level for this user
    SELECT dan_level, issue_date, certificate_no, certificate_url
    INTO highest_record
    FROM public.staff_dan_history
    WHERE user_id = target_user_id
    ORDER BY dan_level DESC, issue_date DESC
    LIMIT 1;

    IF FOUND THEN
        UPDATE public.profiles
        SET 
            current_dan = highest_record.dan_level,
            dan_issue_date = highest_record.issue_date,
            kukkiwon_id = COALESCE(highest_record.certificate_no, profiles.kukkiwon_id),
            dan_certificate_url = COALESCE(highest_record.certificate_url, profiles.dan_certificate_url)
        WHERE id = target_user_id;
    ELSE
        -- No history left, retain kukkiwon_id if manually entered, but clear active Dan tracking
        UPDATE public.profiles
        SET 
            current_dan = NULL,
            dan_issue_date = NULL
        WHERE id = target_user_id;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_dan_sync ON public.staff_dan_history;
CREATE TRIGGER trg_staff_dan_sync
AFTER INSERT OR UPDATE OR DELETE ON public.staff_dan_history
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_staff_latest_dan();

-- 4. ROW LEVEL SECURITY (RLS) FOR STAFF DAN HISTORY
ALTER TABLE public.staff_dan_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_dan_history_read_policy" ON public.staff_dan_history;
CREATE POLICY "staff_dan_history_read_policy"
ON public.staff_dan_history
FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "staff_dan_history_write_policy" ON public.staff_dan_history;
CREATE POLICY "staff_dan_history_write_policy"
ON public.staff_dan_history
FOR ALL
TO authenticated
USING (
    public.auth_role() IN ('Root', 'Super Root', 'Admin') 
    OR auth.uid() = user_id
)
WITH CHECK (
    public.auth_role() IN ('Root', 'Super Root', 'Admin')
);

GRANT SELECT ON public.staff_dan_history TO anon;
GRANT ALL ON public.staff_dan_history TO authenticated, service_role;

-- 5. REALTIME KUKKIWON PROMOTION ELIGIBILITY VIEW
-- Automatically computes required wait years, minimum age, earliest testing date,
-- days remaining, and promotion eligibility status.
CREATE OR REPLACE VIEW public.view_staff_dan_eligibility AS
SELECT 
    p.id AS user_id,
    p.username,
    p.display_name,
    p.email,
    p.role,
    p.is_active,
    p.kukkiwon_id,
    p.current_dan,
    p.dan_issue_date,
    p.dan_certificate_url,
    m.dob,
    -- Next target Dan rank
    CASE 
        WHEN p.current_dan IS NULL THEN NULL
        WHEN p.current_dan < 9 THEN p.current_dan + 1
        ELSE NULL
    END AS next_dan,
    -- Official Kukkiwon time-in-grade rule (waiting period in years)
    -- 1st -> 2nd: 1 yr | 2nd -> 3rd: 2 yrs | 3rd -> 4th: 3 yrs | 4th -> 5th: 4 yrs
    -- 5th -> 6th: 5 yrs | 6th -> 7th: 6 yrs | 7th -> 8th: 8 yrs | 8th -> 9th: 9 yrs
    CASE 
        WHEN p.current_dan = 1 THEN 1
        WHEN p.current_dan = 2 THEN 2
        WHEN p.current_dan = 3 THEN 3
        WHEN p.current_dan = 4 THEN 4
        WHEN p.current_dan = 5 THEN 5
        WHEN p.current_dan = 6 THEN 6
        WHEN p.current_dan = 7 THEN 8
        WHEN p.current_dan = 8 THEN 9
        ELSE 0
    END AS required_wait_years,
    -- Earliest eligible date for next Dan test
    CASE 
        WHEN p.current_dan IS NULL OR p.dan_issue_date IS NULL THEN NULL
        WHEN p.current_dan = 1 THEN (p.dan_issue_date + INTERVAL '1 year')::DATE
        WHEN p.current_dan = 2 THEN (p.dan_issue_date + INTERVAL '2 years')::DATE
        WHEN p.current_dan = 3 THEN (p.dan_issue_date + INTERVAL '3 years')::DATE
        WHEN p.current_dan = 4 THEN (p.dan_issue_date + INTERVAL '4 years')::DATE
        WHEN p.current_dan = 5 THEN (p.dan_issue_date + INTERVAL '5 years')::DATE
        WHEN p.current_dan = 6 THEN (p.dan_issue_date + INTERVAL '6 years')::DATE
        WHEN p.current_dan = 7 THEN (p.dan_issue_date + INTERVAL '8 years')::DATE
        WHEN p.current_dan = 8 THEN (p.dan_issue_date + INTERVAL '9 years')::DATE
        ELSE NULL
    END AS earliest_test_date,
    -- Minimum age for next Dan rank per Kukkiwon standard
    CASE 
        WHEN p.current_dan = 1 THEN 16 -- 2nd Dan min age
        WHEN p.current_dan = 2 THEN 18 -- 3rd Dan min age
        WHEN p.current_dan = 3 THEN 21 -- 4th Dan min age (Master threshold)
        WHEN p.current_dan = 4 THEN 25 -- 5th Dan min age
        WHEN p.current_dan = 5 THEN 30 -- 6th Dan min age
        WHEN p.current_dan = 6 THEN 36 -- 7th Dan min age
        WHEN p.current_dan = 7 THEN 44 -- 8th Dan min age
        WHEN p.current_dan = 8 THEN 53 -- 9th Dan min age
        ELSE 15
    END AS min_age_required,
    -- Current age calculation
    CASE 
        WHEN m.dob IS NOT NULL THEN DATE_PART('year', AGE(CURRENT_DATE, m.dob::DATE))::INT
        ELSE NULL
    END AS staff_current_age,
    -- Eligibility Booleans
    CASE 
        WHEN p.current_dan >= 9 THEN true
        WHEN p.current_dan IS NULL OR p.dan_issue_date IS NULL THEN false
        WHEN CURRENT_DATE >= (
            CASE 
                WHEN p.current_dan = 1 THEN (p.dan_issue_date + INTERVAL '1 year')::DATE
                WHEN p.current_dan = 2 THEN (p.dan_issue_date + INTERVAL '2 years')::DATE
                WHEN p.current_dan = 3 THEN (p.dan_issue_date + INTERVAL '3 years')::DATE
                WHEN p.current_dan = 4 THEN (p.dan_issue_date + INTERVAL '4 years')::DATE
                WHEN p.current_dan = 5 THEN (p.dan_issue_date + INTERVAL '5 years')::DATE
                WHEN p.current_dan = 6 THEN (p.dan_issue_date + INTERVAL '6 years')::DATE
                WHEN p.current_dan = 7 THEN (p.dan_issue_date + INTERVAL '8 years')::DATE
                WHEN p.current_dan = 8 THEN (p.dan_issue_date + INTERVAL '9 years')::DATE
                ELSE CURRENT_DATE
            END
        ) THEN true
        ELSE false
    END AS is_time_eligible,
    CASE 
        WHEN m.dob IS NULL THEN true -- Assume eligible if dob is unset
        WHEN p.current_dan >= 9 THEN true
        ELSE (DATE_PART('year', AGE(CURRENT_DATE, m.dob::DATE))::INT >= (
            CASE 
                WHEN p.current_dan = 1 THEN 16
                WHEN p.current_dan = 2 THEN 18
                WHEN p.current_dan = 3 THEN 21
                WHEN p.current_dan = 4 THEN 25
                WHEN p.current_dan = 5 THEN 30
                WHEN p.current_dan = 6 THEN 36
                WHEN p.current_dan = 7 THEN 44
                WHEN p.current_dan = 8 THEN 53
                ELSE 15
            END
        ))
    END AS is_age_eligible,
    -- Days remaining until earliest test date
    CASE 
        WHEN p.current_dan IS NULL OR p.dan_issue_date IS NULL OR p.current_dan >= 9 THEN 0
        ELSE GREATEST(0, (
            CASE 
                WHEN p.current_dan = 1 THEN (p.dan_issue_date + INTERVAL '1 year')::DATE
                WHEN p.current_dan = 2 THEN (p.dan_issue_date + INTERVAL '2 years')::DATE
                WHEN p.current_dan = 3 THEN (p.dan_issue_date + INTERVAL '3 years')::DATE
                WHEN p.current_dan = 4 THEN (p.dan_issue_date + INTERVAL '4 years')::DATE
                WHEN p.current_dan = 5 THEN (p.dan_issue_date + INTERVAL '5 years')::DATE
                WHEN p.current_dan = 6 THEN (p.dan_issue_date + INTERVAL '6 years')::DATE
                WHEN p.current_dan = 7 THEN (p.dan_issue_date + INTERVAL '8 years')::DATE
                WHEN p.current_dan = 8 THEN (p.dan_issue_date + INTERVAL '9 years')::DATE
                ELSE CURRENT_DATE
            END
        ) - CURRENT_DATE)
    END AS days_remaining,
    -- Synthesis status code
    CASE 
        WHEN p.current_dan IS NULL OR p.dan_issue_date IS NULL THEN 'NO_DAN_DATA'
        WHEN p.current_dan >= 9 THEN 'MAX_DAN'
        WHEN CURRENT_DATE < (
            CASE 
                WHEN p.current_dan = 1 THEN (p.dan_issue_date + INTERVAL '1 year')::DATE
                WHEN p.current_dan = 2 THEN (p.dan_issue_date + INTERVAL '2 years')::DATE
                WHEN p.current_dan = 3 THEN (p.dan_issue_date + INTERVAL '3 years')::DATE
                WHEN p.current_dan = 4 THEN (p.dan_issue_date + INTERVAL '4 years')::DATE
                WHEN p.current_dan = 5 THEN (p.dan_issue_date + INTERVAL '5 years')::DATE
                WHEN p.current_dan = 6 THEN (p.dan_issue_date + INTERVAL '6 years')::DATE
                WHEN p.current_dan = 7 THEN (p.dan_issue_date + INTERVAL '8 years')::DATE
                WHEN p.current_dan = 8 THEN (p.dan_issue_date + INTERVAL '9 years')::DATE
                ELSE CURRENT_DATE
            END
        ) THEN 'TIME_PENDING'
        WHEN m.dob IS NOT NULL AND DATE_PART('year', AGE(CURRENT_DATE, m.dob::DATE))::INT < (
            CASE 
                WHEN p.current_dan = 1 THEN 16
                WHEN p.current_dan = 2 THEN 18
                WHEN p.current_dan = 3 THEN 21
                WHEN p.current_dan = 4 THEN 25
                WHEN p.current_dan = 5 THEN 30
                WHEN p.current_dan = 6 THEN 36
                WHEN p.current_dan = 7 THEN 44
                WHEN p.current_dan = 8 THEN 53
                ELSE 15
            END
        ) THEN 'AGE_RESTRICTED'
        ELSE 'ELIGIBLE_FOR_TEST'
    END AS eligibility_status
FROM public.profiles p
LEFT JOIN public.members m ON p.id = m.id
WHERE p.role IN ('Head Coach', 'Coach', 'Assistant Coach', 'Admin', 'Root', 'Super Root');

GRANT SELECT ON public.view_staff_dan_eligibility TO anon, authenticated, service_role;
