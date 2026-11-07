# Academy operations release — 25 October 2026

Final application verification continued on 26 October 2026.

The staff portal now includes an **Operations** workspace for daily follow-ups, dated classes, membership invoices, reconciliation, grading and system health. The database upgrade is installed on the connected Infinity TKD project. The application has not been deployed.

## What changed

| Request | Implementation and location |
| --- | --- |
| Background-job health | Operations → Job health shows durable run history, partial failures, stale activity, push retry counts and configuration status. Database leases prevent overlapping workers. A failed membership update creates an assigned review task. |
| Membership pauses and returns | Operations → Invoices & pauses records administrator approval, dates and reasons. An active pause starts immediately. Scheduled changes run through the worker. Automatic returns refer to the specific approved pause, so an old pause cannot reactivate an unrelated manual hold. Capacity checks still apply. |
| Reminder and grace periods | Operations → Job health stores reminder lead time and post-due grace independently. Neither setting changes tuition or erases a debt. The old academy-settings grace input is removed. |
| Actual class sessions | Operations → Dated classes generates occurrences from the saved timetable for a chosen period. Each stores its original date, actual start/end, branch, coach, capacity and roster. |
| Closures and rescheduling | Branch or academy holidays cancel affected occurrences. Session changes require a reason and current revision. Marked sessions cannot be moved or cancelled. Attendance and makeup logic use the actual date. |
| Enrollment history | Enrollment changes create immutable events and dated membership periods. Future rosters update; started-session rosters remain intact after transfers or unenrollment. |
| Payment reconciliation | Operations → Reconciliation imports a previewed USD bank CSV or an individual bank line. Matching requires the exact reference and amount of a non-cash receipt. It records evidence and initiates no bank transfer. |
| Partial payments and credits | Invoices preserve the original fee. Received funds, invoice allocations, unused receipt balances, administrator-issued credits and pause waivers remain separate records. Credits and waivers do not inflate cash totals. |
| Today queue | Operations → Today combines outstanding notices and permitted follow-ups. Open work is queried before the display limit, so old closed tasks cannot hide it. |
| Assigned follow-ups | Tasks record category, owner, due date, context and outcome. Owners or administrators can update them; the database rechecks current category access. Concurrent edits require a refresh. |
| Student timeline | Student details → Student activity and enrollment history loads on demand. Financial, attendance and grading entries follow the viewer's permissions. |
| Student portal | Deferred as requested. Existing ownership checks and backend contracts remain available for a future client. This staff application does not grant students administrative access. |
| Structured grading | Operations → Grading separates exam setup, assessment and final promotion. Promotion checks score, dated attendance and rank progression, then creates the belt-history record. Exceptions require an administrator's recorded reason. |
| Focused data loading | Shared route plans request the datasets needed for the selected page. Operations panels load their own views. Class and reconciliation views accept date ranges. Failed reads keep visible warnings and preserve recoverable drafts. |
| Device performance | Operations → Performance reports LCP, INP and CLS by page and coarse device class. No query strings, student content or device model are stored. Physical-device acceptance remains outstanding. |
| Data quality | Operations → Data quality flags missing settlement evidence, over-capacity rosters and conflicting account links. Review notes retain the finding until the underlying issue is corrected. |
| Forms and accessibility | Operation forms use explicit labels, keyboard focus styles, touch targets, reduced-motion support and local save feedback. Failed saves retain input; repeated clicks and retries cannot duplicate a confirmed operation. |
| Shared rules and smaller modules | New workflows live in separate components under `components/operations/`. Contracts, billing status, query plans, permission checks, job tracking and database transactions are shared modules. Existing large screens still need gradual decomposition as they change. |

## Membership and payment rules

- A pause includes its first date and excludes its return date. The student can return on the recorded return date.
- Only administrators approve, void or return an approved pause. Ordinary profile edits cannot bypass it.
- A complete billing cycle covered by an approved pause is waived. A partially covered cycle remains payable. Existing paid receipts remain unchanged.
- A partially collected cycle needs review before a pause can waive it. Corrections require a reason and retain their audit records.
- Monthly due dates follow enrollment-based billing anchors and audited schedule overrides. Changing an invoice's dates does not replace its original fee.
- Unknown historical unpaid fees require an administrator's verified amount and evidence reason. The system does not assume today's tuition was the historical price.
- A receipt records money actually received. Its allocations reduce invoice balances; an unused receipt balance becomes a linked credit. Manual credits require administrator approval and a reason.
- Finance, its renewal calendar and the dashboard use shared cycle calculations. A paused student can still owe a partial cycle. Credit settlement reduces receivables without increasing cash collections, and later fee or scholarship changes cannot erase a saved invoice balance.
- Unbilled historical cycles remain explicitly identified as current-rate estimates until an administrator verifies their original invoices. Missing historical prices are not silently presented as verified evidence.
- Existing full-payment and household screens remain for eligible cycles. A cycle with allocations or credits must be handled through the invoice ledger.
- Reconciliation totals include cash received during the selected period. Invoice allocations can refer to other months; they are a different measure from period cash receipts.

## Session history and attendance

Generate future dated sessions before classes begin. Historical occurrences generated afterwards are labelled **reconstructed**: current enrollment history cannot prove a roster that was never saved. Reconstructed attendance requires administrator review when used for promotion eligibility.

Changing the weekly timetable does not rewrite existing occurrences. Use a dated-session change for already generated classes. Cancelled sessions and approved pause dates do not create makeup obligations. After unenrollment, a saved historical roster still supports attendance review and a legitimate makeup.

Attendance has a direct link to dated sessions. A reminder about a rescheduled class opens its actual date in Operations. Staff with attendance access can read rosters there; schedule changes and attendance writes retain separate permissions.

Enrollment baselines preserve the current roster at migration time. They do not invent past transfers, deleted enrollments or attendance evidence. Classes referenced by retained history cannot be physically deleted through a foreign-key cascade.

## Running the worker

Configure `APP_URL`, a server-only `NOTIFICATION_JOB_SECRET` of at least 32 characters, and the production push keys described in [the notification guide](MEMBERSHIP_MAKEUP_NOTIFICATIONS_2026-10-24.md). Use HTTPS outside localhost.

For a continuously running Node deployment, supervise:

```sh
npm run notifications:worker
```

For a scheduler that runs once per minute:

```sh
npm run notifications:worker -- --once
```

The one-shot command returns a failure status for failed notice generation, push delivery or membership processing. A lease held by another worker is a safe skip. Inspect Operations → Job health after deployment: configured environment variables alone do not prove that scheduling works. No permanent production worker was installed during this release preparation.

## Administrator sign-in

Root and Admin access now requires an authenticator verification at the interface, API and database boundaries. A first-time administrator is guided through enrollment. Private staff details and academy datasets wait for verification. Losing a factor requires owner identity verification and recovery through the provider dashboard; there is no application bypass.

Credential rotation remains deferred at the owner's request. Follow [CREDENTIAL_ROTATION.md](CREDENTIAL_ROTATION.md) before a public release. MFA and cleaned Git history do not revoke an exposed server key.

## Database upgrade and verification

Installed migration: [20261025164318_academy_operations_workflows.sql](supabase/migrations/20261025164318_academy_operations_workflows.sql). Do not reapply it to the connected project. Other installations must first have the baseline, contact and membership/notification upgrades.

Live postflight checks confirmed:

- 86 students, 194 monthly-payment rows, 475 attendance rows and 86 enrollments were preserved; recorded paid totals were unchanged.
- 86 enrollment baselines and 86 membership periods were created from existing enrollments.
- All 22 operational tables have row-level security. Public and authenticated clients cannot execute the operational mutation function.
- All public tables have RLS enabled. Service-only operational tables deliberately have no client policies or grants.
- The database performance advisor reports no unindexed foreign keys after the upgrade. New indexes may appear unused until the workflows receive normal traffic.
- Read-only REST checks passed for the new schemas and all ten operations views. These service reads do not substitute for real-account staging acceptance.

The existing security advisor notices remain: `citext` is in the public schema, intentional authorization helpers are callable by authenticated accounts, and provider leaked-password protection is disabled. The helper grants support existing RLS checks; operational mutations remain server-only. Review [the database linter guidance](https://supabase.com/docs/guides/database/database-linter) before changing those grants or moving the extension.

Useful verification commands:

```sh
npm run check
npm run build
npm run db:readiness
npm run db:operations
npm run test:operations-browser -- http://127.0.0.1:3000
```

Release verification passed: 149 automated tests, TypeScript, the production build, 75 HTTP/security cases, and a production dependency audit with zero findings. The browser suites covered operations, authenticator enrollment/challenge, settings and partners, authentication races, data-load recovery, contact links, attendance calendars, membership/makeup/notifications, anatomy, business rules, POS recovery, navigation motion and hydration. They also verified a paused student's remaining invoice after fee/scholarship changes, and credit settlement clearing receivables. Responsive checks used desktop, tablet and phone viewports. Lint has zero errors and 167 unused-code/image warnings in existing screens. The new operations modules and MFA component have no lint warnings.

Changed-file and browser-bundle scans found no configured private key values. The local environment file remains Git-ignored. These checks do not revoke the previously exposed provider credential.

The browser scripts use fictional identities and mocked services. The database tests run against isolated PostgreSQL fixtures. Financial writes, bank transfers, student records and push recipients were not used as live test data.

## Display limits and release acceptance

Operations views use explicit limits: 200 follow-ups, 200 dated sessions, 500 reconciliation lines and candidate receipts, 120 student billing cycles, 200 student receipts, 100 timeline events, 50 grading events, and 1,000 recent performance measurements. Session and reconciliation periods are limited to 93 days. Narrow busy periods when a list reaches its limit; cash collection totals cover the full selected period.

Before public deployment, complete credential rotation, real-account MFA acceptance, a supervised worker check, backup/restore rehearsal and notification/performance checks on physical phones, tablets and desktops. Browser emulation verifies responsive layouts; it does not measure actual device performance or prove delivery through every platform's push service.

The Weekend-Morning class remains at capacity 35 with 36 active enrollments flagged for review, following the owner's decision. No enrollment was removed and no capacity was increased.

The separate student application remains deferred. Detailed grading rubrics, certificate issuance, automatic bank feeds and tuition refund/reversal workflows are outside this implementation. Existing receipt evidence is retained rather than silently edited.
