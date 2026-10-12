# Partners loading and compact Settings navigation

The live Supabase schema exposes the Partners table and the login rate limiter. It does not expose `profiles.must_change_password`. Every protected admin API reads that account security field before accessing its data, so the Partners request fails before querying partners. The previous client discarded the API error and showed a generic Action Failed modal.

## Required database repair

Run the contents of `supabase/profile-security-repair-20261011.sql` in the Supabase SQL Editor for the portal's configured project:

```sql
BEGIN;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
NOTIFY pgrst, 'reload schema';
COMMIT;
```

Then click Retry on Partners. This repair adds the missing field without changing existing records, permissions or existing password-change requirements. It can be run repeatedly and before the full production upgrade. It is a focused repair, not a replacement for the workflow and security migrations already supplied.

Verify account API prerequisites with `node scripts/check-database-readiness.mjs --auth-only`. Both checks must be true. This reads schema metadata only. The repair has been tested in an isolated PostgreSQL database, but has not been applied to the live project from this workspace; no SQL execution connection is available here.

## Application changes

- Account schema failures return an actionable setup message and HTTP 503. Missing accounts remain forbidden, suspended accounts remain blocked, and temporary-password requirements remain enforced.
- Partners displays loading errors inline with Retry. Failed retries are caught, API error messages are preserved, and previously loaded records remain visible with a stale-data notice.
- Loading has a 15-second network timeout. Responses from a previous session cannot repopulate private partner state. A failed request does not claim that the directory is empty.
- Add, Edit and Delete buttons use their individual permissions, including explicit Admin account overrides. Clipboard failures are handled.
- Settings sections use compact horizontal tabs, smaller icons and text, and full-width content on larger screens. Mobile keeps its section selector. Buttons retain 44-pixel minimum height.

## Verification

All 55 automated tests passed, including the shared account guard, invalid account state and missing schema, repeated repair application, preservation of existing password requirements, and compatibility with the full production upgrade. Type checking and the production build passed. Targeted linting reported no errors and 19 existing unused-variable warnings.

The browser regression passed mocked Partners failures, repeated failed retries, recovery, retained records, permission overrides and the existing Settings checks at 375, 768 and 1440 pixels. The desktop screenshot was visually checked. Provider traffic uses fictional accounts and mocks; no live records are edited. The live account readiness check remains false until the SQL is applied: the rate limiter is present, but the password-change column is absent.
