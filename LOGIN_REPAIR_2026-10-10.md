# Login repair — 10 October 2026

## Immediate 503 repair — 11 October 2026

The live metadata check on 11 October still reports `portal_take_rate_slot` missing. The API stops before checking your password. A browser refresh or password reset cannot install this function.

For the smallest database repair, open the Supabase dashboard for project `lyjxmkyvqazqxkzoeszr`, open **SQL Editor → New query**, paste the entire contents of `supabase/login-repair-20261011.sql`, and click **Run**. This creates only the private rate-limit table and server-only login function; it is safe to run again and compatible with the full upgrade later.

Then verify from the portal folder:

```powershell
node scripts/check-database-readiness.mjs --login-only
```

Wait briefly for the schema cache to refresh if needed. Once this prints `"ready": true`, retry sign-in. The SQL also requests the cache refresh. If earlier attempts triggered a 429, wait one minute. This check confirms the missing function is installed; actual login still requires valid credentials and an active staff profile.

The configured REST service key cannot execute arbitrary SQL, and no connected database administration session was available. This file was tested locally, but has **not** been applied to your live database. The full production upgrade below is still required for the other workflows.

Two separate defects were found. The browser used Supabase 2.106.2's Navigator lock path and started data work inside auth callbacks. The connected database also lacks `portal_take_rate_slot`; the login endpoint therefore returns HTTP 503 before checking credentials. Read-only REST metadata confirmed that the other checked upgrade functions and `profiles.must_change_password` are also absent. No live records or credentials were changed.

## Application changes

- Updated Supabase to 2.117.3. The SDK's supported refresh coordination avoids Navigator locks and guards concurrent session commits. See the [official migration notes](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/migrations/lockless-coordination.md).
- Reuse one browser client across Fast Refresh; verify sessions outside the auth subscriber; handle verification failures and cleanup.
- Ignore obsolete profile/data responses after logout or account switches. Clear all private portal state. Refresh events avoid downloading the full academy snapshot again.
- Wait for an in-flight logout before establishing a new login session. Sign-in requests have a 20-second network timeout.
- Report provider logout errors instead of claiming all sessions were revoked. The updated SDK clears the current browser session even when revocation fails; other-device revocation remains unconfirmed.
- Reject unknown staff roles as well as inactive and Student accounts. Service outages and throttling now have distinct user messages; database rate-limit failures remain fail-closed.
- Keep `.next-dev` separate from `.next` so development cannot overwrite production build output. The former is ignored by Git.
- Fixed attendance realtime updates that removed another class's record for the same student and date.

## Required database installation

The browser changes alone cannot restore live login while the required database function is missing. The SQL code is in `supabase/production-upgrade-20261009.sql`. It contains the six prepared migrations in one transaction, including the login rate limiter and account safeguards.

Use `supabase/preflight-20261009.sql` to identify incompatible existing data/schema, then follow `PRODUCTION_READINESS.md` for installation against the existing database. Apply the bundle once, rather than applying it alongside the individual migration files. This repair did not execute SQL against the live project.

After installation, run `supabase/postflight-20261009.sql`, then:

```powershell
npm run db:readiness
# Stop and restart the application process to use the updated source/dependencies.
npm run dev
```

The readiness command reads metadata only and prints function/column availability, never keys, credentials, tokens or personal records. Restarting the browser tabs releases any lock held by older loaded SDK code. Password changes or browser storage clearing are not required to install this fix.

## Verification

The isolated regression suite includes login failures, active staff login, unknown roles, missing migration, throttling, subscriber cleanup, refresh deduplication and obsolete verification. The headless browser test uses fictional identities and mocked services. It covers a held legacy Navigator lock, two-tab synchronization, reload, public token refresh, sign-out during a delayed student snapshot, and signing back in. These checks do not establish that real production credentials work before the SQL upgrade is installed.

Final local results: **49 regression tests passed; production build passed (44 entries); 63 HTTP smoke checks passed; auth browser checks passed in development and production; production hydration checks passed; runtime dependency audit found zero advisories.** Lint has zero errors and 194 existing warnings. Browser auth coverage also verifies overlapping sign-out/sign-in and provider logout failure; the latter clears the local session and reports unconfirmed other-device revocation. Production auth tests block provider realtime connections as well as mocking HTTP responses.

The CI workflow now installs Chromium and runs hydration and auth browser regressions alongside the production HTTP smoke suite. To run the browser checks locally against an already started portal:

```powershell
npx playwright install chromium
npm run test:auth-browser -- http://127.0.0.1:3000
```

On a machine with installed Edge, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can point to its `msedge.exe` instead of downloading Chromium.
