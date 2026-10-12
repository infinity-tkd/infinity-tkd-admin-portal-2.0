BEGIN;
-- Validate rules against existing records where reconciliation is not needed.
-- The settled-payment-date rule remains NOT VALID until historical dates are verified.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT c.conname,c.conrelid::regclass AS relation FROM pg_constraint c
 WHERE c.connamespace='public'::regnamespace AND NOT c.convalidated
 AND c.conname IN ('portal_partner_dates','portal_waiver_amount','portal_payment_status','portal_money_precision','portal_measurement_values','portal_academy_bounds') LOOP
 EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I',r.relation,r.conname);
 END LOOP;
END $$;
COMMIT;
