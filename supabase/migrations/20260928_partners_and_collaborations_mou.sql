-- =====================================================================
-- INFINITY TKD 2.0 - PARTNERS, MOU & COLLABORATION DIRECTORY CRM
-- Execution Target: Supabase / PostgreSQL (public schema)
-- Date: 2026-09-28
-- =====================================================================

-- 1. CREATE PARTNER TYPE & STATUS DOMAINS / ENUMS (OR TEXT CONSTRAINTS)
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Brand & Institutional Identity
    name VARCHAR(255) NOT NULL,                                -- Formal/Legal Institution Name (e.g. "Korea National Sport University")
    brand_name VARCHAR(255),                                   -- Display Brand Name (e.g. "KNSU", "Mooto Korea")
    logo_url TEXT,                                             -- Logo image URL or uploaded storage path
    partner_type VARCHAR(100) NOT NULL DEFAULT 'MOU',          -- 'MOU', 'Sponsor', 'Educational', 'Supplier', 'Affiliated Dojang', 'Media & Marketing', 'Federation', 'Healthcare', 'Government/NGO', 'Other'
    status VARCHAR(50) NOT NULL DEFAULT 'Active',              -- 'Active', 'Pending Discussion', 'MOU Signed', 'Under Renewal', 'Expired', 'Terminated'
    description TEXT,                                          -- Overview of the company / organization
    collaboration_scope TEXT,                                  -- Core scope of MOU / mutual agreement deliverables
    benefits_summary TEXT,                                     -- Key perks, discounts, athlete sponsorships
    
    -- Key Leadership & Founder
    founder_name VARCHAR(150),                                 -- Founder, President, Grandmaster
    founder_contact VARCHAR(150),                              -- Founder direct contact or notes
    
    -- Primary Working / Operational Contact (Manager / Liaison)
    contact_name VARCHAR(150),                                 -- Key contact or manager name (e.g. "Sokha Mean")
    contact_role VARCHAR(150),                                 -- Role/Title (e.g. "Partnership Manager", "General Secretary")
    email VARCHAR(255),                                        -- Official Email / Gmail
    phone VARCHAR(100),                                        -- Primary Phone / Mobile
    telegram_username VARCHAR(100),                            -- Telegram handle (e.g. "@sokhamean" or "sokhamean")
    telegram_link TEXT,                                        -- Direct Telegram URL (e.g. "https://t.me/sokhamean")
    
    -- Secondary / Backup Contact
    secondary_contact_name VARCHAR(150),
    secondary_contact_phone VARCHAR(100),
    secondary_contact_telegram VARCHAR(100),
    
    -- Online Presence & Geographic Coordinates
    website_url TEXT,
    address TEXT,
    country VARCHAR(100) DEFAULT 'Cambodia',
    
    -- Contractual & MOU Tracking
    mou_signed_date DATE,                                      -- Date signed (YYYY-MM-DD)
    mou_expiry_date DATE,                                      -- Renewal / Expiration deadline (YYYY-MM-DD)
    contract_document_url TEXT,                                -- Drive link, signed PDF URL, or document ref
    
    -- Organizational Tags & Internal Notes
    tags TEXT[] DEFAULT '{}'::TEXT[],
    notes TEXT,                                                -- Internal team notes & communication history
    
    -- Audit & Timestamps
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. AUTOMATIC UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION public.set_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_partners_updated_at ON public.partners;
CREATE TRIGGER trg_partners_updated_at
BEFORE UPDATE ON public.partners
FOR EACH ROW
EXECUTE FUNCTION public.set_partners_updated_at();

-- 3. HIGH PERFORMANCE QUERY INDEXES
CREATE INDEX IF NOT EXISTS idx_partners_name ON public.partners (name);
CREATE INDEX IF NOT EXISTS idx_partners_brand_name ON public.partners (brand_name);
CREATE INDEX IF NOT EXISTS idx_partners_type ON public.partners (partner_type);
CREATE INDEX IF NOT EXISTS idx_partners_status ON public.partners (status);
CREATE INDEX IF NOT EXISTS idx_partners_email ON public.partners (email);
CREATE INDEX IF NOT EXISTS idx_partners_telegram ON public.partners (telegram_username);
CREATE INDEX IF NOT EXISTS idx_partners_expiry ON public.partners (mou_expiry_date);
CREATE INDEX IF NOT EXISTS idx_partners_tags ON public.partners USING GIN (tags);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Read policy: Authenticated staff / coaches / admins can view partners
CREATE POLICY "Allow authenticated staff to view partners"
ON public.partners
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach')
    )
);

-- Write policies: Admins, Head Coaches, and Roots can insert, update, delete
CREATE POLICY "Allow admins and head coaches to insert partners"
ON public.partners
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Root', 'Super Root', 'Admin', 'Head Coach')
    )
);

CREATE POLICY "Allow admins and head coaches to update partners"
ON public.partners
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Root', 'Super Root', 'Admin', 'Head Coach')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Root', 'Super Root', 'Admin', 'Head Coach')
    )
);

CREATE POLICY "Allow admins and head coaches to delete partners"
ON public.partners
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Root', 'Super Root', 'Admin', 'Head Coach')
    )
);

-- 5. INITIAL SEED DATA FOR IMMEDIATE USE
INSERT INTO public.partners (
    name,
    brand_name,
    logo_url,
    partner_type,
    status,
    description,
    collaboration_scope,
    benefits_summary,
    founder_name,
    founder_contact,
    contact_name,
    contact_role,
    email,
    phone,
    telegram_username,
    telegram_link,
    website_url,
    address,
    country,
    mou_signed_date,
    mou_expiry_date,
    contract_document_url,
    tags
) VALUES 
(
    'Korea National Sport University (KNSU)',
    'KNSU Taekwondo Dept.',
    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=200&auto=format&fit=crop&q=80',
    'Educational',
    'MOU Signed',
    'South Korea premier national university specializing in elite athletics and Kukkiwon Taekwondo leadership.',
    'Annual Master Instructor training exchange, black belt Dan certification seminars, and summer student training camp in Seoul.',
    'Fast-track collegiate training admission for Infinity TKD high-dan students, official Kukkiwon syllabus endorsement.',
    'Grandmaster Kim Jin-Hwan',
    '+82 2 410 6114',
    'Prof. Park Sun-Woo',
    'Director of Global Athletic Partnerships',
    'intl.tkd@knsu.ac.kr',
    '+82 10 3344 5566',
    'knsu_tkd_global',
    'https://t.me/knsu_tkd_global',
    'https://www.knsu.ac.kr',
    'Oryun-dong, Songpa-gu, Seoul',
    'South Korea',
    '2025-01-15',
    '2027-01-15',
    'https://drive.google.com/file/d/knsu-mou-2025/view',
    ARRAY['university', 'korea', 'seminar', 'black_belt']
),
(
    'Mooto International Martial Arts Equipment',
    'MOOTO Korea',
    'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=200&auto=format&fit=crop&q=80',
    'Supplier',
    'Active',
    'Global leader in WT-approved Taekwondo uniforms (Dobok), protective gears, electronic scoring systems, and training mats.',
    'Official apparel and gear supplier for Infinity TKD branches and national competitive team athletes.',
    '25% wholesale discount on all bulk dobok & gear orders, customized academy embroidery, and tournament sponsorship gear.',
    'Lee Sang-Hyun (Founder)',
    '+82 2 3445 1200',
    'David Choi',
    'Asia-Pacific Export Manager',
    'david.choi@mooto.com',
    '+82 10 9988 7766',
    'mooto_cambodia_liaison',
    'https://t.me/mooto_cambodia_liaison',
    'https://www.mooto.com',
    'Gangnam-gu, Seoul',
    'South Korea',
    '2024-06-01',
    '2026-12-31',
    'https://drive.google.com/file/d/mooto-supply-agree/view',
    ARRAY['equipment', 'dobok', 'supplier', 'discounts']
),
(
    'Cambodia Taekwondo Federation (WT)',
    'CTF (Federation)',
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=200&auto=format&fit=crop&q=80',
    'Federation',
    'Active',
    'Official governing body for World Taekwondo in the Kingdom of Cambodia, affiliated with NOCC and Ministry of Education.',
    'Official recognition of Infinity TKD dojang branches, referee accreditation, national tournament sanctioning, and National Team athlete scouting.',
    'Direct athlete registration for National Championship, Kukkiwon Poom/Dan certificate processing discount.',
    'H.E. Chhuon Leng (President)',
    '+855 12 900 100',
    'Mr. Sok Cheat',
    'Federation Technical Secretary',
    'secretary@cambodiatkd.org',
    '+855 23 880 771',
    'ctf_technical_sec',
    'https://t.me/ctf_technical_sec',
    'https://www.cambodiatkd.org',
    'National Olympic Stadium, Khan 7 Makara, Phnom Penh',
    'Cambodia',
    '2023-03-10',
    '2028-03-10',
    'https://drive.google.com/file/d/ctf-affiliation-doc/view',
    ARRAY['federation', 'national_team', 'kukkiwon', 'sanctioned']
),
(
    'International School of Phnom Penh (ISPP)',
    'ISPP School Partner',
    'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=200&auto=format&fit=crop&q=80',
    'Educational',
    'Active',
    'Premier IB World School in Phnom Penh hosting Infinity TKD After-School Activity (ASA) martial arts program.',
    'Exclusive on-campus Taekwondo training provider for elementary and secondary students across all 3 academic terms.',
    'Dedicated dojang space during after-school hours, direct billing integration, student enrollment pipeline of 80+ kids.',
    'Eileen Rose (Head of School)',
    '+855 23 213 103',
    'Brendan Walsh',
    'Director of Co-Curricular Activities',
    'activities@ispp.edu.kh',
    '+855 17 554 433',
    'b_walsh_ispp',
    'https://t.me/b_walsh_ispp',
    'https://www.ispp.edu.kh',
    'Hunan Street, Khan Dangkao, Phnom Penh',
    'Cambodia',
    '2024-08-01',
    '2026-06-30',
    'https://drive.google.com/file/d/ispp-asa-mou/view',
    ARRAY['school', 'asa', 'kids', 'campus']
),
(
    'Apsara Physio & Sports Rehabilitation Clinic',
    'Apsara Sports Physio',
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=200&auto=format&fit=crop&q=80',
    'Healthcare',
    'Active',
    'Specialized sports medicine and orthopedic physiotherapy clinic for martial artists and high-performance combat athletes.',
    'On-call injury assessment during internal academy championships, bi-monthly biomechanical screening workshops, and priority recovery sessions.',
    '20% member discount on physiotherapy & dry needling for Infinity TKD students, parents, and coaches.',
    'Dr. Meas Chantha (Lead Physio)',
    '+855 12 778 899',
    'Ms. Keo Sreymom',
    'Clinic Operations Manager',
    'care@apsaraphysio.com',
    '+855 98 445 566',
    'apsaraphysiocare',
    'https://t.me/apsaraphysiocare',
    'https://www.apsaraphysio.com',
    'BKK1, Khan Chamkarmon, Phnom Penh',
    'Cambodia',
    '2024-11-01',
    '2025-11-01',
    'https://drive.google.com/file/d/apsara-physio-agreement/view',
    ARRAY['health', 'injury_prevention', 'discounts', 'championship']
)
ON CONFLICT (id) DO NOTHING;
