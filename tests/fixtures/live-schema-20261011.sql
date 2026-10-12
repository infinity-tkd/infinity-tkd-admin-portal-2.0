-- Schema-only snapshot of the connected Infinity TKD project; no personal data.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE EXTENSION citext;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.role',true),''),'anon') $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_app_meta_data jsonb DEFAULT '{}');
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
CREATE SEQUENCE public."muscles_id_seq";
CREATE SEQUENCE public."class_sessions_id_seq";
CREATE SEQUENCE public."class_enrollments_id_seq";
CREATE SEQUENCE public."payments_id_seq";
CREATE SEQUENCE public."student_body_compositions_id_seq";
CREATE SEQUENCE public."attendance_id_seq";
CREATE SEQUENCE public."scholarships_id_seq";
CREATE SEQUENCE public."inventory_logs_id_seq";
CREATE SEQUENCE public."curriculum_id_seq";
CREATE SEQUENCE public."branches_id_seq";
CREATE SEQUENCE public."belts_id_seq";
CREATE SEQUENCE public."belt_histories_id_seq";
CREATE SEQUENCE public."lms_progress_id_seq";
CREATE SEQUENCE public."achievements_id_seq";
CREATE SEQUENCE public."member_addresses_address_id_seq";
CREATE SEQUENCE public."student_addresses_address_id_seq";
CREATE SEQUENCE public."library_assets_id_seq";
CREATE SEQUENCE public."product_categories_id_seq";
CREATE TYPE public."class_category" AS ENUM ('General Class','Kid Class','Private Class','Elite Team');
CREATE TYPE public."library_type_enum" AS ENUM ('Taekwondo','Fitness');
CREATE TYPE public."taekwondo_category_enum" AS ENUM ('Poomsae','Kyorugi','Chagi','Hosinsul','Kyokpa','Theory');
CREATE TYPE public."fitness_category_enum" AS ENUM ('Strength','Explosive','Speed','Agility','Control','Balance','Flexibility','Functional','Rotational','Core','Conditioning');
CREATE TABLE public."portal_rate_limits" ("key" text NOT NULL,
"attempts" integer NOT NULL,
"expires_at" timestamp with time zone NOT NULL);
ALTER TABLE public."portal_rate_limits" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."library_asset_muscles" ("asset_id" integer NOT NULL,
"muscle_id" integer NOT NULL,
"role" character varying(20) NOT NULL,
"created_at" timestamp with time zone DEFAULT now());
ALTER TABLE public."library_asset_muscles" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."muscles" ("id" integer NOT NULL DEFAULT nextval('muscles_id_seq'::regclass),
"name" character varying(255) NOT NULL,
"name_kh" character varying(255),
"name_zh" character varying(255),
"muscle_group" character varying(100) NOT NULL,
"target_function" character varying(255),
"diagram_url" character varying(255),
"description" text,
"created_at" timestamp with time zone DEFAULT now());
ALTER TABLE public."muscles" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."biomechanical_skill_linkage" ("skill_name" character varying(100) NOT NULL,
"muscle_id" integer NOT NULL,
"loading_factor" numeric(3,2) DEFAULT 1.00);
ALTER TABLE public."biomechanical_skill_linkage" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."profiles" ("id" uuid NOT NULL,
"username" citext NOT NULL,
"email" citext NOT NULL,
"display_name" character varying(150) NOT NULL,
"role" character varying(30) NOT NULL,
"is_active" boolean NOT NULL DEFAULT true,
"created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
"student_id" character varying(50),
"kukkiwon_id" character varying(50),
"current_dan" integer,
"dan_issue_date" date,
"dan_certificate_url" text,
"must_change_password" boolean NOT NULL DEFAULT false);
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."class_sessions" ("id" integer NOT NULL DEFAULT nextval('class_sessions_id_seq'::regclass),
"branch_id" integer NOT NULL,
"class_name" character varying(100) NOT NULL,
"day_of_week" character varying(15) NOT NULL,
"start_time" time without time zone NOT NULL,
"end_time" time without time zone NOT NULL,
"head_coach_id" uuid,
"capacity" integer DEFAULT 30,
"created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
"class_type" class_category NOT NULL DEFAULT 'General Class'::class_category,
"days_of_week" text[] NOT NULL DEFAULT '{}'::text[],
"coach_id" uuid,
"standard_duration_mins" integer NOT NULL DEFAULT 90);
ALTER TABLE public."class_sessions" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."class_enrollments" ("id" bigint NOT NULL DEFAULT nextval('class_enrollments_id_seq'::regclass),
"student_id" character varying(20) NOT NULL,
"class_id" integer NOT NULL,
"enrolled_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
"enrollment_date" date);
ALTER TABLE public."class_enrollments" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."payments" ("id" bigint NOT NULL DEFAULT nextval('payments_id_seq'::regclass),
"student_id" character varying(20) NOT NULL,
"year" integer NOT NULL,
"billing_month" date,
"for_month" character varying(10) NOT NULL,
"status" character varying(20) NOT NULL DEFAULT 'Unpaid'::character varying,
"payment_date" date,
"amount_usd" numeric(6,2) NOT NULL DEFAULT 0.00,
"notes" text,
"created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()));
ALTER TABLE public."payments" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."student_body_compositions" ("id" integer NOT NULL DEFAULT nextval('student_body_compositions_id_seq'::regclass),
"student_id" character varying(255) NOT NULL,
"recorded_date" date NOT NULL DEFAULT CURRENT_DATE,
"height_cm" numeric(5,2) NOT NULL,
"weight_kg" numeric(5,2) NOT NULL,
"body_fat_percentage" numeric(4,2),
"skeletal_muscle_mass_kg" numeric(5,2),
"neck_cm" numeric(5,2),
"shoulder_width_cm" numeric(5,2),
"chest_cm" numeric(5,2),
"waist_cm" numeric(5,2),
"hips_cm" numeric(5,2),
"left_arm_cm" numeric(5,2),
"right_arm_cm" numeric(5,2),
"left_thigh_cm" numeric(5,2),
"right_thigh_cm" numeric(5,2),
"left_calf_cm" numeric(5,2),
"right_calf_cm" numeric(5,2),
"recorded_by" uuid,
"created_at" timestamp with time zone DEFAULT now());
ALTER TABLE public."student_body_compositions" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."audit_logs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(),
"action" character varying(100) NOT NULL,
"performed_by" character varying(255) NOT NULL,
"target_id" character varying(255),
"details" jsonb DEFAULT '{}'::jsonb,
"status" character varying(50) NOT NULL DEFAULT 'SUCCESS'::character varying,
"ip_address" character varying(45),
"created_at" timestamp with time zone NOT NULL DEFAULT now());
ALTER TABLE public."audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."attendance" ("id" bigint NOT NULL DEFAULT nextval('attendance_id_seq'::regclass),
"student_id" character varying(20) NOT NULL,
"date" date NOT NULL DEFAULT CURRENT_DATE,
"status" character varying(20) NOT NULL,
"marked_by" uuid,
"created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()));
ALTER TABLE public."attendance" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."scholarships" ("id" integer NOT NULL DEFAULT nextval('scholarships_id_seq'::regclass),
"type_name" character varying(50) NOT NULL,
"discount_percentage" numeric(5,2) NOT NULL DEFAULT 0.00,
"description" text,
"created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()));
ALTER TABLE public."scholarships" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."pos_order_items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(),
"order_id" uuid NOT NULL,
"product_id" uuid,
"variant_id" uuid,
"sku" character varying(50) NOT NULL,
"product_name" character varying(150) NOT NULL,
"size" character varying(50),
"color" character varying(50),
"unit_price_usd" numeric(10,2) NOT NULL,
"quantity" integer NOT NULL,
"total_price_usd" numeric(10,2) NOT NULL,
"created_at" timestamp with time zone DEFAULT now());
ALTER TABLE public."pos_order_items" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."inventory_logs" ("id" bigint NOT NULL DEFAULT nextval('inventory_logs_id_seq'::regclass),
"product_id" uuid NOT NULL,
"variant_id" uuid,
"change_quantity" integer NOT NULL,
"balance_after" integer NOT NULL,
"reason" character varying(50) NOT NULL,
"reference_id" uuid,
"logged_by" uuid,
"notes" text,
"created_at" timestamp with time zone DEFAULT now());
ALTER TABLE public."inventory_logs" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."products" ("id" uuid NOT NULL DEFAULT gen_random_uuid(),
"sku" character varying(50) NOT NULL,
"name" character varying(150) NOT NULL,
"category_id" integer,
"category_name" character varying(50) NOT NULL,
"price_usd" numeric(10,2) NOT NULL,
"cost_usd" numeric(10,2) DEFAULT 0.00,
"stock" integer NOT NULL DEFAULT 0,
"min_stock_threshold" integer NOT NULL DEFAULT 5,
"sizes" text[] DEFAULT '{}'::text[],
"has_variants" boolean DEFAULT false,
"image_url" text,
"description" text,
"is_active" boolean DEFAULT true,
"allow_student_orders" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
ALTER TABLE public."products" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."pos_orders" ("id" uuid NOT NULL DEFAULT gen_random_uuid(),
"order_number" character varying(50) NOT NULL,
"order_channel" character varying(20) NOT NULL DEFAULT 'STUDENT_PORTAL'::character varying,
"student_id" character varying(50),
"customer_name" character varying(100) NOT NULL,
"customer_phone" character varying(30),
"branch_id" integer,
"subtotal_usd" numeric(10,2) NOT NULL,
"discount_percentage" numeric(5,2) DEFAULT 0.00,
"discount_usd" numeric(10,2) DEFAULT 0.00,
"total_usd" numeric(10,2) NOT NULL,
"payment_method" character varying(30) NOT NULL DEFAULT 'ABA Bank KHQR'::character varying,
"payment_status" character varying(20) NOT NULL DEFAULT 'PENDING'::character varying,
"order_status" character varying(30) NOT NULL DEFAULT 'PENDING_CONFIRMATION'::character varying,
"khqr_md5_hash" character varying(64),
"student_notes" text,
"admin_notes" text,
"recorded_by" uuid,
"confirmed_by" uuid,
"confirmed_at" timestamp with time zone,
"fulfilled_at" timestamp with time zone,
"cancelled_at" timestamp with time zone,
"cancellation_reason" text,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
ALTER TABLE public."pos_orders" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."curriculum" ("id" integer NOT NULL DEFAULT nextval('curriculum_id_seq'::regclass),
"target_belt" character varying(30) NOT NULL,
"category" character varying(50) NOT NULL,
"title" character varying(150) NOT NULL,
"description" text,
"video_url" text,
"thumbnail_url" text,
"is_active" boolean NOT NULL DEFAULT true,
"created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()));
ALTER TABLE public."curriculum" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."belt_techniques" ("id" uuid NOT NULL DEFAULT gen_random_uuid(),
"belt_level" character varying(50) NOT NULL,
"technique_name" character varying(255) NOT NULL,
"created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
"created_by" uuid,
"category" character varying(50) NOT NULL DEFAULT 'Kicks (Chagi)'::character varying);
ALTER TABLE public."belt_techniques" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."branches" ("id" integer NOT NULL DEFAULT nextval('branches_id_seq'::regclass),
"branch_name" character varying(100) NOT NULL,
"address" text,
"contact_phone" character varying(50),
"manager_id" uuid,
"is_active" boolean NOT NULL DEFAULT true,
"created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()));
ALTER TABLE public."branches" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."product_variants" ("id" uuid NOT NULL DEFAULT gen_random_uuid(),
"product_id" uuid NOT NULL,
"sku" character varying(50) NOT NULL,
"size" character varying(50),
"color" character varying(50),
"price_override" numeric(10,2),
"stock" integer NOT NULL DEFAULT 0,
"min_stock_threshold" integer NOT NULL DEFAULT 3,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now());
ALTER TABLE public."product_variants" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."role_permissions" ("role" character varying(50) NOT NULL,
"permission_key" character varying(100) NOT NULL,
"is_granted" boolean NOT NULL DEFAULT true,
"updated_at" timestamp with time zone NOT NULL DEFAULT now(),
"updated_by" uuid);
ALTER TABLE public."role_permissions" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."belts" ("id" integer NOT NULL DEFAULT nextval('belts_id_seq'::regclass),
"belt_name" character varying(30) NOT NULL,
"belt_order" integer NOT NULL,
"belt_type" character varying(20) NOT NULL,
"color_hex" character varying(10));
ALTER TABLE public."belts" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."belt_histories" ("id" integer NOT NULL DEFAULT nextval('belt_histories_id_seq'::regclass),
"student_id" character varying(20) NOT NULL,
"belt_level" character varying(30) NOT NULL,
"promotion_date" date NOT NULL DEFAULT CURRENT_DATE,
"certificate_id" character varying(100),
"certificate_path" text,
"created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
"kukkiwon_dan_card_id" character varying(255));
ALTER TABLE public."belt_histories" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."lms_progress" ("id" bigint NOT NULL DEFAULT nextval('lms_progress_id_seq'::regclass),
"student_id" character varying(20) NOT NULL,
"curriculum_id" integer NOT NULL,
"status" character varying(20) NOT NULL DEFAULT 'Not Started'::character varying,
"last_watched_at" timestamp with time zone,
"completed_at" timestamp with time zone,
"repetition_count" integer,
"execution_speed_fps" numeric(5,2));
ALTER TABLE public."lms_progress" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."achievements" ("id" integer NOT NULL DEFAULT nextval('achievements_id_seq'::regclass),
"student_id" character varying(20) NOT NULL,
"event_name" character varying(255) NOT NULL,
"date" date NOT NULL,
"category" character varying(100) NOT NULL,
"division" character varying(100) NOT NULL,
"medal_rank" character varying(50) NOT NULL,
"notes" text,
"created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
"age_division" text,
"belt_division" text);
ALTER TABLE public."achievements" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."members" ("id" uuid NOT NULL,
"khmer_name" text,
"english_name" text,
"gender" text,
"dob" date,
"phone" text,
"emergency_contact_name" text,
"emergency_contact_phone" text,
"emergency_contact_relation" text,
"medical_notes" text,
"allergies" text,
"joined_date" date NOT NULL DEFAULT CURRENT_DATE,
"created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
"updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
"profile_picture_path" text,
"nationality" character varying(255));
ALTER TABLE public."members" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."students" ("id" character varying(20) NOT NULL,
"profile_id" uuid,
"khmer_name" character varying(150) NOT NULL,
"english_name" character varying(150) NOT NULL,
"gender" character varying(10) NOT NULL,
"dob" date NOT NULL,
"email" citext,
"phone" character varying(50),
"nationality" character varying(50) DEFAULT 'Cambodian'::character varying,
"registration_date" date NOT NULL DEFAULT CURRENT_DATE,
"scholarship_id" integer NOT NULL DEFAULT 1,
"profile_picture_path" text,
"esign_path" text,
"height_cm" numeric(5,2),
"weight_kg" numeric(5,2),
"belt_id" integer,
"current_belt" character varying(30) NOT NULL DEFAULT 'White'::character varying,
"student_status" character varying(20) NOT NULL DEFAULT 'Inactive'::character varying,
"emergency_contact_name" character varying(150),
"emergency_contact_phone" character varying(50),
"emergency_contact_relation" character varying(50),
"medical_notes" text,
"allergies" text,
"created_at" timestamp with time zone NOT NULL DEFAULT now(),
"updated_at" timestamp with time zone NOT NULL DEFAULT now(),
"deleted_at" timestamp with time zone,
"home_branch_id" integer NOT NULL DEFAULT 1,
"kukkiwon_id" character varying(255),
"notes" text,
"status_reason" text,
"status_changed_at" timestamp with time zone DEFAULT now(),
"pause_end_date" date);
ALTER TABLE public."students" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."member_addresses" ("address_id" integer NOT NULL DEFAULT nextval('member_addresses_address_id_seq'::regclass),
"member_id" uuid NOT NULL,
"address_line1" character varying(100) NOT NULL,
"address_line2" character varying(100),
"district_commune" character varying(50) NOT NULL,
"state_province_city" character varying(50) NOT NULL,
"postal_code" character varying(20) NOT NULL,
"country" character varying(50) DEFAULT 'Cambodia'::character varying,
"is_primary" boolean DEFAULT false,
"created_at" timestamp without time zone DEFAULT now(),
"updated_at" timestamp without time zone DEFAULT now());
ALTER TABLE public."member_addresses" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."student_addresses" ("address_id" integer NOT NULL DEFAULT nextval('student_addresses_address_id_seq'::regclass),
"student_id" character varying NOT NULL,
"address_line1" character varying(100) NOT NULL,
"address_line2" character varying(100),
"district_commune" character varying(50) NOT NULL,
"state_province_city" character varying(50) NOT NULL,
"postal_code" character varying(20) NOT NULL,
"country" character varying(50) DEFAULT 'Cambodia'::character varying,
"is_primary" boolean DEFAULT false,
"created_at" timestamp without time zone DEFAULT now(),
"updated_at" timestamp without time zone DEFAULT now());
ALTER TABLE public."student_addresses" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."student_training_plans" ("id" uuid NOT NULL DEFAULT gen_random_uuid(),
"student_id" character varying(50) NOT NULL,
"template_id" uuid,
"assigned_by" uuid,
"customized_structure" jsonb,
"is_active" boolean DEFAULT true,
"created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()));
ALTER TABLE public."student_training_plans" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."user_permissions" ("user_id" uuid NOT NULL,
"permission_key" character varying(100) NOT NULL,
"is_granted" boolean NOT NULL DEFAULT true,
"updated_at" timestamp with time zone NOT NULL DEFAULT now(),
"updated_by" uuid);
ALTER TABLE public."user_permissions" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."workout_templates" ("id" uuid NOT NULL DEFAULT gen_random_uuid(),
"title" character varying(150) NOT NULL,
"description" text,
"difficulty" character varying(20) NOT NULL DEFAULT 'Intermediate'::character varying,
"duration_mins" integer DEFAULT 15,
"creator_name" character varying(100) NOT NULL DEFAULT 'Coach'::character varying,
"structure" jsonb NOT NULL,
"created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()));
ALTER TABLE public."workout_templates" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."student_physical_evaluations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(),
"student_id" character varying(50) NOT NULL,
"skill_name" character varying(150) NOT NULL,
"belt_level" character varying(50) NOT NULL,
"grade" character varying(20) NOT NULL DEFAULT 'Unrated'::character varying,
"evaluated_by" uuid,
"updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()));
ALTER TABLE public."student_physical_evaluations" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."library_assets" ("id" integer NOT NULL DEFAULT nextval('library_assets_id_seq'::regclass),
"title" character varying(150) NOT NULL,
"description" text,
"library_type" library_type_enum NOT NULL,
"tkd_category" taekwondo_category_enum,
"fitness_category" fitness_category_enum,
"target_level" character varying(50) NOT NULL DEFAULT 'All'::character varying,
"video_url" character varying(255),
"created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
"difficulty" character varying(20) DEFAULT 'Beginner'::character varying,
"reps_sets" character varying(100),
"focus_zones" text[] DEFAULT '{}'::text[],
"instructions" text[] DEFAULT '{}'::text[],
"thumbnail_url" character varying(255));
ALTER TABLE public."library_assets" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."staff_dan_history" ("id" uuid NOT NULL DEFAULT gen_random_uuid(),
"user_id" uuid NOT NULL,
"dan_level" integer NOT NULL,
"issue_date" date NOT NULL,
"certificate_no" character varying(50),
"certificate_url" text,
"examiner_name" character varying(100),
"location" character varying(150) DEFAULT 'Infinity Taekwondo Academy'::character varying,
"notes" text,
"created_at" timestamp with time zone NOT NULL DEFAULT now(),
"updated_at" timestamp with time zone NOT NULL DEFAULT now());
ALTER TABLE public."staff_dan_history" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."partners" ("id" uuid NOT NULL DEFAULT gen_random_uuid(),
"name" text NOT NULL,
"brand_name" text,
"logo_url" text,
"partner_type" text NOT NULL,
"status" text NOT NULL DEFAULT 'active'::text,
"description" text,
"founder_name" text,
"founder_contact" text,
"contact_person" text,
"contact_role" text,
"email" text,
"phone" text,
"telegram_username" text,
"telegram_url" text,
"secondary_contacts" jsonb DEFAULT '[]'::jsonb,
"mou_signed_date" date,
"mou_expiry_date" date,
"document_url" text,
"country" text DEFAULT 'Cambodia'::text,
"city" text DEFAULT 'Phnom Penh'::text,
"website" text,
"tags" text[] DEFAULT '{}'::text[],
"internal_notes" text,
"created_at" timestamp with time zone DEFAULT now(),
"updated_at" timestamp with time zone DEFAULT now(),
"collaboration_scope" text,
"benefits_summary" text,
"contact_name" character varying(150),
"telegram_link" text,
"secondary_contact_name" character varying(150),
"secondary_contact_phone" character varying(100),
"secondary_contact_telegram" character varying(100),
"website_url" text,
"address" text,
"contract_document_url" text,
"notes" text,
"created_by" uuid);
ALTER TABLE public."partners" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."academy_profile" ("id" character varying(50) NOT NULL DEFAULT 'default'::character varying,
"academy_name" character varying(255) NOT NULL DEFAULT 'Infinity Taekwondo Academy'::character varying,
"legal_name" character varying(255) DEFAULT 'Infinity Martial Arts Club Co., Ltd.'::character varying,
"tagline" character varying(255) DEFAULT 'Discipline, Honor, Excellence · Martial Arts & Character Building'::character varying,
"logo_url" text DEFAULT '/logo.svg'::text,
"website_url" text DEFAULT 'https://infinitytkd.com'::text,
"portal_url" text DEFAULT 'https://infinitytkd.com/lms'::text,
"tax_id" character varying(100) DEFAULT ''::character varying,
"contact_phone" character varying(50) DEFAULT '+855 12 888 999'::character varying,
"support_email" character varying(255) DEFAULT 'contact@infinitytkd.com'::character varying,
"primary_address" text DEFAULT 'Street 2004, Sen Sok, Phnom Penh, Cambodia'::text,
"default_branch_id" integer,
"currency" character varying(10) NOT NULL DEFAULT 'USD'::character varying,
"currency_symbol" character varying(10) NOT NULL DEFAULT '$'::character varying,
"tuition_grace_period_days" integer NOT NULL DEFAULT 5,
"tax_rate_percentage" numeric(5,2) NOT NULL DEFAULT 0.00,
"date_format" character varying(20) NOT NULL DEFAULT 'YYYY-MM-DD'::character varying,
"default_class_duration_mins" integer NOT NULL DEFAULT 60,
"exam_passing_score" integer NOT NULL DEFAULT 70,
"min_attendance_exam_pct" integer NOT NULL DEFAULT 80,
"allow_student_portal_login" boolean NOT NULL DEFAULT true,
"enable_audio_chimes" boolean NOT NULL DEFAULT true,
"facebook_url" text DEFAULT 'https://facebook.com/infinitytaekwondo'::text,
"telegram_channel" text DEFAULT 'https://t.me/infinitytkd'::text,
"instagram_url" text DEFAULT 'https://instagram.com/infinitytaekwondo'::text,
"updated_by" uuid,
"created_at" timestamp with time zone NOT NULL DEFAULT now(),
"updated_at" timestamp with time zone NOT NULL DEFAULT now());
ALTER TABLE public."academy_profile" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."product_categories" ("id" integer NOT NULL DEFAULT nextval('product_categories_id_seq'::regclass),
"name" character varying(50) NOT NULL,
"description" text,
"display_order" integer NOT NULL DEFAULT 0,
"created_at" timestamp with time zone DEFAULT now());
ALTER TABLE public."product_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."portal_rate_limits" ADD CONSTRAINT "portal_rate_limits_pkey" PRIMARY KEY (key);
ALTER TABLE public."library_asset_muscles" ADD CONSTRAINT "library_asset_muscles_pkey" PRIMARY KEY (asset_id, muscle_id);
ALTER TABLE public."library_asset_muscles" ADD CONSTRAINT "library_asset_muscles_role_check" CHECK (((role)::text = ANY ((ARRAY['Primary'::character varying, 'Secondary'::character varying])::text[])));
ALTER TABLE public."muscles" ADD CONSTRAINT "muscles_name_key" UNIQUE (name);
ALTER TABLE public."muscles" ADD CONSTRAINT "muscles_pkey" PRIMARY KEY (id);
ALTER TABLE public."biomechanical_skill_linkage" ADD CONSTRAINT "biomechanical_skill_linkage_pkey" PRIMARY KEY (skill_name, muscle_id);
ALTER TABLE public."profiles" ADD CONSTRAINT "chk_role_domain" CHECK (((role)::text = ANY ((ARRAY['Root'::character varying, 'Admin'::character varying, 'Head Coach'::character varying, 'Coach'::character varying, 'Assistant Coach'::character varying, 'Student'::character varying])::text[])));
ALTER TABLE public."profiles" ADD CONSTRAINT "chk_username_syntax" CHECK ((username ~* '^[a-z0-9_]{3,30}$'::citext));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_current_dan_check" CHECK (((current_dan >= 1) AND (current_dan <= 9)));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_email_key" UNIQUE (email);
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_role_check" CHECK (((role)::text = ANY (ARRAY[('Root'::character varying)::text, ('Super Root'::character varying)::text, ('Admin'::character varying)::text, ('Head Coach'::character varying)::text, ('Coach'::character varying)::text, ('Assistant Coach'::character varying)::text, ('Student'::character varying)::text])));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_username_key" UNIQUE (username);
ALTER TABLE public."class_sessions" ADD CONSTRAINT "chk_day_of_week" CHECK (((day_of_week)::text = ANY ((ARRAY['Monday'::character varying, 'Tuesday'::character varying, 'Wednesday'::character varying, 'Thursday'::character varying, 'Friday'::character varying, 'Saturday'::character varying, 'Sunday'::character varying])::text[])));
ALTER TABLE public."class_sessions" ADD CONSTRAINT "class_sessions_pkey" PRIMARY KEY (id);
ALTER TABLE public."class_enrollments" ADD CONSTRAINT "class_enrollments_pkey" PRIMARY KEY (id);
ALTER TABLE public."class_enrollments" ADD CONSTRAINT "unique_student_class_enrollment" UNIQUE (student_id, class_id);
ALTER TABLE public."payments" ADD CONSTRAINT "chk_fiscal_month" CHECK (((for_month)::text = ANY ((ARRAY['Jan'::character varying, 'Feb'::character varying, 'Mar'::character varying, 'Apr'::character varying, 'May'::character varying, 'Jun'::character varying, 'Jul'::character varying, 'Aug'::character varying, 'Sep'::character varying, 'Oct'::character varying, 'Nov'::character varying, 'Dec'::character varying])::text[])));
ALTER TABLE public."payments" ADD CONSTRAINT "chk_fiscal_year" CHECK (((year >= 2020) AND (year <= 2100)));
ALTER TABLE public."payments" ADD CONSTRAINT "chk_payment_status" CHECK (((status)::text = ANY ((ARRAY['Paid'::character varying, 'Unpaid'::character varying, 'Pending'::character varying])::text[])));
ALTER TABLE public."payments" ADD CONSTRAINT "chk_positive_value" CHECK ((amount_usd >= 0.00));
ALTER TABLE public."payments" ADD CONSTRAINT "payments_pkey" PRIMARY KEY (id);
ALTER TABLE public."payments" ADD CONSTRAINT "unique_monthly_invoice" UNIQUE (student_id, year, for_month);
ALTER TABLE public."student_body_compositions" ADD CONSTRAINT "student_body_compositions_pkey" PRIMARY KEY (id);
ALTER TABLE public."student_body_compositions" ADD CONSTRAINT "unique_student_measurement_day" UNIQUE (student_id, recorded_date);
ALTER TABLE public."audit_logs" ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY (id);
ALTER TABLE public."attendance" ADD CONSTRAINT "attendance_pkey" PRIMARY KEY (id);
ALTER TABLE public."attendance" ADD CONSTRAINT "chk_attendance_status" CHECK (((status)::text = ANY ((ARRAY['Present'::character varying, 'Absent'::character varying, 'Late'::character varying])::text[])));
ALTER TABLE public."attendance" ADD CONSTRAINT "unique_student_per_day" UNIQUE (student_id, date);
ALTER TABLE public."scholarships" ADD CONSTRAINT "chk_discount_bounds" CHECK (((discount_percentage >= 0.00) AND (discount_percentage <= 100.00)));
ALTER TABLE public."scholarships" ADD CONSTRAINT "scholarships_pkey" PRIMARY KEY (id);
ALTER TABLE public."scholarships" ADD CONSTRAINT "scholarships_type_name_key" UNIQUE (type_name);
ALTER TABLE public."pos_order_items" ADD CONSTRAINT "pos_order_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."pos_order_items" ADD CONSTRAINT "pos_order_items_quantity_check" CHECK ((quantity > 0));
ALTER TABLE public."pos_order_items" ADD CONSTRAINT "pos_order_items_total_price_usd_check" CHECK ((total_price_usd >= (0)::numeric));
ALTER TABLE public."pos_order_items" ADD CONSTRAINT "pos_order_items_unit_price_usd_check" CHECK ((unit_price_usd >= (0)::numeric));
ALTER TABLE public."inventory_logs" ADD CONSTRAINT "inventory_logs_pkey" PRIMARY KEY (id);
ALTER TABLE public."inventory_logs" ADD CONSTRAINT "inventory_logs_reason_check" CHECK (((reason)::text = ANY ((ARRAY['POS_SALE'::character varying, 'ONLINE_ORDER'::character varying, 'RESTOCK'::character varying, 'ORDER_CANCELLED_RESTORE'::character varying, 'DAMAGE_WRITE_OFF'::character varying, 'AUDIT_ADJUSTMENT'::character varying])::text[])));
ALTER TABLE public."products" ADD CONSTRAINT "products_cost_usd_check" CHECK ((cost_usd >= (0)::numeric));
ALTER TABLE public."products" ADD CONSTRAINT "products_pkey" PRIMARY KEY (id);
ALTER TABLE public."products" ADD CONSTRAINT "products_price_usd_check" CHECK ((price_usd >= (0)::numeric));
ALTER TABLE public."products" ADD CONSTRAINT "products_sku_key" UNIQUE (sku);
ALTER TABLE public."products" ADD CONSTRAINT "products_stock_check" CHECK ((stock >= 0));
ALTER TABLE public."pos_orders" ADD CONSTRAINT "pos_orders_discount_percentage_check" CHECK (((discount_percentage >= (0)::numeric) AND (discount_percentage <= (100)::numeric)));
ALTER TABLE public."pos_orders" ADD CONSTRAINT "pos_orders_discount_usd_check" CHECK ((discount_usd >= (0)::numeric));
ALTER TABLE public."pos_orders" ADD CONSTRAINT "pos_orders_order_channel_check" CHECK (((order_channel)::text = ANY ((ARRAY['STUDENT_PORTAL'::character varying, 'ADMIN_POS'::character varying])::text[])));
ALTER TABLE public."pos_orders" ADD CONSTRAINT "pos_orders_order_number_key" UNIQUE (order_number);
ALTER TABLE public."pos_orders" ADD CONSTRAINT "pos_orders_order_status_check" CHECK (((order_status)::text = ANY ((ARRAY['PENDING_CONFIRMATION'::character varying, 'CONFIRMED'::character varying, 'PREPARING'::character varying, 'READY_FOR_PICKUP'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying])::text[])));
ALTER TABLE public."pos_orders" ADD CONSTRAINT "pos_orders_payment_method_check" CHECK (((payment_method)::text = ANY ((ARRAY['ABA Bank KHQR'::character varying, 'Cash'::character varying, 'Credit Card'::character varying, 'Bank Transfer'::character varying, 'Pay at Counter'::character varying])::text[])));
ALTER TABLE public."pos_orders" ADD CONSTRAINT "pos_orders_payment_status_check" CHECK (((payment_status)::text = ANY ((ARRAY['PENDING'::character varying, 'PAID'::character varying, 'REFUNDED'::character varying, 'VOID'::character varying])::text[])));
ALTER TABLE public."pos_orders" ADD CONSTRAINT "pos_orders_pkey" PRIMARY KEY (id);
ALTER TABLE public."pos_orders" ADD CONSTRAINT "pos_orders_subtotal_usd_check" CHECK ((subtotal_usd >= (0)::numeric));
ALTER TABLE public."pos_orders" ADD CONSTRAINT "pos_orders_total_usd_check" CHECK ((total_usd >= (0)::numeric));
ALTER TABLE public."curriculum" ADD CONSTRAINT "chk_curriculum_category" CHECK (((category)::text = ANY ((ARRAY['Recognized Poomsae'::character varying, 'Freestyle Poomsae'::character varying, 'Demonstration'::character varying, 'Tricking'::character varying, 'Kicking Basics'::character varying, 'Conditioning'::character varying])::text[])));
ALTER TABLE public."curriculum" ADD CONSTRAINT "curriculum_pkey" PRIMARY KEY (id);
ALTER TABLE public."belt_techniques" ADD CONSTRAINT "belt_techniques_belt_level_technique_name_key" UNIQUE (belt_level, technique_name);
ALTER TABLE public."belt_techniques" ADD CONSTRAINT "belt_techniques_pkey" PRIMARY KEY (id);
ALTER TABLE public."branches" ADD CONSTRAINT "branches_branch_name_key" UNIQUE (branch_name);
ALTER TABLE public."branches" ADD CONSTRAINT "branches_pkey" PRIMARY KEY (id);
ALTER TABLE public."product_variants" ADD CONSTRAINT "product_variants_pkey" PRIMARY KEY (id);
ALTER TABLE public."product_variants" ADD CONSTRAINT "product_variants_price_override_check" CHECK (((price_override IS NULL) OR (price_override >= (0)::numeric)));
ALTER TABLE public."product_variants" ADD CONSTRAINT "product_variants_sku_key" UNIQUE (sku);
ALTER TABLE public."product_variants" ADD CONSTRAINT "product_variants_stock_check" CHECK ((stock >= 0));
ALTER TABLE public."role_permissions" ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY (role, permission_key);
ALTER TABLE public."belts" ADD CONSTRAINT "belts_belt_name_key" UNIQUE (belt_name);
ALTER TABLE public."belts" ADD CONSTRAINT "belts_belt_order_key" UNIQUE (belt_order);
ALTER TABLE public."belts" ADD CONSTRAINT "belts_pkey" PRIMARY KEY (id);
ALTER TABLE public."belt_histories" ADD CONSTRAINT "belt_histories_certificate_id_key" UNIQUE (certificate_id);
ALTER TABLE public."belt_histories" ADD CONSTRAINT "belt_histories_pkey" PRIMARY KEY (id);
ALTER TABLE public."lms_progress" ADD CONSTRAINT "chk_progress_status" CHECK (((status)::text = ANY ((ARRAY['Not Started'::character varying, 'In Progress'::character varying, 'Completed'::character varying])::text[])));
ALTER TABLE public."lms_progress" ADD CONSTRAINT "lms_progress_pkey" PRIMARY KEY (id);
ALTER TABLE public."lms_progress" ADD CONSTRAINT "lms_progress_student_curriculum_unique" UNIQUE (student_id, curriculum_id);
ALTER TABLE public."lms_progress" ADD CONSTRAINT "unique_student_curriculum" UNIQUE (student_id, curriculum_id);
ALTER TABLE public."achievements" ADD CONSTRAINT "achievements_pkey" PRIMARY KEY (id);
ALTER TABLE public."achievements" ADD CONSTRAINT "chk_medal_types" CHECK (((medal_rank)::text = ANY ((ARRAY['Gold'::character varying, 'Silver'::character varying, 'Bronze'::character varying, 'Participation'::character varying, 'Fourth Place'::character varying])::text[])));
ALTER TABLE public."members" ADD CONSTRAINT "members_gender_check" CHECK ((gender = ANY (ARRAY['Male'::text, 'Female'::text])));
ALTER TABLE public."members" ADD CONSTRAINT "members_pkey" PRIMARY KEY (id);
ALTER TABLE public."students" ADD CONSTRAINT "chk_student_gender" CHECK (((gender)::text = ANY ((ARRAY['Male'::character varying, 'Female'::character varying])::text[])));
ALTER TABLE public."students" ADD CONSTRAINT "chk_student_height" CHECK (((height_cm IS NULL) OR (height_cm > (0)::numeric)));
ALTER TABLE public."students" ADD CONSTRAINT "chk_student_id_format" CHECK (((id)::text ~* '^STU-[MF]-[0-9]+$'::text));
ALTER TABLE public."students" ADD CONSTRAINT "chk_student_status" CHECK (((student_status)::text = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying, 'Suspended'::character varying, 'Graduated'::character varying])::text[])));
ALTER TABLE public."students" ADD CONSTRAINT "chk_student_weight" CHECK (((weight_kg IS NULL) OR (weight_kg > (0)::numeric)));
ALTER TABLE public."students" ADD CONSTRAINT "students_pkey" PRIMARY KEY (id);
ALTER TABLE public."students" ADD CONSTRAINT "students_profile_id_key" UNIQUE (profile_id);
ALTER TABLE public."students" ADD CONSTRAINT "students_student_status_check" CHECK (((student_status)::text = ANY (ARRAY[('Active'::character varying)::text, ('Paused'::character varying)::text, ('Inactive'::character varying)::text, ('Suspended'::character varying)::text, ('Graduated'::character varying)::text])));
ALTER TABLE public."member_addresses" ADD CONSTRAINT "member_addresses_pkey" PRIMARY KEY (address_id);
ALTER TABLE public."student_addresses" ADD CONSTRAINT "student_addresses_pkey" PRIMARY KEY (address_id);
ALTER TABLE public."student_training_plans" ADD CONSTRAINT "student_training_plans_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_permissions" ADD CONSTRAINT "user_permissions_pkey" PRIMARY KEY (user_id, permission_key);
ALTER TABLE public."workout_templates" ADD CONSTRAINT "workout_templates_pkey" PRIMARY KEY (id);
ALTER TABLE public."student_physical_evaluations" ADD CONSTRAINT "student_physical_evaluations_pkey" PRIMARY KEY (id);
ALTER TABLE public."student_physical_evaluations" ADD CONSTRAINT "unique_student_skill" UNIQUE (student_id, skill_name);
ALTER TABLE public."library_assets" ADD CONSTRAINT "library_assets_difficulty_check" CHECK (((difficulty)::text = ANY ((ARRAY['Beginner'::character varying, 'Intermediate'::character varying, 'Advanced'::character varying])::text[])));
ALTER TABLE public."library_assets" ADD CONSTRAINT "library_assets_pkey" PRIMARY KEY (id);
ALTER TABLE public."staff_dan_history" ADD CONSTRAINT "staff_dan_history_dan_level_check" CHECK (((dan_level >= 1) AND (dan_level <= 9)));
ALTER TABLE public."staff_dan_history" ADD CONSTRAINT "staff_dan_history_pkey" PRIMARY KEY (id);
ALTER TABLE public."staff_dan_history" ADD CONSTRAINT "uq_staff_dan_user_level" UNIQUE (user_id, dan_level);
ALTER TABLE public."partners" ADD CONSTRAINT "partners_pkey" PRIMARY KEY (id);
ALTER TABLE public."academy_profile" ADD CONSTRAINT "academy_profile_pkey" PRIMARY KEY (id);
ALTER TABLE public."product_categories" ADD CONSTRAINT "product_categories_name_key" UNIQUE (name);
ALTER TABLE public."product_categories" ADD CONSTRAINT "product_categories_pkey" PRIMARY KEY (id);
ALTER TABLE public."library_asset_muscles" ADD CONSTRAINT "library_asset_muscles_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES library_assets(id) ON DELETE CASCADE;
ALTER TABLE public."library_asset_muscles" ADD CONSTRAINT "library_asset_muscles_muscle_id_fkey" FOREIGN KEY (muscle_id) REFERENCES muscles(id) ON DELETE CASCADE;
ALTER TABLE public."biomechanical_skill_linkage" ADD CONSTRAINT "biomechanical_skill_linkage_muscle_id_fkey" FOREIGN KEY (muscle_id) REFERENCES muscles(id) ON DELETE CASCADE;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;
ALTER TABLE public."class_sessions" ADD CONSTRAINT "class_sessions_branch_id_fkey" FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE public."class_sessions" ADD CONSTRAINT "class_sessions_coach_id_fkey" FOREIGN KEY (coach_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public."class_sessions" ADD CONSTRAINT "class_sessions_head_coach_id_fkey" FOREIGN KEY (head_coach_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public."class_enrollments" ADD CONSTRAINT "class_enrollments_class_id_fkey" FOREIGN KEY (class_id) REFERENCES class_sessions(id) ON DELETE CASCADE;
ALTER TABLE public."class_enrollments" ADD CONSTRAINT "class_enrollments_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public."payments" ADD CONSTRAINT "payments_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;
ALTER TABLE public."student_body_compositions" ADD CONSTRAINT "student_body_compositions_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES profiles(id);
ALTER TABLE public."student_body_compositions" ADD CONSTRAINT "student_body_compositions_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public."attendance" ADD CONSTRAINT "attendance_marked_by_fkey" FOREIGN KEY (marked_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public."attendance" ADD CONSTRAINT "attendance_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public."pos_order_items" ADD CONSTRAINT "pos_order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES pos_orders(id) ON DELETE CASCADE;
ALTER TABLE public."pos_order_items" ADD CONSTRAINT "pos_order_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE public."pos_order_items" ADD CONSTRAINT "pos_order_items_variant_id_fkey" FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;
ALTER TABLE public."inventory_logs" ADD CONSTRAINT "inventory_logs_logged_by_fkey" FOREIGN KEY (logged_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public."inventory_logs" ADD CONSTRAINT "inventory_logs_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE public."inventory_logs" ADD CONSTRAINT "inventory_logs_variant_id_fkey" FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;
ALTER TABLE public."products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL;
ALTER TABLE public."pos_orders" ADD CONSTRAINT "pos_orders_branch_id_fkey" FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE public."pos_orders" ADD CONSTRAINT "pos_orders_confirmed_by_fkey" FOREIGN KEY (confirmed_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public."pos_orders" ADD CONSTRAINT "pos_orders_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public."pos_orders" ADD CONSTRAINT "pos_orders_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;
ALTER TABLE public."belt_techniques" ADD CONSTRAINT "belt_techniques_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public."branches" ADD CONSTRAINT "branches_manager_id_fkey" FOREIGN KEY (manager_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public."product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE public."role_permissions" ADD CONSTRAINT "role_permissions_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."belt_histories" ADD CONSTRAINT "belt_histories_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public."lms_progress" ADD CONSTRAINT "lms_progress_curriculum_id_fkey" FOREIGN KEY (curriculum_id) REFERENCES curriculum(id) ON DELETE CASCADE;
ALTER TABLE public."lms_progress" ADD CONSTRAINT "lms_progress_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public."achievements" ADD CONSTRAINT "achievements_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public."members" ADD CONSTRAINT "members_id_fkey" FOREIGN KEY (id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public."students" ADD CONSTRAINT "students_belt_id_fkey" FOREIGN KEY (belt_id) REFERENCES belts(id);
ALTER TABLE public."students" ADD CONSTRAINT "students_home_branch_id_fkey" FOREIGN KEY (home_branch_id) REFERENCES branches(id);
ALTER TABLE public."students" ADD CONSTRAINT "students_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public."students" ADD CONSTRAINT "students_scholarship_id_fkey" FOREIGN KEY (scholarship_id) REFERENCES scholarships(id);
ALTER TABLE public."member_addresses" ADD CONSTRAINT "member_addresses_member_id_fkey" FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;
ALTER TABLE public."student_addresses" ADD CONSTRAINT "student_addresses_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public."student_training_plans" ADD CONSTRAINT "student_training_plans_assigned_by_fkey" FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."student_training_plans" ADD CONSTRAINT "student_training_plans_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public."student_training_plans" ADD CONSTRAINT "student_training_plans_template_id_fkey" FOREIGN KEY (template_id) REFERENCES workout_templates(id) ON DELETE CASCADE;
ALTER TABLE public."user_permissions" ADD CONSTRAINT "user_permissions_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."student_physical_evaluations" ADD CONSTRAINT "student_physical_evaluations_evaluated_by_fkey" FOREIGN KEY (evaluated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."student_physical_evaluations" ADD CONSTRAINT "student_physical_evaluations_student_id_fkey" FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public."staff_dan_history" ADD CONSTRAINT "staff_dan_history_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public."partners" ADD CONSTRAINT "partners_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."academy_profile" ADD CONSTRAINT "academy_profile_default_branch_id_fkey" FOREIGN KEY (default_branch_id) REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE public."academy_profile" ADD CONSTRAINT "academy_profile_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.sync_profile_to_student()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NEW.student_id IS NOT NULL AND (OLD.student_id IS NULL OR OLD.student_id != NEW.student_id) THEN
        UPDATE public.students 
        SET profile_id = NEW.id 
        WHERE id = NEW.student_id AND (profile_id IS NULL OR profile_id != NEW.id);
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_student_to_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NEW.profile_id IS NOT NULL AND (OLD.profile_id IS NULL OR OLD.profile_id != NEW.profile_id) THEN
        UPDATE public.profiles 
        SET student_id = NEW.id 
        WHERE id = NEW.profile_id AND (student_id IS NULL OR student_id != NEW.id);
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are strictly prohibited.';
END;
$function$;

CREATE OR REPLACE FUNCTION public.auth_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
    SELECT COALESCE(
        auth.jwt() -> 'app_metadata' ->> 'role',
        (SELECT role FROM public.profiles WHERE id = auth.uid())
    );
$function$;

CREATE OR REPLACE FUNCTION public.sync_profile_role_to_auth_app_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.auth_is_active()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
    SELECT COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'is_active')::boolean,
        (SELECT is_active FROM public.profiles WHERE id = auth.uid()),
        true
    );
$function$;

CREATE OR REPLACE FUNCTION public.sync_student_current_belt()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE public.students
    SET current_belt = NEW.belt_level
    WHERE id = NEW.student_id;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_profile_to_members()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- If the profile is assigned a staff role, ensure they have a record in members
  IF NEW.role IN ('Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach') THEN
    INSERT INTO public.members (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
  
  -- If they are demoted to Student, remove them from members (since they belong in students)
  ELSIF NEW.role = 'Student' THEN
    DELETE FROM public.members WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_current_student(sid text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.is_current_student(sid character varying)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.fn_sync_student_profile_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
    matched_profile_id UUID;
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF NEW.profile_id IS NOT NULL THEN
        UPDATE public.profiles
        SET student_id = NEW.id
        WHERE id = NEW.profile_id
          AND (student_id IS NULL OR student_id <> NEW.id);
    ELSE
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
$function$;

CREATE OR REPLACE FUNCTION public.handle_academy_profile_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_sync_profile_student_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
    matched_student_id VARCHAR(50);
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF NEW.role = 'Student' THEN
        IF NEW.student_id IS NOT NULL AND NEW.student_id <> '' THEN
            UPDATE public.students
            SET profile_id = NEW.id
            WHERE LOWER(id) = LOWER(NEW.student_id)
              AND (profile_id IS NULL OR profile_id <> NEW.id);
        ELSE
            SELECT id INTO matched_student_id
            FROM public.students
            WHERE (
                REPLACE(REPLACE(LOWER(id), '-', ''), '_', '') = REPLACE(REPLACE(LOWER(NEW.username), '-', ''), '_', '')
                OR (NEW.email IS NOT NULL AND NEW.email <> '' AND LOWER(email) = LOWER(NEW.email))
            )
            ORDER BY CASE WHEN REPLACE(REPLACE(LOWER(id), '-', ''), '_', '') = REPLACE(REPLACE(LOWER(NEW.username), '-', ''), '_', '') THEN 1 ELSE 2 END
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
$function$;

CREATE OR REPLACE FUNCTION public.trg_sync_staff_latest_dan()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    target_user_id UUID;
    highest_record RECORD;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_user_id := OLD.user_id;
    ELSE
        target_user_id := NEW.user_id;
    END IF;

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
        UPDATE public.profiles
        SET 
            current_dan = NULL,
            dan_issue_date = NULL
        WHERE id = target_user_id;
    END IF;

    RETURN NULL;
END;
$function$;

CREATE TRIGGER trg_update_student_belt AFTER INSERT ON public.belt_histories FOR EACH ROW EXECUTE FUNCTION sync_student_current_belt();
CREATE TRIGGER set_members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_sync_profile_to_members AFTER INSERT OR UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION sync_profile_to_members();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION handle_updated_at_timestamp();
CREATE TRIGGER trg_pos_orders_updated_at BEFORE UPDATE ON public.pos_orders FOR EACH ROW EXECUTE FUNCTION handle_updated_at_timestamp();
CREATE TRIGGER trg_sync_profile_student_link AFTER INSERT OR UPDATE OF student_id, username, email, role ON public.profiles FOR EACH ROW EXECUTE FUNCTION fn_sync_profile_student_link();
CREATE TRIGGER trg_sync_student_profile_link AFTER INSERT OR UPDATE OF profile_id, email ON public.students FOR EACH ROW EXECUTE FUNCTION fn_sync_student_profile_link();
CREATE TRIGGER trg_academy_profile_updated_at BEFORE UPDATE ON public.academy_profile FOR EACH ROW EXECUTE FUNCTION handle_academy_profile_updated_at();
CREATE TRIGGER trg_sync_profile_role_to_auth_app_metadata AFTER INSERT OR UPDATE OF role, is_active, student_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION sync_profile_role_to_auth_app_metadata();
CREATE TRIGGER trg_prevent_audit_log_mutation BEFORE DELETE OR UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
CREATE TRIGGER trg_staff_dan_sync AFTER INSERT OR DELETE OR UPDATE ON public.staff_dan_history FOR EACH ROW EXECUTE FUNCTION trg_sync_staff_latest_dan();
CREATE VIEW public."v_student_test_eligibility" AS  SELECT s.id AS student_id,
    s.khmer_name,
    s.english_name,
    s.current_belt,
    COALESCE(max(bh.promotion_date), s.registration_date) AS last_rank_date,
    EXTRACT(month FROM age(now(), COALESCE(max(bh.promotion_date), s.registration_date)::timestamp with time zone)) AS months_at_belt
   FROM students s
     LEFT JOIN belt_histories bh ON s.id::text = bh.student_id::text
  GROUP BY s.id, s.khmer_name, s.english_name, s.current_belt, s.registration_date;
CREATE VIEW public."view_student_muscular_heatmap" AS  SELECT vp.student_id,
    am.muscle_id,
    sum(
        CASE
            WHEN am.role::text = 'Primary'::text THEN 1.0
            ELSE 0.5
        END) AS load_intensity
   FROM lms_progress vp
     JOIN library_asset_muscles am ON vp.curriculum_id = am.asset_id
  WHERE vp.status::text = 'Completed'::text
  GROUP BY vp.student_id, am.muscle_id;
CREATE VIEW public."view_staff_dan_eligibility" AS  SELECT p.id AS user_id,
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
        CASE
            WHEN p.current_dan IS NULL THEN NULL::integer
            WHEN p.current_dan < 9 THEN p.current_dan + 1
            ELSE NULL::integer
        END AS next_dan,
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
        CASE
            WHEN p.current_dan IS NULL OR p.dan_issue_date IS NULL THEN NULL::date
            WHEN p.current_dan = 1 THEN (p.dan_issue_date + '1 year'::interval)::date
            WHEN p.current_dan = 2 THEN (p.dan_issue_date + '2 years'::interval)::date
            WHEN p.current_dan = 3 THEN (p.dan_issue_date + '3 years'::interval)::date
            WHEN p.current_dan = 4 THEN (p.dan_issue_date + '4 years'::interval)::date
            WHEN p.current_dan = 5 THEN (p.dan_issue_date + '5 years'::interval)::date
            WHEN p.current_dan = 6 THEN (p.dan_issue_date + '6 years'::interval)::date
            WHEN p.current_dan = 7 THEN (p.dan_issue_date + '8 years'::interval)::date
            WHEN p.current_dan = 8 THEN (p.dan_issue_date + '9 years'::interval)::date
            ELSE NULL::date
        END AS earliest_test_date,
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
        END AS min_age_required,
        CASE
            WHEN m.dob IS NOT NULL THEN date_part('year'::text, age(CURRENT_DATE::timestamp with time zone, m.dob::timestamp with time zone))::integer
            ELSE NULL::integer
        END AS staff_current_age,
        CASE
            WHEN p.current_dan IS NULL OR p.dan_issue_date IS NULL THEN 'NO_DAN_DATA'::text
            WHEN p.current_dan >= 9 THEN 'MAX_DAN'::text
            WHEN CURRENT_DATE <
            CASE
                WHEN p.current_dan = 1 THEN (p.dan_issue_date + '1 year'::interval)::date
                WHEN p.current_dan = 2 THEN (p.dan_issue_date + '2 years'::interval)::date
                WHEN p.current_dan = 3 THEN (p.dan_issue_date + '3 years'::interval)::date
                WHEN p.current_dan = 4 THEN (p.dan_issue_date + '4 years'::interval)::date
                WHEN p.current_dan = 5 THEN (p.dan_issue_date + '5 years'::interval)::date
                WHEN p.current_dan = 6 THEN (p.dan_issue_date + '6 years'::interval)::date
                WHEN p.current_dan = 7 THEN (p.dan_issue_date + '8 years'::interval)::date
                WHEN p.current_dan = 8 THEN (p.dan_issue_date + '9 years'::interval)::date
                ELSE CURRENT_DATE
            END THEN 'TIME_PENDING'::text
            WHEN m.dob IS NOT NULL AND date_part('year'::text, age(CURRENT_DATE::timestamp with time zone, m.dob::timestamp with time zone))::integer <
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
            END THEN 'AGE_RESTRICTED'::text
            ELSE 'ELIGIBLE_FOR_TEST'::text
        END AS eligibility_status
   FROM profiles p
     LEFT JOIN members m ON p.id = m.id
  WHERE p.role::text = ANY (ARRAY['Head Coach'::character varying, 'Coach'::character varying, 'Assistant Coach'::character varying, 'Admin'::character varying, 'Root'::character varying, 'Super Root'::character varying]::text[]);
CREATE VIEW public."v_pending_student_orders" AS  SELECT o.id AS order_id,
    o.order_number,
    o.created_at,
    o.student_id,
    s.english_name AS student_name,
    s.current_belt,
    s.phone AS student_phone,
    b.branch_name,
    o.total_usd,
    o.payment_method,
    o.payment_status,
    o.order_status,
    o.student_notes,
    count(i.id) AS total_items_count,
    COALESCE(jsonb_agg(jsonb_build_object('item_id', i.id, 'name', i.product_name, 'sku', i.sku, 'size', i.size, 'qty', i.quantity, 'unit_price', i.unit_price_usd, 'total_price', i.total_price_usd)), '[]'::jsonb) AS items
   FROM pos_orders o
     LEFT JOIN students s ON s.id::text = o.student_id::text
     LEFT JOIN branches b ON b.id = o.branch_id
     LEFT JOIN pos_order_items i ON i.order_id = o.id
  WHERE o.order_status::text = ANY (ARRAY['PENDING_CONFIRMATION'::character varying, 'CONFIRMED'::character varying, 'PREPARING'::character varying]::text[])
  GROUP BY o.id, s.english_name, s.current_belt, s.phone, b.branch_name;
CREATE VIEW public."v_pro_shop_low_stock" AS  SELECT p.id AS product_id,
    p.sku AS master_sku,
    p.name AS product_name,
    p.category_name,
    v.id AS variant_id,
    COALESCE(v.sku, p.sku) AS item_sku,
    v.size,
    COALESCE(v.stock, p.stock) AS current_stock,
    COALESCE(v.min_stock_threshold, p.min_stock_threshold) AS threshold,
        CASE
            WHEN COALESCE(v.stock, p.stock) = 0 THEN 'OUT_OF_STOCK'::text
            WHEN COALESCE(v.stock, p.stock) <= COALESCE(v.min_stock_threshold, p.min_stock_threshold) THEN 'LOW_STOCK'::text
            ELSE 'NORMAL'::text
        END AS stock_status
   FROM products p
     LEFT JOIN product_variants v ON v.product_id = p.id
  WHERE p.is_active = true AND (v.id IS NOT NULL AND v.stock <= v.min_stock_threshold OR v.id IS NULL AND p.stock <= p.min_stock_threshold)
  ORDER BY (COALESCE(v.stock, p.stock));
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated,service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated,service_role;

-- Actual sequence ownership, secondary indexes, functions and public policies.
ALTER SEQUENCE public."muscles_id_seq" OWNED BY public."muscles"."id";
ALTER SEQUENCE public."class_sessions_id_seq" OWNED BY public."class_sessions"."id";
ALTER SEQUENCE public."class_enrollments_id_seq" OWNED BY public."class_enrollments"."id";
ALTER SEQUENCE public."payments_id_seq" OWNED BY public."payments"."id";
ALTER SEQUENCE public."student_body_compositions_id_seq" OWNED BY public."student_body_compositions"."id";
ALTER SEQUENCE public."attendance_id_seq" OWNED BY public."attendance"."id";
ALTER SEQUENCE public."scholarships_id_seq" OWNED BY public."scholarships"."id";
ALTER SEQUENCE public."inventory_logs_id_seq" OWNED BY public."inventory_logs"."id";
ALTER SEQUENCE public."curriculum_id_seq" OWNED BY public."curriculum"."id";
ALTER SEQUENCE public."branches_id_seq" OWNED BY public."branches"."id";
ALTER SEQUENCE public."belts_id_seq" OWNED BY public."belts"."id";
ALTER SEQUENCE public."belt_histories_id_seq" OWNED BY public."belt_histories"."id";
ALTER SEQUENCE public."lms_progress_id_seq" OWNED BY public."lms_progress"."id";
ALTER SEQUENCE public."achievements_id_seq" OWNED BY public."achievements"."id";
ALTER SEQUENCE public."member_addresses_address_id_seq" OWNED BY public."member_addresses"."address_id";
ALTER SEQUENCE public."student_addresses_address_id_seq" OWNED BY public."student_addresses"."address_id";
ALTER SEQUENCE public."library_assets_id_seq" OWNED BY public."library_assets"."id";
ALTER SEQUENCE public."product_categories_id_seq" OWNED BY public."product_categories"."id";
CREATE INDEX idx_profiles_username ON public.profiles USING btree (username);
CREATE INDEX idx_profiles_student_id ON public.profiles USING btree (student_id);
CREATE INDEX idx_profiles_email_lower ON public.profiles USING btree (lower((email)::text));
CREATE INDEX idx_profiles_username_lower ON public.profiles USING btree (lower((username)::text));
CREATE INDEX idx_profiles_current_dan ON public.profiles USING btree (current_dan);
CREATE INDEX idx_profiles_kukkiwon_id ON public.profiles USING btree (kukkiwon_id);
CREATE INDEX idx_classes_branch ON public.class_sessions USING btree (branch_id);
CREATE INDEX idx_enrollments_student ON public.class_enrollments USING btree (student_id);
CREATE INDEX idx_enrollments_class ON public.class_enrollments USING btree (class_id);
CREATE INDEX idx_payments_composite_search ON public.payments USING btree (student_id, year, for_month);
CREATE INDEX idx_attendance_date_lookup ON public.attendance USING btree (date, student_id);
CREATE INDEX idx_pos_order_items_order ON public.pos_order_items USING btree (order_id);
CREATE INDEX idx_inventory_logs_product ON public.inventory_logs USING btree (product_id);
CREATE INDEX idx_inventory_logs_prod ON public.inventory_logs USING btree (product_id);
CREATE INDEX idx_products_sku ON public.products USING btree (sku);
CREATE INDEX idx_products_category ON public.products USING btree (category_id);
CREATE INDEX idx_products_active ON public.products USING btree (is_active);
CREATE INDEX idx_pos_orders_student ON public.pos_orders USING btree (student_id);
CREATE INDEX idx_pos_orders_status ON public.pos_orders USING btree (order_status, payment_status);
CREATE INDEX idx_pos_orders_order_num ON public.pos_orders USING btree (order_number);
CREATE INDEX idx_curriculum_belt ON public.curriculum USING btree (target_belt);
CREATE INDEX idx_product_variants_product ON public.product_variants USING btree (product_id);
CREATE INDEX idx_product_variants_sku ON public.product_variants USING btree (sku);
CREATE INDEX idx_product_variants_active ON public.product_variants USING btree (is_active);
CREATE INDEX idx_lms_progress_student ON public.lms_progress USING btree (student_id);
CREATE INDEX idx_students_profile_fk ON public.students USING btree (profile_id);
CREATE INDEX idx_students_belt ON public.students USING btree (current_belt);
CREATE INDEX idx_students_home_branch ON public.students USING btree (home_branch_id);
CREATE INDEX idx_students_profile_id ON public.students USING btree (profile_id);
CREATE INDEX idx_students_email_lower ON public.students USING btree (lower((email)::text));
CREATE INDEX idx_staff_dan_history_user ON public.staff_dan_history USING btree (user_id);
CREATE INDEX idx_staff_dan_history_level ON public.staff_dan_history USING btree (dan_level);
CREATE INDEX idx_staff_dan_history_date ON public.staff_dan_history USING btree (issue_date);
CREATE OR REPLACE FUNCTION public.sync_profile_to_student()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NEW.student_id IS NOT NULL AND (OLD.student_id IS NULL OR OLD.student_id != NEW.student_id) THEN
        UPDATE public.students 
        SET profile_id = NEW.id 
        WHERE id = NEW.student_id AND (profile_id IS NULL OR profile_id != NEW.id);
    END IF;
    RETURN NEW;
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.sync_student_to_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NEW.profile_id IS NOT NULL AND (OLD.profile_id IS NULL OR OLD.profile_id != NEW.profile_id) THEN
        UPDATE public.profiles 
        SET student_id = NEW.id 
        WHERE id = NEW.profile_id AND (student_id IS NULL OR student_id != NEW.id);
    END IF;
    RETURN NEW;
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.handle_updated_at_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are strictly prohibited.';
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.auth_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
    SELECT COALESCE(
        auth.jwt() -> 'app_metadata' ->> 'role',
        (SELECT role FROM public.profiles WHERE id = auth.uid())
    );
$function$;
;
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_auth_app_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
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
$function$;
;
CREATE OR REPLACE FUNCTION public.auth_is_active()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
    SELECT COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'is_active')::boolean,
        (SELECT is_active FROM public.profiles WHERE id = auth.uid()),
        true
    );
$function$;
;
CREATE OR REPLACE FUNCTION public.is_coach_or_above()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
    SELECT public.auth_is_active() 
       AND public.auth_role() IN ('Root', 'Super Root', 'Admin', 'Head Coach', 'Coach');
$function$;
;
CREATE OR REPLACE FUNCTION public.is_own_student_record(student_id_param character varying)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
    RETURN public.is_current_student(student_id_param);
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.check_user_role(required_roles text[])
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid()
      AND role = ANY(required_roles)
  );
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.sync_student_current_belt()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE public.students
    SET current_belt = NEW.belt_level
    WHERE id = NEW.student_id;
    RETURN NEW;
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.sync_profile_to_members()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- If the profile is assigned a staff role, ensure they have a record in members
  IF NEW.role IN ('Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach') THEN
    INSERT INTO public.members (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
  
  -- If they are demoted to Student, remove them from members (since they belong in students)
  ELSIF NEW.role = 'Student' THEN
    DELETE FROM public.members WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(p_product_id uuid, p_variant_id uuid, p_change_qty integer, p_reason character varying, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_caller_role VARCHAR(20);
    v_new_balance INT;
BEGIN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role NOT IN ('Root', 'Super Root', 'Admin', 'Head Coach') THEN
        RAISE EXCEPTION 'Access denied: Admin role required for stock adjustments.';
    END IF;
    IF p_variant_id IS NOT NULL THEN
        UPDATE public.product_variants
        SET stock = GREATEST(0, stock + p_change_qty), updated_at = NOW()
        WHERE id = p_variant_id
        RETURNING stock INTO v_new_balance;
        -- Update master product aggregate
        UPDATE public.products
        SET stock = (SELECT COALESCE(SUM(stock), 0) FROM public.product_variants WHERE product_id = p_product_id),
            updated_at = NOW()
        WHERE id = p_product_id;
    ELSE
        UPDATE public.products
        SET stock = GREATEST(0, stock + p_change_qty), updated_at = NOW()
        WHERE id = p_product_id
        RETURNING stock INTO v_new_balance;
    END IF;
    INSERT INTO public.inventory_logs (
        product_id, variant_id, change_quantity, balance_after, reason, logged_by, notes
    ) VALUES (
        p_product_id, p_variant_id, p_change_qty, v_new_balance, p_reason, auth.uid(), p_notes
    );
    RETURN jsonb_build_object(
        'success', TRUE,
        'product_id', p_product_id,
        'variant_id', p_variant_id,
        'new_balance', v_new_balance
    );
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.is_elevated_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
    SELECT public.auth_is_active() 
       AND public.auth_role() IN ('Root', 'Super Root', 'Admin', 'Head Coach');
$function$;
;
CREATE OR REPLACE FUNCTION public.is_current_student(sid text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
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
$function$;
;
CREATE OR REPLACE FUNCTION public.get_email_by_username(target_username text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
    found_email TEXT;
    normalized_input TEXT;
    cleaned_input TEXT;
BEGIN
    IF target_username IS NULL OR trim(target_username) = '' THEN
        RETURN NULL;
    END IF;

    normalized_input := trim(target_username);
    cleaned_input := REPLACE(REPLACE(LOWER(normalized_input), '-', ''), '_', '');

    -- 1. Exact username match in profiles
    SELECT email INTO found_email
    FROM public.profiles
    WHERE LOWER(username) = LOWER(normalized_input)
    LIMIT 1;

    IF found_email IS NOT NULL THEN
        RETURN found_email;
    END IF;

    -- 2. Match on profiles.student_id directly
    SELECT email INTO found_email
    FROM public.profiles
    WHERE LOWER(student_id) = LOWER(normalized_input)
       OR REPLACE(LOWER(student_id), '-', '_') = REPLACE(LOWER(normalized_input), '-', '_')
    LIMIT 1;

    IF found_email IS NOT NULL THEN
        RETURN found_email;
    END IF;

    -- 3. Normalized match on profiles.username
    SELECT email INTO found_email
    FROM public.profiles
    WHERE REPLACE(REPLACE(LOWER(username), '-', ''), '_', '') = cleaned_input
    LIMIT 1;

    IF found_email IS NOT NULL THEN
        RETURN found_email;
    END IF;

    -- 4. Match on students.id (retrieve linked profile email)
    SELECT p.email INTO found_email
    FROM public.students s
    JOIN public.profiles p ON p.id = s.profile_id
    WHERE LOWER(s.id) = LOWER(normalized_input)
       OR REPLACE(REPLACE(LOWER(s.id), '-', ''), '_', '') = cleaned_input
    LIMIT 1;

    IF found_email IS NOT NULL THEN
        RETURN found_email;
    END IF;

    -- 5. Match on students.id where profile email matches student record email
    SELECT p.email INTO found_email
    FROM public.students s
    JOIN public.profiles p ON LOWER(p.email) = LOWER(s.email)
    WHERE LOWER(s.id) = LOWER(normalized_input)
       OR REPLACE(REPLACE(LOWER(s.id), '-', ''), '_', '') = cleaned_input
    LIMIT 1;

    IF found_email IS NOT NULL THEN
        RETURN found_email;
    END IF;

    RETURN NULL;
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.is_current_student(sid character varying)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
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
$function$;
;
CREATE OR REPLACE FUNCTION public.fn_sync_student_profile_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
    matched_profile_id UUID;
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF NEW.profile_id IS NOT NULL THEN
        UPDATE public.profiles
        SET student_id = NEW.id
        WHERE id = NEW.profile_id
          AND (student_id IS NULL OR student_id <> NEW.id);
    ELSE
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
$function$;
;
CREATE OR REPLACE FUNCTION public.handle_academy_profile_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.is_admin_or_root()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
    SELECT public.auth_is_active() 
       AND public.auth_role() IN ('Root', 'Super Root', 'Admin');
$function$;
;
CREATE OR REPLACE FUNCTION public.is_dojo_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
    SELECT public.auth_is_active() 
       AND public.auth_role() IN ('Root', 'Super Root', 'Admin', 'Head Coach', 'Coach', 'Assistant Coach');
$function$;
;
CREATE OR REPLACE FUNCTION public.place_student_order(p_student_id character varying, p_customer_name character varying, p_customer_phone character varying, p_branch_id integer, p_payment_method character varying, p_student_notes text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
    v_order_id UUID;
    v_order_number VARCHAR(50);
    v_item RECORD;
    v_prod RECORD;
    v_var RECORD;
    v_unit_price NUMERIC(10, 2);
    v_item_subtotal NUMERIC(10, 2);
    v_calculated_subtotal NUMERIC(10, 2) := 0.00;
BEGIN
    v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

    INSERT INTO public.pos_orders (
        order_number, order_channel, student_id, customer_name, customer_phone,
        branch_id, subtotal_usd, discount_percentage, discount_usd, total_usd,
        payment_method, payment_status, order_status, student_notes, recorded_by
    ) VALUES (
        v_order_number, 'STUDENT_PORTAL', p_student_id, p_customer_name, p_customer_phone,
        p_branch_id, 0.00, 0.00, 0.00, 0.00,
        p_payment_method, 'PENDING', 'PENDING_CONFIRMATION', p_student_notes, auth.uid()
    ) RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID, variant_id UUID, size VARCHAR(50), qty INT
    )
    LOOP
        IF v_item.variant_id IS NOT NULL THEN
            SELECT * INTO v_var FROM public.product_variants WHERE id = v_item.variant_id FOR UPDATE;
            SELECT * INTO v_prod FROM public.products WHERE id = v_var.product_id;

            IF v_var.stock < v_item.qty THEN
                RAISE EXCEPTION 'Insufficient stock for % (%). Available: %, Requested: %',
                    v_prod.name, v_var.size, v_var.stock, v_item.qty;
            END IF;

            v_unit_price := COALESCE(v_var.price_override, v_prod.price_usd);
            v_item_subtotal := v_unit_price * v_item.qty;
            v_calculated_subtotal := v_calculated_subtotal + v_item_subtotal;

            UPDATE public.product_variants SET stock = stock - v_item.qty, updated_at = NOW() WHERE id = v_var.id;
            UPDATE public.products SET stock = GREATEST(0, stock - v_item.qty), updated_at = NOW() WHERE id = v_prod.id;

            INSERT INTO public.pos_order_items (
                order_id, product_id, variant_id, sku, product_name, size, color, unit_price_usd, quantity, total_price_usd
            ) VALUES (
                v_order_id, v_prod.id, v_var.id, v_var.sku, v_prod.name, v_var.size, v_var.color, v_unit_price, v_item.qty, v_item_subtotal
            );

            INSERT INTO public.inventory_logs (
                product_id, variant_id, change_quantity, balance_after, reason, reference_id, logged_by, notes
            ) VALUES (
                v_prod.id, v_var.id, -v_item.qty, v_var.stock - v_item.qty, 'ONLINE_ORDER', v_order_id, auth.uid(), 'Student Portal Pre-order'
            );
        ELSE
            SELECT * INTO v_prod FROM public.products WHERE id = v_item.product_id FOR UPDATE;

            IF v_prod.stock < v_item.qty THEN
                RAISE EXCEPTION 'Insufficient stock for %. Available: %, Requested: %',
                    v_prod.name, v_prod.stock, v_item.qty;
            END IF;

            v_unit_price := v_prod.price_usd;
            v_item_subtotal := v_unit_price * v_item.qty;
            v_calculated_subtotal := v_calculated_subtotal + v_item_subtotal;

            UPDATE public.products SET stock = stock - v_item.qty, updated_at = NOW() WHERE id = v_prod.id;

            INSERT INTO public.pos_order_items (
                order_id, product_id, sku, product_name, size, unit_price_usd, quantity, total_price_usd
            ) VALUES (
                v_order_id, v_prod.id, v_prod.sku, v_prod.name, v_item.size, v_unit_price, v_item.qty, v_item_subtotal
            );

            INSERT INTO public.inventory_logs (
                product_id, change_quantity, balance_after, reason, reference_id, logged_by, notes
            ) VALUES (
                v_prod.id, -v_item.qty, v_prod.stock - v_item.qty, 'ONLINE_ORDER', v_order_id, auth.uid(), 'Student Portal Pre-order'
            );
        END IF;
    END LOOP;

    UPDATE public.pos_orders SET subtotal_usd = v_calculated_subtotal, total_usd = v_calculated_subtotal WHERE id = v_order_id;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number,
        'subtotal_usd', v_calculated_subtotal,
        'order_status', 'PENDING_CONFIRMATION',
        'payment_status', 'PENDING'
    );
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.confirm_student_order(p_order_id uuid, p_new_order_status character varying, p_payment_status character varying DEFAULT NULL::character varying, p_admin_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
    v_order RECORD;
BEGIN
    SELECT * INTO v_order FROM public.pos_orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found.';
    END IF;

    UPDATE public.pos_orders
    SET order_status = p_new_order_status,
        payment_status = COALESCE(p_payment_status, payment_status),
        admin_notes = COALESCE(p_admin_notes, admin_notes),
        confirmed_by = COALESCE(auth.uid(), confirmed_by),
        confirmed_at = CASE WHEN p_new_order_status IN ('CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED') AND confirmed_at IS NULL THEN NOW() ELSE confirmed_at END,
        fulfilled_at = CASE WHEN p_new_order_status = 'COMPLETED' THEN NOW() ELSE fulfilled_at END,
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'order_id', p_order_id,
        'order_status', p_new_order_status,
        'payment_status', COALESCE(p_payment_status, v_order.payment_status)
    );
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.cancel_or_refund_order(p_order_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
    v_order RECORD;
    v_item RECORD;
BEGIN
    SELECT * INTO v_order FROM public.pos_orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found.';
    END IF;
    IF v_order.order_status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Order is already cancelled.';
    END IF;

    FOR v_item IN SELECT * FROM public.pos_order_items WHERE order_id = p_order_id
    LOOP
        IF v_item.variant_id IS NOT NULL THEN
            UPDATE public.product_variants SET stock = stock + v_item.quantity WHERE id = v_item.variant_id;
            UPDATE public.products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;
            INSERT INTO public.inventory_logs (product_id, variant_id, change_quantity, balance_after, reason, reference_id, logged_by, notes)
            SELECT v_item.product_id, v_item.variant_id, v_item.quantity, pv.stock, 'ORDER_CANCELLED_RESTORE', p_order_id, auth.uid(), p_reason
            FROM public.product_variants pv WHERE pv.id = v_item.variant_id;
        ELSE
            UPDATE public.products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;
            INSERT INTO public.inventory_logs (product_id, change_quantity, balance_after, reason, reference_id, logged_by, notes)
            SELECT v_item.product_id, v_item.quantity, p.stock, 'ORDER_CANCELLED_RESTORE', p_order_id, auth.uid(), p_reason
            FROM public.products p WHERE p.id = v_item.product_id;
        END IF;
    END LOOP;

    UPDATE public.pos_orders
    SET order_status = 'CANCELLED',
        payment_status = CASE WHEN payment_status = 'PAID' THEN 'REFUNDED' ELSE 'VOID' END,
        cancelled_at = NOW(),
        cancellation_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'order_id', p_order_id,
        'order_status', 'CANCELLED'
    );
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.process_admin_pos_sale(p_student_id character varying, p_customer_name character varying, p_branch_id integer, p_subtotal numeric, p_discount_percentage numeric, p_payment_method character varying, p_admin_notes text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
    v_order_id UUID;
    v_order_number VARCHAR(50);
    v_item RECORD;
    v_discount_usd NUMERIC(10, 2);
    v_total_usd NUMERIC(10, 2);
    v_unit_price NUMERIC(10, 2);
    v_item_subtotal NUMERIC(10, 2);
BEGIN
    v_order_number := 'POS-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    v_discount_usd := ROUND((p_subtotal * (p_discount_percentage / 100.0)), 2);
    v_total_usd := GREATEST(0.00, p_subtotal - v_discount_usd);

    INSERT INTO public.pos_orders (
        order_number, order_channel, student_id, customer_name,
        branch_id, subtotal_usd, discount_percentage, discount_usd, total_usd,
        payment_method, payment_status, order_status, admin_notes,
        recorded_by, confirmed_by, confirmed_at, fulfilled_at
    ) VALUES (
        v_order_number, 'ADMIN_POS', p_student_id, p_customer_name,
        p_branch_id, p_subtotal, p_discount_percentage, v_discount_usd, v_total_usd,
        p_payment_method, 'PAID', 'COMPLETED', p_admin_notes,
        auth.uid(), auth.uid(), NOW(), NOW()
    ) RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID, variant_id UUID, sku VARCHAR(50), name VARCHAR(150), size VARCHAR(50), price NUMERIC(10, 2), qty INT
    )
    LOOP
        v_unit_price := v_item.price;
        v_item_subtotal := v_unit_price * v_item.qty;

        IF v_item.variant_id IS NOT NULL THEN
            UPDATE public.product_variants SET stock = GREATEST(0, stock - v_item.qty), updated_at = NOW() WHERE id = v_item.variant_id;
            UPDATE public.products SET stock = GREATEST(0, stock - v_item.qty), updated_at = NOW() WHERE id = v_item.product_id;

            INSERT INTO public.pos_order_items (
                order_id, product_id, variant_id, sku, product_name, size, unit_price_usd, quantity, total_price_usd
            ) VALUES (
                v_order_id, v_item.product_id, v_item.variant_id, v_item.sku, v_item.name, v_item.size, v_unit_price, v_item.qty, v_item_subtotal
            );

            INSERT INTO public.inventory_logs (
                product_id, variant_id, change_quantity, balance_after, reason, reference_id, logged_by, notes
            ) VALUES (
                v_item.product_id, v_item.variant_id, -v_item.qty, 0, 'POS_SALE', v_order_id, auth.uid(), 'Counter POS Sale'
            );
        ELSE
            UPDATE public.products SET stock = GREATEST(0, stock - v_item.qty), updated_at = NOW() WHERE id = v_item.product_id;

            INSERT INTO public.pos_order_items (
                order_id, product_id, sku, product_name, size, unit_price_usd, quantity, total_price_usd
            ) VALUES (
                v_order_id, v_item.product_id, v_item.sku, v_item.name, v_item.size, v_unit_price, v_item.qty, v_item_subtotal
            );

            INSERT INTO public.inventory_logs (
                product_id, change_quantity, balance_after, reason, reference_id, logged_by, notes
            ) VALUES (
                v_item.product_id, -v_item.qty, 0, 'POS_SALE', v_order_id, auth.uid(), 'Counter POS Sale'
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', TRUE,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'total_usd', v_total_usd,
        'order_status', 'COMPLETED'
    );
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.fn_sync_profile_student_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
    matched_student_id VARCHAR(50);
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF NEW.role = 'Student' THEN
        IF NEW.student_id IS NOT NULL AND NEW.student_id <> '' THEN
            UPDATE public.students
            SET profile_id = NEW.id
            WHERE LOWER(id) = LOWER(NEW.student_id)
              AND (profile_id IS NULL OR profile_id <> NEW.id);
        ELSE
            SELECT id INTO matched_student_id
            FROM public.students
            WHERE (
                REPLACE(REPLACE(LOWER(id), '-', ''), '_', '') = REPLACE(REPLACE(LOWER(NEW.username), '-', ''), '_', '')
                OR (NEW.email IS NOT NULL AND NEW.email <> '' AND LOWER(email) = LOWER(NEW.email))
            )
            ORDER BY CASE WHEN REPLACE(REPLACE(LOWER(id), '-', ''), '_', '') = REPLACE(REPLACE(LOWER(NEW.username), '-', ''), '_', '') THEN 1 ELSE 2 END
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
$function$;
;
CREATE OR REPLACE FUNCTION public.trg_sync_staff_latest_dan()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    target_user_id UUID;
    highest_record RECORD;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_user_id := OLD.user_id;
    ELSE
        target_user_id := NEW.user_id;
    END IF;

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
        UPDATE public.profiles
        SET 
            current_dan = NULL,
            dan_issue_date = NULL
        WHERE id = target_user_id;
    END IF;

    RETURN NULL;
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(p_product_id uuid, p_change_qty integer, p_reason text, p_notes text DEFAULT NULL::text, p_variant_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_old_stock INTEGER;
  v_new_stock INTEGER;
  v_prod_name TEXT;
  v_variant_sku TEXT;
  v_variant_size TEXT;
  v_variant_color TEXT;
BEGIN
  IF p_variant_id IS NOT NULL THEN
    SELECT v.stock, v.sku, v.size, v.color, p.name 
    INTO v_old_stock, v_variant_sku, v_variant_size, v_variant_color, v_prod_name
    FROM public.product_variants v
    JOIN public.products p ON p.id = v.product_id
    WHERE v.id = p_variant_id AND v.product_id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant ID % not found for product ID %.', p_variant_id, p_product_id;
    END IF;

    v_new_stock := GREATEST(0, v_old_stock + p_change_qty);

    UPDATE public.product_variants
    SET stock = v_new_stock, updated_at = NOW()
    WHERE id = p_variant_id;

    -- Re-sum parent stock from all variants
    UPDATE public.products
    SET stock = (SELECT COALESCE(SUM(stock), 0) FROM public.product_variants WHERE product_id = p_product_id AND is_active = true),
        updated_at = NOW()
    WHERE id = p_product_id;

    INSERT INTO public.inventory_logs (
      product_id, variant_id, change_quantity, balance_after, reason, notes, logged_by
    ) VALUES (
      p_product_id, p_variant_id, p_change_qty, v_new_stock, p_reason, p_notes, auth.uid()
    );

    RETURN jsonb_build_object(
      'product_id', p_product_id,
      'variant_id', p_variant_id,
      'product_name', v_prod_name,
      'variant_sku', v_variant_sku,
      'size', v_variant_size,
      'color', v_variant_color,
      'previous_balance', v_old_stock,
      'change_qty', p_change_qty,
      'new_balance', v_new_stock,
      'reason', p_reason
    );
  ELSE
    SELECT stock, name INTO v_old_stock, v_prod_name
    FROM public.products
    WHERE id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product with ID % not found.', p_product_id;
    END IF;

    v_new_stock := GREATEST(0, v_old_stock + p_change_qty);

    UPDATE public.products
    SET stock = v_new_stock, updated_at = NOW()
    WHERE id = p_product_id;

    INSERT INTO public.inventory_logs (
      product_id, change_quantity, balance_after, reason, notes, logged_by
    ) VALUES (
      p_product_id, p_change_qty, v_new_stock, p_reason, p_notes, auth.uid()
    );

    RETURN jsonb_build_object(
      'product_id', p_product_id,
      'product_name', v_prod_name,
      'previous_balance', v_old_stock,
      'change_qty', p_change_qty,
      'new_balance', v_new_stock,
      'reason', p_reason
    );
  END IF;
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.process_admin_pos_sale(p_customer_name text, p_subtotal numeric, p_discount_percentage numeric, p_payment_method text, p_items jsonb, p_student_id text DEFAULT NULL::text, p_branch_id integer DEFAULT NULL::integer, p_admin_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_discount_usd NUMERIC;
  v_total_usd NUMERIC;
  v_item RECORD;
  v_prod_id UUID;
  v_var_id UUID;
  v_qty INTEGER;
  v_price NUMERIC;
BEGIN
  v_order_number := 'POS-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)) || '-' || TO_CHAR(NOW(), 'YYMMDD');
  v_discount_usd := ROUND((p_subtotal * COALESCE(p_discount_percentage, 0) / 100)::NUMERIC, 2);
  v_total_usd := ROUND((p_subtotal - v_discount_usd)::NUMERIC, 2);

  INSERT INTO public.pos_orders (
    order_number, order_channel, student_id, customer_name, branch_id,
    subtotal_usd, discount_percentage, discount_usd, total_usd,
    payment_method, payment_status, order_status, admin_notes, recorded_by, created_at, updated_at
  ) VALUES (
    v_order_number, 'ADMIN_POS', p_student_id, p_customer_name, p_branch_id,
    p_subtotal, COALESCE(p_discount_percentage, 0), v_discount_usd, v_total_usd,
    p_payment_method, 'PAID', 'COMPLETED', p_admin_notes, auth.uid(), NOW(), NOW()
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    product_id UUID, variant_id UUID, sku TEXT, name TEXT, size TEXT, color TEXT, price NUMERIC, qty INTEGER
  )
  LOOP
    v_prod_id := v_item.product_id;
    v_var_id := v_item.variant_id;
    v_qty := v_item.qty;
    v_price := v_item.price;

    INSERT INTO public.pos_order_items (
      order_id, product_id, variant_id, sku, product_name, size, color, unit_price_usd, quantity, total_price_usd
    ) VALUES (
      v_order_id, v_prod_id, v_var_id, v_item.sku, v_item.name, v_item.size, v_item.color, v_price, v_qty, ROUND((v_price * v_qty)::NUMERIC, 2)
    );

    IF v_var_id IS NOT NULL THEN
      UPDATE public.product_variants
      SET stock = GREATEST(0, stock - v_qty), updated_at = NOW()
      WHERE id = v_var_id;

      UPDATE public.products
      SET stock = (SELECT COALESCE(SUM(stock), 0) FROM public.product_variants WHERE product_id = v_prod_id AND is_active = true),
          updated_at = NOW()
      WHERE id = v_prod_id;

      INSERT INTO public.inventory_logs (
        product_id, variant_id, change_quantity, balance_after, reason, notes, logged_by
      ) VALUES (
        v_prod_id, v_var_id, -v_qty,
        (SELECT stock FROM public.product_variants WHERE id = v_var_id),
        'ADMIN_POS_SALE', 'Purchased via POS: ' || v_order_number, auth.uid()
      );
    ELSE
      UPDATE public.products
      SET stock = GREATEST(0, stock - v_qty), updated_at = NOW()
      WHERE id = v_prod_id;

      INSERT INTO public.inventory_logs (
        product_id, change_quantity, balance_after, reason, notes, logged_by
      ) VALUES (
        v_prod_id, -v_qty,
        (SELECT stock FROM public.products WHERE id = v_prod_id),
        'ADMIN_POS_SALE', 'Purchased via POS: ' || v_order_number, auth.uid()
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'total_usd', v_total_usd);
END;
$function$;
;
CREATE OR REPLACE FUNCTION public.portal_take_rate_slot(p_key text, p_limit integer, p_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE n integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Server only' USING ERRCODE = '42501';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 1000 OR p_seconds NOT BETWEEN 1 AND 3600 OR length(p_key)>256 THEN
    RAISE EXCEPTION 'Invalid rate limit';
  END IF;
  DELETE FROM public.portal_rate_limits WHERE expires_at < now()-interval '1 hour';
  INSERT INTO public.portal_rate_limits VALUES(p_key,1,now()+make_interval(secs=>p_seconds))
  ON CONFLICT(key) DO UPDATE SET
    attempts=CASE WHEN portal_rate_limits.expires_at<=now() THEN 1 ELSE portal_rate_limits.attempts+1 END,
    expires_at=CASE WHEN portal_rate_limits.expires_at<=now() THEN now()+make_interval(secs=>p_seconds) ELSE portal_rate_limits.expires_at END
  RETURNING attempts INTO n;
  RETURN n<=p_limit;
END $function$
;
ALTER TABLE public."portal_rate_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."library_asset_muscles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."muscles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."biomechanical_skill_linkage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."class_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."class_enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."student_body_compositions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."scholarships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pos_order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."inventory_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pos_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."curriculum" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."belt_techniques" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."product_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."belts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."belt_histories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lms_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."achievements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."member_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."student_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."student_training_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."workout_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."student_physical_evaluations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."library_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."staff_dan_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."partners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."academy_profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."product_categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_clean" ON public."profiles" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "Allow authenticated users to read student_addresses" ON public."student_addresses" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Allow authenticated users to read member_addresses" ON public."member_addresses" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Anyone can view active products" ON public."products" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (((is_active = true) OR is_dojo_staff()));
CREATE POLICY "Staff can manage products" ON public."products" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_dojo_staff()) WITH CHECK (is_dojo_staff());
CREATE POLICY "Anyone can view active product variants" ON public."product_variants" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (((is_active = true) OR is_dojo_staff()));
CREATE POLICY "Staff can manage product variants" ON public."product_variants" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_dojo_staff()) WITH CHECK (is_dojo_staff());
CREATE POLICY "Anyone can view product categories" ON public."product_categories" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "Staff can manage product categories" ON public."product_categories" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_dojo_staff()) WITH CHECK (is_dojo_staff());
CREATE POLICY "Pos orders access control" ON public."pos_orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_dojo_staff() OR ((student_id IS NOT NULL) AND is_current_student(student_id))));
CREATE POLICY "Staff can manage pos orders" ON public."pos_orders" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_dojo_staff()) WITH CHECK (is_dojo_staff());
CREATE POLICY "Pos order items access control" ON public."pos_order_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_dojo_staff() OR (EXISTS ( SELECT 1
   FROM pos_orders po
  WHERE ((po.id = pos_order_items.order_id) AND (is_dojo_staff() OR ((po.student_id IS NOT NULL) AND is_current_student(po.student_id))))))));
CREATE POLICY "Staff can manage pos order items" ON public."pos_order_items" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_dojo_staff()) WITH CHECK (is_dojo_staff());
CREATE POLICY "Staff can view inventory logs" ON public."inventory_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_dojo_staff());
CREATE POLICY "biomechanical_skill_linkage_select_policy" ON public."biomechanical_skill_linkage" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "Allow select for all" ON public."biomechanical_skill_linkage" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "Allow write for elevated roles" ON public."biomechanical_skill_linkage" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = ANY ((ARRAY['Root'::character varying, 'Super Root'::character varying, 'Admin'::character varying, 'Head Coach'::character varying, 'Coach'::character varying])::text[]))))));
CREATE POLICY "biomechanical_skill_linkage_write_policy" ON public."biomechanical_skill_linkage" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_coach_or_above()) WITH CHECK (is_coach_or_above());
CREATE POLICY "lms_progress_select_policy" ON public."lms_progress" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_dojo_staff() OR is_current_student(student_id)));
CREATE POLICY "lms_progress_write_policy" ON public."lms_progress" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_dojo_staff() OR is_current_student(student_id))) WITH CHECK ((is_dojo_staff() OR is_current_student(student_id)));
CREATE POLICY "class_sessions_select_policy" ON public."class_sessions" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "class_sessions_write_policy" ON public."class_sessions" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_admin_or_root()) WITH CHECK (is_admin_or_root());
CREATE POLICY "class_enrollments_select_policy" ON public."class_enrollments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_dojo_staff() OR is_current_student(student_id)));
CREATE POLICY "class_enrollments_write_policy" ON public."class_enrollments" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_elevated_staff()) WITH CHECK (is_elevated_staff());
CREATE POLICY "branches_select_policy" ON public."branches" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "Public & authenticated can view categories" ON public."product_categories" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "branches_write_policy" ON public."branches" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_admin_or_root()) WITH CHECK (is_admin_or_root());
CREATE POLICY "profiles_select_policy" ON public."profiles" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "profiles_update_policy" ON public."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_admin_or_root() OR ((id = auth.uid()) AND ((role)::text = (( SELECT profiles_1.role
   FROM profiles profiles_1
  WHERE (profiles_1.id = auth.uid())))::text) AND (is_active = ( SELECT profiles_1.is_active
   FROM profiles profiles_1
  WHERE (profiles_1.id = auth.uid())))))) WITH CHECK ((is_admin_or_root() OR ((id = auth.uid()) AND ((role)::text = (( SELECT profiles_1.role
   FROM profiles profiles_1
  WHERE (profiles_1.id = auth.uid())))::text) AND (is_active = ( SELECT profiles_1.is_active
   FROM profiles profiles_1
  WHERE (profiles_1.id = auth.uid()))))));
CREATE POLICY "belts_select_policy" ON public."belts" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "staff_dan_history_read_policy" ON public."staff_dan_history" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "staff_dan_history_write_policy" ON public."staff_dan_history" AS PERMISSIVE FOR ALL TO "authenticated" USING (((auth_role() = ANY (ARRAY['Root'::text, 'Super Root'::text, 'Admin'::text])) OR (auth.uid() = user_id))) WITH CHECK ((auth_role() = ANY (ARRAY['Root'::text, 'Super Root'::text, 'Admin'::text])));
CREATE POLICY "Allow authenticated staff to view partners" ON public."partners" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Students view only their own orders" ON public."pos_orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM students s
  WHERE (((s.id)::text = (pos_orders.student_id)::text) AND (s.profile_id = auth.uid())))) OR (recorded_by = auth.uid())));
CREATE POLICY "Students view line items of their own orders" ON public."pos_order_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (pos_orders o
     JOIN students s ON (((s.id)::text = (o.student_id)::text)))
  WHERE ((o.id = pos_order_items.order_id) AND (s.profile_id = auth.uid())))));
CREATE POLICY "profiles_insert_policy" ON public."profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_admin_or_root() OR (id = auth.uid())));
CREATE POLICY "profiles_delete_policy" ON public."profiles" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((auth_role() = ANY (ARRAY['Root'::text, 'Super Root'::text])));
CREATE POLICY "students_select_policy" ON public."students" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_dojo_staff() OR (profile_id = auth.uid()) OR is_current_student(id)));
CREATE POLICY "students_insert_policy" ON public."students" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_elevated_staff());
CREATE POLICY "students_update_policy" ON public."students" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_elevated_staff()) WITH CHECK (is_elevated_staff());
CREATE POLICY "profiles_update_own" ON public."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));
CREATE POLICY "profiles_service_role" ON public."profiles" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "students_delete_policy" ON public."students" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_admin_or_root());
CREATE POLICY "student_addresses_select_policy" ON public."student_addresses" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_dojo_staff() OR is_current_student(student_id)));
CREATE POLICY "student_addresses_write_policy" ON public."student_addresses" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_elevated_staff()) WITH CHECK (is_elevated_staff());
CREATE POLICY "members_select_policy" ON public."members" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_dojo_staff() OR (id = auth.uid())));
CREATE POLICY "members_insert_policy" ON public."members" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_elevated_staff());
CREATE POLICY "members_update_policy" ON public."members" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_elevated_staff() OR (id = auth.uid()))) WITH CHECK ((is_elevated_staff() OR (id = auth.uid())));
CREATE POLICY "members_delete_policy" ON public."members" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_admin_or_root());
CREATE POLICY "member_addresses_select_policy" ON public."member_addresses" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_dojo_staff() OR (member_id = auth.uid())));
CREATE POLICY "Members: Read access" ON public."members" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Members: Update own profile details" ON public."members" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((id = auth.uid()));
CREATE POLICY "Members: Root manage all" ON public."members" AS PERMISSIVE FOR ALL TO "authenticated" USING (check_user_role(ARRAY['Root'::text]));
CREATE POLICY "member_addresses_write_policy" ON public."member_addresses" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_elevated_staff() OR (member_id = auth.uid()))) WITH CHECK ((is_elevated_staff() OR (member_id = auth.uid())));
CREATE POLICY "payments_select_policy" ON public."payments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_admin_or_root() OR is_current_student(student_id)));
CREATE POLICY "Students: Read access" ON public."students" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((check_user_role(ARRAY['Root'::text, 'Admin'::text, 'Head Coach'::text, 'Coach'::text, 'Assistant Coach'::text]) OR (profile_id = auth.uid())));
CREATE POLICY "Students: Root and Admin manage" ON public."students" AS PERMISSIVE FOR ALL TO "authenticated" USING (check_user_role(ARRAY['Root'::text, 'Admin'::text]));
CREATE POLICY "payments_insert_policy" ON public."payments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_admin_or_root());
CREATE POLICY "Attendance: Modify access" ON public."attendance" AS PERMISSIVE FOR ALL TO "authenticated" USING (check_user_role(ARRAY['Root'::text, 'Admin'::text, 'Head Coach'::text, 'Coach'::text]));
CREATE POLICY "payments_update_policy" ON public."payments" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_admin_or_root()) WITH CHECK (is_admin_or_root());
CREATE POLICY "Payments: Management write" ON public."payments" AS PERMISSIVE FOR ALL TO "authenticated" USING (check_user_role(ARRAY['Root'::text, 'Admin'::text]));
CREATE POLICY "Belt Histories: Modify access" ON public."belt_histories" AS PERMISSIVE FOR ALL TO "authenticated" USING (check_user_role(ARRAY['Root'::text, 'Admin'::text, 'Head Coach'::text, 'Coach'::text]));
CREATE POLICY "payments_delete_policy" ON public."payments" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_admin_or_root());
CREATE POLICY "attendance_select_policy" ON public."attendance" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_dojo_staff() OR is_current_student(student_id)));
CREATE POLICY "attendance_insert_policy" ON public."attendance" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_dojo_staff());
CREATE POLICY "attendance_update_policy" ON public."attendance" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_dojo_staff()) WITH CHECK (is_dojo_staff());
CREATE POLICY "attendance_delete_policy" ON public."attendance" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_elevated_staff());
CREATE POLICY "belt_histories_select_policy" ON public."belt_histories" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_dojo_staff() OR is_current_student(student_id)));
CREATE POLICY "Achievements: Modify access" ON public."achievements" AS PERMISSIVE FOR ALL TO "authenticated" USING (check_user_role(ARRAY['Root'::text, 'Admin'::text, 'Head Coach'::text, 'Coach'::text]));
CREATE POLICY "Scholarships: Read access" ON public."scholarships" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((check_user_role(ARRAY['Root'::text, 'Admin'::text, 'Head Coach'::text]) OR (EXISTS ( SELECT 1
   FROM students
  WHERE ((students.profile_id = auth.uid()) AND (students.scholarship_id = scholarships.id))))));
CREATE POLICY "Scholarships: Management write" ON public."scholarships" AS PERMISSIVE FOR ALL TO "authenticated" USING (check_user_role(ARRAY['Root'::text, 'Admin'::text, 'Head Coach'::text]));
CREATE POLICY "belt_histories_write_policy" ON public."belt_histories" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_coach_or_above()) WITH CHECK (is_coach_or_above());
CREATE POLICY "Belts: Read access" ON public."belts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Belts: Modify access" ON public."belts" AS PERMISSIVE FOR ALL TO "authenticated" USING (check_user_role(ARRAY['Root'::text, 'Admin'::text]));
CREATE POLICY "physical_evaluations_select_policy" ON public."student_physical_evaluations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_dojo_staff() OR is_current_student(student_id)));
CREATE POLICY "Branches: Read access" ON public."branches" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Branches: Modify access" ON public."branches" AS PERMISSIVE FOR ALL TO "authenticated" USING (check_user_role(ARRAY['Root'::text, 'Admin'::text]));
CREATE POLICY "Sessions: Read access" ON public."class_sessions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "role_permissions_select_policy" ON public."role_permissions" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "library_assets_read" ON public."library_assets" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "Sessions: Modify access" ON public."class_sessions" AS PERMISSIVE FOR ALL TO "authenticated" USING (check_user_role(ARRAY['Root'::text, 'Admin'::text, 'Head Coach'::text, 'Coach'::text]));
CREATE POLICY "library_assets_write" ON public."library_assets" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_dojo_staff()) WITH CHECK (is_dojo_staff());
CREATE POLICY "muscles_read" ON public."muscles" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "Enrollments: Modify access" ON public."class_enrollments" AS PERMISSIVE FOR ALL TO "authenticated" USING (check_user_role(ARRAY['Root'::text, 'Admin'::text, 'Head Coach'::text, 'Coach'::text]));
CREATE POLICY "Curriculum: Read access" ON public."curriculum" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "library_asset_muscles_read" ON public."library_asset_muscles" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "belt_techniques_read" ON public."belt_techniques" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "body_comp_read" ON public."student_body_compositions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_dojo_staff() OR is_current_student(student_id)));
CREATE POLICY "Curriculum: Modify access" ON public."curriculum" AS PERMISSIVE FOR ALL TO "authenticated" USING (check_user_role(ARRAY['Root'::text, 'Admin'::text, 'Head Coach'::text, 'Coach'::text]));
CREATE POLICY "body_comp_manage" ON public."student_body_compositions" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_dojo_staff()) WITH CHECK (is_dojo_staff());
CREATE POLICY "physical_evaluations_write_policy" ON public."student_physical_evaluations" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_coach_or_above()) WITH CHECK (is_coach_or_above());
CREATE POLICY "physical_eval_read" ON public."student_physical_evaluations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_dojo_staff() OR is_current_student(student_id)));
CREATE POLICY "body_compositions_select_policy" ON public."student_body_compositions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_dojo_staff() OR is_current_student(student_id)));
CREATE POLICY "user_permissions_select_policy" ON public."user_permissions" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "body_compositions_write_policy" ON public."student_body_compositions" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_coach_or_above()) WITH CHECK (is_coach_or_above());
CREATE POLICY "training_plans_select_policy" ON public."student_training_plans" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_dojo_staff() OR is_current_student(student_id)));
CREATE POLICY "training_plans_write_policy" ON public."student_training_plans" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_coach_or_above()) WITH CHECK (is_coach_or_above());
CREATE POLICY "library_assets_select_policy" ON public."library_assets" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "library_assets_write_policy" ON public."library_assets" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_coach_or_above()) WITH CHECK (is_coach_or_above());
CREATE POLICY "curriculum_select_policy" ON public."curriculum" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "curriculum_write_policy" ON public."curriculum" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_coach_or_above()) WITH CHECK (is_coach_or_above());
CREATE POLICY "belt_techniques_select_policy" ON public."belt_techniques" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "belt_techniques_write_policy" ON public."belt_techniques" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_coach_or_above()) WITH CHECK (is_coach_or_above());
CREATE POLICY "workout_templates_select_policy" ON public."workout_templates" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "workout_templates_write_policy" ON public."workout_templates" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_coach_or_above()) WITH CHECK (is_coach_or_above());
CREATE POLICY "physical_eval_manage" ON public."student_physical_evaluations" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_dojo_staff()) WITH CHECK (is_dojo_staff());
CREATE POLICY "lms_progress_read" ON public."lms_progress" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_dojo_staff() OR is_current_student(student_id)));
CREATE POLICY "lms_progress_manage" ON public."lms_progress" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_dojo_staff() OR is_current_student(student_id))) WITH CHECK ((is_dojo_staff() OR is_current_student(student_id)));
CREATE POLICY "muscles_select_policy" ON public."muscles" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "muscles_write_policy" ON public."muscles" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_coach_or_above()) WITH CHECK (is_coach_or_above());
CREATE POLICY "asset_muscles_select_policy" ON public."library_asset_muscles" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "asset_muscles_write_policy" ON public."library_asset_muscles" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_coach_or_above()) WITH CHECK (is_coach_or_above());
CREATE POLICY "belts_write_policy" ON public."belts" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_admin_or_root()) WITH CHECK (is_admin_or_root());
CREATE POLICY "scholarships_select_policy" ON public."scholarships" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "scholarships_write_policy" ON public."scholarships" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_admin_or_root()) WITH CHECK (is_admin_or_root());
CREATE POLICY "achievements_select_policy" ON public."achievements" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_dojo_staff() OR is_current_student(student_id)));
CREATE POLICY "achievements_write_policy" ON public."achievements" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_dojo_staff()) WITH CHECK (is_dojo_staff());
CREATE POLICY "academy_profile_select_policy" ON public."academy_profile" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "academy_profile_insert_policy" ON public."academy_profile" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_admin_or_root());
CREATE POLICY "academy_profile_update_policy" ON public."academy_profile" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_admin_or_root()) WITH CHECK (is_admin_or_root());
CREATE POLICY "audit_logs_select_policy" ON public."audit_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_admin_or_root());
CREATE POLICY "audit_logs_insert_policy" ON public."audit_logs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "products_select_policy" ON public."products" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "products_write_policy" ON public."products" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_admin_or_root()) WITH CHECK (is_admin_or_root());
CREATE POLICY "product_variants_select_policy" ON public."product_variants" AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (true);
CREATE POLICY "product_variants_write_policy" ON public."product_variants" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_admin_or_root()) WITH CHECK (is_admin_or_root());
CREATE POLICY "pos_orders_select_policy" ON public."pos_orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_dojo_staff() OR is_current_student(student_id)));
CREATE POLICY "pos_orders_insert_policy" ON public."pos_orders" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_dojo_staff() OR is_current_student(student_id)));
CREATE POLICY "pos_orders_update_policy" ON public."pos_orders" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_dojo_staff()) WITH CHECK (is_dojo_staff());
CREATE POLICY "pos_orders_delete_policy" ON public."pos_orders" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_admin_or_root());
CREATE POLICY "role_permissions_write_policy" ON public."role_permissions" AS PERMISSIVE FOR ALL TO "authenticated" USING ((auth_role() = ANY (ARRAY['Root'::text, 'Super Root'::text]))) WITH CHECK ((auth_role() = ANY (ARRAY['Root'::text, 'Super Root'::text])));
CREATE POLICY "user_permissions_write_policy" ON public."user_permissions" AS PERMISSIVE FOR ALL TO "authenticated" USING ((auth_role() = ANY (ARRAY['Root'::text, 'Super Root'::text]))) WITH CHECK ((auth_role() = ANY (ARRAY['Root'::text, 'Super Root'::text])));
