-- =====================================================================
-- INFINITY TKD 2.0 - ACADEMY PROFILE & SYSTEM OPERATIONAL CONFIGURATION
-- Execution Target: Supabase / PostgreSQL (public schema)
-- Date: 2026-09-24
-- =====================================================================

-- 1. CREATE ADMIN CHECK HELPER IF NOT EXISTS
CREATE OR REPLACE FUNCTION public.is_admin_or_root()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Root', 'Super Root', 'Admin')
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_or_root() TO authenticated, anon;

-- 2. CREATE ACADEMY PROFILE TABLE
CREATE TABLE IF NOT EXISTS public.academy_profile (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
    
    -- Brand & Identity
    academy_name VARCHAR(255) NOT NULL DEFAULT 'Infinity Taekwondo Academy',
    legal_name VARCHAR(255) DEFAULT 'Infinity Martial Arts Club Co., Ltd.',
    tagline VARCHAR(255) DEFAULT 'Discipline, Honor, Excellence · Martial Arts & Character Building',
    logo_url TEXT DEFAULT '/logo.svg',
    website_url TEXT DEFAULT 'https://infinitytkd.com',
    portal_url TEXT DEFAULT 'https://infinitytkd.com/lms',
    tax_id VARCHAR(100) DEFAULT '',
    
    -- Contact & Physical Headquarters
    contact_phone VARCHAR(50) DEFAULT '+855 12 888 999',
    support_email VARCHAR(255) DEFAULT 'contact@infinitytkd.com',
    primary_address TEXT DEFAULT 'Street 2004, Sen Sok, Phnom Penh, Cambodia',
    default_branch_id INT REFERENCES public.branches(id) ON DELETE SET NULL,
    
    -- Financial & Billing Operational Policies
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    currency_symbol VARCHAR(10) NOT NULL DEFAULT '$',
    tuition_grace_period_days INT NOT NULL DEFAULT 5,
    tax_rate_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    
    -- Academic Curriculum & Exam Thresholds
    date_format VARCHAR(20) NOT NULL DEFAULT 'YYYY-MM-DD',
    default_class_duration_mins INT NOT NULL DEFAULT 60,
    exam_passing_score INT NOT NULL DEFAULT 70,
    min_attendance_exam_pct INT NOT NULL DEFAULT 80,
    
    -- System Toggles & Feature Flags
    allow_student_portal_login BOOLEAN NOT NULL DEFAULT true,
    enable_audio_chimes BOOLEAN NOT NULL DEFAULT true,
    
    -- Social Ecosystem
    facebook_url TEXT DEFAULT 'https://facebook.com/infinitytaekwondo',
    telegram_channel TEXT DEFAULT 'https://t.me/infinitytkd',
    instagram_url TEXT DEFAULT 'https://instagram.com/infinitytaekwondo',
    
    -- Audit & Timestamps
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. INSERT DEFAULT SINGLETON RECORD (IF NOT EXISTS)
INSERT INTO public.academy_profile (
    id, 
    academy_name, 
    legal_name, 
    tagline, 
    contact_phone, 
    support_email, 
    primary_address, 
    currency, 
    currency_symbol, 
    date_format, 
    default_class_duration_mins, 
    exam_passing_score, 
    min_attendance_exam_pct
) VALUES (
    'default',
    'Infinity Taekwondo Academy',
    'Infinity Martial Arts Club Co., Ltd.',
    'Discipline, Honor, Excellence · Martial Arts & Character Building',
    '+855 12 888 999',
    'contact@infinitytkd.com',
    'Street 2004, Sen Sok, Phnom Penh, Cambodia',
    'USD',
    '$',
    'YYYY-MM-DD',
    60,
    70,
    80
) ON CONFLICT (id) DO NOTHING;

-- 4. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.academy_profile ENABLE ROW LEVEL SECURITY;

-- 5. CONFIGURE DEFENSE-IN-DEPTH ACCESS POLICIES
DROP POLICY IF EXISTS "Public and authenticated can read academy profile" ON public.academy_profile;
CREATE POLICY "Public and authenticated can read academy profile"
ON public.academy_profile
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can update academy profile" ON public.academy_profile;
CREATE POLICY "Admins can update academy profile"
ON public.academy_profile
FOR UPDATE
TO authenticated
USING (public.is_admin_or_root())
WITH CHECK (public.is_admin_or_root());

DROP POLICY IF EXISTS "Admins can insert academy profile" ON public.academy_profile;
CREATE POLICY "Admins can insert academy profile"
ON public.academy_profile
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_root());

-- Prohibit deleting the singleton profile record
REVOKE DELETE ON public.academy_profile FROM authenticated, anon, public;

-- Grant access rights to authenticated and anon
GRANT SELECT ON public.academy_profile TO authenticated, anon;
GRANT INSERT, UPDATE ON public.academy_profile TO authenticated;

-- 6. AUTOMATIC UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION public.handle_academy_profile_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_academy_profile_updated_at ON public.academy_profile;
CREATE TRIGGER trg_academy_profile_updated_at
BEFORE UPDATE ON public.academy_profile
FOR EACH ROW
EXECUTE FUNCTION public.handle_academy_profile_updated_at();

-- 7. REALTIME REPLICATION (IF PUBLICATION EXISTS)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.academy_profile;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
