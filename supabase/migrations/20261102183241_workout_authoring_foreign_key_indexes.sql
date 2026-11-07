-- Cover only the new authoring foreign keys identified by the release advisor.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE INDEX portal_workout_commands_actor_idx ON public.portal_workout_commands(actor_id);
CREATE INDEX workout_template_drafts_created_by_idx ON public.workout_template_drafts(created_by);
CREATE INDEX workout_template_drafts_updated_by_idx ON public.workout_template_drafts(updated_by);
COMMIT;
