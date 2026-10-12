-- Login-only repair for the existing Infinity TKD Supabase project.
-- Run the entire file in Supabase SQL Editor. Safe to run again.
-- The full production upgrade remains required for other portal workflows.
BEGIN;

CREATE TABLE IF NOT EXISTS public.portal_rate_limits(
  key text PRIMARY KEY, attempts integer NOT NULL, expires_at timestamptz NOT NULL
);
ALTER TABLE public.portal_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_take_rate_slot(p_key text, p_limit integer, p_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
END $$;

REVOKE ALL ON FUNCTION public.portal_take_rate_slot(text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_take_rate_slot(text,integer,integer) TO service_role;
GRANT ALL ON TABLE public.portal_rate_limits TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
