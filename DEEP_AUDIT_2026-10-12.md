# Infinity TKD deep audit — 12 October 2026

The release candidate now includes another pass over attendance, achievements, tuition reporting, enrollment, promotion records and save recovery. The application is not deployed. Passing these checks establishes the tested behavior; it cannot establish that every component and future production condition is error-free.

## Repairs completed

- Class attendance status filters, counts, roster marking and analytics use the selected class. A mark in a different class on the same date no longer changes that class's roster. Combined attendance uses a deterministic rule: a daily mark takes precedence; otherwise Present, Late, then Absent. Enrollment eligibility uses the selected class's enrollment date.
- Tournament achievement additions, edits and removals commit in one PostgreSQL transaction. Failed batches roll back completely, cross-student record edits are rejected, and retry keys prevent duplicate inserts after an uncertain response. Failed saves preserve the form. Inputs and close/save controls are disabled while saving.
- Collected tuition totals and payment averages use Paid rows only. Unpaid, pending and waived rows do not inflate collections. Receipt search recognizes the recorded receipt number. Multi-month prepayment validates complete tuition, blocks concurrent submission and no longer treats an explicitly entered zero as an omitted amount.
- Branch saves wait for a confirmed database record and keep the draft on failure. Enrollment, unenrollment and technique removal require confirmed affected rows. Inactive students do not consume active enrollment capacity. Schedule and dashboard selections recover when their selected class or branch disappears.
- Student provisioning generates a unique credential instead of offering a shared default password. Both provisioning dialogs explain the existing minimum of 12 characters.
- Student edit controls honor effective permission overrides instead of relying solely on the account's role name. The browser regression verifies that an Admin with a denied student-edit override cannot see achievement edit controls.
- Belt certificate clearing stores NULL rather than a potentially colliding empty unique value. Promotion history edits use the confirmed store workflow and refresh the affected student's belt.
- Staff Dan APIs reject impossible/future issue dates, malformed IDs and empty edits, and report missing deletions. The client uses saved records and refreshes database-derived profile ranks rather than guessing the latest certificate from local history. Session changes block stale responses.
- Attendance quick dates use academy calendar dates, including leap days and year boundaries, rather than UTC conversions that can choose the wrong day. The store no longer manufactures active Coach accounts from member records when profiles are unavailable.

## Live database repair

Applied `portal_achievement_integrity` through the Supabase migration tool to `lyjxmkyvqazqxkzoeszr`. Source: [20261012065927_portal_achievement_integrity.sql](supabase/migrations/20261012065927_portal_achievement_integrity.sql).

The new `portal_save_achievements` function checks the active actor's permission, validates ownership, locks the student's batch and stores its retry result in the audit transaction. Only `service_role` can execute it. Authenticated clients no longer write the achievement table directly; the admin portal uses `/api/admin/achievements`. Coordinate any separate client that previously wrote achievements directly before releasing it.

This incremental migration is separate from the nine-migration baseline and the realtime follow-up. All three are already installed on the connected project. Apply only missing migrations on another installation, after rehearsal; do not rerun the whole baseline against this project.

Before/after checks preserved 77 students, 193 payments, 393 attendance records, 23 achievements, zero POS orders and USD 6,178.00 in recorded paid tuition. No live financial, achievement, account or enrollment test mutations were submitted.

**Weekend-Morning remains at capacity 35, as requested.** Its 36 active enrollments are flagged for roster review in Schedule. The existing roster was preserved and new active enrollment remains blocked. There are 43 total enrollment records including inactive students; the capacity warning counts active, unarchived students only.

## Verification

- `npm run check`: TypeScript passed; 75 automated tests passed, zero failures; lint has zero errors and 189 existing cleanup/image warnings.
- Isolated PostgreSQL tests exercise atomic rollback, ownership checks, permission overrides, duplicate/overlapping changes, retry identity, restricted privileges and compatibility with the installed schema fixture.
- Production build: passed, 46 build entries. Windows compilation required the permitted host execution path; the sandbox attempt failed canonical path access before compilation.
- Production HTTP/security checks: 65 passed, including the protected achievement endpoint, page responses, CSP nonces and authentication/origin failures. These do not exercise real credentials.
- Production browser suites passed for hydration, auth/session races, settings/partners, data-load recovery, POS recovery, motion and the new business workflow. Synthetic accounts and mocked services cover conflicting class marks, capacity warnings, failed achievement saves, retained drafts and retry keys. The business check is included in CI.
- All 25 live startup datasets and address joins loaded read-only with no checked field/value issues: 701,082 bytes in 1,172 ms in this observation. Production rendering of actual records passed with a fictional browser session and writes blocked. This is a compatibility observation, not a sustained-load or device performance guarantee.
- Live aggregate checks found no profile/student link mismatches, order/variant ownership mismatches or POS amount inconsistencies. Post-migration metadata confirms the new function, server execution rights, denied direct client writes and successful startup queries.

## Remaining release work

- Review the Weekend-Morning roster without exceeding capacity 35. Historical Paid rows still lack payment dates (193 records); reconcile them from evidence, rather than inventing dates or receipts.
- Complete real-account staging journeys, concurrency/load tests, real-device/accessibility checks, HTTPS/proxy/monitoring configuration and a tested provider backup/restore before deployment. Check compatibility with the separate Student portal after shared database privilege changes.
- Supabase advisors still report 13 WARN findings and two INFO findings, with zero ERROR findings. The notices cover [public extensions](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [11 authenticated RLS-helper execution notices](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) and two intentional server-only tables. Provider password protection, the pending PostgreSQL security update and backup settings need provider configuration and verification; this migration does not complete those operations.
- Run one development server for this checkout. A second independently started development process was present during this audit; duplicate development compilers consume memory and share `.next-dev`. Production uses its separate `.next` build.

The previous [release candidate report](RELEASE_CANDIDATE_2026-10-12.md) records earlier verification and fixes. This report supersedes its current test counts and achievement workflow status.
