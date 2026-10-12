-- Run in the Supabase SQL Editor for this portal's project.
-- Minimal repair for the shared API account check; existing accounts remain unchanged.
-- Safe to run repeatedly and compatible with production-upgrade-20261009.sql.
BEGIN;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
NOTIFY pgrst, 'reload schema';
COMMIT;
