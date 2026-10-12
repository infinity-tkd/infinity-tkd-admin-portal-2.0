-- Realtime events are invalidation signals; clients re-read RLS-visible snapshots.
-- No business rows, privileges, RLS policies or replica identities are changed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $migration$
DECLARE
  table_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE EXCEPTION 'The Supabase realtime publication is missing';
  END IF;
  FOREACH table_name IN ARRAY ARRAY[
    'profiles', 'members', 'member_addresses', 'students', 'student_addresses',
    'branches', 'class_sessions', 'class_enrollments', 'scholarships', 'attendance',
    'payments', 'payment_transactions', 'belt_histories', 'achievements', 'library_assets',
    'lms_progress', 'workout_templates', 'student_physical_evaluations', 'belt_techniques',
    'muscles', 'library_asset_muscles', 'student_body_compositions', 'academy_profile',
    'role_permissions', 'user_permissions', 'staff_dan_history', 'partners',
    'products', 'product_variants', 'product_categories', 'pos_orders'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = table_name AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'Realtime table public.% must exist with RLS enabled', table_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END;
$migration$;
COMMIT;
