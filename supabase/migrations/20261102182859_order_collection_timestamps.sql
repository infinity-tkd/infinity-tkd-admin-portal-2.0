-- Record future staff-confirmed collection time without guessing legacy dates.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public.pos_orders ADD COLUMN payment_recorded_at timestamptz;

CREATE FUNCTION public.portal_order_collection_time()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.payment_recorded_at IS NOT NULL THEN RAISE EXCEPTION 'Collection time is recorded by the server' USING ERRCODE='22023'; END IF;
  IF NEW.payment_status='PAID' THEN NEW.payment_recorded_at:=now(); END IF;
 ELSE
  IF NEW.payment_recorded_at IS DISTINCT FROM OLD.payment_recorded_at THEN RAISE EXCEPTION 'The original collection time cannot be reassigned' USING ERRCODE='22023'; END IF;
  IF OLD.payment_recorded_at IS NULL AND OLD.payment_status IS DISTINCT FROM 'PAID' AND NEW.payment_status='PAID' THEN NEW.payment_recorded_at:=now(); END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.portal_order_collection_time() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER portal_order_collection_timestamp BEFORE INSERT OR UPDATE ON public.pos_orders
 FOR EACH ROW EXECUTE FUNCTION public.portal_order_collection_time();
COMMENT ON COLUMN public.pos_orders.payment_recorded_at IS 'Server time of the first newly recorded PAID state; not bank settlement time. Legacy paid rows remain undated until separately reviewed.';
NOTIFY pgrst,'reload schema';
COMMIT;
