# Infinity TKD live database review — 11 October 2026

The schema upgrade has been applied to **InfinityTKD's Student Management System**, project `lyjxmkyvqazqxkzoeszr`. The Supabase connector reported success for all three migration transactions. The portal readiness check reports `ready: true`, with all 25 startup queries passing. This verifies database compatibility and tested access boundaries; it does not certify every application or separate Student portal workflow.

Verification was repeated on **12 October 2026 (Asia/Bangkok)**. Student and Head Coach read-only checks passed again after policy consolidation. The migration dates/names below remain the original recorded versions.

**12 October follow-up:** the incremental [realtime publication migration](supabase/migrations/20261011215930_portal_realtime_sync.sql) was applied successfully. All 31 required published tables have RLS enabled; business rows and totals were unchanged. Read-only application diagnostics also fetched all 25 datasets with actual address joins, and a fictional browser session rendered actual records without submitting live writes. The earlier metadata-only review below describes its original scope. See [RELEASE_CANDIDATE_2026-10-12.md](RELEASE_CANDIDATE_2026-10-12.md) for the current results and release gates.

## What the actual database showed

The pasted CREATE TABLE export was incomplete. The live database already had unique keys for monthly invoices, class enrollments, student lesson progress and evaluations. Adding more indexes blindly would have duplicated those keys. The review inspected the live catalogs: 38 public tables, 426 columns, 153 constraints, 132 public/storage policies, five views, actual enum values and 11 triggers. No personal row values or Auth secrets were downloaded; diagnostics used schema metadata and aggregate counts.

## Applied fixes

| Problem | Applied result |
|---|---|
| Missing payment ledger and workflow RPCs | Installed immutable `payment_transactions`, receipts, transactional payments, household payments, class deletion, measurements, library saves and other prepared workflow functions. |
| Anonymous execution of privileged legacy functions | Revoked client execution of private POS, inventory and operational functions, including overloads. Server operations use the service role and verify the actor's current account and permission. |
| Five views could bypass underlying RLS | All public views now use `security_invoker=true`. [PostgreSQL view permissions](https://www.postgresql.org/docs/current/sql-createview.html) |
| Permissive profile/contact policies and stale JWT roles | Replaced operational policies, fresh account/role checks and explicit student ownership. Removed anonymous profile reads. Suspended and forced-password accounts fail protected checks. |
| Conflicting role/status CHECK constraints | Removed overlapping legacy rules; Super Root, Paused and authorized Waived payments now match the application's supported values. |
| Cancellation/refund inventory logs failed their CHECK | Restock operations now use the database's valid `ORDER_CANCELLED_RESTORE` reason. Tests confirm repeated cancellation restores stock once. |
| Staff provisioning conflicted with a legacy member trigger | Provisioning updates the trigger-created member row. Role changes preserve historical member/contact records. |
| Student links inferred by shared email/username | Links now use explicit student/profile IDs, validate availability and keep both directions consistent. Matching contact information cannot silently transfer ownership. |
| Backdated promotions could overwrite the latest belt | Removed the competing legacy INSERT trigger. The transactional promotion logic retains the latest rank. |
| Library migration compared unsupported enum values | Text comparison prevents enum-cast failures against the actual Taekwondo categories. |
| Duplicate indexes and missing foreign-key indexes | Reused existing unique keys, removed proven identical redundant indexes/constraint, indexed every public foreign key and added payment/report/audit/measurement lookup indexes. [PostgreSQL constraints and foreign-key indexing](https://www.postgresql.org/docs/current/ddl-constraints.html) |
| Repeated permissive policy evaluation | Consolidated equivalent policies using the same OR semantics. Final scan reports no multiple-permissive-policy warnings. |
| Financial and settings integrity gaps | New settled payments require a date; waivers must be zero. Finite two-decimal money, measurement bounds, academy settings and partner date rules are enforced. Six rules were also validated against existing rows. |

## Preservation and verification

Before and after all live migrations, these aggregates matched:

| Data | Before | After |
|---|---:|---:|
| Students | 77 | 77 |
| Profiles / members | 7 / 6 | 7 / 6 |
| Monthly payments | 193 | 193 |
| Recorded paid amount | $6,178 | $6,178 |
| Attendance | 393 | 393 |
| Classes / enrollments | 10 / 79 | 10 / 79 |
| Body-composition records | 1 | 1 |

There were no open POS orders. Existing monthly records were preserved; the new transaction ledger starts empty. Historical receipt numbers, payment methods and dates were not invented.

- **59 tests passed**, including the original transaction/RLS regressions and a new rehearsal against the actual live-schema definitions, enums, foreign keys, indexes, public policies and legacy triggers. Test records were fictional and isolated in PGlite.
- The installed Supabase JavaScript client is pinned to 2.117.3 in both package manifests; the installed version was retained.
- Read-only live role checks: Root could read 77 students and 193 payments; the linked Student could read one own student, profile and payment; Head Coach could read students but had no financial permission and saw zero payments.
- Final catalog checks: zero anonymous SECURITY DEFINER functions, zero client-executable private portal mutators, zero public tables with RLS disabled, zero view RLS bypasses, zero missing public foreign-key indexes and zero overlapping permissive policies.
- Final REST schema checks: all 25 startup queries pass; all checked workflow signatures and login rate limiter are available.
- Supabase security advisor: zero ERROR findings, zero mutable function search paths, zero anonymous privileged-function findings.
- Supabase performance advisor: zero warning-level findings, zero duplicate-index or unindexed-foreign-key findings. New indexes are understandably reported as unused until real traffic uses them; that INFO is not evidence they should be removed.

## Remaining improvements and data work

1. **Reconcile 193 historical paid invoices without a payment date.** All legacy paid invoices are affected. Recover dates from actual bank/cash records before correction. `portal_settled_payment_date` remains NOT VALID for those existing rows while enforcing new writes. Validate it after verified reconciliation. Missing historical receipts/methods likewise require source evidence.
2. **Enable leaked-password protection in Supabase Authentication.** The advisor confirms it is disabled. The connected tools do not expose the Auth configuration setting, so it was not changed. [Password-security setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
3. **Plan relocation of `citext` to the extensions schema.** This remains an advisor warning. Public-schema CREATE was revoked from anonymous/authenticated roles now. Moving the extension deserves a separate rehearsal of username/email constraints, operators, legacy SQL and the other Student application. [Extension advisor](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)
4. **Keep the 11 authenticated policy helper functions intentional.** Their SECURITY DEFINER warnings are expected: they return account/role/ownership/permission answers and avoid recursive RLS. They have fixed paths and fresh active-account checks. Private mutators remain server-only. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
5. **Keep telemetry and rate-limit tables server-only.** RLS with no client policy intentionally denies browser access. These two INFO advisories do not need permissive policies. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
6. **Verify the separate Student portal after these shared security changes.** Legacy direct curriculum/progress writes are restricted; that application must use its authorized server workflow. Real login credentials, real devices, concurrent network traffic, deployed server secrets, backup/restore drills and production monitoring still need operational validation.
7. **Reduce duplicated business fields gradually.** Plan canonical sources for `billing_month` versus year/month labels, belt ID versus belt name, product category ID versus name, and single versus multiple class weekdays. Keep compatibility while migrating consumers; do not drop these columns without checking the other portal.
8. **Review retention and export/restore procedures.** Audit logs, telemetry and expired rate-limit rows need operational retention schedules. Application exports are not substitutes for a tested database/Auth/Storage backup.
9. **Install the managed PostgreSQL security update.** The live engine reports 17.6. Supabase's 25 September release offers 17.11, which addresses 44 CVEs. The read-only compatibility review found zero ltree indexes, zero float GiST indexes, zero non-extension custom selectivity estimators and zero public bytea columns. These results do not audit encrypted values outside this application's public schema. Schedule the supported engine update with backups and a maintenance window; the available connector cannot perform it. [Release and upgrade checks](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)
10. **Keep explicit Data API grants in new migrations.** Supabase changes default exposure for new tables on existing projects on 30 October 2026. Existing table grants are preserved. The portal's new payment and household tables already declare their service/client grants explicitly alongside RLS. Continue this pattern rather than relying on automatic grants. [Data API change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)

## SQL code and migration record

The complete code is in [production-upgrade-20261009.sql](supabase/production-upgrade-20261009.sql), rebuilt from nine ordered source migrations. Its original filename is retained for existing references. **Do not run the full bundle again on this project.** It is for an equivalent pre-upgrade database; use forward migrations for subsequent changes.

Live migration history:

| Version | Name | Contents |
|---|---|---|
| 20261011165119 | portal_production_upgrade_20261011 | Six prepared workflow migrations plus live-schema hardening |
| 20261011165527 | portal_policy_optimization_20261011 | Equivalent policy consolidation |
| 20261011165644 | portal_validate_existing_records_20261011 | Validate six integrity rules against existing rows |

Rebuild the distribution SQL with `node scripts/build-sql-upgrade.mjs`. Run `npm test` for isolated verification and `npm run db:readiness` for metadata-only live compatibility checks. The local scratch metadata snapshot records the pre-upgrade definitions, not a full data/Auth/Storage backup.

Reload the admin portal or click **Retry loading records**. The confirmed missing-ledger cause of the incomplete-reports warning is resolved. Any new warning should be assessed by its named dataset and error code.
