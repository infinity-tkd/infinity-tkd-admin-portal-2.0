-- =====================================================================
-- INFINITY TKD 2.0 - FIX & ALIGN PARTNERS SCHEMA WITH MOU CRM
-- Execution Target: Supabase / PostgreSQL (public schema)
-- Date: 2026-10-01
-- Description:
-- Aligns the pre-existing partners table with the full MOU specification.
-- Drops legacy restrictive check constraints, drops NOT NULL on contact_person,
-- adds all required CRM columns (address, collaboration_scope, etc.),
-- backfills existing data, sets up non-blocking RLS & Realtime publication,
-- and signals PostgREST to reload its schema cache.
-- =====================================================================

-- 1. Remove restrictive constraints if they exist
ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_partner_type_check;
ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_status_check;

-- 2. Relax legacy NOT NULL constraint on contact_person
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'partners' 
          AND column_name = 'contact_person' 
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.partners ALTER COLUMN contact_person DROP NOT NULL;
    END IF;
END $$;

-- 3. Add all missing columns from the modern specification idempotently
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS collaboration_scope TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS benefits_summary TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS contact_name VARCHAR(150);
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS telegram_link TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS secondary_contact_name VARCHAR(150);
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS secondary_contact_phone VARCHAR(100);
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS secondary_contact_telegram VARCHAR(100);
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS contract_document_url TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Sync legacy column data into modern columns (if any existing rows exist)
UPDATE public.partners SET
    contact_name = COALESCE(contact_name, contact_person),
    telegram_link = COALESCE(telegram_link, telegram_url),
    website_url = COALESCE(website_url, website),
    contract_document_url = COALESCE(contract_document_url, document_url),
    notes = COALESCE(notes, internal_notes),
    address = COALESCE(address, city);

-- 5. Add helpful query indexes if not present
CREATE INDEX IF NOT EXISTS idx_partners_name ON public.partners (name);
CREATE INDEX IF NOT EXISTS idx_partners_brand_name ON public.partners (brand_name);
CREATE INDEX IF NOT EXISTS idx_partners_type ON public.partners (partner_type);
CREATE INDEX IF NOT EXISTS idx_partners_status ON public.partners (status);
CREATE INDEX IF NOT EXISTS idx_partners_email ON public.partners (email);
CREATE INDEX IF NOT EXISTS idx_partners_telegram ON public.partners (telegram_username);
CREATE INDEX IF NOT EXISTS idx_partners_expiry ON public.partners (mou_expiry_date);
CREATE INDEX IF NOT EXISTS idx_partners_tags ON public.partners USING GIN (tags);

-- 6. Row Level Security (RLS) Policies
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated staff to view partners" ON public.partners;
DROP POLICY IF EXISTS "Allow staff read partners" ON public.partners;
DROP POLICY IF EXISTS "Allow authenticated users to read partners" ON public.partners;

-- Allow all authenticated users (staff, coaches, admins) to view partners
CREATE POLICY "Allow authenticated staff to view partners"
ON public.partners
FOR SELECT
TO authenticated
USING (true);

-- Allow staff and service role to manage partners
DROP POLICY IF EXISTS "Allow staff manage partners" ON public.partners;
DROP POLICY IF EXISTS "Allow admins and head coaches to insert partners" ON public.partners;
DROP POLICY IF EXISTS "Allow admins and head coaches to update partners" ON public.partners;
DROP POLICY IF EXISTS "Allow admins and head coaches to delete partners" ON public.partners;

CREATE POLICY "Allow staff manage partners"
ON public.partners
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Root', 'Super Root', 'Admin', 'Head Coach', 'Coach')
    )
    OR auth.role() = 'service_role'
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Root', 'Super Root', 'Admin', 'Head Coach', 'Coach')
    )
    OR auth.role() = 'service_role'
);

GRANT SELECT ON public.partners TO authenticated, anon;
GRANT ALL ON public.partners TO authenticated;

-- 7. Ensure Realtime publication includes partners for live UI sync
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'partners'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.partners;
    END IF;
END $$;

-- 8. Trigger PostgREST schema cache reload so the 'address' column and policies are immediately live
NOTIFY pgrst, 'reload schema';
