# Infinity Taekwondo admin portal — fix status, 10 October 2026

This maps the 37 findings in your pasted review to the current source. **Prepared** means the application/SQL changes are implemented locally and covered by relevant automated checks; it does not mean the live database or deployment has been upgraded. **Partial** means the immediate defect is addressed but the wider feature or release work remains.

## Additional problems fixed during this continuation

- Fixed the reported Supabase Navigator lock error by upgrading to the SDK's supported refresh coordination, reusing one browser client and keeping verification outside auth callbacks. Late profile/data responses cannot restore a signed-out account; refresh events avoid full reloads. Overlapping logout/login operations are serialized, and provider logout failures are reported without falsely claiming other devices were revoked; the updated SDK clears the local session.
- Confirmed a separate live login blocker using read-only metadata: the database lacks `portal_take_rate_slot`, other checked upgrade functions and `profiles.must_change_password`. The prepared SQL must be installed before live login can succeed. See `LOGIN_REPAIR_2026-10-10.md`.
- Development now uses `.next-dev`, preventing the existing development server from corrupting `.next` production builds. Attendance realtime updates preserve another class's record on the same student/date.
- Fixed the reported nonce hydration warning on both layout scripts. A real browser confirmed that browsers hide the nonce attribute while the script's nonce property still matches the CSP. The security policy remains in place.
- Class deletion now uses one database transaction. Attendance history blocks deletion, and a later delete failure cannot leave enrollments removed. Malformed IDs are rejected; edits of missing classes return a failure.
- Body measurements and current student metrics commit together. Retries are idempotent, older measurements retain their place in history, zero optional values are preserved, and invalid numbers/dates are rejected.
- Family collection now saves actual sibling tuition allocations and a permanent consolidated receipt. All allocations roll back if one fails. A retry retrieves the original receipt, and duplicate bank references are rejected. Staff must verify funds received; the screen does not execute a bank payment.
- Student profile and enrollment-date changes commit together. Failed saves reach the caller, so forms cannot report successful status changes or close after a failed archive. Contact emails do not overwrite login emails; pausing training does not simulate a disabled login.
- Library assets, muscle relations and corresponding curriculum records commit together. New numeric IDs avoid existing curriculum IDs. Conflicting legacy mappings are left untouched and require reconciliation. Lessons with student progress cannot be deleted. Watch-status updates retain belt requirements; completion resets preserve existing progress metrics/history.
- Academy settings no longer fall back to a failed direct write and then report success. Server-managed fields are excluded from the settings request, and the displayed settings come from the confirmed database record. Workout forms wait for confirmed saves before closing.
- Student, staff and library imports now have byte/row limits, paced requests, downloadable row errors and retries that skip confirmed rows while the wizard remains open. CSV files support quoted multiline fields. Staff credential downloads contain only confirmed creations.

## Original findings

| # | Finding | Status | Current result / remaining work |
|---|---|---|---|
| 1 | Privileged database functions | Prepared | Service-only transactional POS/inventory functions enforce fresh actor permissions; known unsafe legacy entry points lose client execution rights. Verify all installed legacy functions with preflight/postflight. |
| 2 | Profile privilege gaps | Prepared | Protected identity/role fields require trusted operations; signup metadata cannot assign staff authority. |
| 3 | Permission matrix consistency | Prepared | API guards, database checks and UI actions use effective role/user permissions. Class and finance/library handlers accept explicit staff grants instead of additional conflicting role gates. Exercise configured overrides on staging. |
| 4 | Shared password | Prepared | Unique temporary credentials and mandatory first password change for staff. |
| 5 | Logout all devices | Prepared | Uses Supabase global sign-out instead of simulated sessions. Provider-issued access tokens retain their normal expiry behavior; global sign-out revokes refresh sessions. |
| 6 | Admin fallback | Prepared | Failed/missing/inactive profiles fail closed. |
| 7 | Public account information | Prepared | Anonymous profile/permission access and public username-to-email lookup are restricted/retired. |
| 8 | Suspension/demotion | Prepared | Permissions consult current active profile/overrides rather than trusting stale role claims. |
| 9 | Student-shop API/SQL mismatch | Prepared | Checkout uses the matching transactional RPC contract. The separate Student portal must send and retain a request-key UUID. |
| 10 | Unsafe checkout fallback | Prepared | Failed atomic operations remain failures; separate-write checkout fallbacks removed. |
| 11 | Submitted POS prices | Prepared | Catalog prices and variant overrides determine totals on the server. |
| 12 | Overselling | Prepared | Locked stock validation rejects insufficient stock; no clamping to zero. |
| 13 | Cancellation stock inflation | Prepared | Reservation tracking restores reserved stock once. Historical orders require reconciliation. |
| 14 | Cancellation/refund confusion | Partial | Cancellation retains refund-pending status until an authorized operator records a verified refund reference. Automatic bank refunds/webhooks remain an integration task. |
| 15 | False payment success | Prepared | Confirmed database results are required; settlement failures propagate to callers. |
| 16 | Invented receipts | Prepared | Immutable tuition transactions and family batches persist receipt identity, collector, date, method and family reference. |
| 17 | Tuition rules | Partial | Shared configurable fees, calendar anniversaries, arrears, full-month settlement and explicit zero-value waivers are implemented. Partial payments, credits, historical rate snapshots and pause/proration/refund allocation rules need a wider ledger design and agreed business rules. |
| 18 | Local households | Prepared | Guardians and unique sibling links persist through a transactional API. Saves retain their generated household ID for retries. |
| 19 | Family estimate disguised as collection | Prepared | Review-and-confirm workflow records all sibling allocations atomically and returns a real family receipt. |
| 20 | Daily-only attendance | Prepared | New attendance is keyed per student, date and class; legacy daily rows remain distinct. |
| 21 | Bulk absent overwriting check-ins | Prepared | Roster initialization does not overwrite existing marks. |
| 22 | Class capacity | Prepared | Database validation covers enrollment, class edits and reactivation. Real concurrent staging tests are still required. |
| 23 | Count-derived student IDs | Prepared | The server generates student IDs; bulk import no longer supplies count-derived IDs. |
| 24 | Partial related changes | Partial | Student/profile/address/enrollment, class deletion, measurements, catalog/library and payment writes use transactions; archiving preserves records. Supabase Auth and PostgreSQL cannot share one transaction, so provisioning/email changes use compensation and report reconciliation failures. |
| 25 | UTC calendar drift | Prepared | Academy calendar dates and capped anniversaries are centralized. |
| 26 | Imports / CSV safety | Prepared | Multiline parsing, 2 MB/500-row bounds, pacing, row-error downloads and in-memory resume added; text exports prevent spreadsheet formulas. Reloading loses resume state. Check the directory after an ambiguous provisioning/network failure before retrying. |
| 27 | Truncated/broad loads | Partial | Pagination prevents silent row-limit truncation and read failures are surfaced. Large initial data loads still need performance measurement and incremental module loading. |
| 28 | Invented dashboard figures | Prepared | Empty/missing data no longer produces fixed simulated turnout figures. |
| 29 | Audit integrity | Partial | Client audit writes are restricted; core transactional mutators write audit events in their transaction. Remaining API-only best-effort audit paths require monitoring and broader coverage before claiming complete audit guarantees. |
| 30 | Sensitive browser caches | Prepared | Student, POS and grade caches were removed; protected data is network-only. Verify session changes and browser storage on real devices. |
| 31 | React correctness | Prepared | Conditional hooks/shared-state mutation fixed; nonce hydration mismatch now verified in development and production browsers. |
| 32 | Release checks | Prepared | Type/lint failures block builds; CI includes regressions, runtime audit, SQL bundle consistency, compilation and HTTP smoke checks. Remote CI has not been run here. |
| 33 | Vulnerable packages | Partial | Runtime audit reports zero findings. Five high affected development-package entries remain in the documented unpatched ESLint/braces chain. |
| 34 | PWA consistency | Prepared | Production builds regenerate the worker; updates require deliberate reload and private navigation remains network-only. Real device/offline/update tests remain release work. |
| 35 | Complete backups | Partial | Application export now includes all supported application tables, including family receipts. It is not an Auth/Storage backup or a consistent database snapshot; provider backups and restore drills remain required. |
| 36 | Reproducible database setup | Partial | A six-migration atomic upgrade, preflight/postflight and isolated fixture are provided for the existing installation. The fixture is not a complete production baseline; restore the actual schema with enums/FKs/Auth/Storage triggers for staging. |
| 37 | Usability / maintainability / extra features | Partial | Several forms now preserve data on failed saves, and import/collection workflows are clearer. Full keyboard/screen-reader/device review, translations, unsaved-change handling, store decomposition, monitoring, waitlists, holiday/makeup classes, guardian accounts and reminder integrations remain separate work. |

## Verification completed locally

- TypeScript passed; ESLint: **0 errors, 194 warnings**, **0 hook dependency warnings**.
- **49 regression tests passed**, including the complete six-migration bundle in isolated PostgreSQL, an enum-typed library field, privileges, intentional failures/rollback, retry safety, imports, and API validation.
- Production compilation passed with **44 build entries** with the development server still running in its separate build directory.
- **63 production HTTP smoke checks passed**. Anonymous protected operations were rejected; these requests did not submit live database changes.
- Browser checks passed on three pages and a dark-theme reload in **both development and production**. No hydration/page errors; browser nonce properties matched the response CSP despite hidden nonce attributes.
- Production dependency audit: **0 findings**. Passing these checks does not establish that every authenticated workflow, device or production integration is error-free.
- Auth browser checks passed in development and production using fictional accounts and mocked provider responses, including lock contention, two tabs, refresh/reload, obsolete snapshots and logout failures/races. The latest source passes 49 isolated tests, the production build and 63 HTTP smoke checks. Live login remains blocked until the prepared SQL is installed.

## SQL and release instructions

Use `supabase/production-upgrade-20261009.sql` for an existing installation that has not applied this hardening set. It contains all six migrations in one transaction. If the original five October 9 migrations are already installed, apply **only** `supabase/migrations/20261010090000_portal_workflow_integrity.sql`.

Follow `PRODUCTION_READINESS.md`: back up and restore into staging, run preflight, reconcile legacy library/curriculum ID conflicts and duplicate progress, apply the matching SQL, test authenticated staff/Student roles and financial/inventory concurrency, then run postflight. No live SQL upgrade, production deployment or authenticated financial/account mutation was performed in this task.
