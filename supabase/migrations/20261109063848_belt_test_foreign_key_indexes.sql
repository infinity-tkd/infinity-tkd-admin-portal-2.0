-- Covering indexes for the foreign keys added by the belt test system and the
-- grading_events branch link (Supabase performance advisor: unindexed_foreign_keys).
-- Without them, deleting or updating a referenced profile or branch scans the
-- whole child table. The tables are small today, so a plain CREATE INDEX is fine.
-- Additive only: no data changes.

CREATE INDEX IF NOT EXISTS belt_test_syllabi_created_by_ops_idx ON public.belt_test_syllabi (created_by);
CREATE INDEX IF NOT EXISTS belt_test_syllabi_published_by_ops_idx ON public.belt_test_syllabi (published_by);
CREATE INDEX IF NOT EXISTS grading_candidates_registered_by_ops_idx ON public.grading_candidates (registered_by);
CREATE INDEX IF NOT EXISTS grading_candidates_finalized_by_ops_idx ON public.grading_candidates (finalized_by);
CREATE INDEX IF NOT EXISTS grading_events_branch_id_ops_idx ON public.grading_events (branch_id);
CREATE INDEX IF NOT EXISTS grading_item_scores_scored_by_ops_idx ON public.grading_item_scores (scored_by);
