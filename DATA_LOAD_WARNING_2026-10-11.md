# Portal data-load warning

**Resolved in the live database on 11 October 2026:** the complete workflow upgrade, live-schema hardening and policy optimization were applied through the Supabase connector. All 25 startup queries and required workflow checks now pass. Existing student/payment/attendance counts and the $6,178 paid total were preserved. See [DATABASE_REVIEW_2026-10-11.md](DATABASE_REVIEW_2026-10-11.md). Do not reapply the full SQL bundle to this project.

On 2026-10-11, schema-only requests against the configured Supabase project confirmed that `public.payment_transactions` is unavailable in its API schema (`PGRST205`). The other 24 startup query shapes passed, including the student/member address joins and pagination ordering. These checks used the service role and `limit=0`: no personal rows were downloaded and no database writes were made. They do not validate the signed-in user's RLS visibility or connectivity.

The existing `payments` table passed the check. The missing transaction table supplies receipt numbers and payment methods. The old warning appeared after **any** failed startup request and did not identify the affected records.

Before the full upgrade, the login rate-limit function and `profiles.must_change_password` were present, but the workflow functions were unavailable. After the authorized live upgrade, every checked workflow function is available.

## Database repair for other pre-upgrade installations

Use the existing complete SQL bundle; creating an empty table alone would leave payment recording and its transaction protections unavailable.

If the SQL Editor already shows the transaction table and these functions, run `NOTIFY pgrst, 'reload schema';` and repeat the readiness check first. Do not reapply the full bundle to an installation where it has already completed.

1. Run [preflight-20261009.sql](supabase/preflight-20261009.sql) against a staging copy and resolve any reported conflicts.
2. Apply [production-upgrade-20261009.sql](supabase/production-upgrade-20261009.sql) once in the Supabase SQL Editor. This transaction installs the payment ledger, required workflow functions, permissions, RLS, and integrity checks.
3. Run [postflight-20261009.sql](supabase/postflight-20261009.sql), then validate and apply the same upgrade to the live project.
4. Run `npm run db:readiness`. Click **Retry loading records** in the portal after the checks pass.

The bundle preserves monthly payment records and does not invent missing historical receipt numbers, methods or dates. It passed both the simplified fixture and the actual live-schema rehearsal before live application. The new ledger starts empty; 193 existing paid invoices still need verified historical dates.

To check only the startup query shapes without reading rows:

```powershell
npm run db:readiness -- --startup-only
```

## Implemented changes

- The notice names each affected dataset and distinguishes missing database setup, permission failures, expired sessions, and temporary failures. Technical details contain only dataset names and error codes.
- Financial guidance appears only when financial inputs or receipt data fail. A Library-only failure does not imply an incomplete financial report.
- Retry runs in place, prevents overlapping retries, and retains component drafts. Failed datasets keep their previously loaded records, still flagged as unavailable. Successful empty results replace previous records correctly.
- Successfully loading Partners through its API fallback clears the corresponding startup error, including an empty directory.
- A temporary profile-query outage no longer signs out an already verified account. Missing or inactive profiles still fail authentication.
- Bootstrap queries have a 15-second abort signal; the Partners fallback has its own 15-second bound. Disabled local storage cannot mark a completed download as failed.

## Verification

- 58 unit/database tests passed, including the existing SQL upgrade, payment integrity and RLS tests, plus three new data-load classification/preservation tests.
- Mocked browser checks passed for the named warning, failed/successful retries, retained Settings drafts, scoped financial guidance, a profile outage without logout, empty Partners recovery, the 375px mobile layout, and a hung request timing out and recovering on retry.
- The final production build passed. The data-load checks and existing Settings/Partners checks passed against that build. Authentication regression checks also passed against the development server. The new notice/helper passed ESLint; existing repository lint warnings remain.
- All browser identities and provider responses were fictional. The live schema mismatch was subsequently resolved; the complete test suite now passes 59 tests, including actual legacy triggers, enums, foreign keys and policy behavior.
