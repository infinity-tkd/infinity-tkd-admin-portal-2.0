# Infinity TKD release candidate — 12 October 2026

The later [deep audit report](DEEP_AUDIT_2026-10-12.md) supersedes this report's current verification counts and records the additional achievement transaction migration and business-rule fixes. The results below describe the earlier release pass.

The admin portal is prepared as a release candidate. It has not been deployed. The changes below address concrete data, error recovery and reporting defects; the operational checks at the end remain required before release.

## Fixes in this pass

- Replaced partial realtime row patches with canonical reads. Student addresses and payment receipt/date/method metadata now survive updates. Archived students remain excluded from startup reads.
- Coalesced realtime bursts, reconciled after online/visibility/reconnect events, and added a 60-second fallback while visible and online. Failed datasets retain their notice and confirmed records. Recovery never replays writes.
- Limited startup reads to six concurrent datasets, bounded page requests to 15 seconds and the startup snapshot to 60 seconds, and cancelled superseded session reads. Non-Root permissions remain unavailable until their access rules load successfully.
- Disabled the installed SDK's automatic retries for mutations. This prevents a transient response from replaying a non-idempotent stock RPC. Safe paginated GET reads explicitly enable retries. Existing transaction request keys remain in use.
- Added persistent POS catalog/order/sales failure notices and a retry action. Catalog failure prevents checkout; concurrent checkout submissions are blocked. Pending, refunded, void and cancelled orders remain available for review but do not contribute to collected revenue. Exports and receipts display payment status.
- Added bounded, deduplicated runtime telemetry shared by route, global and segment error boundaries. Raw exception messages are omitted; route queries, emails and token-like strings are filtered. Logging failure does not trigger another error report.
- Corrected offline/save messages: uncertain saves require checking the record before retrying. The interface does not promise an offline write queue.
- Indexed invoice receipts once for lookup, replacing repeated scans. Added reproducible read-only live-data diagnostics and POS failure/recovery browser checks to the repository; CI includes the synthetic POS check without live credentials.

Earlier account, billing, inventory transaction, settings, motion, hydration, profile-route and development-memory changes are described in [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md), [DATABASE_REVIEW_2026-10-11.md](DATABASE_REVIEW_2026-10-11.md) and [DEVELOPMENT_CRASH_FIX_2026-10-12.md](DEVELOPMENT_CRASH_FIX_2026-10-12.md).

## Live database update

Applied `portal_realtime_sync` to project `lyjxmkyvqazqxkzoeszr` through the Supabase migration tool. The SQL source is [20261011215930_portal_realtime_sync.sql](supabase/migrations/20261011215930_portal_realtime_sync.sql).

The publication now includes 31 required tables, all with RLS enabled. This migration adds missing publication entries only; it changes no business rows, grants or RLS policies. It verifies table/RLS prerequisites and is tested for repeat application. Existing totals remained 77 students, 193 payments, 393 attendance records, 10 products, 4 partners and USD 6,178 in recorded paid tuition.

The nine-migration baseline SQL bundle and this separate realtime follow-up are already installed on the connected project. Do not reapply the baseline. Other installations must follow their migration history and rehearse missing upgrades against their actual schema.

## Verification completed

| Check | Result and scope |
|---|---|
| TypeScript | Passed, including a final standalone type check. |
| Regression suite | 69 passed, 0 failed. Isolated PostgreSQL tests include workflow transactions, RLS boundaries, live-schema compatibility and publication guards; new tests cover read recovery, bounded concurrency, telemetry privacy, SDK retry behavior and collected sales. |
| Lint / production build | Passed with 0 lint errors and 189 warnings. Generated 45 build entries. Remaining warnings concern unused code/image optimization and remain technical debt. |
| Production HTTP/security suite | 64 passed against the final local production build. These are request/response and security-header checks, not real signed-in workflow coverage. |
| Runtime dependency audit | 0 findings on 12 October (`npm audit --omit=dev`). Earlier full development-tool audit findings remain recorded in the readiness document. |
| Actual startup records | All 25 datasets and address joins fetched read-only: 701,082 bytes in 1,452 ms in one local observation. Required field/value checks returned no issues. This is not a capacity or latency guarantee. |
| Live RLS checks | Root saw 77 students, 193 payments and 4 partners. Head Coach saw 77 students and 4 partners, with no payments. A linked Student saw only their own student/profile/payment and no partners. Read-only SQL checks used existing identities; no passwords or new sessions were created. |
| Actual-record rendering | Local development and production checks passed using real database records in memory and a fictional browser identity, with database/admin writes blocked. These verify rendering compatibility, not provider sign-in or a full authenticated transaction journey. External assets were blocked and route timing was observational. |
| Development browser regressions | Auth, settings, data-load recovery and POS recovery passed. POS checks simulate outages, successful retries and refunded/pending/cancelled revenue exclusions. Data-load checks include drafts, hanging reads, online recovery and deduplicated telemetry. |
| Final production browser suite | All six scripts passed: hydration, auth, settings/partners, data-load recovery, POS recovery and motion. Fictional accounts and mocked provider responses cover held Navigator locks, session races, permission overrides, failed saves, retries, draft retention, mobile layouts and reduced motion. No live financial/account writes were submitted. |
| Motion observations | The production headless mobile settings-scroll observation recorded no long tasks and zero layout shift. Layout checks cover 1440/768/390/375 px. This is not a real-device FPS or sustained-load guarantee. |
| Post-migration advisors | No ERROR findings. Security: 13 WARN findings (public `citext`, 11 RLS helper execution notices, leaked-password protection) and 2 INFO notices for intentional server-only tables. Performance: 62 unused-index INFO notices. Details below. |

The read-only scripts keep business rows in process memory for verification and print aggregate diagnostics; they do not export rows or credentials. No live orders, payments, student updates or account changes were submitted by these checks.

The final browser suite initially could not run because automatic approval review reached an account usage limit. Once that review service responded again, the same approval path accepted the retry and all checks completed. This execution blocker is resolved. No remote CI run was initiated here.

The advisor's [leaked-password protection notice](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) requires provider configuration. [Public extension placement](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public) remains migration planning work because existing schema types depend on `citext`. The [11 executable security-definer notices](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) cover the reviewed RLS authorization helpers; these are not client-executable stock/payment workflow functions. [Unused-index notices](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) are monitoring suggestions, not evidence that foreign-key indexes should be dropped. The [two tables with RLS and no policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) are server-only telemetry/rate-limit tables whose client access should remain denied.

## Remaining release gates

1. **Backup and restore:** confirm a provider database backup and rehearse recovery with Auth configuration and Storage objects. Portal exports are not a complete backup. Test the separate Student portal against the shared RLS/workflow changes.
2. **Provider security:** enable leaked-password protection where supported, confirm password/session/redirect settings, and schedule the provider-supported PostgreSQL security upgrade with backup and maintenance planning. The inspected project reported PostgreSQL 17.6. Provider controls were not changed by this code pass.
3. **Historical reconciliation:** 193 existing paid invoices have no payment date and no immutable ledger receipts. Preserve these as legacy records until an authorized finance operator can substantiate their dates/references. Do not invent dates or receipt numbers. Reconcile historical stock/reservations before operational refunds.
4. **Deployment validation:** select hosting, configure server-only secrets and HTTPS/proxy behavior, and verify real Root/Admin/Coach/Student sign-in, session expiry, permission denial and representative transactions on staging. Establish error-log alerts and telemetry retention. Real-device/PWA/accessibility testing and concurrent-user load testing remain operational checks.

## Reproduce checks

From the repository with its server-only Supabase environment configured:

```powershell
npm run check
npm run db:readiness
npm run db:check-data
npm audit --omit=dev
npm run build
npm run start -- --hostname 127.0.0.1 --port 3110
```

In a second terminal, with a Playwright browser installed (or `PLAYWRIGHT_CHROMIUM_EXECUTABLE` pointing to a compatible executable):

```powershell
node scripts/smoke-production.mjs http://127.0.0.1:3110
node scripts/check-hydration.mjs http://127.0.0.1:3110
npm run test:auth-browser -- http://127.0.0.1:3110
npm run test:settings-browser -- http://127.0.0.1:3110
npm run test:data-load-browser -- http://127.0.0.1:3110
npm run test:pos-recovery-browser -- http://127.0.0.1:3110
npm run test:motion-browser -- http://127.0.0.1:3110
npm run test:live-render -- http://127.0.0.1:3110
```

The auth/settings/recovery/motion browser tests use fictional accounts and mocked services. The live-render check reads actual records server-side and supplies them to an isolated fictional browser session. Neither substitutes for a staging test with real account credentials and verified transaction outcomes.
