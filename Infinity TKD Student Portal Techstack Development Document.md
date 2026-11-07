# Infinity TKD Student Portal — Technical Development & Techstack Specification

**Revision:** 4.0 — student specification with current operations integration

**Reviewed:** 26 October 2026, Asia/Bangkok

**Reference baseline:** current admin checkout `ea5ade3` plus explicitly identified workspace changes; original findings retain historical reference `f4fe973`

**Scope:** the student and authorized guardian experience only

**Status:** implementation specification; not certification of a deployed student application

## 1. Purpose, scope, and evidence

The student portal is a separate application for an athlete to see their academy record, timetable, attendance, tuition, learning progress, belt journey, achievements, and training information. An authorized guardian may eventually access several children through explicit account grants.

The admin portal remains the source of official academy records. Both applications may use the same Supabase project, but the student application needs its own authentication boundary, routes, state provider, manifest, service worker, and deployment.

This revision consolidates the earlier 65 chapters. It preserves the student product direction while replacing duplicated schema definitions, admin implementation instructions, and unverified “production complete” examples with source-backed integration contracts. Proposed features are separated from repository evidence.

### 1.1 Evidence labels

| Label | Meaning |
| --- | --- |
| **Implemented reference** | Relevant executable code or a migration exists in this checkout. This does not prove production deployment or correctness. |
| **Query-observed** | Current code uses a table/field; deployed types, constraints, and policies remain unverified. |
| **Migration-observed** | A checked-in migration defines/changes an object; deployment is unverified. |
| **Snapshot-observed** | `tests/fixtures/live-schema-20261011.sql` defines the object in a dated schema-only test snapshot. This is stronger evidence than a UI type, but does not establish the current deployed schema. |
| **Proposed** | Student behavior or an additive contract specified here; implementation required. |
| **Blocked for release** | A prerequisite must be resolved before the dependent feature is enabled. |

### 1.2 Review coverage and limits

The review inventoried application pages, API handlers, shared libraries, component families, hooks, migrations, dependency manifests, and PWA configuration. It examined authentication, account provisioning/linking, student mapping, schedules, attendance, billing, LMS, training, promotions, shop, realtime, caches, errors, and anatomy flows.

Live database inspection, production policy tests, merchant verification, authenticated browser testing, database mutations, and a student application build were not performed. README descriptions, comments, screenshots, and previous document snippets are not test evidence.

This revision changes documentation only.

### 1.3 Product boundary

Included:

- Sign-in, recovery, account eligibility, and authorized student selection.
- Personal dashboard and official profile.
- Enrolled timetable and personal attendance history.
- Personal tuition ledger, renewal information, and supported receipts.
- Belt-matched learning, self-tracked progress, routines, and training guidance.
- Coach assessments, biometric history, readiness, belt history, and awards.
- Educational 2D/3D anatomy.
- Student merchandise ordering after commerce blockers are resolved.
- Preferences, accessible mobile layouts, network states, and installability.
- Planned guardian access, verified payment, push/inbox, QR passes, exams, and certificate verification.

Excluded from the student application:

- Academy student directory, bulk import, account provisioning, staff/member administration, permission editors, and staff Dan management.
- Attendance marking/roster commits, class/enrollment management, scholarship editing, financial operations, retail counter POS, inventory adjustments, refunds, and order fulfillment.
- Partners/MOU management, executive analytics, audit-log browsing, and administrative settings.

References to these systems below explain student dependencies, not student admin functionality.

### 1.4 Reading order

For implementation, read Sections 2–8 for repository integration, Sections 9–20 for student contracts and behavior, Sections 21–25 for architecture and quality, Sections 26–31 for future modules, and Sections 32–37 for migration and delivery. Sections 38–45 provide the detailed implementation decisions, response models, endpoint rules, screen interactions, data lifecycle, resilience scenarios, test fixtures, and work packages. The newer explicit contracts supersede older illustrative examples where noted.

Sections 46–50 incorporate the 23–25 October workspace features: persisted billing anchors and schedule changes, approved pauses, dated sessions and makeup records, invoice/receipt/allocation/credit accounting, persisted notifications/push, and staff grading. Use these current contracts when they replace earlier proposed structures; preserve legacy behavior only where explicitly described.

| Start here | Main chapters |
| --- | --- |
| Repository facts and scope | [Integration map](#2-admin-system-integration-map), [historical findings](#3-findings-affecting-student-development), [stack](#4-techstack-baseline), [data dictionary](#8-shared-data-model-and-dictionary) |
| Student product behavior | [Routes](#10-student-route-map-and-navigation), [pages](#11-page-by-page-behavior), [attendance](#12-timetable-dates-and-attendance-rules), [tuition](#13-tuition-renewal-and-receipt-contract), [learning](#14-lms-content-and-progress) |
| Architecture and delivery | [PWA](#23-pwa-offline-behavior-and-cache-isolation), [migration workflow](#32-canonical-schema-and-migration-workflow), [project structure](#33-proposed-student-repository-structure), [phases](#35-phased-implementation-backlog) |
| Detailed build contracts | [Decisions](#38-implementation-decisions-and-application-boundaries), [resource DTOs](#39-complete-resource-and-projection-contracts), [endpoint reference](#40-endpoint-implementation-reference), [screen interactions](#41-detailed-screen-and-interaction-specification) |
| Engineering handover | [Database lifecycle](#42-database-lifecycle-and-migration-contracts), [resilience](#43-consistency-offline-and-operational-scenarios), [test fixtures](#44-verification-fixtures-and-complete-acceptance-plan), [work packages and gates](#45-implementation-work-packages-and-release-handover) |
| Current shared operations | [Authority map](#46-current-operations-integration-and-authority-map), [sessions and makeups](#47-dated-sessions-attendance-and-makeup-history), [membership and invoices](#48-membership-pauses-invoices-receipts-and-credits), [notifications and grading](#49-persisted-notifications-push-and-grading-results), [updated acceptance gates](#50-current-contract-acceptance-and-revision-handover) |

### 1.5 Newer working-tree implementation observed on 10 October

The admin repository changed during the 10 October review. The October migration files and related code below were uncommitted at that time; several are present in the current `ea5ade3` baseline. Their presence does not prove deployment. Sections 3, 8, 12, 13, 18, and 27 distinguish the earlier defect from its later source repair. Compare final committed migrations with the live schema and repeat access tests before student implementation.

| Area | New source observed | Student consequence |
| --- | --- | --- |
| Staff sign-in | `app/api/auth/login/route.ts` now performs internal identifier/password sign-in with a database rate slot and explicitly rejects Student roles; `app/api/auth/username-to-email/route.ts` returns HTTP 410. | Build a separate student sign-in path; do not reuse the staff login. Confirm old email lookup RPC grants are revoked in the deployed database. |
| Authorization | `supabase/migrations/20261009090000_portal_security_and_transactions.sql` replaces many earlier permissive policies, restricts profile writes, uses live profile state in helpers, and revokes older RPC overload grants. | Treat the earlier exposures as historical baseline findings pending migration verification; inspect every effective policy, grant, and table/view column exposure after applying this migration. |
| Orders | The shop handler now requires `requestKey` and calls `portal_place_order` without its former separate-insert fallback; the October migration adds server pricing, transactional reservation, and idempotency. | The former order mismatch/fallback is repaired in source. Do not enable student checkout until the migration, actor authorization, response projection, and concurrency/replay tests pass in staging. |
| Attendance | An October migration adds nullable `attendance.class_id` and a unique occurrence key; older daily rows retain `class_id = NULL`. | Support mixed daily/class-linked history. A class ID alone still does not prove actual check-in or check-out timestamps. |
| Billing and households | `lib/billing.ts`, `lib/dates.ts`, admin household endpoints, and October migrations add configurable fees, a Phnom Penh calendar, persisted household rows, and transaction receipts. | Read the newer contracts, but keep guardian login/grants, provider settlement, and student-facing receipt authorization as separate deliverables. |
| Client/PWA | The admin store now fetches full tables through pagination and removes legacy personal cache keys; the worker source excludes private API/navigation caching. | The student application still needs its own scoped queries and separate PWA identity. Retest the final built worker, not only its source. |

### 1.6 Source refresh on 18 October

This revision additionally examined the dated schema fixture, October 11–13 migrations, contact utilities, strict student payload adapters, attendance calendar utilities, anatomy integration, current shop handlers, and their test sources. No live database was queried or changed for this documentation revision.

| Newer evidence | Verified source behavior | Student requirement |
| --- | --- | --- |
| `tests/fixtures/live-schema-20261011.sql` | Contains schema-only definitions for core student tables, constraints, functions, and policies, plus test Auth substitutes. | Use as dated test evidence; obtain a fresh canonical export/types before deployment. Do not apply this fixture to production. |
| `20261011090000_portal_live_schema_hardening.sql` | Replaces automatic contact-based account linking with explicit links, restricts function grants, and changes views to use caller permissions. | Preserve explicit identity links and test all effective helpers/views under Student identities. |
| `20261010090000_portal_workflow_integrity.sql` | Library writes maintain a curriculum mirror transactionally; video completion uses a service-only, staff-authorized RPC. | Student completion requires its own narrow operation; staff grading permission must never be granted to enable student learning. |
| Contact workspace changes and `20261013052326_portal_telegram_contacts_and_access.sql` | Add optional `telegram_username`, normalized contact links, stricter request payloads, and server-allocated student IDs. | Treat contact information separately from login identity; display authorized links without using them to claim records. |
| `lib/attendance-calendar.ts`; `components/StudentAttendanceCalendar.tsx` | Keep daily/class scopes separate, retain multiple marks on one date, and use calendar date arithmetic. | Adapt read-only calendar behavior without importing staff mark/edit actions. |
| `lib/anatomy-integration.ts` | Derives muscle learning coverage from completed assets and primary/secondary content mappings. | Label the output as learning coverage; it does not measure strain, recovery, strength, or injury. |
| `20261011215930_portal_realtime_sync.sql`; achievement integrity migration | Expand publication membership and make staff achievement batches transactional. | Re-fetch authorized projections after changes; student awards remain read-only. |

Workspace files may continue to change independently. This document describes sampled source evidence, the student target contracts, and release verification requirements; it does not certify the admin system's current deployment.

### 1.7 Source refresh on 26 October

The checkout remains `ea5ade3`; the reviewed workspace additionally contains uncommitted feature work. This revision inspected the current code and SQL for membership schedules, makeup attendance, notifications/push delivery, operations reads/mutations, invoices/credits, session occurrences, grading, and job status. A migration filename or source comment is not proof that this review applied or verified it on a live database.

Primary additions: `supabase/migrations/20261023155619_membership_makeup_notifications.sql`, `supabase/migrations/20261025164318_academy_operations_workflows.sql`, `lib/tuition-cycle.ts`, `lib/invoice-status.ts`, `lib/makeup.ts`, `lib/notifications.ts`, `lib/notifications-server.ts`, `lib/operations-contract.ts`, `lib/operations-read.ts`, `lib/operations-server.ts`, and the associated route handlers. Their student implications are detailed in Sections 46–50. Existing uncommitted application changes are outside this documentation edit.

## 2. Admin system integration map

| Reference area | Source files | Student integration |
| --- | --- | --- |
| Student identities/records | `lib/store.tsx`; `app/api/admin/create-student/route.ts`; `app/api/admin/create-user/route.ts`; `app/api/admin/update-student/route.ts` | Resolve a verified athlete and project approved fields. |
| Authorization | `lib/backend-security.ts`; `lib/security.ts`; `lib/permissions.ts`; `middleware.ts`; security migrations | Identity, live account eligibility, ownership, operation permission. |
| Dashboard/dossier | `components/DashboardView.tsx`; `components/StudentDossierModal.tsx`; `components/ManageStudentPanel.tsx` | Reuse pure presentation concepts in a separate student shell. |
| Timetable/enrollment | `components/ScheduleView.tsx`; `app/api/admin/classes/route.ts`; enrollment store actions | Own enrolled schedule and safe branch/coach labels. |
| Attendance | `components/AttendanceView.tsx`; calendar utilities and attendance store actions | Own daily/class-linked history, never attendance writes. |
| Tuition | `components/FinancialsView.tsx`; `getMembershipBillingStatus` in `lib/store.tsx` | Personal ledger and centralized billing summary. |
| Lessons/workouts | `components/LmsView.tsx`; `components/LibraryView.tsx`; `hooks/useWorkoutTimer.ts`; `lib/utils.ts` | Safe lessons, own completion, local timer. |
| Assessments/body composition | Evaluation/body-composition store actions; `lib/utils.ts` | Read permitted coaching/measurement records. |
| Belt/achievement | Belt/achievement store actions; `lib/utils.ts`; `lib/kukkiwon.ts` | Personal milestones and academy readiness. |
| Shop | `app/api/shop/order/route.ts`; `components/InventoryPosView.tsx`; shop migrations | Student catalog and own orders after contract repair. |
| Anatomy | `components/atlas/`; `components/2d/Biomechanical2DScanner.tsx`; `lib/atlas/`; `public/models/` | Lazy educational viewer and fallback. |
| Academy identity | `supabase/migrations/20260924_create_academy_profile.sql`; `mapDbRowToAcademyProfile` | Verified public brand/support/policy projection. |
| Resilience | `lib/errors/`; `lib/api/resilientFetch.ts`; `components/errors/`; `components/providers/NetworkStatusProvider.tsx` | Adapt error/recovery patterns; redesign mutation replay. |
| Theme/language/PWA | `app/layout.tsx`; `app/globals.css`; `lib/i18n.ts`; `hooks/useTranslation.ts`; `sw.ts` | Student dictionaries, tokens, manifest, cache/update policy. |

### 2.1 Feature availability

| Student capability | Repository evidence | Student delivery status |
| --- | --- | --- |
| Account provisioning/linking | Admin create-user route and linking migrations | Reference exists; student bootstrap required. |
| Identifier lookup | `app/api/auth/username-to-email/route.ts`; newer staff-only `app/api/auth/login/route.ts` | Public lookup is disabled in the newer working tree; student sign-in remains proposed. |
| Complete student app/layout/routes | No dedicated student application found | Proposed. |
| Profile, schedule, attendance, tuition, belts, awards | Admin queries/components | Sources exist; student APIs/screens proposed. |
| Library/progress | Library, curriculum, progress queries | ID bridge must be repaired. |
| Grades/biometrics | Store actions and RLS migrations | Read projections proposed. |
| Workout templates/timer | Library/store/timer hook | Reference exists; completion history not established. |
| Assigned plans | Dated snapshot defines student/template/assignee/customized structure fields | Student projection and active assignment workflow still required. |
| Anatomy | Components and local models | Adaptable reference. |
| Student order GET/POST | `app/api/shop/order/route.ts` | Blocked for student release. |
| Guardian switching | New admin household persistence; no verified guardian account grants | Student guardian authorization and switching proposed. |
| Verified ABA/KHQR settlement | Method labels, UI concepts, QR-related columns | Provider transaction/webhook not implemented here. |
| Inbox/push | October 23 tables, shared Student-capable notifications API, worker/delivery code | Implementation reference exists; student DTO/navigation/privacy and deployed delivery need verification. |
| Dated sessions and makeup | October 25 occurrences/rosters and Student-capable makeup GET | Student-safe schedule/history projections required; makeup writes remain staff-only. |
| Invoices/receipts/credits | October 25 operations accounting tables and staff workflows | Reuse shared accounting; separate student read/receipt endpoints required. |
| Rotating pass/wallet | No complete issuance/scanner/wallet flow found | Proposed. |
| Grading/exams | Staff grading events/candidates exist; no verified student publication/registration flow | Adapt grading results carefully; student applications/publication remain proposed. |
| Public certificate resolver | No complete issued-file/token resolver found | Proposed. |
| Camera pose analysis | No MediaPipe implementation/dependency found | Optional future feature. |

## 3. Findings affecting student development

Findings below record the initial `f4fe973` baseline. Several have source repairs in later commits or workspace changes (Sections 1.5–1.7); their deployed status remains unverified. Use the final migration and staging test result to close each finding, rather than treating this historical table as a description of every current file.

| ID | Priority | Evidence/findings | Required response |
| --- | --- | --- | --- |
| SP-01 | P0 | Admin bootstrap deliberately signs out Student accounts. | Separate student auth/provider. |
| SP-02 | P0 | Admin store downloads academy-wide profiles, members, students, finance, permissions, staff history, partners. | Minimal student-scoped resources; do not import admin provider. |
| SP-03 | P0 | Master RBAC defines profile SELECT for anon/authenticated with `USING (true)`; earlier files grant anon SELECT. | Inspect and close effective identity-directory exposure. |
| SP-04 | P0 | Profile self-update rules constrain role/active state but not explicitly `student_id`; linking triggers update student relationships. | Freeze links for student callers at database level. |
| SP-05 | P0 | Ownership helper accepts email/normalized username/JWT links and lacks an active Student requirement. | Explicit live grants; audit all helper overloads/policies. |
| SP-06 | P0 | Role/active helpers prefer JWT app metadata over current database values. | Define revocation freshness and live sensitive-operation checks. |
| SP-07 | P0 | Shop migrations define incompatible order RPC signatures; September 30 expects client item price/name/SKU. | One server-priced, authorized transaction contract. |
| SP-08 | P0 | Shop API sends IDs/size/qty; later RPC expects more; fallback writes header/items separately and ignores item insert result. | Remove nontransactional fallback success. |
| SP-09 | P0 | API fallback uses order state `PENDING`; September 13/30 use `PENDING_CONFIRMATION`. | Verify effective constraint and unify lifecycle. |
| SP-10 | P0 | Later security-definer commerce functions lack internal caller checks and explicit search path in source. | Audit execute privileges/overloads; restrict privileged functions. |
| SP-11 | P1 | Own-order GET includes `admin_notes`; broad product policies may expose cost/inactive rows. | Allowlisted DTOs and direct database exposure controls. |
| SP-12 | P1 | Content loads from library assets; progress targets curriculum; admin completion upserts a mirror first. | Repair/backfill mapping server-side; no student curriculum authorship. |
| SP-13 | P1 | Attendance conflicts on `student_id,date`; no mapped class/check-in time. | Accurate daily display; class-level data requires shared migration. |
| SP-14 | P1 | Billing hard-codes fees and five-day “Due Soon”; academy has grace settings. | Central server policy; settle anniversary/calendar/grace semantics. |
| SP-15 | P1 | Readiness can treat absent syllabus as complete; evaluations are found without belt-level match. | Unknown-input handling and rank-specific evaluation matching. |
| SP-16 | P1 | Evaluation upsert conflicts on `student_id,skill_name`. | Verify uniqueness and add history/version-aware contracts. |
| SP-17 | P1 | Baseline household and active-device panels used local/sample state; newer code persists admin households and invokes provider sign-out for other sessions. | Student guardian grants and a truthful session UI before release. |
| SP-18 | P1 | Offline queue stores arbitrary URLs/headers/bodies without identity partitioning; `idb` is not direct dependency. | Restricted identity-scoped progress queue; declare dependencies. |
| SP-19 | P1 | Baseline XOR/base64 cache used a shipped constant; newer admin bootstrap clears legacy caches and no longer hydrates personal records from them. | Keep private student records out of shared caches and purge on identity change. |
| SP-20 | P1 | Worker caches navigation; source is root `sw.ts`; compile flag required; generated worker contains admin chunks. | Separate student worker; exclude private HTML/RSC. |
| SP-21 | P1 | Baseline build ignored TS/lint errors; the newer Next config enables both build checks and adds check scripts. | Verify the final build/check results and pin a tested student lockfile. |
| SP-22 | P1 | Headers block camera/mic; video frames need explicit policy; browser middleware precedes future webhooks. | Route-specific media/webhook policies. |
| SP-23 | P1 | Initial checkout lacked a base schema and included repeated date-only prefixes; a dated test schema fixture now exists. | Fresh canonical schema and reconciled applied migration history; never deploy the fixture as a baseline migration. |
| SP-24 | P2 | Addresses use `district_commune/state_province_city`; branches use `branch_name`. | Generated types and adapters, not old guessed DDL. |
| SP-25 | P2 | Baseline local dates/UTC slicing appeared in billing/attendance; newer `lib/dates.ts` uses `Asia/Phnom_Penh`, but an academy-configurable timezone field remains unverified. | Agree academy timezone and test date-only arithmetic across all student views. |
| SP-26 | P2 | Academy defaults have placeholder contacts; portal-enabled flag is mapped without student enforcement route. | Verified academy values and server gate. |

P0 blocks release of the affected capability. P1 requires integration/reliability correction. P2 requires correctness/presentation follow-up. This is a student delivery review, not certification of the admin portal’s entire production security posture.

### 3.1 Current student delivery blockers after the source refresh

Use this table for current planning; the SP findings above retain their historical evidence.

| Item | Current source/evidence | Release dependency |
| --- | --- | --- |
| Dedicated student app | No complete student project, protected shell, or student API surface found | STU-02–05 before core launch. |
| Student authentication | New internal login is staff-only; public identifier lookup is disabled | STU-03 student auth/scope and credential-change flow. |
| Applied schema/authorization | Dated fixture and hardening migrations exist; current live state was not verified in this review | STU-01 canonical inventory and restricted-identity tests. |
| Safe projections | Admin store/handlers return broad records; shop GET still selects admin notes | STU-04 DTO/database exposure controls before reuse. |
| Publication/eligibility | Broad reference-read policies and no verified unified library publication contract | STU-06 before private/rank-restricted content delivery. |
| Student progress writes | Existing completion RPC requires staff grading permission; authenticated table writes were revoked by newer migration | STU-07 dedicated narrow operation; do not reopen broad writes. |
| Historical mappings | New content writes maintain mirrors, but existing same-ID collisions/missing mappings need inspection | STU-01/06 reconciliation before progress saves. |
| Commerce confirmation | Transactional ordering exists; proposed student quote-price validation and safe order projection are not established | STU-11 before student checkout. |
| Guardian identity | Admin households exist; account-to-child grants/switching do not | STU-12 before family login. |
| Provider payments | Staff receipts and invoice allocations now exist; merchant intents/webhook verification are not established | Reuse allocations, verify provider integration in STU-13 before online payment claims. |
| Notifications | Persisted inbox/push reference now exists and accepts Students, but uses admin-app routes/raw rows | STU-14 student projection/navigation/delivery checks; do not duplicate the inbox schema. |
| Other optional services | Staff grading exists; student pass/registration/published-result/certificate lifecycle is incomplete | Independent gates remain closed until their specific contracts pass. |

These blockers define student implementation scope. They do not authorize unrelated admin changes or production database operations as part of this documentation revision.

## 4. Techstack baseline

### 4.1 Versions sampled on 26 October

| Package | Declared reference | Lockfile resolution | Purpose |
| --- | --- | --- | --- |
| Next.js | `^15.5.27` | `15.5.28` | App Router, layouts, route handlers. |
| React/DOM | `^19.2.1` | `19.2.6` | Student UI. |
| TypeScript | `5.9.3` | `5.9.3` | Strict contracts. |
| Tailwind | `4.1.11` | `4.1.11` | Tokens/responsiveness. |
| Supabase JS | `2.117.3` | `2.117.3` | Auth/data/realtime. |
| Serwist Next | `^9.5.13` | `9.5.13` | PWA build. |
| Motion | `^12.23.24` | `12.40.0` | Optional accessible transitions. |
| Zod | `^4.6.7` | `4.6.7` | Input/metadata validation. |
| Phosphor | `^2.1.10` | `2.1.10` | Primary icon family. |
| Three | `^0.184.0` | `0.184.0` | Optional anatomy rendering. |
| R3F/Drei | `^9.6.1/^10.7.7` | `9.6.1/10.7.7` | Optional anatomy UI. |
| ESLint/Next ESLint config | `9.39.1/^15.5.27` | `9.39.1/15.5.27` | Framework-compatible validation. |
| Meshoptimizer | `1.1.1` | `1.1.1` | Optional optimized anatomy models. |
| Web Push | `3.6.7` | `3.6.7` | Existing server push-delivery dependency; never browser-imported. |

Ranges are not installed versions. This table is a repository baseline, not a recommendation to retain an unreviewed version forever. Select supported compatible releases, review official security advisories at implementation time, and commit the tested lockfile.

The sampled manifest includes direct test tooling and `typecheck`/`test`/`check` scripts. These are admin project scripts; the separate student project must declare its own dependencies and checks. Reconcile the final lockfile and CI result before release.

### 4.2 Student package choices

Required: Next.js, React, TypeScript, Tailwind, Supabase JS, Zod, consistent icons, and compatible Serwist packages when PWA work starts.

Proposed SSR addition: `@supabase/ssr`, absent from the reference lockfile. Use separate browser/server cookie clients per [Supabase’s SSR guide](https://supabase.com/docs/guides/auth/server-side/nextjs).

Add only when used: declared IndexedDB helper, QR encoder, push delivery package, and test tooling. `idb` and `react-hook-form` exist in the reference lockfile but are not declared direct dependencies. Avoid relying on accidental transitive imports.

Lazy-load Three/R3F/Drei, certificate export libraries, and future pose models. A home dashboard must not download the anatomy engine.

Use a small student context for identity/scope/preferences/connection state. Keep page resources scoped. Shared utilities must be pure and independent of the admin provider.

## 5. Architecture and authority

### 5.1 Data flow

~~~mermaid
flowchart LR
    Client[Student browser or installed PWA] --> Auth[Supabase Auth]
    Client --> App[Student Next.js application]
    App --> Guard[Verified identity and live student scope]
    Guard --> Query[Scoped query and DTO projection]
    Query --> DB[(Shared Supabase PostgreSQL)]
    Official[Official academy operations] --> DB
    DB --> Changes[Authorized change invalidation]
    Changes --> Client
    App --> Files[Authorized private file delivery]
    App --> Provider[Future verified payment provider]
~~~

Use the student application’s own origin. Its backend accesses the shared database with user-scoped credentials wherever possible. Reserve service role for narrow privileged operations with explicit authorization, projection, and audit controls.

Do not call staff-only admin endpoints cross-origin from the PWA. Current middleware validates request origins and staff routes intentionally restrict roles.

### 5.2 Source of truth

| Resource | Authoritative writer | Student action |
| --- | --- | --- |
| Official identity, scholarship, enrollment, membership, rank | Academy staff/service | Read approved self fields. |
| Attendance | Academy attendance process | Read personal records. |
| Tuition settlement | Finance/verified payment service | Read status; initiate supported flow. |
| Lesson progress | Student/authorized guardian | Narrow own-progress write. |
| Grades, measurements, awards | Coaches/authorized staff | Read permitted records. |
| Published content/templates | Content staff | Read eligible content. |
| Order request | Student/authorized guardian | Submit own order. |
| Stock, confirmation, fulfillment, refund | Commerce service/staff | Track customer-facing state. |
| Household grants | Verified privileged linking process | Select existing authorized athlete. |
| Preferences | Current account | Change language/theme/audio. |

### 5.3 Mandatory private-request checks

1. Verified authentication.
2. Current eligible profile/account.
3. Student portal enabled.
4. Explicit authorized athlete scope.
5. Capability for the operation.
6. Query and response restricted to that scope.

A request’s `studentId`, selected cookie, cached profile, hidden field, route segment, and realtime filter are not ownership evidence.

## 6. Identity, authentication, and account linking

### 6.1 Current model

- `auth.users.id` is the identity UUID; `profiles.id` maps the application account.
- `profiles.role` includes Student; no Parent role is verified.
- `profiles.student_id` points to `students.id`, an academy string ID.
- `students.profile_id` points back to the profile.
- `members` is the admin staff/person registry, not the student roster.
- Admin create-user explicitly links students and skips member-row creation for Student accounts.
- Migration normalization/email linking is administrative compatibility behavior, not suitable student ownership evidence.

### 6.2 Proposed scope resolver

1. Verify identity through the server Supabase client.
2. Load minimal current profile fields and exact explicit student link.
3. Reject missing/disabled/unsupported profiles; no default Admin or default active account.
4. Check the academy portal flag.
5. Require exact account/student relationship; if both directions exist, require agreement.
6. Refuse absent, ambiguous, contradictory, deleted, or revoked relationships.
7. Return a support/link-required state without exposing another roster record.
8. Later, resolve guardian athletes through approved grant rows.
9. Repeat live checks on sensitive mutations.

Never repair account links during student login. A privileged verified process must resolve conflicts.

### 6.3 Sign-in

Email sign-in is the recommended first release: provider authentication, scope resolution, then an allowlisted relative redirect.

At the reference baseline, username lookup returned the resolved email and distinguished missing/unactivated accounts. The newer `app/api/auth/username-to-email/route.ts` disables this route with HTTP 410, and the October migration revokes legacy `get_email_by_username` overload grants. The newer `app/api/auth/login/route.ts` is explicitly staff-only and rejects Student roles. Verify those database grant changes after deployment; neither route is the student login contract.

If identifier login is required, resolve the identifier internally in a student server sign-in flow and return generic credential failures. Do not make an unauthenticated email directory the login prerequisite. Reject normalized collisions instead of selecting the first match. Use distributed attempt limits.

No public signup or self-claim-by-email is implied. Academy-issued accounts or verified invitations must establish access.

### 6.4 Session state

~~~text
Unknown -> Checking -> Authenticated -> ResolvingScope -> Ready
                  -> SignedOut
                  -> AccountDisabled
Ready -> Refreshing -> Ready | SessionExpired
ResolvingScope -> LinkRequired | PortalUnavailable | ScopeDenied
~~~

- Cached UI cannot bypass verification.
- Coordinate refresh once across pending requests; return to sign-in on failure.
- Logout/account change cancels requests, unsubscribes, clears state, and erases private caches/queues.
- Ordinary logout and “sign out other sessions” are separate actions; verify actual provider semantics.
- An idle screen lock does not revoke server tokens.
- Use supported Supabase client locking and test multi-tab refresh; do not reintroduce the baseline Navigator Locks bypass that the newer `lib/supabase.ts` removed.

For Next.js 15, SSR refresh uses `middleware.ts`. Next.js 16 documentation uses `proxy.ts`; choose for the actual framework. Verify server identity instead of trusting a local session object. See [Supabase’s SSR guide](https://supabase.com/docs/guides/auth/server-side/nextjs).

### 6.5 Recovery/password changes

Use a dedicated recovery route and configured student-origin redirect URLs. Reject external redirects and use a generic recovery acknowledgment. Change passwords through the provider’s supported self-service operation.

Password authority does not permit editing official identity, role, links, scholarship, or rank. Do not reuse the admin `AccountSecurityPanel`: its device list is synthesized for the current browser, its “sign out others” action calls the provider without a verified device inventory, and its password operation calls staff administration.

### 6.6 Account eligibility and membership

`profiles.is_active` and `students.student_status` are separate.

| Membership | Proposed reading, with enabled account | New training/shop/exam actions |
| --- | --- | --- |
| Active | Permitted personal data | Allowed only after feature-specific checks. |
| Paused | Historical records and pause notice | Explicit academy restrictions. |
| Inactive | Personal archive/support | Disabled by default. |
| Suspended | Minimal status/support and approved history | Disabled. |
| Graduated | Personal issued-record archive | Disabled unless new program access exists. |
| Unknown historical value | Safe status/support state under explicit policy | Disabled until resolved; never default to Active. |

These are proposed student capability defaults. Return server capabilities; do not scatter status rules in UI. A legacy `pause_end_date` alone does not establish automatic reactivation. The newer operations migration supplies approved pause records and `portal_process_membership_dates`; its deployed job execution and error state must be verified before presenting a return as complete (Section 48).

## 7. Security and access control

### 7.1 Target student permission matrix

| Resource | Read | Student write |
| --- | --- | --- |
| Own account | Minimal identity | Provider password/preference flow only. |
| Official student/contact/address/health | Approved self projection | None initially. |
| Enrollment/schedule | Own enrollments and safe reference labels | None. |
| Attendance/tuition | Own records | None directly. |
| Belt/award/coach assessment/body composition | Own permitted records | None. |
| Published eligible lessons/skills/workouts | Safe content | None. |
| LMS progress | Own progress | Validated upsert; reset separately authorized. |
| Workout completion | Proposed | Validated self-report after persistence exists. |
| Product catalog | Active/student-orderable safe fields | None. |
| Own orders | Customer-facing projection | Transactional submit/authorized cancel only. |
| Guardian grants | Own approved scope metadata | None. |
| Notifications | Proposed own inbox | Own read acknowledgment. |
| Staff/permissions/audit logs/product costs | None | None. |

RLS controls rows, not which columns a permitted row reveals. Explicit DTO selection and database column/view exposure controls are both needed. See [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

### 7.2 Required policy review

Inspect all effective grants, policies, views, triggers, helper overloads, and RPC execution rights. Check permissive-policy combinations, not only the newest file.

Student clients must not alter account links, role, activation, or grants. Shared contact email does not grant household access. Disabled accounts/revoked relationships must lose direct database access too.

Close profile directory exposure; restrict product costs, internal notes, signatures, staff identity, and payment hashes. Narrow security-definer ownership helpers must have explicit search paths and safe execution grants.

In the newer `20261009090200` migration, `portal_reference_read` grants every active authenticated account SELECT on several reference tables, including `library_assets`, `curriculum`, `workout_templates`, `scholarships`, and `academy_profile`. That policy does not itself enforce publication, belt eligibility, or a safe column projection. Inspect direct Data API access and replace it with published views/policies or restricted grants where those rows/columns must remain private.

Service-role queries bypass normal RLS, so perform ownership checks before their use. A backend-only UI does not protect an independently exposed Data API.

### 7.3 Proposed policy predicate

~~~text
can_access_student(student_id, operation):
    verified caller exists
    current account is enabled
    explicit account link or approved guardian grant exists
    relationship is current and not revoked
    requested capability is granted
    record lifecycle permits that operation
~~~

This is a contract, not executable migration SQL. Freeze relationship columns and align progress `USING/WITH CHECK` so rows cannot be reassigned to another athlete. Do not use generic `FOR ALL` permission when only completion upsert is intended.

### 7.4 Concrete first-release Data API boundary

Application role `Student` is a profile value; both staff and student Supabase sessions normally use the PostgreSQL `authenticated` role. A table-level GRANT or REVOKE for `authenticated` therefore affects both groups. Row policies distinguish people through trusted current profile/permission checks, but cannot hide selected columns inside a row.

For the first student release, use the following explicit boundary for tables that mix student and private staff fields:

1. Student browsers read personal resources through the same-origin student backend.
2. The backend verifies identity with the user client, then resolves the minimum profile/link/grant through a narrow server adapter.
3. Sensitive base-table row policies permit authorized staff operations and deny Student direct SELECT where unrestricted row columns would reveal internal fields. Preserve staff policies needed by the existing admin browser.
4. Student backend services perform tightly scoped server reads and allowlisted projection. They never accept a client actor ID or an unchecked student ID, and they constrain joined rows as well as the parent.
5. Any future user-callable projection function/view is separately audited for caller identity, ownership, columns, grants, and row-security behavior before replacing that backend path.

This is a **proposed shared-schema change**, not the current behavior of all October migrations. It is a prerequisite for enabling student scopes where base rows contain fields they must not receive. A service key never reaches the browser, and backend access does not remove the need for direct-path tests.

| Resource class | First-release access | Implication |
| --- | --- | --- |
| Profiles/student record, raw addresses, health/internal notes | Student backend projection; direct Student base-table exposure restricted | Staff direct reads remain governed by staff row permissions. |
| Orders/transactions/receipts with internal metadata | Student backend projection and authorized file service | Removing admin notes from JSON is paired with direct Data API protection. |
| Published content/reference rows containing only approved fields | User-scoped reads only after effective publication/grant review | Broad existing reference policies are not accepted automatically. |
| Progress/attendance/awards/measurements | Student backend by default; direct paths enabled only if every exposed field and policy is approved | Student writes still use narrow explicit operations. |
| Realtime personal tables | Polling/authorized refresh initially if base SELECT is denied | Do not reopen raw rows merely to make Postgres Changes subscriptions work. |

If live updates are required before safe direct subscriptions are possible, add authenticated server-issued invalidation messages containing only resource kind/version/scope reference, or retain bounded refresh. The message itself grants no access; the subsequent API read reauthorizes the scope.

## 8. Shared data model and dictionary

### 8.1 Relationships

~~~mermaid
erDiagram
    AUTH_USER ||--|| PROFILE : has
    PROFILE o|--o| STUDENT : explicit_link
    STUDENT ||--o{ ENROLLMENT : enrolled
    CLASS_SESSION ||--o{ ENROLLMENT : contains
    BRANCH ||--o{ CLASS_SESSION : hosts
    STUDENT ||--o{ ATTENDANCE : daily_records
    STUDENT ||--o{ PAYMENT : tuition
    STUDENT ||--o{ BELT_HISTORY : promoted
    STUDENT ||--o{ ACHIEVEMENT : earns
    STUDENT ||--o{ LMS_PROGRESS : tracks
    CURRICULUM ||--o{ LMS_PROGRESS : target
    LIBRARY_ASSET o|--o| CURRICULUM : verified_mapping_required
    LIBRARY_ASSET ||--o{ ASSET_MUSCLE : relates
    MUSCLE ||--o{ ASSET_MUSCLE : referenced
    STUDENT ||--o{ PHYSICAL_EVALUATION : assessed
    STUDENT ||--o{ BODY_COMPOSITION : measured
    STUDENT ||--o{ POS_ORDER : requests
    POS_ORDER ||--o{ POS_ORDER_ITEM : contains
    PRODUCT ||--o{ PRODUCT_VARIANT : has
~~~

One-to-one profile/student and library/curriculum links are target invariants to verify, not proof of current uniqueness. Guardian access is additive; do not overload `students.profile_id`.

### 8.2 Identity and official record

| Source | Query-observed fields | Rules |
| --- | --- | --- |
| profiles | `id, username, email, display_name, role, is_active, student_id` | Current account only. |
| students identity | `id, profile_id, khmer_name, english_name, gender, dob, registration_date, nationality` | Own official fields; preserve null. |
| students contact | `email, phone, emergency_contact_name, emergency_contact_phone, emergency_contact_relation`; October 13 migration adds `telegram_username` | Detail view only; no push/telemetry payload or ownership inference. |
| students membership | `current_belt, scholarship_id, home_branch_id, student_status, status_reason, status_changed_at, pause_end_date`; later migrations add `membership_start_date, billing_schedule, approved_pause_id` | Safe membership explanation; billing/pause changes remain staff-authorized. |
| students sensitive | `height_cm, weight_kg, medical_notes, allergies, profile_picture_path, esign_path, kukkiwon_id, notes` | Health authorization; omit internal notes/raw signature path by default. |
| student_addresses | `address_id, student_id, address_line1, address_line2, district_commune, state_province_city, postal_code, country, is_primary` | Own address; deterministic primary selection. |

The sampled Student type and newer create/update validation use Male/Female. The student portal does not edit gender. Generate types from the final schema and display unexpected historical values safely instead of inferring identity from an ID prefix.

The dated schema snapshot includes `students.belt_id` and `deleted_at`; mapped admin display still primarily uses `current_belt`. Confirm which rank field is authoritative before adding student rank-based access. Named avatar/signature buckets and their effective policies still require verification.

### 8.3 Academy, timetable, and enrollment

| Table | Fields observed | Student use |
| --- | --- | --- |
| branches | `id, branch_name` | Adapter maps name. |
| class_sessions | `id, branch_id, class_name, class_type, days_of_week, day_of_week, start_time, end_time, capacity, coach_id, standard_duration_mins` | Own enrolled schedule and safe labels. |
| class_enrollments | `id, student_id, class_id, enrollment_date` | Own assignments; no classmates. |
| scholarships | `id, type_name, discount_percentage` | Own server pricing context. |
| academy_profile | Branding/support/social fields; currency/date settings; grace/exam settings; portal login flag | Allowlisted public/policy projection. |

Class categories: General Class, Kid Class, Private Class, Elite Team. Handle unknown future values safely. Duration fallbacks differ in the reference; return an effective duration explicitly.

### 8.4 Attendance and tuition

| Table | Contract evidence | Limits |
| --- | --- | --- |
| attendance | Baseline `id, student_id, date, status, marked_by`; later nullable `class_id`, class-aware unique key, and October 25 `occurrence_id` | Mixed daily/class/dated-session history; no inferred check-in/check-out time or duration. |
| payments | `id, student_id, year, for_month, status, amount_usd`; conflict `student_id,year,for_month` | Monthly ledger; October migrations add staff-recorded transaction/receipt evidence, not payment-provider settlement. |

Attendance states: Present/Absent/Late. Baseline tuition states were Paid/Unpaid/Pending; October code also writes `Waived`. Verify the final database constraint and generated types. Keep tuition states separate from uppercase shop states.

The October migrations define `payment_transactions` with staff-recorded method, amount, date, request key, and receipt number. Verify the applied schema and student row/column access before exposing receipts; partial payments, adjustments, and provider settlement remain separate contracts.

### 8.5 Learning and training

| Table | Query evidence | Meaning |
| --- | --- | --- |
| library_assets | `id, title, description, library_type, tkd_category, fitness_category, target_level, video_url, created_at` | Primary admin content; JSON may be encoded in description. |
| curriculum | Writer supplies `id, title, target_belt, category, is_active` | Progress target/mirror; mapping unverified. |
| lms_progress | `id, student_id, curriculum_id, status, last_watched_at`; snapshot also has `completed_at, repetition_count, execution_speed_fps` | Column existence does not establish a reliable student capture/measurement workflow. |
| workout_templates | `id, title, description, difficulty, duration_mins, creator_name, structure` | Routine reference. |
| student_training_plans | Snapshot: `id, student_id, template_id, assigned_by, customized_structure, is_active, created_at` | Persisted assignment shape exists; student authorization and structure/version handling require implementation. |
| belt_techniques | `id, belt_level, technique_name, category, created_at, created_by` | Required skills. |
| student_physical_evaluations | `id, student_id, skill_name, belt_level, grade, evaluated_by, updated_at` | Latest grade, not a six-axis measurement history. |
| student_body_compositions | Date, height, weight, fat percentage, skeletal muscle mass, circumference/recorder fields | Recorded values with units. |

Mapped body fields also include `neck_cm, shoulder_width_cm, chest_cm, waist_cm, hips_cm, left_arm_cm, right_arm_cm, left_thigh_cm, right_thigh_cm, left_calf_cm, right_calf_cm, recorded_by, created_at`.

No established workout-completion ledger, raw kick-velocity series, or Speed/Agility/Core/Power/Flexibility/Stamina benchmark table was found. Such visualizations require new measurement contracts.

### 8.6 Belts, awards, anatomy, and shop

| Table | Observed student data | Exposure |
| --- | --- | --- |
| belt_histories | `id, student_id, belt_level, promotion_date, test_score, program, certificate_id, kukkiwon_dan_card_id` | Own ledger. |
| achievements | `id, student_id, event_name, date, category, division, medal_rank, notes, age_division, belt_division` | Own event; review notes disclosure. |
| belts | Reference in types/migrations | Verify ordering/catalog before rank-range gating. |
| muscles | Translated names, group, concept/element IDs, system, action/relevance descriptions | Educational catalog. |
| library_asset_muscles | `asset_id, muscle_id, role` | Primary/Secondary mapping. |
| products | `id, sku, name, category_name, price_usd, image_url, description, has_variants, sizes, is_active, allow_student_orders` | Safe active catalog; omit costs/internal thresholds. |
| product_variants | `id, product_id, sku, size, color, price_override, stock, is_active` | Sellable options and server-priced availability. |
| pos_orders | Own customer/order totals, method, payment/order states, student notes, dates | Omit admin notes, raw hashes, staff audit fields. |
| pos_order_items | Own SKU/name/size/color/unit price/qty/line total snapshots | Through authorized parent order. |
| inventory_logs | Stock audit | No student access. |

`certificate_id` maps to `certificateRef`; this alone proves neither a signed file nor public verification nor Kukkiwon issuance.

Generate exact SQL types/nullability/constraints from a canonical schema export. This dictionary is source usage evidence, not replacement CREATE TABLE DDL.

### 8.7 Newer operations dictionary

| Source group | Key identities/fields in the migration | Detailed student contract |
| --- | --- | --- |
| Membership schedule/pause | Student FK, effective month/day history, pause start/resume, void metadata, approved pause link | Section 48: safe recorded state and schedule; no student change authority. |
| Dated sessions | Occurrence UUID, class/source-date unique key, actual timestamps, revision, saved roster/provenance | Section 47: own dated timetable and declared historical coverage. |
| Makeups | UUID, source class/date/optional occurrence, replacement date/class, status, source status, void state | Section 47: linked read-only history with no automatic duplicate credit. |
| Invoice accounting | Invoice UUID/student/cycle, due/end, amount/waiver/balance, legacy settlement link; receipts/allocations/credits/uses | Section 48: posted amounts, separate cash/credit, verified joins and deduplication. |
| Notice delivery | Recipient/source-key unique pair, read/dismissed/resolved; account subscriptions and per-notice delivery states | Section 49: student audience/projection, safe app targets, delivery/consent lifecycle. |
| Staff grading | Event UUID, candidate student/event uniqueness, score/status/revision, optional belt-history link | Section 49: publication extension required; internal candidate records are not a student feed. |

These are migration-observed objects from uncommitted workspace additions. The 11 October fixture predates them, so it must not be used to prove their deployment or final types.

## 9. Student DTOs and validation contracts

All contracts in this section are **proposed**. They describe the student API, not existing admin response shapes.

### 9.1 Representation rules

- Keep student IDs as academy strings; do not validate them as UUIDs.
- Preserve database UUIDs as strings and large integer record IDs as opaque strings at the API boundary.
- Keep date-only values as `YYYY-MM-DD`; timestamps use ISO 8601 with an offset/UTC.
- Money uses decimal strings plus currency; compute authoritative totals with database decimal arithmetic or integer minor units.
- Null means unknown/unrecorded. Zero means a measured/recorded zero.
- Enums must be runtime validated. Unknown reference values need a safe display fallback.
- Do not serialize database rows directly or spread `select('*')` into student responses.
- Version business-rule outputs independently from the application build.

### 9.2 Core TypeScript contracts

~~~typescript
type StudentId = string;
type RecordId = string;
type DateOnly = string; // Runtime validation also checks a real calendar date.
type MembershipStatus =
  | 'Active' | 'Paused' | 'Inactive' | 'Suspended' | 'Graduated' | 'Unknown';

interface Money {
  amount: string; // Example: "45.00"; never a client-authoritative price.
  currency: 'USD' | 'KHR';
}

interface StudentScope {
  studentId: StudentId;
  relationship: 'self' | 'guardian';
  capabilities: {
    readProfile: boolean;
    readHealth: boolean;
    readTuition: boolean;
    recordLearning: boolean;
    placeOrder: boolean;
    registerExam: boolean;
    viewIssuedFiles: boolean;
  };
}

interface StudentSummary {
  id: StudentId;
  englishName: string;
  khmerName: string | null;
  currentBelt: string | null;
  membershipStatus: MembershipStatus;
  branch: { id: number; name: string } | null;
  avatarUrl: string | null; // Authorized display URL; not arbitrary storage path.
}

interface StudentBootstrap {
  account: { id: string; displayName: string; role: 'Student' };
  scopes: StudentScope[];
  activeStudent: StudentSummary;
  academy: {
    name: string;
    logoUrl: string | null;
    supportPhone: string | null;
    supportEmail: string | null;
    timeZone: string;
  };
  featureFlags: {
    shop: boolean;
    guardianAccess: boolean;
    verifiedPayments: boolean;
    notifications: boolean;
    qrPass: boolean;
    exams: boolean;
  };
  schemaVersion: string;
  fetchedAt: string;
}

interface AttendanceRecord {
  id: RecordId;
  studentId: StudentId;
  date: DateOnly;
  recordType: 'daily' | 'class' | 'occurrence';
  classId: RecordId | null;
  occurrenceId: RecordId | null;
  status: 'Present' | 'Absent' | 'Late';
}

interface TuitionLedgerEntry {
  id: RecordId;
  studentId: StudentId;
  year: number;
  month: string; // Adapter validates the legacy month label.
  status: 'Paid' | 'Unpaid' | 'Pending' | 'Waived';
  amount: Money;
}

interface ReadinessFactor {
  key: 'time' | 'attendance' | 'syllabus' | 'physical';
  actual: number | null;
  required: number | null;
  unit: string;
  state: 'met' | 'not_met' | 'unknown' | 'not_applicable';
}

interface ReadinessReport {
  policyVersion: string;
  calculatedAt: string;
  status: 'ready_for_review' | 'developing' | 'needs_work' | 'unknown';
  score: number | null;
  factors: ReadinessFactor[];
  finalDecision: 'coach_review_required';
}
~~~

The initial account model stays Student. Guardian capability is an approved relationship, not a silently invented Parent role. If a new role is later chosen, extend profile constraints, API validation, app metadata, and RLS together.

### 9.3 Validation

Validate request body size, strict object keys, identifier length, date bounds, allowed statuses, pagination, quantity limits, and feature availability.

A syntactically valid date is not necessarily a real date. Reject February 30, reversed ranges, and excessive query windows. Never build raw SQL/PostgREST filters from unchecked values.

Validate stored JSON on read as well as write. Malformed content must yield a recoverable content warning, not an application crash.

## 10. Student route map and navigation

Every route below is **proposed student application structure**.

| Route | Main purpose | Initial availability |
| --- | --- | --- |
| `/` | Sign-in/redirect to personal home | Core. |
| `/login` | Explicit sign-in route | Core. |
| `/forgot-password` | Recovery request | Core. |
| `/auth/callback` | Approved auth callback handling | Core when required by auth flow. |
| `/reset-password` | Recovery password change | Core. |
| `/change-password` | Required credential change for an authenticated account | Core when academy-issued accounts require it. |
| `/dashboard` | Personal home | Core. |
| `/profile` | Official personal record | Core. |
| `/schedule` | Enrolled timetable | Core. |
| `/attendance` | Labelled daily/class-linked attendance history | Core. |
| `/tuition` | Ledger/renewal status | Core read-only. |
| `/lms` | Eligible lesson catalog | Core after ID mapping. |
| `/lms/[assetId]` | Lesson detail/progress | Core after ID mapping. |
| `/training` | Routines and development overview | Reference adaptation. |
| `/training/[templateId]` | Workout detail/local timer | Reference adaptation. |
| `/development` | Coach grades/measurements/readiness | Core permitted records. |
| `/belt-journey` | Promotion milestones | Core. |
| `/awards` | Trophy shelf and event details | Core. |
| `/anatomy` | Optional educational atlas | Deferred performance feature. |
| `/shop` | Active merchandise | Feature-gated until repaired. |
| `/shop/products/[id]` | Merchandise detail and variant selection | Feature-gated. |
| `/shop/orders` | Own order history | Feature-gated. |
| `/shop/orders/[id]` | Own order status/details | Feature-gated. |
| `/settings` | Language/theme/audio/security | Core. |
| `/notifications` | Personal inbox | Future. |
| `/digital-pass` | Online rotating pass | Future. |
| `/exams` | Eligible exam opportunities | Future. |
| `/exams/[cohortId]` | Published exam detail and own application | Future. |
| `/certificates/[id]` | Authorized issued certificate | Future file/issuance contract. |
| `/verify-cert/[token]` | Minimal public verification | Future; separate public authorization. |
| `/offline` | Generic offline assistance | Core PWA. |
| `/support` | Verified academy support details | Core. |

Mobile primary navigation: Home, Learn, Schedule, Tuition, More. More contains profile, attendance, development, belt journey, awards, optional shop/anatomy, and settings. Use actual feature capabilities to show available destinations.

Desktop uses a compact sidebar; tablet may use a drawer. A student never sees academy directory, finance administration, counter POS, or permission-management navigation.

Deep links require the same server guard as direct navigation. Hiding a menu entry is not authorization.

## 11. Page-by-page behavior

### 11.1 Sign-in and account states

Inputs: identifier, password, show/hide password, recovery link. Support password managers, paste, keyboard submission, and meaningful field labels.

States: submitting, generic invalid credentials, throttled with retry time, network unavailable, disabled account, link required, portal unavailable. Avoid revealing roster membership to unauthenticated callers.

After authentication, show a linked-account support screen if scope is unresolved. Never fall back to the first student in a list.

### 11.2 Dashboard

Load a bounded summary, not the entire student archive.

Cards:

1. Student name, current belt, membership state, branch.
2. Next enrolled class with academy-local date/time.
3. Latest recorded attendance and a clearly labeled recorded-day rate.
4. Current tuition status or “billing information unavailable.”
5. Learning completion against the published current-belt syllabus.
6. Readiness factors requiring coach review.
7. Latest award/promotion and quick links.

Each card may fail independently after identity/scope verification. A failed payment request is not a zero balance. A failed lesson query is not 100% completion. Include freshness timestamps.

Hide future feature actions when flags are disabled; do not render inert “Pay now,” exam, or QR controls.

### 11.3 Profile

Display own official names, academy ID, rank, branch, membership, and permitted contact/guardian details. Put health/emergency information in a deliberately opened detail region.

Use readable text with a “Managed by the academy” label rather than a page full of disabled form inputs. A support link for corrections must not silently edit the official record.

Omit internal notes, staff-only status commentary, and raw signature files. Do not expose all staff profile rows to obtain a coach name.

### 11.4 Schedule

Show only assigned classes, branch, safe coach label, days, local start/end time, and enrollment start date. Offer week/day views with accessible list equivalents.

Recurring rules remain estimates. Where the October 25 occurrence/holiday model is deployed and authorized, show actual dated sessions and changes from that model. Preserve a separate “Weekly estimate” label for fallback entries (Section 47).

Empty state: “No classes assigned yet.” Never substitute another cohort. Enroll/swap/pause actions are absent unless new server workflows are delivered.

### 11.5 Attendance

Default to recent personal records and a date-range filter. Show Present/Late/Absent with icons and text. Missing dates are Unrecorded, not Absent.

Monthly calendar colors have a text/list equivalent. Attendance discrepancy actions lead to support or a future request workflow; they do not mutate attendance.

Do not display invented check-in times, class names, or training duration from the current daily table.

### 11.6 Tuition

Show current server billing summary, own monthly entries, status, amount/currency, and available receipt links. Separate historical recorded amounts from the current policy estimate.

Payments in progress show Pending; bank success cannot be inferred from closing a QR modal. Disable payment initiation when the provider integration is unavailable.

Missing renewal anchor or inconsistent ledger is an “Unable to calculate” state, not Current/paid.

### 11.7 Learning

Catalog groups eligible Taekwondo content and approved Fitness content. Search/filter operate only on authorized content. Display completion state as self-tracked learning.

Lesson detail presents video, instructions, principles, prerequisites, drilling, common mistakes/corrections, performance criteria, terminology, questions, and suggested exercises when present.

A “Mark completed” action uses the verified curriculum mapping and returns authoritative progress. It does not indicate coach proficiency or promotion approval.

### 11.8 Training and development

Training shows verified templates and any actually persisted assignments. A local timer does not become completion history until a completion endpoint exists.

Development shows coach grades, measurement trends, and readiness factors. Avoid fabricated radar axes or precision. Clearly distinguish recorded data from informational recommendations.

### 11.9 Belt journey and awards

Belt journey sorts promotion date and record ID deterministically, displays rank/program/score when recorded, and shows issued certificates only when authorized assets exist.

Awards shows event/date/category/division/medal and approved notes. Do not invent bout records or weigh-in details absent from the schema.

Provide empty states that encourage continued training without generating sample achievements.

### 11.10 Shop, settings, and support

Shop lists safe active merchandise and variant choices. Checkout is online-only, server-priced, and idempotent. Order detail exposes customer-facing states and pickup information.

Settings handles theme, language, audio, installed-app help, data refresh, password recovery/change, and actual sign-out. Do not list fictional devices or fake revocation success.

Support uses verified academy contact data. Opening a mail/phone link is a user action; the portal does not send messages automatically.

## 12. Timetable, dates, and attendance rules

### 12.1 Timezone contract

The newer `lib/dates.ts` and October SQL use `Asia/Phnom_Penh` for academy calendar operations. Confirm this as the academy timezone and store/version it as a policy value if branches may differ; do not infer it from the browser. The document review date uses the user’s Asia/Bangkok context.

Date-only values are calendar dates, not UTC instants. Keep them as date-only strings and use timezone-aware calendar arithmetic. Timestamp events are instants and must include UTC/offset information.

Avoid deriving academy dates by `toISOString().split('T')[0]` from browser-local midnight. Calculate “today,” month boundaries, renewal days, attendance windows, and age from one server policy.

### 12.2 Next-class algorithm

1. Fetch own enrollments and referenced class sessions.
2. Normalize `days_of_week`; use legacy `day_of_week` only when necessary.
3. Interpret recurring times in the academy timezone.
4. Exclude dates before enrollment.
5. Find the next valid scheduled start; decide explicitly whether a class already in progress is shown.
6. Sort by date/time and stable class ID.
7. Return the calculation timestamp and timezone.

This algorithm is the legacy recurring-timetable fallback. The October 25 migration now defines `class_occurrences`, saved rosters, holidays, enrollment periods, and revisions. Prefer authorized dated occurrences when present, preserve cancelled/rescheduled states, and label any fallback estimate. Section 47 defines coexistence and duplicate-prevention rules.

### 12.3 Current attendance analytics

For a selected window:

~~~text
recordedDays = Present + Late + Absent records
attendedDays = Present + Late records
recordedDayRate = recordedDays > 0
    ? 100 * attendedDays / recordedDays
    : null
~~~

Label the result “Attendance among recorded days.” It is not “percentage of scheduled sessions attended.”

A schedule-based rate requires reliable occurrences, saved eligibility/rosters, holidays, closures, pause intervals, and class-level marks. October 25 source now provides that model and adds `attendance.occurrence_id`; deployment and historical coverage remain unverified. Legacy daily and class-only rows still coexist. Do not mix them with occurrence units or manufacture missing session history; use Section 47's declared-basis rules.

### 12.4 Streaks and history

Initial release may show consecutive recorded training dates with a clear definition. Do not penalize nontraining days or describe calendar-day streaks as official coaching requirements.

A future scheduled-session streak needs occurrences and pause/holiday exclusions. Corrections/deletions require recomputation from authoritative records; do not maintain a fragile increment-only counter.

## 13. Tuition, renewal, and receipt contract

### 13.1 Observed reference calculation

At the initial reference baseline, `getMembershipBillingStatus`:

- Chooses the earliest enrollment date, falling back to registration date.
- Subtracts one day to derive the billing anchor.
- Clamps invalid month-day anniversaries to the month’s last day.
- Chooses a target month according to whether today precedes that month’s anniversary.
- Uses USD 25 for “Early Group Student,” otherwise USD 45 minus scholarship percentage.
- Treats a 100% scholarship as Current with zero owed.
- Uses a matching Paid ledger record to determine whether the cycle is paid.
- Marks an unpaid active cycle Overdue without applying the academy grace setting.
- Uses five days for Due Soon.

That helper did not itself apply membership pause/inactive exemption. Current `lib/billing.ts` now prefers persisted `membership_start_date`, applies effective billing-day changes, examines invoice summaries/approved pauses, and separates reminder configuration. `lib/invoice-status.ts`, `lib/tuition-cycle.ts`, and the October 25 operations migration additionally provide invoice/receipt/allocation/credit and whole-cycle pause logic. The three-state membership helper is not the complete student invoice status contract; use Section 48 to reconcile these sources without duplicating obligations or claiming merchant verification.

### 13.2 Required decisions and proposed service

Create one server billing module shared by student and official billing consumers. Resolve:

| Decision | Proposed implementation requirement |
| --- | --- |
| Calendar month versus anniversary cycle | Select one policy and version it. |
| Enrollment anchor minus one day | Earlier code used this; newer `lib/billing.ts` uses the enrollment day. Confirm the intended cycle and migrate historical obligations deliberately. |
| 29th/30th/31st and leap years | Clamp using calendar dates; include explicit examples/tests. |
| Grace period | Distinguish due date, upcoming reminder, and overdue threshold. |
| Pauses/inactive periods | Preserve historical debt; exemption/proration needs recorded interval policy. |
| Current scholarship versus historical amount | Keep posted ledger amount authoritative; policy changes affect applicable future cycles. |
| Full scholarship | Show Exempt if policy grants exemption; do not fabricate a cash receipt. |
| Missing payment row | Do not equate with generated debt without an authoritative cycle/invoice rule. |
| Pending/partial/refunded settlement | Existing `membership_receipts`/`membership_allocations` support staff-recorded allocation; provider pending/refund semantics still need an explicit compatible lifecycle. |

Proposed summary:

~~~text
policyVersion, calculatedAt, timeZone,
cycleStart, cycleEnd, dueDate, overdueAfter,
status: current | due_soon | overdue | exempt | paused | unknown,
postedAmount, settledAmount, remainingAmount,
nextRenewalDate, explanationCodes[]
~~~

Fields unsupported by applied persistence remain null/unknown. Invoice-based balances now have source evidence in `membership_invoices` and associated allocation/credit tables; the legacy monthly ledger alone still does not establish them. Reuse the newer invoice objects instead of synthesizing a second student invoice ledger.

### 13.3 Examples to lock down before coding

- Enrollment on 1 October produced a September 30 anchor in baseline code; newer billing uses 1 October. Reconcile historical dues before adopting the new rule.
- A 31st-day anchor in February must clamp consistently and recover in March.
- A Pending payment never counts as Paid.
- A paused athlete with prior unpaid tuition retains that historical obligation unless an explicit adjustment exists.
- A 100% scholarship can be exempt without a settlement event.
- Moving class enrollment must not unexpectedly reset a previously agreed billing anchor.

### 13.4 Receipts

A rendered student ledger statement is not necessarily an issued payment receipt. Only settled/authorized records may produce a receipt.

Receipt contract: stable number/reference, student display identity, covered period, recorded amount/currency, method/reference if verified, settlement date, issuer, and correction/void status where supported.

Do not invent staff signatures, tax identifiers, settlement references, or bank confirmation. Export is a display of the authorized snapshot, not a mutation of the ledger.

## 14. LMS content and progress

### 14.1 Repair the content/progress bridge

Reference content is fetched from `library_assets`; progress uses `lms_progress.curriculum_id`. The newer `portal_save_library_asset` RPC maintains same-ID curriculum rows transactionally and rejects conflicting titles. Existing historical rows can still require reconciliation. The separate `portal_set_video_progress` RPC checks the mirror and requires staff `action:evaluations_grade`; it is not a student self-completion API.

Required approach:

1. Export both tables and identify exact existing correspondences.
2. Detect missing/duplicate/mismatched records and orphaned progress.
3. Select a canonical mapping; a proposed additive `curriculum.library_asset_id` unique reference is one option.
4. Backfill through a privileged migration.
5. Preserve progress ownership and existing IDs.
6. Ensure the official content write path maintains the mapping transactionally.
7. Student API accepts an asset ID, resolves the mapping, validates publication/eligibility, and writes progress only.
8. Missing mapping returns `CONTENT_MAPPING_REQUIRED`; students cannot create the missing curriculum.

Do not assume matching numeric IDs imply identity across independent sequences.

### 14.2 Eligibility

`isBeltMatch` currently normalizes “Belt” suffixes and equivalent Poom/Dan degree labels. It matches the current level; it is not a complete rank ordering engine.

Initial student catalog may follow exact current-belt matching plus approved general/Fitness content. Historical lower-belt access, assigned advanced content, and age restrictions require explicit policy.

Current reference content policies allow broad reads. If belt gating is intended as an access restriction, enforce publication/eligibility in database/API/media delivery; hiding a video card alone is insufficient.

### 14.3 Structured lesson metadata

`parseAssetDescription` supports text/JSON and fields including:

- `difficulty, instructions, focusZones, repsSets, thumbnailUrl`.
- `principles, prerequisites, drillingMethods`.
- `mistakes: [{ mistake, correction }]`, with legacy text normalization.
- `performance, fitnessSolutions`.
- `terminology: [{ korean, english, khmer }]`.
- `studyGuide: [{ question, answer }]`.

Proposed student parser validates field types, lengths, referenced exercise IDs, and URL schemes. Render strings as text; sanitize any deliberately supported rich text.

If parsing fails, show the original safe description and omit invalid structured sections. Never present raw JSON to the student.

### 14.4 Progress semantics

Initial contract: Started and Completed for the authorized athlete and mapped curriculum target.

- Repeated completion is idempotent.
- Server writes authoritative timestamps.
- Do not regress Completed to Started on a delayed request.
- Reset/reopen is a separately defined action.
- Watching/marking a lesson is self-tracked learning, not certified technique execution.
- Progress is deduplicated by student/curriculum unique key after schema verification.

The dated snapshot already defines `completed_at`, `repetition_count`, and `execution_speed_fps`. Their existence does not prove the values were measured or how they should be interpreted. Playback position, watched duration, attempts, provenance, and content-version tracking need verified existing fields or additive migrations. Never fill metrics with guessed values or equate FPS with physical movement speed.

## 15. Workouts and coach development

### 15.1 Template structure

Reference routines use `workout_templates.structure`, including exercise lists and values such as routineType, prepareSeconds, workSeconds, restSeconds, and rounds. Exercise entries must be inspected/normalized before a stable student DTO is committed.

Proposed canonical routine:

~~~text
schemaVersion, title, difficulty,
prepareSeconds, rounds,
steps[]:
    stepId, assetId?, displayName,
    mode: timed | repetitions,
    workSeconds?, repetitions?, restSeconds,
    side: left | right | both | none
~~~

Validate nonnegative finite durations, bounded rounds/step counts, valid referenced assets, and compatibility of mode-specific fields. Unknown legacy shapes display as a read-only routine until normalized.

### 15.2 Timer behavior

Reference states: Idle, Prepare, Work, Rest, Completed. It supports start, pause, reset, next/previous round with interval-based countdown.

Student adaptation:

- Start audio only after a user gesture.
- Provide pause/resume/reset and a clear progress view.
- Avoid counting browser `setInterval` callbacks as precise elapsed time; use a time anchor and reconcile after visibility changes.
- Pause or offer explicit recovery after long background suspension.
- Keep sound optional and provide visible/haptic-compatible feedback where available.
- Store only a scoped lightweight local draft if resuming a routine is desired.
- Completing a timer is not proof of exercise correctness.

### 15.3 Assigned plans and completion

Do not invent assignments from all templates. Deliver plans only after the actual assignment schema and authorized workflow are verified.

Proposed completion persistence: student ID, plan/template ID, immutable template version/snapshot reference, session ID/idempotency key, start/end timestamps, completed steps, self-reported repetitions, and completion state.

Health/coach-grade updates remain staff-owned. Student workout records are explicitly self-reported and must not silently raise official skill grades.

### 15.4 Readiness and recommendations

Show unmet coach-reviewed factors, not an unsupported diagnostic prescription. Exercise recommendations may use verified lesson fitnessSolutions links and coach assignments.

The earlier six-axis radar, kick velocity, frequency quotient, and invented conditioning benchmarks remain future measurement modules. Add each only with units, method, recorder, date, benchmark version, and validation.

## 16. Belt journey and promotion readiness

### 16.1 Observed academy requirements

`BELT_REQUIREMENTS` in `lib/utils.ts` records:

| Current belt | Days | Recorded attended days/classes threshold | Minimum physical average |
| --- | --- | --- | --- |
| White | 60 | 16 | 2.0 |
| Yellow | 90 | 24 | 2.0 |
| Green | 90 | 24 | 2.5 |
| Blue | 120 | 36 | 2.5 |
| Brown | 120 | 36 | 3.0 |
| Red | 150 | 48 | 3.0 |
| 1st Poom/Dan | 365 | 96 | 3.5 |
| 2nd Poom/Dan | 730 | 192 | 3.5 |
| 3rd Poom/Dan | 1095 | 288 | 3.8 |

These are application rules in this checkout. They are not independently verified official Kukkiwon regulations.

### 16.2 Observed PRI formula

The reference helper uses latest promotion date or registration date as the start, counts Present/Late since that date, computes current-belt lesson completion, and uses dynamic skills or fallback skill names.

Grade scores: Needs Work/F = 1; Developing/C = 2; Proficient/B = 3; Outstanding/A = 4.

~~~text
timeProgress = min(100, round(daysElapsed / daysRequired * 100))
attendanceProgress = min(100, round(attended / required * 100))
physicalProgress =
    round((gradedSkills / totalSkills) * 50 + (averageGrade / 4) * 50)
PRI = round(
    timeProgress * 0.25 +
    attendanceProgress * 0.25 +
    syllabusCompletion * 0.25 +
    physicalProgress * 0.25
)
~~~

Ready requires Active status and all factor thresholds. The score alone does not approve promotion.

### 16.3 Required corrections for student use

- Use server academy dates and an explicit policy version.
- Match coach evaluation to student, belt, and skill identity/version.
- Unknown syllabus or missing assessment is Unknown, unless academy explicitly declares Not Applicable.
- Do not fall back to today when an official promotion/registration date is invalid.
- Avoid double-counting duplicate progress/attendance.
- Preserve the latest promotion tie-breaker and define rank changes/corrections.
- Explain each requirement and missing input.
- Do not reuse admin churn-risk or debt-based executive scores as student achievement metrics.

UI wording: “Ready for coach review,” “Developing,” “More work required,” or “Insufficient records.” Never imply an automatic promotion.

### 16.4 Poom/Dan and certification

The reference `formatBelt` changes certain black-belt display labels according to age. It does not issue or convert a credential.

The staff-oriented `lib/kukkiwon.ts` is not an authoritative student grading engine. Official promotion/certification rules require current verified governing-body guidance and academy approval before publication.

Keep academy belt history, Kukkiwon ID/card reference, issued document, and public verification separate.

## 17. Biometrics and educational anatomy

### 17.1 Measurements

Show recorded date, units, recorder display label where approved, value, and previous-value difference. Height/weight/circumference charts preserve nulls and use stable chronological ordering.

No measurements means an empty state. Missing body fat is not 0%. Do not score weight change as universally good/bad or infer clinical diagnoses from academy data.

Health records require the scope’s readHealth capability and must not enter generic caches, push bodies, screenshots generated automatically, or telemetry.

### 17.2 2D/3D integration

Reference assets include BodyParts3D catalog/chunk files and educational front/back 2D components. The atlas has system selection, concept search, isolate/explode/rotate controls, progressive loading, and fallback hooks.

Student requirements:

- Dynamic import on explicit route/open action.
- Responsive canvas and accessible text content.
- Download progress, cancellation, retry, and a 2D fallback.
- Conservative device-pixel ratio and memory limits.
- Dispose geometries/materials/listeners and abort downloads on unmount.
- Avoid prefetching all anatomy binaries on home/login.
- Offer educational explanations and source attribution from `public/ATTRIBUTION.md`.

The local reference represents adult male anatomy, not the student’s own body scan.

### 17.3 Muscle highlights

Lesson-to-muscle Primary/Secondary associations may drive a conceptual exercise emphasis visualization.

The earlier +1.0/+0.5 weighting is a proposed educational heuristic. A completed lesson proves neither muscular loading nor tendon strain. Label the result “Exercise muscle emphasis”; never imply measured fatigue/injury risk.

Prefer concept IDs/element mapping over fuzzy translated names. Handle unmapped muscles without guessing.

## 18. Student shop and order lifecycle

### 18.1 Existing reference API

`GET /api/shop/order` verifies a bearer token/profile via `verifyCaller`, resolves a student relationship, and filters Student callers’ order history. Staff callers may see broader orders. An unresolved Student link returns an empty list. The handler still selects `admin_notes`, so it is not yet an appropriate student DTO.

At the initial baseline, `POST /api/shop/order` accepted student and item data, called an incompatible order RPC, then fell back to separate inserts. In the newer working tree, it requires a UUID `requestKey`, checks Student ownership, and calls the service-role `portal_place_order` RPC with no separate-insert fallback. The October migration defines that RPC with server prices, row locks, inventory reservation, line snapshots, and idempotency. Its deployment and behavior under concurrent requests are unverified.

This is an integration reference, not yet a verified student release contract. In particular, the GET response needs a strict customer projection, the Student link must be unambiguous and current, and a missing deployed RPC must fail closed.

### 18.2 Required transaction contract

1. Verify current account, explicit athlete scope, membership capability, and shop flag.
2. Validate bounded item counts and positive integer quantities.
3. Resolve active/student-orderable products and variants belonging to those products.
4. Load current server prices and variant overrides; ignore/reject client prices.
5. Validate pickup branch and customer-facing contact fields.
6. Aggregate duplicate line quantities and apply item/total limits.
7. Lock inventory/reservations consistently and calculate totals inside one transaction.
8. Persist header, immutable line snapshots, and inventory/reservation effects atomically.
9. Return the persisted result; never return success with missing items.
10. Record idempotency so retries return the same order.
11. Fail closed when the required RPC/schema is unavailable.

Audit the service-role RPC caller model: service role does not magically preserve the student’s `auth.uid()`. Choose either a user-scoped RPC with internal authorization or a service-only RPC receiving a server-verified actor under restricted execution privileges.

### 18.3 Inventory policy

The older migrations disagreed about reservation timing. The newer `portal_place_order` migration implements reservation when an order is accepted; confirm this as the final deployed rule before checkout:

Reserve inventory on accepted student order, release on eligible cancellation/expiry, and convert to fulfillment once. If the academy changes to reservation only on confirmation, checkout must clearly state availability is provisional.

Store explicit reservation effects. Cancellation must restore only inventory actually reserved/decremented, exactly once. Repeating cancel/refund must not manufacture stock. Never clamp an oversell to zero with `GREATEST` and report success.

Verify concurrent requests for the last variant, wrong variant/product pairs, negative/oversized quantities, duplicate line items, inactive products, price changes, and cancellation replay.

### 18.4 Customer-facing lifecycle

Proposed canonical order states:

~~~text
PENDING_CONFIRMATION -> CONFIRMED -> PREPARING -> READY_FOR_PICKUP -> COMPLETED
PENDING_CONFIRMATION -> CANCELLED
CONFIRMED/PREPARING -> CANCELLED only under explicit authorized policy
~~~

Payment states are separate: PENDING, PAID, REFUNDED, VOID. An order confirmation is not payment verification. Completed orders do not become Cancelled through a normal student action; disputes/refunds belong to a controlled workflow.

Map effective database values only after migration/constraint inspection. Do not silently translate unknown states into Completed.

### 18.5 Shop UI

Product card: image, title, category, server price, variant availability. Detail: size/color/collar choices, description, and sizing guidance labeled as guidance.

Cart contains identifiers/quantities/display estimates. Reprice on submit. Show price/stock conflict before retry and retain the user’s cart.

Own order detail: order number, lines, totals, safe status, created/confirmed/fulfilled dates if present, pickup information, and student-visible notes. Omit admin_notes, procurement cost, raw KHQR hash, and internal staff audit identifiers.

## 19. Realtime and cross-portal consistency

### 19.1 Observed reference

The admin store multiplexes many tables on `infinity_realtime_sync` and removes its channel on cleanup. This is not the student subscription plan.

### 19.2 Student subscriptions

The table below is a resource invalidation plan, not a grant to subscribe directly to every base table. Under the first-release boundary in Section 7.4, use authorized refresh or safe server invalidations wherever direct Student SELECT would expose private columns.

| Resource change | Student response |
| --- | --- |
| Own student status/rank | Revalidate bootstrap/capabilities and related pages. |
| Own attendance | Invalidate history/dashboard/readiness. |
| Own payment | Re-fetch billing; never derive settlement from client event alone. |
| Own progress | Reconcile lesson/catalog/home. |
| Own belt/award/evaluation/measurement | Invalidate permitted relevant resource. |
| Own enrollment | Re-fetch timetable and billing anchor inputs. |
| Referenced class/branch | Re-fetch schedule labels/timing. |
| Published eligible content | Refresh relevant catalog and readiness version. |
| Own order | Re-fetch authorized order projection. |
| Account/grant revoked | Clear scope and private state immediately upon verified detection. |

Use authenticated channels and narrow filters, but enforce access independently in RLS/server. Database replication publication must include the intended tables.

Prefer invalidation/refetch to merging raw event payloads, especially for sensitive columns. Reconnect performs a fresh authorized fetch because events may have been missed. Treat delete events as a resync signal rather than relying on complete old-row contents. See [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

### 19.3 Race prevention

Each resource key includes account ID, student ID, filters, and schema/policy version when relevant. Increment a scope generation when identity/student changes; ignore completions from earlier generations and cancel their requests.

Deduplicate events by stable record identity/version where available. Do not overwrite newer server data with an older optimistic response. Clean up all channels/listeners on logout/unmount/scope switch.

Realtime connection status is informational, not evidence that all data is fresh.

## 20. Student backend API contract

### 20.1 Common envelope

~~~typescript
type StudentApiResponse<T> =
  | {
      success: true;
      data: T;
      error: null;
      meta: { requestId: string; fetchedAt: string; schemaVersion: string };
    }
  | {
      success: false;
      data: null;
      error: { code: string; message: string };
      meta: { requestId: string };
    };
~~~

Use consistent HTTP status as well as this envelope. Do not return secrets, SQL details, health/contact payloads, or internal stack traces in errors.

Private endpoints use the verified cookie session in the proposed SSR app. A separately documented bearer interface may support integrations; do not accept competing identities from cookies and headers without an explicit rule.

### 20.2 Scope and pagination

Initial self scope is resolved server-side. For approved guardian selection, `X-Student-Id` is a requested scope only; validate the grant on every request. Never rewrite JWT app metadata just to switch the selected child.

History endpoints use bounded date ranges and a cursor with stable ordering such as `date DESC, id DESC`. Proposed defaults: 25 entries, maximum 100, maximum 12 months for one history request. Reject invalid cursor/filter combinations and reauthorize every page.

Private responses: `Cache-Control: private, no-store`; exclude from CDN/ISR/service-worker caches. Any deliberately cached public reference endpoint must be separate from personalized content.

### 20.3 Endpoint directory

All endpoints below are proposed unless marked existing reference.

| Method/path | Data/action | Requirement |
| --- | --- | --- |
| POST /api/auth/sign-in | Internal identifier/email sign-in if required | Generic failures, provider integration, distributed limits. |
| POST /api/auth/recovery | Recovery request if mediated | Generic acknowledgment; allowlisted redirect. |
| GET /api/student/bootstrap | Account, scopes, active athlete, safe academy, flags | Identity/scope gate; minimal data. |
| GET /api/student/dashboard | Bounded card summary | Explicit unknown/error states per card. |
| GET /api/student/profile | Official self projection | Read only. |
| GET /api/student/schedule | Enrolled recurring timetable | Safe coach/branch labels. |
| GET /api/student/attendance | Daily/class-linked history + declared-basis summary | Bounded dates/cursor. |
| GET /api/student/tuition | Posted ledger + server billing summary | Live policy version. |
| GET /api/student/tuition/receipts/[id] | Authorized settled receipt | Issued-record contract required. |
| GET /api/student/lms | Eligible content + own progress | Publication/rank scope. |
| GET /api/student/lms/[assetId] | Safe lesson detail | Mapping/publication validated. |
| PUT /api/student/lms/[assetId]/progress | Started/Completed | Own mapped target; idempotent. |
| GET /api/student/training | Verified templates/assignments | Assignment model verified. |
| POST /api/student/training/completions | Self-reported session | Future persistence/idempotency. |
| GET /api/student/development | Grades/measurements/readiness | Health capability and correct syllabus match. |
| GET /api/student/belt-history | Personal promotion ledger | Stable ordering. |
| GET /api/student/achievements | Own tournament records | Safe notes. |
| PATCH /api/student/preferences | Language/theme/audio | Strict allowlist; no registry edits. |
| GET /api/student/shop/products | Safe catalog | Shop flag; active/student-orderable filter. |
| POST /api/student/shop/quotes | Server-priced checkout review | Quote bound to actor/scope/cart; atomic validation on order. |
| GET/POST /api/student/shop/orders | Own orders/atomic submit | Commerce blockers resolved. |
| GET /api/student/shop/orders/[id] | Own order detail | Parent-order ownership. |
| POST /api/student/shop/orders/[id]/cancel | Eligible cancellation request | Idempotent transition; policy dependent. |
| GET/POST /api/shop/order | Existing admin-repo reference | Not adopted unchanged; repair before reuse. |

Future endpoints are listed with their modules in Sections 26–31.

### 20.4 Handler sequence

For a private request: verify identity -> current profile/account -> portal flag -> requested scope/grant -> capability/feature -> validate body/query -> authorized query/transaction -> DTO projection -> sanitized response/audit.

Authenticate before revealing private object existence. An inaccessible child/order/certificate should not provide an existence oracle.

Use user-scoped database clients where feasible. Any privileged aggregate query must restrict all joined child tables, not merely the first student row.

### 20.5 Write examples

Lesson progress request:

~~~json
{ "status": "completed", "clientMutationId": "11111111-1111-4111-8111-111111111111" }
~~~

Server resolves asset-to-curriculum mapping, writes the authorized student’s progress, and returns persisted status/timestamp. No client-controlled student ownership, curriculum metadata, or coach grade.

Order request:

~~~json
{
  "quoteToken": "server-issued-cart-quote",
  "customerPhone": "+85500000000",
  "pickupBranchId": 1,
  "paymentMethod": "Pay at Counter",
  "studentNotes": "",
  "items": [
    { "productId": "product-uuid", "variantId": "variant-uuid", "quantity": 1 }
  ]
}
~~~

These IDs are illustrative placeholders. Send a unique `Idempotency-Key` header. The server resolves athlete/customer identity and current sellable product values. It rejects client price/subtotal/discount/paid-state fields.

### 20.6 Error catalog

| Status/code | Student behavior |
| --- | --- |
| 401 AUTH_REQUIRED / SESSION_EXPIRED | One refresh attempt, then sign-in. |
| 403 ACCOUNT_DISABLED / SCOPE_DENIED | Clear affected scope, display safe support state. |
| 403 PORTAL_UNAVAILABLE / CAPABILITY_DISABLED | Informative unavailable state; no retry loop. |
| 404 NOT_FOUND | Generic inaccessible/missing resource. |
| 409 LINK_CONFLICT / CONTENT_MAPPING_REQUIRED | Support/integration state; no automatic relinking. |
| 409 STOCK_CHANGED / PRICE_CHANGED | Refresh cart pricing/availability and ask user to submit updated order. |
| 409 IDEMPOTENCY_CONFLICT | Explain repeated request differs; reconcile existing result. |
| 422 INVALID_INPUT | Accessible field error. |
| 429 RATE_LIMITED | Honor Retry-After and disable rapid resubmission. |
| 503 FEATURE_UNAVAILABLE | Keep feature disabled; no direct-table fallback. |
| 5xx TEMPORARY_FAILURE | Bounded retry for reads; reconcile writes by idempotency. |

## 21. Client state, hydration, and loading

### 21.1 Provider boundary

Proposed `StudentProvider` owns:

- Verified bootstrap and current account/scope generation.
- Active student selection drawn only from server-authorized scopes.
- Theme/language/audio preferences.
- Connection/revalidation state.
- Lightweight global toast/dialog state.

It does not contain academy-wide arrays or administrative mutation functions.

Page resources own their filters/pagination/loading/error state. The server supplies the initial authenticated projection when useful; client revalidation must use the same identity/scope.

### 21.2 Loading sequence

1. Load a generic shell and preferences.
2. Verify the server session.
3. Resolve the account/student scope.
4. Render verified minimal student identity.
5. Fetch bounded dashboard resources.
6. Load long history and optional media only on demand.
7. Subscribe after scope establishment.

Identity/scope failures block personal rendering. Optional resource failures do not sign the user in by fallback or make another card appear successful.

Avoid returning cached data under a new identity while authorization is pending.

### 21.3 Resource states

Use explicit states: idle, loading, ready, refreshing, stale, empty, error, unavailable, forbidden.

Empty means a successful query returned no records. Error means the query failed. Unavailable means a feature/schema prerequisite is absent. Stale means previously authorized data is displayed with its freshness information under the allowed cache policy.

Use skeletons with stable dimensions, not an indefinite spinner. A timeout transitions to a retryable error; it does not pretend success.

### 21.4 Optimistic writes

Only low-impact self-tracked progress may be optimistic. Keep a pending marker, mutation ID, previous value, and scope generation; reconcile with the server or roll back.

Tuition payment, order submission, examination approval, attendance, official rank, and coach grades never become final from optimistic state.

## 22. Design system, accessibility, and localization

### 22.1 Student visual system

Retain the Infinity red identity and recognizable typography. The reference app defaults to light mode; the old document’s “dark-first implemented” claim was inaccurate. Proposed student default: follow system theme, then honor saved preference.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| Canvas | #FFFFFF | #0A0A0A | Page background. |
| Surface | #FFFFFF | #0F0F0F | Cards/dialogs. |
| Recessed | #F3F4F6 | #141414 | Inputs/secondary panels. |
| Border | #E5E7EB | #262626 | Dividers. |
| Text | #1F2937 | #E4E4E4 | Main copy. |
| Muted | #4B5563 | #999999 | Secondary copy. |
| Brand | #EF2F38 | #EF2F38 | Identity/focus/selected accents. |

These are starting tokens, not proof of contrast compliance for every combination. Test actual text/button/disabled states. Use a darker red token where necessary for small text/white-label contrast.

Fonts: Montserrat for supported Latin text; Kantumruy Pro for Khmer as in the reference layout. Chinese needs a deliberate supported font/fallback and testing; Montserrat does not cover it.

Keep student cards less dense than the admin grid. Use mobile spacing around 16px, larger desktop spacing, consistent radii, and restrained motion.

### 22.2 Responsive behavior

- Base layout works at 320–390 CSS px without horizontal page overflow.
- Bottom navigation respects `env(safe-area-inset-bottom)`.
- Dialogs fit viewport height and support internal scrolling.
- Use `min-w-0` for grid/flex children and wrap long names/translations.
- Avoid hover-only controls and drag-only actions.
- Larger screens use extra space for readable history, not extra permissions.
- Do not disable zoom, text scaling, selection, or copy globally.
- Preserve normal browser navigation and recovery.

### 22.3 Accessibility acceptance

Target WCAG 2.2 AA behavior; validate actual implementation.

- Interactive controls have clear names and practical 44×44px touch targets.
- Keyboard focus is visible; navigation, dialogs, tabs, calendars, and video controls are reachable.
- Dialogs trap focus appropriately, support Escape where safe, and restore focus.
- Announce errors and important state changes without repetitive live-region chatter.
- Charts have textual summaries/tables; badges use words/icons as well as color.
- Read-only information is selectable text.
- Honor reduced motion and provide pause/stop for animation.
- Form errors are associated with fields; password managers/paste remain supported.
- “Late,” “Unpaid,” and measurement changes are not encoded only by color.

### 22.4 Localization

The reference uses `en/kh/zh` internal locale keys. Proposed document language tags: en, km, and an approved Chinese tag such as zh-Hans, with an explicit mapping from legacy keys.

Separate student translations from the admin navigation/permission dictionary. Use typed keys and interpolation/plural rules.

For database content, use translated fields or a content localization model; exact-title translation lookup is a compatibility fallback, not a scalable source of truth.

Keep canonical identifiers, enums, dates, and money unchanged; localize display. Show original-language content when no translation exists. Do not silently machine-translate personal/health records.

## 23. PWA, offline behavior, and cache isolation

### 23.1 Reference and proposed build

The reference registers `public/sw.js`; its source is root `sw.ts`. The original build required `BUILD_PWA_SW=true`; the sampled newer `next.config.ts` runs worker generation for production client builds automatically. It is not automatically `app/sw.ts`, and an existing generated file may represent a different build.

Student PWA needs its own manifest identity, screenshots, icons, shortcuts, cache prefix, and generated worker. Do not reuse the “Infinity TKD Admin Portal” manifest or admin precache list.

Use the actual selected Serwist integration and verify generated output. See [Serwist Next integration](https://serwist.pages.dev/docs/next).

### 23.2 Manifest requirements

Proposed values:

~~~json
{
  "id": "/student-portal",
  "name": "Infinity TKD Student Portal",
  "short_name": "Infinity TKD",
  "start_url": "/dashboard?source=pwa",
  "scope": "/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#EF2F38",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/maskable-icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
~~~

This assumes a separate student origin at root. A path-hosted app must change scope/start URL/worker registration together. Define student screenshots and only student shortcuts.

Production requires HTTPS. Install prompts are platform-dependent; provide contextual manual instructions where needed. An unsupported install prompt does not block normal browser use. See [Next.js PWA guidance](https://nextjs.org/docs/app/guides/progressive-web-apps).

### 23.3 Cache policy

| Resource | Proposed strategy | Privacy/freshness |
| --- | --- | --- |
| Versioned JS/CSS/fonts/icons | Precache/cache-first | Public immutable assets; bounded cache. |
| Generic offline page | Precache | No athlete data. |
| Public reference content/images | Explicit bounded cache | Only approved nonpersonal content. |
| Anatomy chunks | Opt-in bounded cache | Versioned assets, quota-aware; no automatic full download. |
| Auth/recovery/session callbacks | Network-only | Never store tokens or credential responses in worker caches. |
| Private API, HTML, RSC/Flight responses | Network-only | No shared navigation cache for personal pages. |
| Tuition/receipts/payment initiation | Network-only | No offline settlement claims. |
| Orders/exams/QR pass | Network-only | No queued authoritative transactions. |
| Health/signatures/private media URLs | Network-only | No generic image cache. |

Generic navigation caching is not safe simply because APIs are network-only: private HTML/RSC can carry student data. Exclude these requests explicitly and review fallback/default cache rules.

### 23.4 Offline experience

Initial release supports the generic shell, help, and approved public cached learning material. Sensitive student data remains unavailable when fresh authorization cannot be verified.

Optional scoped lesson metadata/progress drafts may be cached after a separate privacy decision. Display “Offline — progress not synced” and the last successful update. Never call cached data verified current status.

If later personal offline reading is approved, define exactly which fields, retention, identity partition, unlock policy, and revocation limitations apply. Local data cannot magically learn about a server revocation while disconnected.

### 23.5 Restricted progress queue

Allowed initial queue: self-tracked learning completion only.

Queue record:

~~~text
mutationId, accountId, studentId, assetId,
desiredStatus, contentVersion, createdAt,
expiresAt, attemptCount, schemaVersion
~~~

- No saved bearer token, arbitrary URL/method, account contact details, or arbitrary request headers.
- Reconstruct the approved endpoint and current credentials at replay time.
- Reverify current account, athlete grant, content eligibility, and mapping.
- Use idempotency and monotonic completion merge.
- Pause replay on authentication failure; treat 429 as delayed, not discard.
- Drop/review invalid/revoked/expired operations with a visible explanation.
- Serialize concurrent queue flushes; clean up after logout/account switch.
- Bound size/age/retries; preserve user-visible pending status until resolved.

Do not replay payments, orders, attendance, official profile changes, or exams offline.

### 23.6 Worker update and cache purge

Prompt for a safe update when a new worker is ready. Avoid forced reload during a workout or unconfirmed form; preserve allowed drafts before updating.

Use app/build-specific cache names and clean only the student application’s caches. Logout clears private memory, permitted scoped local data, and queued mutations. Do not delete unrelated origin/application data indiscriminately.

Inspect Cache Storage/IndexedDB after switching from Student A to Student B. Private content from A must not reappear through old navigation, image, or queue caches.

## 24. Storage, media, and privacy

### 24.1 File delivery

Reference code stores URL/path strings, but no complete bucket/policy design is established for student avatars, signatures, receipts, or certificates.

Proposed private storage classes:

| File class | Access | Student action |
| --- | --- | --- |
| Profile photo | Own authorized display | Read initially; upload only if later explicitly enabled. |
| Signature/identity document | Narrow authorized staff use | No raw student endpoint by default. |
| Issued certificate | Owning athlete/approved guardian | Read/download through authorization. |
| Receipt | Authorized billing scope | Read issued snapshot. |
| Public lesson thumbnail | Approved public content | Bounded cache. |
| Learning video | Publication/eligibility policy | Safe embed or private stream. |

Do not use public bucket URLs for private documents. Authorize each object and issue short-lived URLs or stream through a controlled endpoint. Signed URLs are access tokens and must not enter logs, push text, or public caches. Bucket policies need their own review; see [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

### 24.2 Video/embed policy

Use an approved provider allowlist and a URL parser. The reference has YouTube/embed helpers and restrictive headers; test actual student video playback under the deployed CSP.

Define `frame-src`, image/connect origins, and referrer behavior for intended providers. Do not broadly allow all HTTPS frames to make one lesson work.

Private lesson metadata gating does not protect a publicly accessible video URL. Choose media access accordingly. Captions/transcripts and nonvideo instructions improve accessibility.

### 24.3 Uploads, if introduced later

Limit file size/type, validate contents server-side, assign authorized object paths, strip unnecessary metadata, avoid public identifiers, and use controlled replacement/deletion. Do not let clients choose another student’s path.

No upload route is part of the initial official-profile editing scope.

### 24.4 Data minimization

Keep health, contact, DOB, signatures, finance notes, and internal reasons out of dashboard previews, notifications, URLs, and routine telemetry. Store only fields needed for each feature.

Shared devices are a first-class scenario. Logout/back navigation/account switching must not show a previous athlete. Operational retention/deletion decisions require an approved academy policy; this document does not invent a legal retention period.

## 25. Errors, retries, telemetry, and performance

### 25.1 Error handling

Reuse the reference’s error-envelope and segment-boundary concepts after removing admin dependencies. Provide route-level boundaries and scoped retry actions.

No generic “self-healing” promise: a failed ownership check, schema mismatch, missing content mapping, or invalid transaction is not repaired by retries.

Never retry permission/validation errors automatically. Network detection is advisory; a browser online event does not prove the API is reachable.

### 25.2 Retry policy

Reads may use bounded exponential backoff with jitter and timeout. Honor Retry-After. Cancel pending retry when identity/scope changes.

Writes require idempotency or reconciliation before retry. A timed-out order may already exist. Query by idempotency/result instead of submitting another purchase.

Reference `resilientFetch` is method-agnostic; do not adopt its default retries for commerce.

### 25.3 Telemetry

Record request ID, route template, operation, safe error code, build/schema version, duration, and coarse connection state. Scrub query strings, headers, signed URLs, passwords/tokens, and student/health payloads.

The reference telemetry route accepts client strings and writes to audit logs. Adapt with redaction and delivery limits rather than copying full error messages/stack URLs.

Avoid recursive telemetry failures and high-frequency retries. Private action audits are server-authored with verified actor IDs; a client must not forge staff actions.

### 25.4 Proposed performance budgets

These are targets to measure, not existing benchmark claims.

| Area | Proposed target |
| --- | --- |
| Core mobile page | LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 under an agreed representative test profile. |
| Bootstrap | One bounded account/scope response; no global directory download. |
| History | Cursor pagination, default 25/max 100 rows. |
| Dashboard | Bounded summaries; optional cards lazy/load independently. |
| Anatomy | Separate chunk; no home-route model transfer. |
| Realtime | Only active authorized resources; cleanup verified. |
| Local cache | Explicit quota/age and privacy partition. |
| API | Profile query plans, concurrency, and p95 latency under representative load. |

Optimize after measuring: appropriate student/date indexes, selected columns, aggregation, pagination, and dynamic imports. Do not claim fixed 60 FPS or zero memory leaks without device testing.

## 26. Additive database extension plan

Objects below are proposed additions or reuse decisions. Sections 46–49 identify newer source evidence that supersedes earlier proposed table names. Finalize names/types against the canonical schema and avoid parallel replacements for shared records.

### 26.1 Extension registry

| Extension | Minimum fields/constraints | Purpose/dependency |
| --- | --- | --- |
| `student_access_grants` | UUID id; account_id UUID -> profiles; student_id compatible -> students; relationship; explicit capabilities; approved_by/at; valid_from; expires_at; revoked_at; audit timestamps | Verified guardian/multi-athlete access. |
| `student_preferences` | account_id PK; language/theme/audio; updated_at | Optional account-synced preferences; no role/link columns. |
| `curriculum.library_asset_id` or canonical mapping table | Unique verified asset reference; curriculum reference; migration/backfill evidence | Repair library/progress bridge. |
| `workout_completions` | Student/template/plan/version; UUID session/idempotency; timestamps; self-reported results/status | Persist training history separately from coach grades. |
| Provider payment intents/events | Provider/idempotency/reference; student; amount/currency; verified event IDs/timestamps; allocation state | Future verified provider payments. Existing October `payment_transactions` records staff-entered settlement and receipts, not provider webhook evidence. |
| Reuse `membership_allocations` and `membership_credit_uses` | Receipt/credit -> authoritative existing invoice; amount; ownership and total checks | October 25 source supplies these objects; do not create a parallel `payment_allocations` table by default. |
| Reuse `portal_push_subscriptions` and `portal_push_deliveries` | Account/endpoint/keys and per-notice delivery attempts/lease/status | October 23 source supplies push persistence; add only missing verified lifecycle fields. |
| Reuse `portal_notifications` | Account/source-key/category/safe content/link; read/dismissed/resolved timestamps | Existing inbox; add explicit student scope/publication semantics where needed instead of a duplicate `student_notifications` ledger. |
| Adapt `grading_events` for published opportunities if suitable | Existing event/target/date/threshold plus proposed publication/window/capacity/fee rules | Do not create `exam_cohorts` as a parallel event source without an explicit business distinction. |
| `exam_registrations` | Student/cohort unique; state; eligibility snapshot; approvals; payment reference | Application/approval lifecycle. |
| `issued_certificates` | Student/promotion; unique serial; issued snapshot; opaque verification token; issuer; revoked_at; file ref | Verifiable issued document. |
| `checkin_pass_nonces` or replay ledger | Hashed nonce/token ID; audience; student/class occurrence; expiry/consumed timestamp | Future online rotating pass. |
| Reuse `class_occurrences`, roster, holidays, membership periods | October 25 source: stable occurrence ID, source date, actual start/end, status/revision/roster provenance | Student-safe session projection and accurate history; do not recreate these objects. |
| Assessment history/version fields | Student/belt/skill identity; rubric/version; recorder/time; immutable assessment entry | Reliable historical coaching development. |
| Order expiry/reconciliation extension | Reservation expiry and reconciliation evidence, if product policy requires timeouts | The October `portal_place_order` migration already proposes request keys and reserved stock; verify it before adding parallel structures. |

### 26.2 Constraint and access requirements

- Preserve current PK/FK types; do not introduce UUID student IDs where the roster uses strings.
- Add foreign keys, appropriate unique keys, positive/nonnegative decimal checks, and finite enum constraints.
- Index scope/date/filter fields actually used by queries.
- All private extension tables enable RLS immediately and default to deny until policies are supplied.
- Students cannot insert/update access grants, official payment settlement, exam approvals, or certificate issuance.
- Recipient notification access is account-scoped; athlete scope may further restrict deep-linked data.
- Expired/revoked grants remain auditable; renewal must not destroy access history.
- New writes remain compatible with the official data consumer before student flags are enabled.

DDL is intentionally not presented as a “complete master schema.” A buildable migration set must be produced after schema inspection and independently tested in staging.

## 27. Guardian and household access

### 27.1 Current limitation

At the initial baseline, `components/HouseholdManagementModal.tsx` used local sample groups. The newer component calls `app/api/admin/households` and its payments route; October migrations define `households`, `household_students`, and staff-managed household payment batches. This establishes a proposed persisted **admin** grouping and collection flow, subject to deployment verification. It does not establish guardian authentication, a grant from a guardian account to a child, student-side household switching, or an automatic sibling discount policy.

No learner may be linked simply because children share emergency-contact email/phone/name.

### 27.2 Proposed verified grants

A privileged process verifies the guardian relationship and creates per-account/per-student grants. Capabilities may differ: readProfile, readHealth, readTuition, recordLearning, placeOrder, registerExam.

Revocation/expiry takes effect in API, RLS, subscriptions, and cache revalidation. Multiple guardians can have different rights. Adult-student access transitions require an explicit academy process, not a DOB-triggered assumption.

### 27.3 Switching workflow

1. Bootstrap returns only authorized athlete summaries.
2. User selects a child from that set.
3. Cancel old requests/channels and increment scope generation.
4. Clear child-specific data from the displayed page.
5. Send the requested child scope to the server; server checks the grant.
6. Load the new authorized snapshot and subscriptions.
7. Reject revoked grants and return to an authorized scope/support state.

Never fetch the whole student roster and filter in the browser. Never store active child selection as trusted JWT ownership.

Future API: `GET /api/student/scopes`; optional `POST /api/student/active-scope` for preference persistence. The latter does not grant access.

### 27.4 Family tuition

A family overview is a projection of individually authorized obligations. A combined payment requires explicit allocations to each bill/cycle.

No sibling discount is assumed. Define policy/version/order of discounts before adding it; do not apply an invented “second child” percentage in the student UI.

## 28. Verified tuition payments and KHQR

This module is **proposed and disabled** until merchant/provider setup, authoritative obligations, and server verification are implemented.

### 28.1 Payment state machine

~~~text
CREATED -> PENDING -> VERIFIED_PAID
CREATED/PENDING -> EXPIRED | FAILED | CANCELLED
VERIFIED_PAID -> REFUND_PENDING -> REFUNDED, if provider/policy supports it
~~~

Keep provider transaction state separate from tuition ledger Paid/Unpaid/Pending and shop payment states. A QR payload, bank logo, screenshot, hash, client timer, or browser redirect is not proof of payment.

### 28.2 Required transaction flow

1. Authorize the athlete’s billing capability.
2. Resolve authoritative payable obligation and remaining amount.
3. Create an idempotent provider transaction with exact server amount/currency.
4. Generate a provider-supported checkout/QR artifact server-side.
5. Return limited display payload and expiry; cache-control no-store.
6. Accept authenticated provider callback or verified server polling.
7. Verify merchant, reference, amount, currency, event authenticity, and final provider state.
8. Deduplicate events and lock relevant transaction/allocation/ledger rows.
9. Post settlement exactly once; generate authorized receipt state.
10. Reconcile missed callbacks and unresolved pending transactions through a server job.

Future API: `POST /api/student/tuition/payment-intents`, `GET /api/student/tuition/payment-intents/[id]`, and a provider-specific webhook route.

### 28.3 Provider-specific implementation boundary

Do not use the earlier document’s guessed HMAC/token formats, fabricated bank SDK calls, or random hashes. Obtain current official merchant integration details and sandbox credentials before implementation.

A server-to-server webhook needs its own signature/replay/rate-limit policy. Browser Origin/CSRF checks are not its authentication mechanism. Validate deployed middleware behavior deliberately.

Client polling is bounded and stops on expiry/logout/background. Client success text follows a verified server state only. Future family/shop settlement uses the same verified transaction principles with separate allocation targets.

## 29. Digital identity and QR check-in pass

**Proposed:** online-only rotating pass, not direct student attendance marking.

### 29.1 Pass service

Authorize account, athlete, membership, and relevant class/occurrence. Issue a short-lived token with audience, token ID/nonce, athlete identity reference, expiry, and intended use.

Sign server-side. Do not embed signing secrets, calculate trusted signatures in the browser, or place DOB/contact/health data in the QR.

Future API: `POST /api/student/checkin-pass`; staff scanner verification is a separate privileged service.

### 29.2 Verification and replay

The scanner verifies signature, audience, expiry, live athlete eligibility, class applicability, and replay rules, then records attendance through the authorized academy process.

A screenshot may remain usable until expiry; rotating display alone does not prevent replay. Use consumed token IDs/nonce handling and a defined duplicate-scan response.

The baseline attendance model supported one mark per athlete/day. The newer nullable `class_id` permits class-linked marks while preserving legacy daily records; a live rotating pass still needs a stable occurrence, scan timestamp, replay controls, and compatibility rules for both record types.

### 29.3 Wallet scope

Wallet cards, native pass signing, issuer credentials, and update services are separate future work. A static academy ID/barcode is not a cryptographically verified live pass. Do not include wallet integration in initial readiness criteria.

## 30. Notifications and web push

**Current reference:** October 23 source implements a durable `portal_notifications` inbox, preferences, subscriptions, delivery claims, and push dispatch. `app/api/notifications/route.ts` accepts Student roles. The separate student application still needs a safe projection, its own link/worker integration, and verification of deployed jobs/configuration; see Section 49.

### 30.1 Events and recipients

| Event | Recipient rule | Safe notification |
| --- | --- | --- |
| Schedule change | Authorized enrolled athlete/guardian | “Your class schedule was updated.” |
| Tuition update | Approved billing scope | “Your tuition information was updated.” |
| Order ready | Owning order scope | “Your order is ready for pickup.” |
| Promotion/award published | Authorized athlete | “A new academy record is available.” |
| Exam application change | Authorized applicant | “Your exam application was updated.” |

Do not put student full names, debts, health, signatures, or private document URLs on a lock screen.

### 30.2 Subscription and delivery

Ask after a deliberate user action and explain the benefit. Permission denial is respected; no repeated automatic prompt.

Persist subscriptions per account/device, restrict read/write access, remove/revoke on logout/account change as designed, and remove dead endpoints on delivery failure.

Create the inbox record once with a dedup key; dispatch push through a privileged outbox/worker. Client code never calls a public arbitrary-recipient push endpoint.

Proposed student wrapper APIs: `GET /api/student/notifications`, `PATCH /api/student/notifications/[id]/read`, `POST/DELETE /api/student/push-subscriptions`. Adapt the existing account-owned tables/service; do not assume the current shared API's payload and admin-app paths are the final student contract.

Deep links are internal allowlisted routes and still require live authorization. Delivery failure does not erase the durable inbox event.

## 31. Exams, certificates, and optional pose analysis

### 31.1 Examination registration

**Proposed dependencies:** published cohorts, registration windows, capacity, fees, reliable readiness inputs, and coach approval.

The October 25 source already defines staff `grading_events` and `grading_candidates` with assessment/promotion states and revisions. That does not establish a student registration or result-publication workflow. Reuse the authoritative event/result where appropriate and add the missing student lifecycle described in Section 49.

Workflow:

~~~text
AVAILABLE -> APPLICATION_SUBMITTED -> COACH_REVIEW
COACH_REVIEW -> APPROVED | REJECTED | CHANGES_REQUIRED
APPROVED -> PAYMENT_REQUIRED | CONFIRMED
CONFIRMED -> ATTENDED -> RESULT_PUBLISHED
~~~

Store eligibility/policy snapshot and server timestamp at submission. Revalidate before confirmation where required. Student self-tracked LMS cannot alone approve an examination.

Use a unique student/cohort registration, idempotent submit, authoritative capacity checks, and auditable transitions. Cancellation/refund conditions are explicit.

Future APIs: `GET /api/student/exams`, `POST /api/student/exam-registrations`, `GET /api/student/exam-registrations/[id]`.

### 31.2 Issued certificate and verification

A certificate is an immutable issued snapshot tied to an official promotion/result. Assign a unique serial, issuer, issued date, file reference, opaque high-entropy verification token, and revocation state.

Do not derive a guessable public hash solely from student ID/name/date. A public token resolves only minimal consent-approved information: issuer, serial, rank, issued date, validity, and minimal student display identity.

Never disclose contact, DOB, medical information, tuition, signatures, or all promotion records publicly. Revoked documents remain resolvable as revoked; reissue creates a new issuance record.

Private certificate download reauthorizes ownership and storage access. Public verification means “academy record verified,” not external Kukkiwon validation unless an actual authoritative integration establishes it.

### 31.3 Optional camera pose analysis

No executable pose implementation was found. Keep this outside the initial launch.

Before prototyping: select supported model/runtime, define valid motion measurements and confidence thresholds, test device performance, and amend camera CSP/Permissions-Policy for the dedicated route.

Camera access requires explicit user initiation. Stop tracks on exit, process locally when feasible, avoid raw video upload/storage by default, and show uncertainty. An inferred angle is educational feedback, not a coach grade or medical diagnosis.

## 32. Canonical schema and migration workflow

### 32.1 Why a fresh baseline is required

The original reference checkout had incremental migrations without a complete executable base schema. A dated schema-only test fixture now exists at `tests/fixtures/live-schema-20261011.sql`; it includes substituted Auth functions and historical policy/function definitions for isolated tests. It is not a production reset script. Date-only prefixes remain duplicated in older files: two begin 20260914 and five begin 20260928. Newer timestamp-style migrations reconcile parts of this history, but the current deployed starting schema and applied order must still be exported and verified.

Do not run every historical script blindly or assume alphabetical order proves the deployed schema. Supabase migration history must have an unambiguous version/sequence.

### 32.2 Read-only inspection package

Collect in an authorized staging/read-only environment:

- Applied migration versions/history.
- Tables, columns, SQL types/nullability/defaults.
- PK/FK/unique/check constraints and indexes.
- Grants, policies, RLS flags, view security properties.
- Function names/full signatures, execute grants, owners, search paths, security-definer flags.
- Trigger definitions and linking behavior.
- Realtime publication membership.
- Storage bucket/object policies.
- Existing orphaned/conflicting links/content mappings and ledger keys, without exposing personal records in documentation.

Example read-only catalog queries:

~~~sql
-- Policies and effective policy expressions.
select schemaname, tablename, policyname, permissive, roles,
       cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Full signatures prevent overlooking TEXT/VARCHAR overloads.
select n.nspname as schema_name, p.proname,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, arguments;

-- Actual constraints; use this instead of document-era guessed DDL.
select conrelid::regclass as table_name, conname, contype,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where connamespace = 'public'::regnamespace
order by table_name, conname;
~~~

These queries inspect metadata; they do not certify ownership behavior. Run behavioral tests using real restricted test identities separately.

### 32.3 Delivery sequence

1. Snapshot/export canonical schema and applied history.
2. Generate typed database definitions.
3. Reconcile migration naming/history without rewriting already-applied versions casually.
4. Create uniquely versioned additive migrations for ownership, content bridge, needed indexes, and feature contracts.
5. Backfill links/mappings with ambiguity reports and privileged review.
6. Test direct API/RPC permissions and user-scoped queries in staging.
7. Verify official data consumers still function.
8. Deploy compatible schema before dependent student code.
9. Enable features only after acceptance evidence.
10. Keep a rollback/disable plan and restoration evidence for data-sensitive changes.

Do not drop shared core tables or recreate them from this document. Destructive migrations require a separately reviewed operational plan.

### 32.4 Candidate indexing

Verify existing indexes before adding:

| Query | Candidate index |
| --- | --- |
| Own daily history | attendance(student_id, date DESC, id DESC). |
| Own monthly ledger | payments(student_id, year, for_month), uniqueness matching actual rule. |
| Own progress | lms_progress(student_id, curriculum_id), verified unique. |
| Own enrollments | class_enrollments(student_id, class_id). |
| Own promotions/awards | student_id with event/promotion date and ID. |
| Own grades | student_id, belt_level, skill identity/version. |
| Own measurements | student_id, recorded_date DESC, id DESC. |
| Own orders | pos_orders(student_id, created_at DESC, id DESC). |
| Variant resolution | product_variants(product_id, is_active) and unique SKU. |
| Future grants/inbox | account/student/revocation fields; account/read/created date. |

Choose indexes from actual query plans and cardinality; do not add redundant index families solely because a document lists them.

## 33. Proposed student repository structure

This is a target structure for a separate student project, not directories already present in the admin repository.

~~~text
app/
  (auth)/
    login/page.tsx
    forgot-password/page.tsx
    reset-password/page.tsx
    change-password/page.tsx
  auth/callback/route.ts
  (student)/
    layout.tsx
    dashboard/page.tsx
    profile/page.tsx
    schedule/page.tsx
    attendance/page.tsx
    tuition/page.tsx
    lms/page.tsx
    lms/[assetId]/page.tsx
    training/page.tsx
    training/[templateId]/page.tsx
    development/page.tsx
    belt-journey/page.tsx
    awards/page.tsx
    settings/page.tsx
    shop/page.tsx
    shop/products/[id]/page.tsx
    shop/orders/page.tsx
    shop/orders/[id]/page.tsx
    notifications/page.tsx
    digital-pass/page.tsx
    exams/page.tsx
    exams/[cohortId]/page.tsx
    certificates/[id]/page.tsx
    anatomy/page.tsx
  verify-cert/[token]/page.tsx
  api/auth/...
  api/student/...
  offline/page.tsx
  support/page.tsx
  layout.tsx
  globals.css
components/
  student/StudentLayout.tsx
  student/StudentNavigation.tsx
  student/StudentSwitcher.tsx
  student/ScopeBoundary.tsx
  student/ResourceState.tsx
  learning/
  training/
  development/
  pwa/
  ui/
lib/
  auth/resolve-student-scope.ts
  auth/capabilities.ts
  supabase/browser.ts
  supabase/server.ts
  supabase/privileged.ts
  student/provider.tsx
  student/api-client.ts
  student/contracts.ts
  student/projections.ts
  student/repositories/
  student/services/
  student/resource-keys.ts
  policies/billing.ts
  policies/readiness.ts
  content/parse-lesson.ts
  offline/progress-queue.ts
  errors/
  telemetry/
  i18n/
types/database.ts
public/
  icons/
  manifest.webmanifest
sw.ts
middleware.ts
tests/
  unit/
  integration/
  e2e/
~~~

Choose one source convention, with or without src/. Server-only credential modules must not be importable by client components. Shared academy contracts should be versioned packages/modules with no admin-provider dependency.

## 34. Environment, build, deployment, and operations

### 34.1 Environment contract

| Variable/category | Exposure | Purpose |
| --- | --- | --- |
| Supabase project URL | Public | Client/server project target. |
| Supabase publishable or supported legacy anon key | Public | Restricted user-scoped access; not a privileged secret. |
| Student application origin | Server config/public where needed | Redirect/origin configuration. |
| Service/secret key | Server-only, only where required | Narrow privileged processes. |
| Provider credentials/webhook verification keys | Server-only | Future payment module. |
| VAPID private key | Server-only | Future push delivery. |
| VAPID public key | Public when enabled | Push subscription. |
| QR signing key | Server-only | Future pass issuance. |
| Distributed rate-limit backend | Server-only | Cross-replica protection. |
| Build/schema/policy version | Safe metadata | Diagnostics and compatibility. |

The reference uses `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and server `APP_URL`. Its current delivery worker additionally uses `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`, and `NOTIFICATION_JOB_SECRET`. Only the public push key is disclosed through an approved configuration response; worker/private keys remain server-only. A student browser build does not need the scheduler secret. Select/document one naming scheme in the student project; do not copy real .env values into this file.

Validate public and server variables separately. Never require a privileged key in a browser-imported module or expose it through a NEXT_PUBLIC name. Do not copy the reference development TLS bypass into student production configuration.

### 34.2 Deployment isolation

Use separate student/admin origins and distinct application/PWA identity. Maintain staging with its own database/auth/provider sandbox.

Configure student Auth redirects, cookie/origin behavior, HTTPS, private response headers, CSP, storage access, realtime publications, and feature flags deliberately.

Keep private pages out of static export, ISR, CDN caching, and generic navigation caches. Verify network responses and cookies in deployed staging, not only local development.

### 34.3 Build gates

The reference baseline had dev/build/start/lint/icons scripts and a strict tsconfig, but its Next config ignored build type/lint errors. The newer working tree enables those Next build checks and adds `typecheck`, `test`, and `check` scripts. Their passing status was not established by this documentation review.

Student CI must separately run:

~~~text
npm ci
npm run lint
npx tsc --noEmit
unit/integration tests using declared student test scripts
production build with the configured worker-generation step
student end-to-end acceptance suite
~~~

Do not claim test scripts exist before creating them. Pin a supported Node runtime using the chosen framework/package engines and CI configuration. Declare every direct import dependency.

Fail the build on type/lint errors. Verify manifest, generated worker, offline fallback, and student precache list from that exact artifact.

### 34.4 Rollout and rollback

Release read-only student core first to a small authorized pilot. Keep optional commerce/provider/guardian modules disabled.

Monitor login/scope failures, API latency/error rates, progress saves, realtime reconnect, and cache privacy regressions. Alerts should use safe codes/request IDs.

Rollback may disable feature flags, revert application version, and reconcile worker caches. Database rollback must preserve student progress, transaction history, and official records; code rollback alone cannot undo a settled payment.

## 35. Phased implementation backlog

### Phase 0 — establish shared contracts

Deliver canonical schema/types, policy/grant/RPC inventory, account-link invariants, content bridge decision, billing/readiness policy versions, and compatible migration sequence.

Exit criteria: two test students cannot access each other through API, Data API, RPC, storage, or relevant realtime channels; inactive/revoked access fails; effective ownership columns are protected.

### Phase 1 — student read-only foundation

Deliver separate student project, server auth/scope guard, login/recovery, navigation, dashboard, profile, schedule, labelled daily/class attendance, tuition ledger, belt journey, awards, language/theme, and error states.

Exit criteria: own records only, accurate null/unknown handling, mobile accessibility, no admin routes/provider/data dependencies, no private response cache.

### Phase 2 — learning and development

Deliver repaired lesson mapping, published eligible catalog/detail, idempotent own progress, coach assessments, biometrics, readiness explanation, verified templates, and local timer.

Exit criteria: no curriculum authorship by students; no official-grade writes; missing syllabus/date data is explicit; progress isolation/idempotency passes.

### Phase 3 — PWA and controlled resilience

Deliver student manifest/icons/worker, generic offline shell, cache exclusions, safe update flow, and optional scoped progress queue.

Exit criteria: production-generated worker verified; logout/account switching/cache inspection passes; sensitive transactions cannot queue offline.

### Phase 4 — merchandise

Deliver repaired RPC/lifecycle/pricing/reservation/idempotency contracts, safe catalog, own checkout/order details, and applicable cancellation.

Exit criteria: concurrent last-unit checkout, forged prices/variants, RPC failures, partial-write prevention, timeout replay, and duplicate cancel tests pass.

### Phase 5 — guardian and verified payments

Deliver approved access grants/switching, audited revocation, billing allocations, merchant sandbox verification, reconciliation, and authorized receipts.

Exit criteria: grant removal works across all access paths; forged/replayed/mismatched payment events cannot settle tuition; duplicate events post once.

### Phase 6 — additional student services

Deliver inbox/push, rotating pass, exam application/approval, issued certificate verification, and optional anatomy enhancements.

Each module has an independent flag and acceptance gate. Pose analysis/wallet integrations remain separate future projects.

### 35.1 Task sizing and completion definition

An implementation task must identify source contract, data ownership, UI states, API validation, migration need, acceptance cases, and feature flag.

“Done” means code, compatible persistence/policies, meaningful tests, accessible UI, staged evidence, and documentation all agree. A mocked card, sample household, or code snippet is not a completed feature.

## 36. Test and acceptance matrix

Use synthetic accounts/data in staging. The entries below are required verification plans; this documentation revision has not executed them.

| ID | Test | Expected outcome |
| --- | --- | --- |
| AUTH-01 | Anonymous/private route and API | No personal data; proper sign-in/401. |
| AUTH-02 | Student A supplies Student B ID/header | Denied without existence/data leak. |
| AUTH-03 | Enabled session with disabled current profile | Live private access denied. |
| AUTH-04 | Missing/conflicting explicit links | Support state; no roster fallback. |
| AUTH-05 | Forged user_metadata role/student ID | No new authority. |
| AUTH-06 | Old JWT after role/grant/account change | Behavior matches documented revocation boundary; sensitive access denied. |
| AUTH-07 | Direct Data API profile/link mutation | Cannot edit role, activation, or account/student association. |
| AUTH-08 | Anonymous/profile-email RPC enumeration | Closed or deliberately restricted approved login design. |
| AUTH-09 | Recovery external redirect/callback tampering | Rejected; credentials never in URLs. |
| AUTH-10 | Multiple tabs refreshing/logout | Consistent identity; no leaked old student state. |
| DATA-01 | A queries B attendance/payment/grade/award/order | Denied via API and direct database paths. |
| DATA-02 | Query fails versus successful empty list | Error distinguished from empty. |
| DATA-03 | Raw response inspection | No costs/internal notes/signature paths/staff details. |
| DATA-04 | Null measurements/unknown enums/invalid JSON | Safe display; no fabricated zero/completion. |
| DATA-05 | Date-only near timezone/month boundaries | Academy-local dates remain correct. |
| SCHED-01 | Enrollment starts in future | Earlier occurrences excluded. |
| SCHED-02 | Legacy/modern weekday fields | Deterministic normalized weekly schedule. |
| ATT-01 | Unrecorded date | Unrecorded, not Absent. |
| ATT-02 | Multiple classes on one day with legacy table | No invented per-class attendance. |
| BILL-01 | Month-end/leap-year/first-day enrollment | Versioned expected anchor/cycle results. |
| BILL-02 | Full scholarship/Pending/paused old debt | Explicit exemption/pending/history; no false Paid. |
| BILL-03 | Class transfer/fee change | Preserved agreed anchor and recorded historical amounts. |
| LMS-01 | Missing asset/curriculum bridge | Clear unavailable state; no curriculum insert. |
| LMS-02 | Duplicate completion/delayed Started | One row; completion not regressed. |
| LMS-03 | Ineligible/private/unpublished lesson URL | Correct access/media enforcement. |
| DEV-01 | Missing syllabus/rank-specific evaluation | Unknown or defined applicability; no false readiness. |
| DEV-02 | PRI high but a factor unmet | No automatic promotion. |
| SHOP-01 | Client price/discount/Paid field injected | Rejected/ignored; server computes truth. |
| SHOP-02 | Wrong variant/product, inactive product, huge qty | Denied before transaction. |
| SHOP-03 | Two purchases for last available unit | Defined reservation policy; no oversell success. |
| SHOP-04 | RPC/item failure after attempt | Whole transaction fails; no false success/partial order. |
| SHOP-05 | Timeout/retry with same idempotency key | Same result/order; no duplicate stock effect. |
| SHOP-06 | Same key with changed request | Conflict, not new order. |
| SHOP-07 | Duplicate cancellation/refund | No repeated inventory restoration/settlement. |
| SYNC-01 | Official update while student page open | Authorized resource refreshes. |
| SYNC-02 | Disconnect/reconnect/missed delete | Full scoped reconciliation. |
| SYNC-03 | Child/account switches during slow fetch | Old response/event discarded. |
| PWA-01 | Inspect deployed cache contents | No private HTML/RSC/API/health/payment artifacts. |
| PWA-02 | Logout then browser back/new student | Previous athlete not rendered. |
| PWA-03 | Offline order/payment/exam/pass | Disabled; no queue or fake completion. |
| PWA-04 | Expired/revoked scope during progress replay | Queue pauses/rejects safely. |
| PWA-05 | Worker update during timer | Safe prompt and preserved permitted state. |
| GUA-01 | Shared email without approved grant | No sibling access. |
| GUA-02 | Removed grant while child selected | Scope cleared/denied across all access paths. |
| PAY-01 | Forged/duplicate/wrong amount/currency callback | Rejected or idempotently processed once. |
| PAY-02 | Bank settled but browser closed | Server reconciliation posts correctly. |
| QR-01 | Expired/wrong audience/replayed pass | Defined rejection; no unauthorized attendance. |
| CERT-01 | Private certificate ID guessed | Denied. |
| CERT-02 | Public resolver/revoked certificate | Minimal approved disclosure; revocation visible. |
| PUSH-01 | Denied permission/dead endpoint/account switch | No repeated nagging, stale recipient, or private lock-screen data. |
| UX-01 | Keyboard/screen reader/200% zoom/reduced motion | Core flows usable; charts have alternatives. |
| UX-02 | Khmer/Chinese long text/mobile safe area | No clipped controls or inaccessible content. |
| PERF-01 | Core page with anatomy module unused | No heavy model/engine transfer. |
| OPS-01 | Staging build/worker/schema versions | Recorded compatible artifact evidence; strict checks pass. |

Unit tests should cover pure date/money/billing/readiness/parser logic. Integration tests must exercise real constraints/policies/transactions with restricted identities. End-to-end tests verify user flows, responsive states, and browser caches; screenshots alone do not validate permissions.

## 37. Traceability, decisions, and release sign-off

### 37.1 Reference sources

Primary repository sources:

- `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`.
- `lib/store.tsx`, `lib/supabase.ts`, `lib/env.ts`; newer `lib/data-access.ts`, `lib/billing.ts`, and `lib/dates.ts`.
- `lib/backend-security.ts`, `lib/security.ts`, `middleware.ts`; newer `lib/permissions.ts`.
- `lib/utils.ts`, `lib/kukkiwon.ts`, `hooks/useWorkoutTimer.ts`.
- Student, attendance, schedule, finance, LMS, library, household, security, and shop component families listed in Section 2.
- All application API routes inventoried; student-relevant provisioning/shop/auth routes examined in detail.
- `supabase/migrations/20260910_zero_trust_hardening.sql`.
- `supabase/migrations/20260913_student_account_linking_and_rls.sql`.
- `supabase/migrations/20260914_fix_rls_infinite_recursion.sql`.
- `supabase/migrations/20260914_anatomy_and_muscle_schema.sql`.
- `supabase/migrations/20260924_create_academy_profile.sql`.
- `supabase/migrations/20260928_dynamic_role_permission_matrix.sql`.
- `supabase/migrations/20260928_dynamic_user_permission_overrides.sql`.
- `supabase/migrations/20260928_master_defense_in_depth_rbac.sql`.
- `supabase/migrations/20260929_proshop_pos_engine_functions.sql`.
- `supabase/migrations/20260930_proshop_product_variants_and_matrix.sql`.
- October migration sources including `supabase/migrations/20261009090000_portal_security_and_transactions.sql`, `20261009090100_portal_catalog_and_households.sql`, `20261009090200_portal_billing_attendance_and_rbac.sql`, `20261009090300_portal_account_integrity.sql`, `20261009090400_portal_settlement_validation.sql`, and `20261010090000_portal_workflow_integrity.sql`.
- `tests/fixtures/live-schema-20261011.sql`; October 11 schema hardening, policy optimization, existing-record validation, and realtime migrations; October 12 achievement integrity and October 13 contact/access migration sources.
- Newer `lib/contacts.ts`, `lib/contact-validation.ts`, `lib/student-payload.ts`, `lib/attendance-calendar.ts`, `lib/attendance-write.ts`, and `lib/anatomy-integration.ts`, with their corresponding test sources.
- October 23/25 migration and domain sources listed in Section 1.7, plus `app/api/attendance/makeup/route.ts`, `app/api/membership/schedule/route.ts`, `app/api/notifications/route.ts`, `app/api/operations/route.ts`, and `app/api/jobs/notifications/route.ts`.
- Newer `app/api/auth/login/route.ts`, `app/api/auth/username-to-email/route.ts`, `app/api/shop/order/route.ts`, `app/api/admin/households/`, and `components/HouseholdManagementModal.tsx`.
- `sw.ts`, `public/manifest.webmanifest`, `app/layout.tsx`, `components/pwa/`, `public/ATTRIBUTION.md`.

Other staff/partner migrations and screens were inventoried to establish boundaries; they are not student feature requirements.

External primary implementation references are linked at the relevant sections. They support framework/provider behavior, not claims that this repository implements the proposed modules. Recheck version-specific APIs during implementation.

### 37.2 Decisions to confirm before dependent implementation

| Decision | Working specification | Impact if changed |
| --- | --- | --- |
| Student hosting | Separate origin/project sharing authorized Supabase | Auth/cookies/worker scope. |
| Initial login | Email; internal identifier flow only when required | Privacy, server auth endpoint. |
| Guardian identity | Student-compatible accounts plus explicit grants | Role/schema/policy extension. |
| Official profile edits | Read-only; correction via academy | Mutation workflow scope. |
| Initial attendance | Mixed daily/class history, explicitly labeled | Scheduled-session percentages require occurrence/exception rules. |
| Billing | Preserve source behavior until policy reconciled; one server version | Due dates/fees/exemptions. |
| Rank content | Exact-belt/reference normalization plus approved content | Historical/advanced access policy. |
| Offline | Generic shell/public content; restricted progress only after approval of cache fields | Privacy/retention/revocation. |
| Shop reservation | Reserve accepted order, unless academy chooses explicit alternative | Inventory lifecycle/UX. |
| Bank integration | Feature disabled until official merchant sandbox verified | Payment intents/webhook/reconciliation. |
| Camera/wallet | Future optional work | Dependencies, keys, permissions, performance. |

These unresolved business/deployment choices do not prevent documenting or building independent read-only foundations. They do prevent silently shipping dependent behavior as established policy.

### 37.3 Student release sign-off

Before initial student release:

- Canonical schema/types and effective permissions reviewed.
- Account links protected and Student A/B isolation verified across all access paths.
- Portal/account/membership gates implemented.
- No admin provider/global fetch/admin navigation dependency.
- Core profile/schedule/attendance/tuition/belt/award projections accurate.
- Missing/failed data distinguished from empty/zero.
- Lesson bridge and narrow progress semantics verified if learning is enabled.
- Private response/cache/storage exposure checked.
- Accessibility/localization/mobile flows tested.
- Strict checks and generated PWA artifact validated.
- Optional feature flags remain off until their specific gates pass.
- Staging evidence and rollback/monitoring plan recorded.

**Current sign-off:** specification completed from repository inspection. Student application implementation, live schema verification, final migration reconciliation/deployment, production security tests, provider setup, and staged release remain future work.

## 38. Implementation decisions and application boundaries

Everything in Sections 38–45 is the **proposed student implementation contract** unless a source file is explicitly identified as evidence. These sections make the product buildable without implying that a student application already exists.

### 38.1 Architecture decisions

| Decision | Selected student approach | Reason and consequence |
| --- | --- | --- |
| Primary consumer | Responsive browser application and installed PWA | One student experience across phone, tablet, and desktop. Native apps are outside this delivery. |
| API style | Same-origin JSON route handlers under `/api/student`; explicit auth endpoints | Fits the current App Router/Supabase system and supports independent deployment. A GraphQL gateway is unnecessary for the defined consumer. |
| Private initial render | Server-verified student scope, followed by minimal projected data | Prevents personal content rendering from a cached client identity. |
| Database access | Request-scoped Supabase user client where RLS and safe projection are sufficient | Keeps database authorization active; service-role access needs an explicit operation-level check. |
| Privileged operations | Narrow server service and transaction/RPC boundary | Students never call staff provisioning, settlement, grading, or household administration endpoints. |
| Browser state | Identity/scope context plus page resource state | Avoids the admin provider's academy-wide snapshot and large startup download. |
| Realtime | Optional scoped invalidation followed by an authorized read | Correctness remains possible when the socket disconnects. |
| Content completion | Dedicated student operation, separate from coach assessment | The current staff progress RPC requires a permission students must not receive. |
| Payment launch | Read-only posted tuition and supported receipts | Provider payment initiation remains feature-gated until verification and reconciliation exist. |
| Compatibility | Additive API changes within contract version 1; explicit schema and policy versions | Old installed clients may remain open while new server/database code deploys. |

Student browser code may import student DTOs, validation schemas, pure date/content helpers, design tokens, and public asset manifests. It must not import `lib/store.tsx`, server environment modules, staff permission matrices, service-role client factories, or admin component providers.

For mixed private base tables, the concrete first-release choice is the backend projection strategy in Section 7.4. The user-scoped database option above applies only where every directly exposed row/column is approved. This avoids treating a DTO alone as database column security.

### 38.2 Session implementation choice

Use one documented session model for the first release: the supported `@supabase/ssr` browser/server cookie integration. Create the server client inside each request. Middleware refresh, route handlers, server components, and the browser client must share compatible cookie settings and refresh behavior.

Use the supported verified identity methods for the selected SDK; a locally loaded session object is not server authorization. Resolve live profile/link/grant state independently of token metadata. Sensitive operations must use the documented current-session verification strategy when immediate remote revocation is required.

Do not describe SDK-managed SSR cookies as automatically HttpOnly. If a later architecture requires tokens to be inaccessible to browser JavaScript, design a server-only session backend and adjust browser realtime/storage access accordingly. That is a different integration choice. Supabase documents its cookie/PKCE model and refresh considerations in the [SSR advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

Private response handlers preserve refresh cookies and prevent shared caching. Sign-in responses contain a safe next step and account state, rather than returning tokens in the application JSON contract. Application telemetry and errors must never include cookie/header values.

### 38.3 Exact scope resolution rules

Scope resolution returns one of these results before private page rendering:

| Result | Conditions | Student presentation |
| --- | --- | --- |
| `ready` | Verified session, eligible profile, portal enabled, one valid requested relationship | Render the requested student. |
| `auth_required` | Missing/invalid/expired authentication | Sign-in with an allowlisted return path. |
| `password_change_required` | Verified account requires credential change | Dedicated password route; no normal private data fetch. |
| `account_disabled` | Current profile is disabled | Clear personal state and display support information. |
| `link_required` | No self link and no valid approved guardian grants | Minimal support state; no roster search or automatic claim. |
| `link_conflict` | Explicit links disagree or multiple rows claim a one-to-one self account | Block scope selection and require privileged correction. |
| `scope_denied` | Requested athlete is not in the authorized relationship set | Clear requested scope; do not reveal whether the athlete exists. |
| `portal_unavailable` | Academy portal gate disabled or required policy cannot be resolved | Maintenance/support state. |
| `temporarily_unavailable` | Identity/profile/schema lookup failed | Retryable error; do not treat it as an empty account. |

Self-link resolution must examine both directions. If `profiles.student_id` identifies A and `students.profile_id` identifies B, do not select A with a fallback expression. If both are present, they must identify the same nonarchived row. A single populated direction may be accepted only under an explicitly supported compatibility rule; report it for repair without changing it during sign-in.

For future guardian accounts, a self link is optional only after provisioning constraints and scope resolver behavior support grant-only Student accounts. The current staff provisioning assumptions must be reconciled first. A household row containing a child's ID is not an account grant.

### 38.4 Capability calculation

Compute capabilities on the server from current account status, relationship/grant, membership policy, academy gate, feature gate, and resource state. The client receives the result for presentation and the server recalculates it on each mutation.

| Capability | Additional requirement | Never implies |
| --- | --- | --- |
| `readProfile` | Valid self/guardian relationship | Editing identity or contact details. |
| `readHealth` | Explicitly approved health scope | Access to staff notes or all family records. |
| `readTuition` | Billing scope for selected athlete | Recording a payment or changing scholarship. |
| `recordLearning` | Eligible content and permitted membership policy | Grading a skill or editing curriculum. |
| `placeOrder` | Shop enabled, commerce ready, eligible membership | Fulfillment, refunds, or counter POS privileges. |
| `registerExam` | Exam feature and registration window/eligibility rules | Approval or certification. |
| `viewIssuedFiles` | Ownership plus document publication status | Public exposure or access to raw storage directories. |

Use feature gates for deployment readiness and capabilities for user authority. Neither substitutes for the other. A disabled optional module returns `CAPABILITY_DISABLED` or `FEATURE_UNAVAILABLE` consistently and performs no side effect.

### 38.5 Dependency flow

~~~mermaid
flowchart TD
    Route[Student route or API] --> Guard[Request identity and scope guard]
    Guard --> Policy[Current capability and feature policy]
    Policy --> Service[Student resource service]
    Service --> Repo[Scoped database adapter]
    Repo --> Data[(Shared authoritative records)]
    Service --> Project[Allowlisted DTO mapper]
    Project --> Schema[Runtime response validation]
    Schema --> View[Student page or JSON response]
~~~

A view cannot call a database adapter with an arbitrary athlete ID. The adapter receives a server-created authorized scope object. That object is not accepted from request JSON and is not serialized as a bearer credential.

## 39. Complete resource and projection contracts

### 39.1 Shared response metadata

Section 20's envelope remains the base contract. Extend successful list metadata with pagination and scope information without exposing private grant internals.

~~~typescript
interface PageInfo {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
  snapshotAt: string;
}

interface ResourceMeta {
  requestId: string;
  fetchedAt: string;
  schemaVersion: 'student-api-v1';
  policyVersion: string;
  studentId: StudentId;
  timeZone: string;
  page?: PageInfo;
}

interface FieldIssue {
  field: string; // An allowlisted schema field path.
  code: 'required' | 'invalid' | 'too_long' | 'out_of_range';
  message: string; // Safe localized message or message key.
}
~~~

`snapshotAt` is an upper-bound cursor time, not a claim that multiple queries ran in one database snapshot. Aggregates requiring transactionally consistent values must be read in a single authorized query/transaction. List counts are optional; do not run full counts for every scroll request.

### 39.2 Official profile contract

~~~typescript
interface ContactProjection {
  email: string | null;
  phone: string | null;
  telegramUsername: string | null;
}

interface StudentProfileDTO {
  student: StudentSummary;
  official: {
    dateOfBirth: DateOnly | null;
    genderLabel: string | null;
    nationality: string | null;
    registrationDate: DateOnly | null;
    kukkiwonId: string | null;
  };
  contact: ContactProjection;
  address: {
    line1: string | null;
    line2: string | null;
    districtCommune: string | null;
    provinceCity: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
  emergencyContact: {
    name: string | null;
    phone: string | null;
    relationship: string | null;
  } | null;
  health: {
    medicalNotes: string | null;
    allergies: string | null;
  } | null;
  visibility: { health: 'allowed' | 'restricted' };
  editable: false;
}
~~~

Health fields require `readHealth`; a restricted response omits the values and explicitly indicates restriction. A valid health scope with no recorded data returns null fields. Do not use the same visual state for restricted and unrecorded information.

Never include raw `esign_path`, internal `notes`, raw profile/student linking columns, creator identifiers, or role permissions. An avatar is a separate authorized display resource. Contact email/Telegram are profile contact values, not verified authentication identities.

### 39.3 Timetable contract

~~~typescript
interface ScheduleItemDTO {
  enrollmentId: RecordId;
  classId: RecordId;
  className: string;
  category: string;
  branch: { id: number; name: string };
  coachLabel: string | null;
  daysOfWeek: number[]; // ISO weekday: Monday=1 through Sunday=7.
  startLocalTime: string; // HH:mm or HH:mm:ss, normalized by the server.
  endLocalTime: string;
  timeZone: string;
  enrollmentStartDate: DateOnly | null;
  durationMinutes: number | null;
  source: 'recurring_timetable';
}
~~~

Validate stored weekday strings and normalize legacy singular `day_of_week`. Deduplicate repeated weekdays. Missing/invalid times yield a schedule warning, not midnight. Overnight classes require an explicit next-day rule; until supported, report invalid intervals for correction rather than guessing.

Return safe coach labels through a server projection. Do not fetch all `profiles` or `members` into the student browser. Capacity, staff personal contacts, roster names, and enrollment controls are outside this response.

### 39.4 Mixed attendance contract

~~~typescript
interface AttendanceItemDTO extends AttendanceRecord {
  classLabel: string | null;
  branchLabel: string | null;
}

interface AttendanceSummaryDTO {
  basis: 'recorded_days' | 'recorded_class_marks';
  from: DateOnly;
  to: DateOnly;
  present: number;
  late: number;
  absent: number;
  totalRecorded: number;
  attended: number;
  ratePercent: number | null;
  mixedRecordDays: number;
}
~~~

Supported scopes are `daily`, `class:<classId>`, and `all`. In daily scope, count only records with null class ID. In class scope, count only the exact authorized class. In all scope, list all records, but do not publish a combined percentage that mixes daily and class units.

The attendance response contains `items: AttendanceItemDTO[]`, `summary: AttendanceSummaryDTO | null`, and safe available-scope labels. Return `summary = null` for all scope unless separate explicitly labelled daily and class summaries are supplied. The dashboard chooses one declared summary basis rather than combining units.

For a combined calendar, each date may contain several separate badges. A daily Present and a class Absent on the same date are distinct records; preserve both and offer a detail list. Missing rows mean unrecorded. They do not imply Absent, a day off, or a cancelled class.

Historical class marks remain visible even when current enrollment changes, provided the student owns the record. Schedule editing must not rewrite their display history into a false current-class claim; immutable class label snapshots are a future improvement where required.

### 39.5 Tuition and receipt contract

~~~typescript
interface TuitionDTO {
  summary: {
    state: 'current' | 'due_soon' | 'due_today' | 'within_grace' | 'overdue' | 'exempt' | 'unknown';
    policyVersion: string;
    nextRenewalDate: DateOnly | null;
    policyEstimate: Money | null;
    explanationCodes: string[];
  };
  accountingCoverage: 'invoice_accounting' | 'legacy_only' | 'mixed';
  invoices: StudentInvoiceDTO[];
  entries: Array<TuitionLedgerEntry & {
    paymentDate: DateOnly | null;
    receipt: { id: RecordId; number: string } | null;
    source: 'posted_monthly_ledger';
  }>;
  postedOutstanding: Money | null;
  providerPaymentAvailable: boolean;
}
~~~

Ledger amount and policy estimate are separate. A missing monthly row does not automatically become a posted invoice. If outstanding debt is only inferred from a policy helper, label it as a policy estimate rather than `postedOutstanding`. Avoid summing different currencies into one total. The existing `_usd` columns represent USD: an academy display-currency setting does not convert those values to KHR. Any future conversion requires a recorded rate/source/time and clear original/converted labels.

`Waived` is an explicit zero-value settlement classification where supported; it is not a bank payment. A Paid row without transaction/date/receipt evidence remains a historical Paid ledger entry with a missing-receipt explanation. Do not create an invented receipt to fill that gap.

Receipt detail contains issuer identity, receipt number, selected athlete, period, posted amount/currency, recorded method/date, status, and safe external reference if disclosure is approved. An original family receipt may contain sibling information; provide a student-specific allocation receipt or require authority for every included athlete before serving it.

### 39.6 Lesson and progress contract

~~~typescript
type LearningStatus = 'not_started' | 'started' | 'completed';

interface LessonCardDTO {
  assetId: RecordId;
  title: string;
  libraryType: 'Taekwondo' | 'Fitness';
  category: string | null;
  targetLevel: string;
  difficulty: string | null;
  thumbnailUrl: string | null;
  progress: {
    status: LearningStatus;
    completedAt: string | null;
    provenance: 'student_reported' | 'staff_recorded' | 'legacy_unknown';
  };
  canRecordProgress: boolean;
}

interface LessonDetailDTO extends LessonCardDTO {
  description: string | null;
  media: { provider: 'youtube' | 'approved_video'; url: string } | null;
  instructions: string[];
  terminology: Array<{ korean: string | null; english: string | null; khmer: string | null }>;
  studyGuide: Array<{ question: string; answer: string }>;
  mistakes: Array<{ mistake: string; correction: string }>;
  muscleLinks: Array<{ muscleId: RecordId; label: string; role: 'Primary' | 'Secondary' }>;
  warnings: Array<'media_unavailable' | 'metadata_incomplete' | 'mapping_unavailable'>;
}
~~~

The current progress table has no verified provenance field. Until an extension/backfill exists, return `legacy_unknown` for historical rows. Do not infer that a coach approved a completion merely because a staff tool wrote it, or that every completion was student-reported.

Map raw status strings at one adapter boundary. The dated snapshot uses `Not Started`; Started support and its database check must be verified before writing it. Do not silently serialize unknown statuses as completed.

### 39.7 Training and development projections

| Response object | Required fields | Data rule |
| --- | --- | --- |
| Template summary | Opaque template ID, title, difficulty, estimated duration, safe description | A template is available content, not an assignment. |
| Assignment | Plan ID, template ID if any, active flag, assigned date, validated effective structure | Own active `student_training_plans`; customized structure takes precedence only when valid. |
| Workout structure | Version, ordered blocks, exercise reference/label, work/rest/reps/sets, optional coaching text | Reject invalid references and negative/nonfinite durations. |
| Skill assessment | Assessment ID, skill name, belt label, grade, updated date, safe coach label if permitted | Read-only official record; do not create historical trend points from a single latest value. |
| Measurement | Record ID/date, individual recorded numeric values with unit, source label | Preserve null; do not derive body fat or other values without an agreed formula and inputs. |
| Readiness | Policy version, timestamp, four factor states, optional score, explanation codes | Unknown essential factors prevent a false `ready_for_review`. |
| Belt event | History ID, belt, promotion date, safe certificate reference, authorized file availability | A reference is not proof of external verification. |
| Achievement | ID, event/date, category/division, medal rank, approved public-to-student notes | Handle Gold/Silver/Bronze/Participation/Fourth Place and safe unknown historical labels. |

Only server-approved plan structures may enter the workout timer. Content metadata and arbitrary JSON never become executable JavaScript or unvalidated DOM markup.

### 39.8 Shop and preference projections

Product DTOs include sellable identifier, name, description, approved image, variants, price/currency, and availability classification. Student stock display should default to `available`, `low_stock`, or `unavailable` unless publishing exact quantities is an explicit product decision. No procurement cost, supplier detail, threshold configuration, or stock audit logs are included.

Order DTOs contain immutable line snapshots, subtotal/discount/total money, order/payment states, safe pickup labels, customer contact submitted for that order, student notes, and permitted timestamps. Unknown states remain `unknown` with raw values retained only in internal diagnostics. Administrative notes and staff IDs never leave the projection.

Preferences are account-scoped: language, theme, audio preference, and motion preference. Selected athlete is a requested scope, not an authorization preference. Student-specific training filters are separate from account language/theme settings.

### 39.9 Field mapping and precision rules

| Database representation | Student representation | Important conversion |
| --- | --- | --- |
| `students.id varchar(20)` | Opaque academy string | Preserve spelling; never regenerate from gender/name. |
| Bigint history/payment IDs | Decimal string | Avoid JavaScript integer truncation. |
| UUID product/plan IDs | Opaque UUID string | Validate syntax, then authorize ownership/eligibility. |
| `numeric(10,2)` money | Decimal amount string plus currency | Preserve two decimal places and reject nonfinite/negative amounts where forbidden. |
| SQL `date` | `YYYY-MM-DD` | No timezone shift through browser `Date` parsing. |
| SQL timestamp with timezone | ISO instant | Format in academy/user context with a clear timezone when relevant. |
| Timestamp without timezone | Explicit documented source interpretation | Never append `Z` without establishing the source timezone. |
| `district_commune`, `state_province_city` | `districtCommune`, `provinceCity` | Preserve actual geography rather than guessed generic fields. |
| Null optional contacts/measurements | Null | Do not turn unrecorded height/weight into zero. |
| JSON/text description | Validated structured DTO with safe fallback text | No raw JSON dump in the student UI. |

## 40. Endpoint implementation reference

### 40.1 Common HTTP rules

The consumer is the student browser/PWA on the same origin. Request bodies are strict JSON objects. Private reads use the verified session cookie and requested athlete scope. Normal student endpoints reject staff-only account roles; an administrative support preview, if ever added, requires a separate audited route and must not impersonate a student silently.

| Concern | Version 1 contract |
| --- | --- |
| Media type | JSON mutation bodies require `application/json`; reject unsupported types. |
| Payload bound | Proposed default 32 KiB for student JSON; endpoint-specific stricter bounds may apply. Uploads use a separate future contract. |
| Scope | Server-derived self scope; `X-Student-Id` only when valid guardian selection is enabled. |
| Private caching | `Cache-Control: private, no-store`; no ISR/CDN/worker cache, including auth responses. |
| Correlation | Generate a request ID; return it in metadata and `X-Request-Id`. Validate any incoming correlation token before using it in logs. |
| Mutation origin | Verify allowed origin and the selected CSRF defense for cookie-authenticated mutations. GET requests never mutate records. |
| Idempotency | UUID `Idempotency-Key` on nontrivial creates/completion events; scope to actor, athlete, operation, and canonical payload. |
| Timeout | Proposed application read/transaction budgets are configurable; an aborted browser request does not prove the server transaction rolled back. |
| Pagination | `limit` default 25/max 100; opaque bounded cursor bound to scope, filters, ordering, and contract version. |
| Error response | Safe code/message, request ID, optional allowlisted field issues and retry-after hint; no submitted secrets. |
| Success codes | 200 for reads/updates/replayed results; 201 for a newly created order/event; preserve the same resource identity on replay. |

Rate limits must be shared across application instances. Suggested initial budgets are configuration starting points, not proven capacity: private reads 120/account/minute, progress 30/account/minute, order attempts 5/account/minute, and tighter recovery/credential controls. Load-test and tune them; no limiter key contains a raw password or unprotected contact identifier.

### 40.2 Authentication operations

| Operation | Request | Success | Rejection and side-effect rules |
| --- | --- | --- | --- |
| `POST /api/auth/sign-in` | `{ identifier, password, returnTo? }` | Session cookies plus `{ next, redirectTo }`; next is dashboard, change_password, or link_required | Generic credential failure; normalize identifier only, never trim/transform password; no public email resolution response. |
| `POST /api/auth/recovery` | `{ email }` | Generic acknowledgment regardless of account existence | Allowlisted student recovery origin; shared abuse controls; never disclose whether a student profile exists. |
| `GET /auth/callback` | Provider-supported callback parameters | Verified one-time exchange and safe relative redirect | Reject invalid/replayed callback, external return URLs, and conflicting session state. Do not write tokens to logs. |
| `POST /api/auth/password` | `{ password, confirmation }` within verified recovery or required-change context | Provider-confirmed update and next authorized state | Enforce the selected policy/provider rules; privileged change-required flag clearing needs a narrowly authorized operation. |
| `POST /api/auth/sign-out` | `{ scope }` with local or others | Provider-confirmed action, appropriate cookie/state cleanup | Ordinary logout uses `local`; show other-session action separately and explain access-token expiry behavior. |

The ordinary sign-in redirect goes through the application scope resolver before rendering a dashboard. Successful provider credentials alone do not authorize a profile link, academy access, health record, or order.

Password-change-required accounts may use only the endpoints necessary to verify/change credentials, sign out, and view safe support information. Do not clear `must_change_password` merely because a client submits a boolean. Recheck current account state after the provider confirms the operation.

### 40.3 Bootstrap and profile reads

**`GET /api/student/bootstrap`** has no student-controlled ownership body. It returns `StudentBootstrap`, account preferences, and the server capability set. If guardian selection is enabled, the scope list contains only approved athlete summaries and the active scope must belong to that list. An unauthorized requested scope returns `SCOPE_DENIED`; it must not silently render a different child's records under the requested URL.

**`GET /api/student/profile`** returns `StudentProfileDTO` under the active scope. Profile reads do not perform link repair, address creation, contact normalization writes, or default-value persistence. Missing avatars and invalid optional contacts are display issues rather than reasons to expose storage paths.

**`GET /api/student/dashboard`** returns bounded sections with explicit status rather than a single academy-wide object:

~~~typescript
type DashboardSection<T> =
  | { state: 'ready'; data: T; asOf: string }
  | { state: 'empty'; data: null; asOf: string }
  | { state: 'unavailable'; data: null; reasonCode: string };

interface DashboardDTO {
  student: StudentSummary;
  nextClass: DashboardSection<ScheduleItemDTO & { estimatedDate: DateOnly }>;
  attendance: DashboardSection<AttendanceSummaryDTO>;
  tuition: DashboardSection<TuitionDTO['summary']>;
  learning: DashboardSection<{ eligible: number; completed: number; percent: number | null }>;
  readiness: DashboardSection<ReadinessReport>;
  recentMilestones: DashboardSection<Array<{ id: string; kind: 'belt' | 'award'; label: string; date: DateOnly }>>;
}
~~~

Identity/scope failure rejects the entire dashboard. An optional resource outage may produce an unavailable card while other authorized cards render. Do not return a tuition value of zero because a finance query failed.

### 40.4 Read endpoint query catalog

| Endpoint | Accepted query | Response data | Ordering/limits |
| --- | --- | --- | --- |
| `/api/student/schedule` | `from,to` for a bounded screen window | `StudentScheduleDTO` with dated sessions and separate recurring estimates | Current contract: max 93 days; own roster/history, cancellation/revision rules in Section 47. |
| `/api/student/attendance` | Required `from,to`; optional `scope=daily\|all\|class:<id>`, `limit,cursor` | `{ items, summary, availableScopes }` | `date DESC,id DESC`; historical class scopes must come from authorized records/enrollments. |
| `/api/student/tuition` | `year`, `limit,cursor` | `TuitionDTO` | Numeric year/month order, not alphabetical month labels. |
| `/api/student/lms` | `type`, `category`, `status`, `q`, `limit,cursor` | `{ items: LessonCardDTO[], facets }` | Stable normalized title/ID or published order; eligibility applied before pagination. |
| `/api/student/lms/[assetId]` | None | `LessonDetailDTO` | Same publication/eligibility guard as catalog. |
| `/api/student/training` | Optional `kind=assigned\|available`, `limit,cursor` | `{ assignments, templates }` | Active own plans; never infer assignment from template availability. |
| `/api/student/training/[templateId]` | Optional authorized `planId` | Validated effective workout structure | Plan/template ownership and reference agreement checked together. |
| `/api/student/development` | Optional bounded measurement date range | `{ assessments, measurements, readiness, visibility }` | Health capability controls measurement/medical projection. |
| `/api/student/belt-history` | `limit,cursor` | `{ items, currentBelt }` | Promotion date and stable ID; future/unverified dates do not silently change official current rank. |
| `/api/student/achievements` | Optional `year`, `medal`, `limit,cursor` | `{ items }` | Event date DESC, ID DESC; safe notes only. |
| `/api/student/preferences` | None | Account preference values and revision | Account-scoped; selected athlete has no effect. |
| `/api/student/shop/products` | `category`, `q`, `limit,cursor` | Safe product/variant cards | Filter active and student-orderable before pagination. |
| `/api/student/shop/products/[id]` | None | Safe product detail | Ineligible/deleted product returns generic 404. |
| `/api/student/shop/orders` | Optional safe order state, `limit,cursor` | `{ items }` | Own orders, created DESC/ID DESC; no whole-history bulk load. |
| `/api/student/shop/orders/[id]` | None | Order DTO | Constrain by both order ID and authorized athlete. |

Search `q` has a proposed maximum of 100 characters. Search only permitted text fields, escape wildcard syntax where the chosen query method requires it, and never interpolate user text into raw filter expressions. Category/status values are strict allowlists generated from the approved catalog domain.

Summary totals cover the declared filter window, not just the visible page. If the backend cannot compute an accurate aggregate independently of paging, omit it or label it as page-only. Changing filters resets the cursor.

### 40.5 Progress write contract

**`PUT /api/student/lms/[assetId]/progress`** requires `recordLearning`. The request is strict and contains no student ID, curriculum row, grade, rank, or coach identifier:

~~~json
{
  "status": "completed",
  "clientMutationId": "11111111-1111-4111-8111-111111111111"
}
~~~

Lowercase status is the canonical student API vocabulary; the database adapter handles legacy stored labels. A UUID `Idempotency-Key` header is required and must equal `clientMutationId`. The server returns a persisted lesson-progress DTO with authoritative timestamps and provenance.

Transaction rules:

1. Recheck current student scope, membership capability, content publication/eligibility, and mapping.
2. Resolve asset ID to the canonical curriculum target without creating curriculum during the student request.
3. Lock or atomically upsert the student's unique target row.
4. Preserve first completion time when replaying completion.
5. A Started update may initialize/advance a record only if that database status is supported; it cannot regress Completed.
6. Completion provenance follows the new schema contract. Existing staff/legacy completions remain intact.
7. Record/return the idempotent result and invalidate personal learning/readiness summaries.

No student reset/delete operation ships in version 1. If reset is later allowed, give it a separate explicit route and policy that preserves staff-reviewed evidence. The current `portal_set_video_progress` is staff-authorized and must not be exposed unchanged.

### 40.6 Account preference updates

**`PATCH /api/student/preferences`** accepts only supplied keys:

~~~json
{
  "language": "kh",
  "theme": "system",
  "audioEnabled": false,
  "motion": "system",
  "expectedRevision": 3
}
~~~

Proposed domains: language `en|kh|zh`, theme `light|dark|system`, motion `system|reduced`. Unsupported keys or language codes are rejected. Server preferences override local defaults after bootstrap; optimistic changes are permitted and roll back or visibly remain local if saving fails.

Use an integer revision or equivalent optimistic concurrency field when persistence is implemented. A stale revision returns `PREFERENCE_CONFLICT` with a safe current representation. Account updates cannot include student ID, role, scholarship, membership, or notification recipients.

### 40.7 Atomic order placement and current API adapter

**`POST /api/student/shop/orders`** accepts:

~~~json
{
  "quoteToken": "server-issued-cart-quote",
  "customerPhone": "+85500000000",
  "pickupBranchId": 1,
  "paymentMethod": "Pay at Counter",
  "studentNotes": "",
  "items": [
    {
      "productId": "22222222-2222-4222-8222-222222222222",
      "variantId": "33333333-3333-4333-8333-333333333333",
      "quantity": 1
    }
  ]
}
~~~

These UUIDs are synthetic. The header carries the unique idempotency key. An accepted request returns the persisted order and `Location: /api/student/shop/orders/<id>`. The UI navigates using that returned ID.

Proposed first-release cart bounds: at most 20 distinct normalized lines, 20 units of one variant, and 100 units in total; student notes at most 500 characters. Validate phone length/format and catalog-specific quantity restrictions on the server. These student policy bounds may be narrower than the reference API's 100 lines/1,000 units per line and must be configured consistently in the quote and order transaction.

| Student contract | Existing admin-repo order/RPC field | Adapter rule |
| --- | --- | --- |
| Authorized active scope | `studentId` | Server supplies from resolved scope; reject any client ownership field. |
| Official safe display name | `customerName` | Server supplies; do not allow ordering under another athlete's name. |
| `pickupBranchId` | `branchId` | Validate branch availability for student collection. |
| `quantity` | `qty` | Aggregate duplicate variants and apply per-line/cart limits before transaction. |
| `Idempotency-Key` header | Body `requestKey`, RPC `p_request_key` | Translate once; preserve the same key on timeout retry. |
| Session actor | `p_actor` | Server derives verified account UUID; never accept it from JSON. |
| Student ordering channel | `p_channel='STUDENT_PORTAL'` | Fixed server constant. |
| Safe order response | RPC/database result | Explicit DTO projection; omit internal fields even on idempotent replay. |

The existing `app/api/shop/order/route.ts` is an integration reference with different request shapes and an overbroad order projection. The student app should call the narrow student service, not make a cross-origin staff application request.

The proposed student checkout requires a priced review before order acceptance. `POST /api/student/shop/quotes` authorizes the scope and produces safe line totals plus a server-issued quote token bound to actor, athlete, normalized cart, pickup branch, currency, catalog prices/revisions, and expiry. A proposed initial expiry is five minutes, configurable and displayed to the student. The quote does not reserve inventory.

Use a persisted quote or a signed bounded token under a server-only key. Verify it on order submit and pass its trusted expectations into the **same atomic order transaction** that rechecks catalog prices and stock. A separate route-level price precheck cannot prevent a concurrent change. Changed prices return `PRICE_CHANGED` with a refreshed safe review and no accepted order; the student explicitly accepts the new quote. Expired quotes return `QUOTE_EXPIRED` without mutation.

The existing `portal_place_order` RPC has no verified quote-expectation contract, so this requires a compatible extension before adopting the proposed checkout unchanged. Reconcile an ambiguous original order attempt before accepting a new quote/key. Bank/KHQR labels do not enable automatic settlement.

### 40.8 Cancellation and receipt download

**`POST /api/student/shop/orders/[id]/cancel`** is enabled only after a student cancellation policy and a dedicated authorized transaction exist. It takes a bounded optional reason plus idempotency key. The transaction locks the own order, verifies its current cancellable state, releases only previously reserved stock, and returns the authoritative state. Repeated cancellation returns the same final resource without restocking again.

The current `portal_cancel_order` requires staff permission. Do not grant that permission to students. Until the student contract is implemented, show academy support as the cancellation channel.

**`GET /api/student/tuition/receipts/[id]`** first resolves receipt ownership and publication. A metadata request can use the normal JSON envelope. An actual file response is a documented exception: return the authorized file with the correct MIME type, private/no-store headers, and safe Content-Disposition filename. Errors remain JSON; do not send an HTML login page as a PDF download.

### 40.9 Cursor and idempotency behavior

A cursor encodes the last sort tuple, fixed upper boundary, filter fingerprint, and contract version. Sign it or validate every bounded component; it is never an authorization token. Reauthorize each page under the current account and athlete scope. Newer records may be omitted until refresh; edits/deletions can change history between pages, so deduplicate by record ID and reset paging after a reconciliation event.

| Idempotency state | Same key and same payload | Same key and different payload |
| --- | --- | --- |
| No prior attempt | Execute one authorized transaction | First accepted payload establishes the key. |
| In progress | Wait within bounded server budget or return retryable conflict | Reject conflict without executing another mutation. |
| Committed | Return persisted original result after current authorization | `IDEMPOTENCY_CONFLICT`; no second write. |
| Rolled back | Retry according to the operation's persisted-key design | Do not assume rollback when a client merely timed out. |
| Expired retention | Return a documented reconciliation outcome | Never silently create a duplicate financial/order effect. |

Do not generate a new order key on every retry or store the key only in component memory after a request starts. Preserve the pending operation in identity-scoped session state until it is reconciled. Do not persist auth headers, contact/health payloads, or payment credentials with the key.

### 40.10 Additional HTTP errors and OpenAPI deliverable

Add to Section 20.6: 400 `MALFORMED_JSON`/`INVALID_CURSOR`, 413 `PAYLOAD_TOO_LARGE`, 415 `UNSUPPORTED_MEDIA_TYPE`, 409 `STATE_CHANGED`/`PREFERENCE_CONFLICT`/`QUOTE_EXPIRED`, and 503 `SCHEMA_NOT_READY`. Validation failures may return field issues but must not echo arbitrary unknown keys or their values.

The implementation must produce an OpenAPI document for the student endpoints with cookie authentication, request/response schemas, examples, pagination, all expected failures, and feature availability. Generate shared TypeScript types or validate their agreement with that contract. A prose specification is not an executable OpenAPI file, and this documentation edit does not claim one was generated.

### 40.11 Feature-gated service endpoints

These complete the planned student API surface. Each remains disabled until its persistence, authorization, and external integration dependencies are delivered. All private operations use the same live scope resolver and safe envelope.

| Method/path | Input | Result and required invariant |
| --- | --- | --- |
| POST `/api/student/training/completions` | Plan/template IDs, effective structure version, client session UUID, self-reported times/result; idempotency key | Persisted self-report receipt. Validate own plan/references, duration bounds, and duplicate session; never write attendance/grades. |
| POST `/api/student/tuition/payment-intents` | Authoritative obligation/period references and supported method; idempotency key | Server-priced intent ID, amount/currency, expiry, provider display payload, initial state. Ignore/reject submitted amount/Paid flags. |
| GET `/api/student/tuition/payment-intents/[id]` | Owned intent ID | Current verified server state and safe receipt link if settled; no provider credentials/raw webhook body. |
| GET `/api/student/notifications` | `unread`, `limit,cursor` | Own inbox records and bounded unread count. Recipient IDs are not client query parameters. |
| PATCH `/api/student/notifications/[id]/read` | `{ read: true }` | Idempotent own read acknowledgment; cannot edit message body or recipients. |
| POST `/api/student/push-subscriptions` | Browser PushSubscription fields and device label | Account-bound subscription receipt. Validate format/size and delivery endpoint policy before privileged outbound delivery. |
| DELETE `/api/student/push-subscriptions/[id]` | Owned subscription ID | Idempotent revocation; cannot remove another account's endpoint. |
| POST `/api/student/checkin-pass` | Authorized occurrence/class context if required | Short-lived signed opaque pass, expiry, audience, safe display metadata; online-only issuance. |
| GET `/api/student/exams` | Eligible published cohort filters and pagination | Own eligibility explanations and published opportunities, not private applicant rosters. |
| GET `/api/student/exams/[cohortId]` | Cohort ID | Published detail, policy/fee/capacity/window state, own registration if any. |
| POST `/api/student/exams/[cohortId]/registrations` | Required acknowledgments and supported application details; idempotency key | One own registration after a transactional window/capacity/eligibility check. Client eligibility/fee/approval values are not accepted. |
| POST `/api/student/exam-registrations/[id]/cancel` | Optional bounded reason and idempotency key | Own policy-permitted state change; refund/fee release follows the separate finance policy. |
| GET `/api/student/certificates/[id]` | Owned issued certificate ID | Published metadata and authorized file action; revoked/unissued records do not return a usable file. |
| GET `/api/public/certificates/[token]` | Opaque verification token | Minimum approved public issuer/certificate validity fields; no contacts, health, full DOB, or private file path. |

Merchant webhooks, push dispatch jobs, staff pass scanning, exam approval, and certificate issuance are trusted backend/academy dependencies. They are not student endpoints and are not accessible through student capabilities.

The public verification handler has its own bounded rate limits and minimal invalid/revoked response. Raw verification tokens are excluded from analytics. A public certificate check does not turn all of the athlete's belt history into public data.

## 41. Detailed screen and interaction specification

### 41.1 Shared application shell

The shell contains academy identity, the active athlete's safe name/avatar/belt, current page, and primary navigation. Desktop may show a sidebar; mobile uses the five primary destinations in Section 10 and a More menu. Never hide the active athlete's identity while family switching is possible.

| Shared element | Behavior | Failure/edge state |
| --- | --- | --- |
| Athlete switcher | Lists approved scope summaries; loading blocks new child-specific actions | No grants means no switcher; denied/revoked selection clears that child's data. |
| Page heading | One clear H1, optional subtitle, contextual actions | Long English/Khmer names wrap; they do not overlap controls. |
| Connection indicator | Reports offline/reconnecting and last successful refresh where relevant | A connected socket alone does not display “all data current.” |
| Account menu | Settings, support, local sign-out | No administrative links, search across students, or impersonation menu. |
| Update banner | Describes an available app update; applies after permitted active work is safe | Does not interrupt a payment reconciliation or silently lose an unsaved progress draft. |
| Error boundary | Safe message, retry, request ID, support link | Clears private content on scope failure; prevents infinite reload loops. |
| Modal/dialog | Labelled title, focus trap/return, Escape where safe, scroll containment | An in-flight mutation cannot be resubmitted by reopening a dialog. |

Authenticated private content never flashes before eligibility is resolved. A generic skeleton contains no previous athlete name, balance, or profile picture. Browser Back after logout must not display a retained personal snapshot.

### 41.2 Sign-in, recovery, and account resolution

Sign-in form: Identifier/email, Password, show/hide password, submit, forgot password, and verified academy help. Use correct autocomplete semantics, keyboard submission, visible labels, and accessible inline errors. Keep the password intact during a safe failed attempt; never repopulate it from storage.

Submitting disables duplicate credential requests and shows a single progress indicator. Failure copy is generic. A rate-limited response displays when retry is available without a rapidly updating screen-reader announcement. Recovery acknowledgment does not disclose account existence.

Account-disabled, link-required, conflicting-link, portal-disabled, and service-unavailable pages have distinct safe explanations. Only retryable states offer Retry. Support links may include a request ID after a deliberate click; they do not automatically send messages or disclose a password/student medical record.

### 41.3 Dashboard composition

Order the initial mobile content so the student can act without scrolling through analytics: identity and status, next class, tuition notice when applicable, continue learning, recorded attendance summary, readiness explanation, and recent milestones. Optional anatomy/shop promotions must not displace core information.

| Card | Required content | Interaction and state |
| --- | --- | --- |
| Next class | Class, branch, estimated date/time, timezone, recurring-timetable label | Opens Schedule; “No assigned class” differs from unavailable schedule data. |
| Tuition | Server policy state, applicable amount label, renewal date, uncertainty text if required | Opens Tuition; no Pay button unless verified payment feature/capability exists. |
| Continue learning | Eligible incomplete/recent lesson and completion state | Opens authorized lesson; do not choose arbitrary academy-wide content. |
| Attendance | Declared period/basis and recorded count/rate | Opens matching attendance filter; no combined daily/class percentage. |
| Readiness | Status, factor summary, coach-review wording | Opens Development; unknown factors are visible. |
| Milestones | Latest own belt/award events | Opens exact own event/ledger; empty state contains no sample trophies. |

Each optional card owns its empty/error state. A failed card does not display a believable-looking stale zero. Refresh retries the failed resource without reloading unrelated data unnecessarily.

### 41.4 Official profile and contact actions

Group identity/membership, academy registration, contact/address, emergency contact, and permitted health data. Mark official fields as academy-managed and provide a clear correction path. The student cannot submit the admin update-student payload.

Contact actions use validated `tel:`, `mailto:`, and approved Telegram URLs. The current `lib/contacts.ts` accepts/normalizes supported Telegram usernames and `t.me` links; adapt this pure logic without importing the admin store. Show an absent action when no valid contact exists. Opening a contact app is a user action; no message is sent automatically.

Separate “Account email” from “Contact email” if both are presented. Changing a contact at the academy does not prove a change to Supabase Auth identity. Raw signature viewing is excluded from the default profile. Medical content is visually separate and hidden for scopes lacking health permission.

### 41.5 Schedule and attendance calendar

Schedule offers a readable weekly list and optional day view. Every entry shows class/branch/local time and enrollment context. An estimated next class is labeled until occurrence/holiday support exists. Student actions are view/support only.

Attendance supports month navigation, all/daily/class filters, legend, date selection, and a list equivalent. For the current month, highlight academy Today. A future date remains viewable as a calendar cell but never appears automatically Present/Absent. Blank adjacent-month cells are not selectable record controls.

| Calendar case | Required display |
| --- | --- |
| One daily record | Status plus “Daily record.” |
| Several class records | Individual status badges/count and expandable class list. |
| Daily and class records | Separate labelled records; no destructive merge or implied precedence. |
| No record | “No attendance recorded” when date details are opened. |
| Historical class no longer assigned | Preserve the mark; show safe historical class label or “Class record.” |
| Record changed while open | Refresh authorized selected-date details and announce the update politely. |
| Query failure | Visible retry state; retain filter selection but do not substitute empty history. |

Keyboard users can move through dates and reach the selected day's list. Status is conveyed through text/icons as well as color. The student component exposes no mark, clear, bulk absent, roster, or edit controls from the admin calendar.

### 41.6 Tuition, periods, and receipts

The screen separates current policy summary, posted ledger, and available receipts. Period filters use numeric month ordering and retain the selected year in shareable internal state without putting sensitive information in the URL.

Show Paid, Unpaid, Pending, Waived, or a safe unknown historical state. A Paid badge is tied to the authoritative ledger; it never follows a client timer, QR display, screenshot, or local success callback. A missing receipt explains that the academy has not supplied a downloadable record.

Receipt actions show a download/open progress state and handle an authorization expiry as a private error. Do not leave a permanent signed file URL in persisted preferences or analytics. Print views contain only the authorized receipt scope and avoid unrelated profile/health details.

If provider payment launches later, the student reviews athlete, period, amount/currency, and method before initiation. Pending verification has a distinct screen and bounded refresh; a timeout offers status reconciliation rather than a second payment request with a new key.

### 41.7 Learning catalog and lesson detail

Catalog controls: text search, Taekwondo/Fitness category, applicable level, and completion filter. Facets reflect permitted content. Preserve search/filter state on returning from a lesson; clear child-specific result caches on athlete change.

Lesson detail contains title/category/difficulty, safe media, instructions, terminology, principles/prerequisites where available, mistakes/corrections, study guide, relevant muscles, and progress control. Invalid or missing metadata sections are omitted with a safe content warning when useful.

| Action | Enable condition | Completion behavior |
| --- | --- | --- |
| Play media | Approved URL/provider and user initiation | Playback is not automatic completion. |
| Reveal study answer | Valid study item | Local view state only. |
| Mark completed | `recordLearning`, eligible lesson, valid mapping, online or approved queue | Shows pending until persisted/reconciled; then authoritative timestamp. |
| Open anatomy context | Valid approved muscle links and optional module available | Lazy-load viewer and pass safe lesson context. |
| Open related exercise | Referenced asset is eligible for selected athlete | Server rechecks eligibility on deep link. |

A stale Started request cannot erase completion. Duplicate taps submit one mutation. A `CONTENT_MAPPING_REQUIRED` error explains that progress cannot be saved and provides a retry/support path; it does not ask the student to repair curriculum.

### 41.8 Training timer and personal development

Training separates “Assigned to you” from “Available routines.” Each assigned plan shows its effective structure and assigned context; it does not silently display the latest template as the original historical assignment.

Timer controls are Start, Pause, Resume, Skip interval where policy allows, End session, and sound toggle. Explain that timer completion is self-reported activity unless a persisted completion endpoint exists. Navigating away warns only when there is active work at risk; returning does not create an official record automatically.

Development separates learning completion, coach skill grades, recorded body measurements, and readiness. Each has its own meaning and timestamp. Display original measurement units and dates; use charts only when enough actual records exist. Health restrictions remove the sensitive data from API payloads, not just the visual chart.

Readiness presents every factor with actual/required/unit and met/not-met/unknown state. Display “Coach review required” even when all factors are met. No student control changes official belt, evaluation grade, body composition, or promotion outcome.

### 41.9 Belt journey, awards, and anatomy

Belt journey is chronological and includes official dates, rank labels, available certificate references, and external IDs only where disclosure is approved. A downloadable certificate requires authorized issued-file evidence. Awards support event detail and safe filters; no student CRUD is available.

Anatomy starts with a lightweight explanation and a 2D fallback. The user deliberately opens 3D. Loading exposes progress/cancel/retry, and WebGL failure returns to a usable 2D/list interface. Exiting disposes viewer resources and stops animation loops.

The current anatomy integration weights Primary/Secondary mappings for completed learning coverage. Label heatmaps accordingly. Do not label them as injury risk, muscle growth, fatigue, recovered percentage, or measured strength. Unmapped elements show “No learning mapping available.”

### 41.10 Merchandise browse, cart, and order tracking

Product detail requires explicit variant selection when a product has variants. Disabled/unavailable options cannot be submitted. Size guidance is advisory. The cart belongs to the selected athlete scope and is cleared or explicitly switched when that scope changes.

Checkout reviews line items, quantities, estimated amounts, pickup branch, order contact, payment method, and notes. It sends identifiers/quantities and one idempotency key. Disable duplicate submissions; preserve the pending key through retry. The accepted order response supplies the authoritative ID/total/status.

| Order situation | Student behavior |
| --- | --- |
| Stock/variant unavailable | Refresh availability and retain editable cart. |
| Price changed under a supported confirmation contract | Show updated price; require explicit new acceptance before an atomic create. |
| Request timed out | Show “Checking order status”; reconcile the same key. |
| Accepted pending order | Show order number, lines, collection information, and Pending Confirmation. |
| Paid/fulfillment changed by academy | Re-fetch own detail and show authoritative new state. |
| Cancellation not enabled | Show verified academy support contact. |
| Order not accessible | Generic unavailable record; no customer information from another order. |

### 41.11 Settings, support, and optional student services

Settings contains language, theme, motion, audio, account security actions, install/update guidance, and local sign-out. Preferences save separately from official profile data. Device/session UI shows only real provider-backed capabilities; no fabricated IP/location history is displayed.

Support shows approved academy identity and channels. A correction request is a manual contact workflow until a persisted request system is explicitly implemented. Do not show a successful “request submitted” toast for a mail link or an unimplemented endpoint.

| Future screen | Minimum complete behavior before enabling |
| --- | --- |
| Notifications | Own inbox with unread/read states, pagination, safe deep links, and explicit empty/error handling. |
| Digital pass | Live authorized issuance, visible expiry, online status, and an expired/refresh state; no raw personal record in the QR. |
| Exam list/detail | Published window, branch/date/fee, eligibility explanation, capacity state, review/submit/status workflow. |
| Certificate viewer | Owned issued document, immutable issuer/date/reference, revoked/unavailable state, controlled download. |
| Public certificate verification | Minimal approved public fields; opaque token, invalid/revoked response, no student health/contact disclosure. |
| Guardian switching | Verified relationships, visible selected child, complete state reset and denied/revoked-grant handling. |

## 42. Database lifecycle and migration contracts

### 42.1 Existing schema versus proposed additions

The shared student, attendance, payment, content, progress, assignment, award, and shop tables remain authoritative. This section specifies required semantics rather than replacement DDL. Exact SQL must be generated against the final schema, constraints, and migration history.

| Object | Existing evidence | Required student extension or verification |
| --- | --- | --- |
| `profiles`/`students` links | Two explicit link directions and newer synchronization triggers | Prove one-to-one self ownership and conflict rejection; no contact-based claim. |
| `attendance.class_id` | October migration and current store/calendar support | Preserve null legacy marks; verify unique key, historical visibility, and date policy. |
| `library_assets`/`curriculum` | Transactional staff mirror with same-ID/title check | Reconcile historical collisions and define publication/content version. |
| `lms_progress` | Status/timestamps/optional metrics in snapshot; staff service RPC | Dedicated student completion contract, provenance, monotonic update rules. |
| `student_training_plans` | Student/template/customized structure fields in snapshot | Validated structure version, active-plan access, ownership, and template deletion behavior. |
| `payment_transactions` | Immutable staff-recorded transactions and receipt references | Safe receipt projection; provider intents/events/allocations remain separate. |
| `households`/`household_students` | Admin grouping and collection | Guardian account grants; no student ownership inference from grouping alone. |
| `pos_orders` | Request keys/reservations/transaction functions | Student DTO, atomic quote-price validation/cancellation, retry reconciliation, publication-ready catalog. |

### 42.2 Guardian access grant schema contract

Proposed `student_access_grants` contains:

| Field | Required meaning/constraint |
| --- | --- |
| `id` | Immutable UUID grant identity. |
| `account_id` | FK to the authenticated profile, never an email/phone string. |
| `student_id` | Compatible FK to the existing academy student ID. |
| `relationship` | Approved guardian relationship label; not a permission string supplied by the browser. |
| Capabilities | Explicit finite capability set, using validated columns or a validated schema; arbitrary JSON permissions are rejected. |
| `valid_from`, `expires_at` | Time-bounded validity with end after start; nullable expiry only under explicit policy. |
| `approved_by`, `approved_at` | Privileged approval evidence. |
| `revoked_at`, `revoked_by`, `revocation_reason` | Auditable revocation; no student write access. |
| Timestamps/version | Created/updated and a revision useful for cache invalidation. |

Prevent overlapping duplicate active grants for the same intended relationship, or define deterministic precedence that never broadens authority accidentally. Keep revoked grants for audit under the retention policy. Query valid grants using the server clock. Every private access path uses the same capability meaning.

The account provisioning model must permit a grant-only guardian without silently forcing a link to one child. This is a required compatibility change before guardian launch. Do not add a Parent role only in the frontend.

### 42.3 Student preference persistence

Proposed `student_preferences` has `account_id` as its primary key, constrained language/theme/audio/motion fields, a revision, and update timestamp. Only the current account can read/update its row. Upsert allows known columns only; account ID is server-derived and cannot be reassigned.

Default preferences are presentation defaults, not stored official identity changes. A missing preference row does not block sign-in. No health, contact, selected student authority, or password data belongs in this table.

### 42.4 Learning integrity and provenance

Choose one canonical content-to-progress mapping. If the existing same-ID mirror is retained, enforce its invariant in privileged content operations and test ID/title collision behavior. If an explicit mapping reference is added, backfill it with a reconciliation report and migrate both admin/student readers together. Do not operate two inconsistent sources of completion identity.

Proposed progress additions include provenance, content version, and optionally a stable mutation event/receipt. Historical rows are `legacy_unknown` until reliable evidence justifies a different value. A new student operation may mark personal completion but may not create/overwrite a coach assessment.

If staff and students must record independent completion evidence, use distinct event/source records or separate state fields; a single unqualified status row cannot represent both authorities safely. The initial implementation may keep a monotonic combined completion display while preserving provenance and denying student resets.

Persist watch position/time or repetitions only after defining their capture semantics. The existing `execution_speed_fps` field is insufficient to prove a physical performance metric. Do not populate it from video playback FPS and present it as kick speed.

### 42.5 Workout and assignment history

An active plan resolves its authorized template and validated customized structure. Retain enough structure/version information for a historical completion to remain interpretable after a coach edits the template. A future completion record contains athlete, plan/template/version, server receipt time, client session identifier, self-reported start/end/result, and a clear provenance label.

The dated snapshot's template foreign key uses cascade deletion for assigned plans. Verify the effective constraint before adding completion history; a template deletion must not silently erase the context of a student's historical session. Prefer an agreed archive/version strategy for content with dependent history.

Client time is not trusted proof of attendance or duration. Apply plausible bounds and show uncertain interrupted sessions honestly. Official assessment, attendance, and promotion logic must not consume timer completions as certified evidence without a separate agreed policy.

### 42.6 Billing, receipts, and immutable history

Maintain one shared invoice/receipt/allocation domain with a compatible monthly ledger projection and historical settlement evidence (Section 48). A transaction insert, its allocation/ledger effect, and receipt identity commit atomically. Corrections use a reviewed compensating/void workflow supported by the final schema, not student updates to amounts/statuses or a duplicate student ledger.

Policy changes must not recalculate the amount on an issued historical receipt. Preserve the posted amount, applicable period, recorded method/date, issuer, and relevant policy snapshot. Missing historical fields remain unknown and require reconciliation rather than fabricated backfill.

Provider payment objects are separate from staff-entered transaction evidence: intent, provider event, verified settlement, and allocation must have stable IDs/deduplication. A webhook can update a payment only after provider authenticity and amount/currency/target matching succeed. No student API can mark its own tuition Paid.

### 42.7 Content publication and safe views

The student release needs an explicit publication decision for lessons, routines, academy public details, and private files. If the existing table lacks a suitable publication field, add one or use a dedicated approved projection. `curriculum.is_active` must not be assumed to represent every library/media publication state automatically.

A read view must expose only approved columns and use caller permissions where supported; ordinary views can otherwise bypass underlying row policies. Table grants and RLS are separate controls. Inspect both for direct API access, including retired policies and function overloads. See [Supabase's API security guide](https://supabase.com/docs/guides/api/securing-your-api) and [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

### 42.8 Migration rollout and rollback evidence

| Stage | Evidence required |
| --- | --- |
| Inventory | Fresh schema/types, exact applied migration list, grants/policies/functions/storage/publications, data anomaly counts. |
| Preflight | Nonpersonal reports for conflicting account links, duplicate keys, content collisions, orphaned progress, invalid dates, and unsupported states. |
| Staging migration | Compatible uniquely versioned SQL, reviewed backfill results, restricted-identity tests, official consumer checks. |
| Schema deployment | Required migration version present before student feature gate is enabled. |
| Application deployment | API can detect missing schema and fail with `SCHEMA_NOT_READY`; no silent direct-table fallback. |
| Backout | Disable dependent feature/application version while preserving official records, completed transactions, and reconciled links. |

Do not apply the test fixture to production, rewrite already-applied historical migration versions casually, or deploy destructive cleanup as part of a student documentation task. The implementation handover includes the reviewed SQL, verification output, and rollback/disable instructions.

## 43. Consistency, offline, and operational scenarios

### 43.1 State transitions that every resource must handle

| Trigger | Required sequence |
| --- | --- |
| Sign-in | Establish verified session -> resolve current scope -> clear prior identity state -> bootstrap -> fetch permitted resources. |
| Athlete switch | Increment scope generation -> abort requests -> detach channels -> clear displayed child data -> authorize new scope -> fetch -> attach new channels. |
| Local sign-out | Request provider sign-out -> clear cookies/session state as supported -> cancel work -> purge private caches/queues -> show generic login. If network sign-out fails, clear local private state and report the unresolved server sign-out honestly. |
| Account disabled/revoked | Any authoritative 401/403 clears affected personal state and channels; sensitive pending writes stop. |
| Offline | Show network state; permit generic shell/approved public content; stop authoritative order/payment/exam/pass actions. |
| Reconnect | Reverify identity/scope -> reconcile pending operations -> re-fetch visible resources -> restore eligible subscriptions. |
| Content/rank changed | Recompute eligibility from server data; close or replace now-ineligible content without leaving private media state active. |
| Database/schema unavailable | Preserve safe UI controls/support, show unavailable state, and fail mutations closed. |

Do not wait for a realtime event as the sole revocation mechanism. Live server checks remain authoritative on subsequent access; disconnected clients cannot promise immediate remote revocation of already downloaded data.

### 43.2 Query identity and stale-response protection

Use a canonical resource key such as:

~~~text
[student-api-v1, accountId, studentId, resource, normalizedFilters, policyVersion]
~~~

No resource request starts before the scope is ready. Capture the current generation when starting a request and discard results if identity/scope/generation changed before completion. This applies to successful responses, errors, optimistic rollback callbacks, pagination, worker messages, and file requests.

Deduplicate in-flight identical reads within one scope. Do not share user clients or personal data through server module-level caches. Server request memoization, if used, must remain inside the authenticated request boundary.

### 43.3 Realtime invalidation map

| Authoritative change | Invalidate | Special handling |
| --- | --- | --- |
| Own profile/student relationship/status | Bootstrap, profile, capabilities, current page | Re-resolve scope; an ordinary data refetch cannot repair a revoked relationship. |
| Own enrollments/classes | Schedule, dashboard next class | Preserve historical attendance until its own query changes. |
| Own attendance | Filtered attendance, dashboard, readiness | Recompute correct daily/class summary; reset pages after structural change. |
| Own payments/transactions | Tuition, receipts, dashboard | Payment status comes from authorized server read; socket payload is not settlement proof. |
| Own LMS progress | Lesson, catalog, learning summary, readiness/learning coverage | Preserve monotonic completion and content/provenance semantics. |
| Library/template/muscle mapping | Affected eligible content and anatomy context | Revalidate publication and references. |
| Own assessments/measurements/belt/awards | Development, journey, awards, dashboard | Health payloads still require capability. |
| Own order | Own order list/detail and shop summary | Never merge `admin_notes` or internal columns from raw events. |

Subscribe only to the necessary tables/filters for the current view and authorized scope. The admin publication migration includes many tables, but membership in a publication does not authorize the student to subscribe to every academy resource. If a safe scoped stream cannot be implemented, use bounded authorized refresh for that resource.

### 43.4 Offline queue eligibility and replay

Only a narrowly defined learning progress event may enter the optional queue. The initial release can omit the queue entirely. Orders, payment intents, exams, QR passes, contact changes, grants, and official records never queue through a generic request replay mechanism.

Queued event fields: account ID, athlete ID, asset ID, allowed progress state, mutation UUID, created time, contract/content version, and bounded retry metadata. Do not persist a URL, Authorization header, cookie, arbitrary JSON body, or service endpoint supplied by the client.

Replay uses current session credentials and rechecks the current grant/content mapping. Handle outcomes explicitly:

| Outcome | Queue behavior |
| --- | --- |
| Same completion already committed | Mark synchronized and use authoritative result. |
| Account/scope revoked | Stop replay and clear/quarantine under the privacy policy; never send under another account. |
| Content deleted/ineligible | Mark unavailable for review; no automatic alternative lesson. |
| Mapping/policy changed | Pause event and require a fresh authorized contract; no curriculum creation. |
| Temporary failure | Bounded exponential backoff with jitter and visible pending status. |
| Invalid event or idempotency conflict | Stop automatic retries; show safe recovery/support guidance. |

Queue retention and size must be explicit configuration. Proposed starting bounds: at most 100 events per identity and 7 days before requiring reconciliation. These are design bounds to test, not a reason to retain sensitive data unnecessarily.

### 43.5 Timer lifecycle

Represent timer state as a validated structure version, current interval, accumulated active duration, deadline/baseline, and running/paused/ended state. Derive remaining time from elapsed time rather than subtracting one each time an interval callback runs.

On background/resume, recompute elapsed time and ask the student to confirm an interrupted session when its meaning is uncertain. Browser suspension does not prove training continued. Audio starts only after permitted user interaction; reduced-motion and sound preferences remain respected.

Disposing the timer cancels callbacks/listeners/audio resources. Scope switch terminates or explicitly abandons the prior athlete's local session before starting a new one. A completed timer does not mutate attendance or grades.

### 43.6 Worker and cache isolation checks

Use a distinct student manifest ID, worker scope, cache prefix, and IndexedDB names. Precache only release-matched public assets and the generic offline page. Private HTML/RSC, auth/recovery, APIs, files, and responses that set session cookies remain outside cache.

Test cache contents using two synthetic accounts. Include browser Back, hard reload, app update, offline start, expired session, failed logout, and account switching. Verify signed URLs do not enter generic image caches. Worker-source inspection alone does not prove the generated production worker has the correct rules.

### 43.7 Deployment compatibility and recovery

| Failure | Safe student result | Operational follow-up |
| --- | --- | --- |
| Required RPC missing | `SCHEMA_NOT_READY`, affected feature disabled | Compare deployed migration/function signatures; no fallback insert. |
| Account link conflict | Support state, no athlete payload | Privileged review with explicit evidence; no login-time email matching. |
| Legacy content ID collision | Lesson may remain readable if authorized; progress unavailable | Reconcile mapping without moving another student's progress. |
| Duplicate order attempt | Reconcile original key/resource | Inspect persisted transaction result before retrying. |
| Ledger/transaction mismatch | Explain unavailable receipt/balance verification | Finance reconciliation; no fabricated Paid state or receipt. |
| Private cache regression | Disable affected caching/feature and purge controlled caches | Verify all cache layers and deploy a corrected worker. |
| Provider payment delayed | Show pending verification with support/reference | Server reconciliation and event deduplication; no second settlement. |

Record request ID, operation, safe failure code, deployment/schema version, and nonpersonal timing metrics. Use restricted server audit records for sensitive access events under the academy retention policy. Do not send raw personal/health/contact/payment payloads to client analytics.

## 44. Verification fixtures and complete acceptance plan

### 44.1 Existing tests are reference evidence

The admin repository contains local database, route, contact, attendance, and anatomy tests. In particular, `tests/student-api.test.mjs` exercises **admin student-management routes and payloads**; its filename does not prove a student-facing API exists. The dated SQL fixture is for isolated tests and substitutes Auth behavior.

This documentation revision does not run or certify all admin tests. The student implementation must supply its own unit/contract/database/browser suites and record actual results against the final deployment artifact.

### 44.2 Minimum synthetic fixture set

Use generated fictional data with deterministic identifiers and an injectable clock. Do not copy production student contact or medical records into fixtures.

| Fixture | Purpose |
| --- | --- |
| Student A and Student B | Distinct enabled accounts, roster IDs, records, private files, orders, and progress for isolation tests. |
| No-link and conflicting-link accounts | Verify safe support states and lack of roster fallback. |
| Disabled, password-change-required, and archived accounts | Verify account eligibility across server render, APIs, direct database/RPC, and file paths. |
| Guardian G | Valid grant to A, no grant to B; separate health/billing/learning capabilities; expiring/revoked variants. |
| Status variants | Active, Paused, Inactive, Suspended, Graduated under the selected membership policy. |
| Date edges | Leap day, 29th/30th/31st enrollment, academy midnight, year rollover, invalid February 30. |
| Attendance mix | Daily and two class marks on one date, missing day, historical class, record before current enrollment. |
| Content mix | Eligible/ineligible/published/unpublished assets, malformed JSON, missing media, mirror collision, legacy completion. |
| Finance mix | Paid/Unpaid/Pending/Waived, missing historical receipt/date, older unpaid cycle, policy fee change, family receipt. |
| Commerce mix | Last unit, inactive variant, wrong product/variant pair, duplicate lines, price change, pending/cancelled/paid order. |
| Development mix | Missing syllabus, rank-mismatched grade, null measurement, one measurement, several real historical measurements. |
| Network/session mix | Slow reads, write timeout after commit, reconnect gap, refresh in several tabs, stale worker/cache. |

### 44.3 Contract and projection tests

| ID | Scenario | Required assertion |
| --- | --- | --- |
| CONTRACT-01 | Every student response | Runtime schema matches documented DTO/envelope and safe HTTP status. |
| CONTRACT-02 | Profile projection with every source column populated | Internal notes/signature/link/permission fields never appear. |
| CONTRACT-03 | Health denied versus health empty | Restricted payload contains no health values; empty allowed payload remains distinguishable. |
| CONTRACT-04 | Bigint above JavaScript safe integer | Identifier round-trips as an exact string. |
| CONTRACT-05 | Money/date/null mapping | Decimal precision, calendar date, and unrecorded null are preserved. |
| CONTRACT-06 | Stored enum/JSON unexpectedly changes | Safe unknown/content warning; no false completion, Paid status, or crash. |
| CONTRACT-07 | Pagination with equal dates and new insertion | Stable order, no duplicate displayed IDs, bounded cursor and declared refresh semantics. |
| CONTRACT-08 | Invalid cursor or scope change between pages | Rejected/re-authorized; no continuation into another athlete's rows. |
| CONTRACT-09 | Malformed/oversized/unknown request fields | Rejected before mutation; error does not echo arbitrary secrets/keys. |
| CONTRACT-10 | User supplies role/student/price/grade fields | Strict rejection or safe ignored documented fields; no authority change. |

### 44.4 Authorization and persistence tests

Exercise UI APIs and independently reachable database, RPC, storage, and realtime paths. Passing an API test alone does not establish Data API safety.

| ID | Scenario | Required assertion |
| --- | --- | --- |
| ACCESS-01 | A requests B by route/header/body/cursor/object ID | No B data or write; safe not-found/denied semantics. |
| ACCESS-02 | Old token after account disable or link/grant revocation | Current sensitive access denied under the documented revocation policy. |
| ACCESS-03 | Shared email/phone/Telegram/name | No additional ownership or automatic account link. |
| ACCESS-04 | Profile/student link/activation mutation via direct Data API | Student cannot change protected fields. |
| ACCESS-05 | Staff-only progress/settlement/cancel RPC | Student execute/action denied even with a known function name. |
| ACCESS-06 | Broad reference table/view query | Publication and safe-column restrictions hold or table access is revoked. |
| ACCESS-07 | Guardian scope with health permission removed | Profile/tuition behavior follows capability; health is absent from every relevant payload. |
| ACCESS-08 | Family receipt containing unauthorized sibling | No sibling disclosure; projected allocation receipt or denied download. |
| ACCESS-09 | Account switch during slow fetch or optimistic update | Old result/error/rollback cannot repaint the new athlete. |
| ACCESS-10 | Service-role adapter receives forged actor/scope JSON | Server-derived actor/scope wins; no request field authorizes access. |

### 44.5 Business transaction tests

| ID | Scenario | Required assertion |
| --- | --- | --- |
| TX-01 | Repeated/late Started and Completed | Completion remains monotonic and first timestamp/provenance follows policy. |
| TX-02 | Mapping missing or mismatched title/ID | Student progress fails without creating/editing curriculum. |
| TX-03 | Two simultaneous purchases of the last variant | At most available stock reserved; one clear failure if only one order can succeed. |
| TX-04 | Order transaction fails after line processing begins | No partial order, reservation leak, or false success. |
| TX-05 | Write commits but browser times out | Same-key retry returns the same resource without extra stock/financial effect. |
| TX-06 | Same key reused with changed cart/athlete | Conflict and no new mutation. |
| TX-07 | Cancellation/refund replay | No repeated inventory restoration or settlement effect; student cannot invoke staff refund. |
| TX-08 | Monthly boundary/scholarship/fee policy change | Versioned due policy and posted historical amount remain distinct. |
| TX-09 | Forged/duplicated/out-of-order provider event | No unsupported payment state transition or duplicate allocation. |
| TX-10 | Two exam requests for the final seat | Transactional capacity/uniqueness holds if the module is enabled. |

### 44.6 Browser, accessibility, and PWA acceptance

Verify keyboard-only flows, visible focus, screen-reader labels/live regions, reduced motion, large text, light/dark contrast, long Khmer/English/Chinese text, touch targets, modal scrolling, and calendar/list equivalence. Check both narrow mobile and desktop layouts with realistic empty/error data.

Run on supported desktop Chromium, Firefox/Safari where available, Android Chrome, and iOS Safari/installed mode. Record the tested versions/devices instead of claiming universal compatibility. Feature-detect install/push/WebGL and provide the defined fallback.

Privacy cases include no private cache entries, logout then Back, offline cold start, expired session, new child selection, worker update, signed file display, and pending progress replay after revocation. Browser console/network inspection must show no service credentials or private data in analytics/logs.

### 44.7 Test deliverables in the student project

| Deliverable | Coverage |
| --- | --- |
| Pure unit tests | Dates, monthly boundaries, attendance grouping, content parsing, DTO conversion, readiness unknowns, contact normalization. |
| Route/contract tests | Auth/scope, validation, response projection, status codes, pagination, idempotency adapter. |
| Isolated PostgreSQL tests | Actual RLS/grants/functions/transactions under synthetic roles; fixture Auth substitutes are documented. |
| Integration tests | Supported Supabase Auth/session/storage/realtime behavior against a separate staging project. |
| Browser tests | Full student journeys and privacy/accessibility states against the production build. |
| Artifact checks | Manifest, icons, worker generation, private response headers, no leaked server imports or secrets. |
| Evidence report | Command, version/commit/schema, date, result, unresolved issue, and release gate. |

Only document commands as available after adding the corresponding scripts. A passing build is insufficient evidence for authorization, concurrency, or private cache correctness.

## 45. Implementation work packages and release handover

### 45.1 Ordered development packages

Paths below refer to the **proposed separate student repository**. They are implementation destinations, not claims that files already exist here.

| Package | Depends on | Main implementation artifacts | Completion evidence |
| --- | --- | --- | --- |
| STU-01 Contract inventory | None | Canonical schema/types, migration/grant inventory, this spec's decision register | Snapshot source and anomalies documented; no guessed core DDL. |
| STU-02 Project foundation | STU-01 | App Router shell, strict TS/lint, env validation, tokens/i18n, build/check scripts | Minimal production build and accessible shell with no admin provider imports. |
| STU-03 Auth/session/scope | STU-01–02 | `lib/supabase/{browser,server}`, `lib/auth/resolve-student-scope`, auth routes, protected layout | Account/link/revocation/multi-tab cases pass. |
| STU-04 DTO/repository layer | STU-01,03 | `lib/student/contracts`, `lib/student/repositories`, runtime mappers | Explicit source selection and projection tests pass. |
| STU-05 Core read screens | STU-04 | Dashboard/profile/schedule/attendance/tuition/journey/awards pages and APIs | Two-student isolation, mixed history, null/error, mobile/accessibility evidence. |
| STU-06 Learning access | STU-04 | Catalog/detail, metadata/media adapter, publication/mapping verification | Eligible-only reads and safe malformed-content behavior. |
| STU-07 Student progress | STU-06 | Narrow student transaction, provenance/idempotency, progress API/control | No staff grading privilege, no curriculum writes, monotonic replay tests. |
| STU-08 Training/development | STU-04,06 | Plan resolver, timer, coach assessments, health measurements, readiness service | Real assignments/units, unknown factors, health capability, timer lifecycle tests. |
| STU-09 Preferences/support | STU-03–04 | Preference storage/API, account settings, contact actions | Account scope, safe links, conflict/local-save behavior. |
| STU-10 PWA/resilience | STU-05–09 | Student manifest/icons/worker/offline page/update UI; optional restricted queue | Final artifact cache/privacy/update tests. |
| STU-11 Commerce | STU-04,10 plus verified commerce schema | Safe catalog/cart/quote/order APIs, atomic price-validation adapter, optional student cancellation | Last-stock, price-change/expiry, timeout/replay, no partial writes, no admin-note exposure. |
| STU-12 Guardian access | STU-03–04 plus provisioning/grants | Approved grant resolver, child switcher, capability-aware projections | Grant-only account compatibility and revoke/switch/health isolation tests. |
| STU-13 Verified payments | STU-05 plus merchant integration | Server intents/events/allocations, status/receipt UI | Sandbox verification, reconciliation, duplicate-event and amount/currency tests. |
| STU-14 Notifications/pass/exams/certificates | Relevant earlier packages | Feature-specific schema, backend dependency contracts, student screens | Each module's lifecycle and access tests pass independently. |
| STU-15 Optional anatomy | STU-06,08 | Lazy 2D/3D viewer, approved model assets/attribution, contextual learning coverage | Fallback/loading/disposal/device evidence and truthful labels. |
| STU-16 Release/operations | Enabled packages only | Deployment config, monitoring, evidence index, support/runbook, rollback | Signed-off gate matrix for the exact application/schema/worker artifact. |

Deliver a working read-only vertical slice before broadening optional modules: verified sign-in -> scope -> profile/schedule -> accurate attendance/tuition -> safe sign-out. Then add learning writes and other capabilities behind independent gates.

### 45.2 Release gate matrix

| Module | Minimum release prerequisite | Default when unmet |
| --- | --- | --- |
| Student core | Auth/link/RLS/projection, account/portal gate, real data contracts | No personal application launch. |
| Learning read | Publication/eligibility/media/mapping strategy | Hide content or show safe unavailable state. |
| Learning write | Dedicated scope-safe transaction/provenance/idempotency | Read-only lessons. |
| Development/health | Correct rank/assessment interpretation and health scope | Omit restricted/unverified sections. |
| PWA install | Student identity/worker/artifact checks | Normal online browser experience. |
| Offline progress | Approved minimal queue/retention/replay/privacy | Online-only progress saving. |
| Shop | Atomic transaction schema, safe DTO, stock/idempotency tests | Feature disabled. |
| Guardian | Verified grants/provisioning/revocation/switching | Self scope only. |
| Provider payment | Merchant sandbox, signatures/events/allocations/reconciliation | Posted ledger and academy payment guidance only. |
| Push/inbox | Recipient privacy, durable inbox, subscription lifecycle | No subscription prompt or fake badge. |
| QR pass | Issuance/scanner/replay/expiry contract | No live pass claim. |
| Exam/certificate | Published workflow, capacity/approval/issuance/verification | No application/certificate actions. |
| Anatomy | Approved assets/attribution, device fallback and cleanup | 2D/list or no optional viewer. |

Feature flags are evaluated on the server as well as in navigation. A stale installed client calling a disabled feature receives a documented safe error and cannot bypass the release gate.

### 45.3 Handover package

The student implementation handover contains:

- Exact source commit, dependency lockfile, runtime versions, and deploy artifact identifier.
- Canonical shared schema/types, applied migration sequence, student additions, and preflight/backfill outcomes.
- Student OpenAPI contract, DTO schemas, field projection matrix, and compatibility version.
- Auth redirect/cookie/origin configuration and scope/capability decision record.
- Approved business rules for attendance basis, billing cycle/grace/exemption, content eligibility, readiness, and shop cancellation.
- Student route/component inventory with loading/empty/error/restricted/offline states.
- Unit/database/contract/browser results, tested devices, and any explicit limitations.
- Manifest/worker/cache inspection output from the exact production build.
- Operational alert/runbook, feature disable controls, support ownership, and data-preserving rollback instructions.
- Provider/push/pass/certificate configuration evidence only for modules actually enabled; secrets remain outside documentation and source control.

### 45.4 Documentation completion and remaining implementation boundary

This revision specifies the complete intended student experience, its current admin integration evidence, API/data contracts, screen interactions, privacy boundaries, optional module lifecycles, migration strategy, and ordered delivery/test requirements. Proposed interfaces are intentionally distinguished from existing code.

A document can be complete while deployment-specific values remain to be verified. Do not fill unknown bucket names, merchant secrets, live schema state, official rule approvals, or production test results with plausible examples. Record those items in the implementation evidence register and keep their dependent feature gate closed until verified.

**Revision 3.0 record:** the 18 October documentation pass expanded the student contracts. Revision 4.0 below refreshes them against later workspace operations code. This work remains a documentation edit; implementation and deployment evidence are separate deliverables.

## 46. Current operations integration and authority map

### 46.1 Source evidence and precedence

Sections 46–50 extend the student specification using source sampled on 26 October. October 23/25 migrations and associated files were uncommitted in this checkout. They may coexist with older source, a dated test fixture, or a differently deployed database. Verify the applied versions and actual restricted-identity behavior before enabling dependent student features.

For current planning, reuse the shared record below rather than implementing an earlier proposed duplicate. Where data has not been migrated, return the explicitly labelled legacy projection. Do not make the absence of a new table look like a student with no records.

| Domain | Authoritative shared source | Student target |
| --- | --- | --- |
| Membership origin | `students.membership_start_date`, fallback helper and initial-enrollment trigger | Read-only start date; preserve registration date separately. |
| Billing day/history | `students.billing_schedule`, `membership_schedule_changes` | Safe current/effective future schedule and history. |
| Approved pause | `membership_pauses`, `students.approved_pause_id` | Read authorized interval and current recorded state; no student approve/void/return action. |
| Session history | `class_occurrences`, `class_occurrence_roster`, `class_membership_periods`, holidays | Own session projection with status, revision, actual times, provenance. |
| Recorded attendance | `attendance` including optional `occurrence_id`; `makeup_attendance` | Separate ordinary marks and linked replacement history. |
| Posted invoice | `membership_invoices` and rate snapshot | Read the issued period/amount/waiver/balance; avoid reconstructing it from current fees. |
| Cash collection | `membership_receipts`/`membership_allocations`, legacy `payment_transactions` | Safe receipt and allocation projection; preserve provenance. |
| Credit | `membership_credits`/`membership_credit_uses` | Read available/applied credit where permitted; credit is not new cash. |
| Inbox/push | `portal_notifications`, preference/subscription/delivery tables | Own safe inbox/preferences; student-specific navigation. |
| Grading | `grading_events`, `grading_candidates`, promoted belt history | Own published result after a publication contract is added; no examiner actions. |

### 46.2 Endpoint authority matrix

| Existing route | Student role accepted by current handler? | Safe integration decision |
| --- | --- | --- |
| `GET /api/attendance/makeup` | Yes, with explicit linked-student resolution | Reference read flow; replace raw class/staff metadata and resolve link conflicts before student reuse. |
| `POST /api/attendance/makeup` | No | Staff records/voids makeup evidence. Student portal has no equivalent write button. |
| `POST /api/membership/schedule` | No; Root/Super Root/Admin plus finance permission | Student schedule/history is read-only. No direct wrapper to this mutation. |
| `GET/POST /api/notifications` | Yes | Existing own-account inbox/preferences/actions; adapt safe DTOs, links, affected-row checks, and lifecycle. |
| `GET/POST /api/operations` | No | Staff-only aggregate/action API. Build narrow student reads instead of adding Student to its role list. |
| `/api/jobs/notifications` | Scheduler-secret authentication | Backend dependency only; never expose scheduler credentials or execution controls to students. |
| `GET/POST /api/shop/order` | Yes, with existing ownership checks | Continue using the safe student order/quote requirements; this is not a general operations gateway. |

An accepted Student role is evidence of a potential integration path, not proof that all returned fields are appropriate for the new student application. The current makeup loader retrieves all class definitions before student filtering; the notification handler selects raw notice rows. Project only the fields the student contract needs.

### 46.3 Request authentication compatibility

The existing shared routes use bearer-token `verifyCaller`, while the proposed separate student application uses its documented SSR cookie session. `lib/portal-api.ts` is an admin-app bearer fetch helper and is not adopted unchanged as the student session architecture.

Use a shared server service behind the student guard, or an explicit authenticated adapter. Do not quietly send a cookie to a bearer-only route and report empty data on its 401. Do not expose service-role/scheduler keys or add a competing request identity to solve an integration mismatch.

The new admin MFA gate concerns Root/Super Root/Admin assurance. It is not evidence that all Student accounts must have administrator MFA. Preserve student authentication policy separately while enforcing current profile/link/capability checks.

### 46.4 New student read surface

| Proposed student endpoint | Purpose | Required projection/guard |
| --- | --- | --- |
| `GET /api/student/membership` | Start date, effective billing schedule, approved pauses and recorded status | Selected athlete; public-to-student explanations only; omit staff IDs/internal reasons. |
| `GET /api/student/sessions` | Dated own upcoming/history sessions | Own saved roster or supported eligibility rule, bounded dates/cursor, safe coach/branch labels. |
| `GET /api/student/attendance/makeups` | Own recorded makeups and clearly labelled candidate information if enabled | Own scope, safe source/target session labels, no classmates or staff notes. |
| `GET /api/student/tuition/invoices` | Posted invoice history and declared balances | `readTuition`, unique student/cycle; no automatic invoice creation during GET. |
| `GET /api/student/tuition/invoices/[id]` | One invoice, receipts/credit allocations, waiver and outstanding amount | Constrain every joined receipt/allocation/credit to the invoice athlete. |
| `GET /api/student/tuition/credits` | Available/applied own tuition credit | `readTuition`; no refund/transfer/apply-credit mutation. |
| `GET /api/student/grading-results` | Own explicitly published outcomes | Publication prerequisite and result projection; unavailable before that contract exists. |

Canonical screen contract: `/api/student/schedule` returns the unified dated/estimate response in Section 47. `/api/student/sessions` is a paged dated-history view using the same authorized query/projection; it never manufactures recurring entries. Keep both backed by one domain service and explicit source labels.

## 47. Dated sessions attendance and makeup history

### 47.1 Dated session model

The October 25 migration defines one `class_occurrences` row per `(class_id, source_date)` with a UUID, actual `starts_at`/`ends_at`, class/branch/coach snapshots, capacity, status, roster provenance, and revision. A moved session retains its occurrence identity and original source date. The date displayed as its actual class date comes from the timestamp in the academy timezone.

Proposed student DTO:

~~~typescript
interface StudentSessionDTO {
  id: RecordId;
  classId: RecordId;
  sourceDate: DateOnly;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  classLabel: string;
  branch: { id: number; name: string };
  coachLabel: string | null;
  status: 'scheduled' | 'completed' | 'cancelled' | 'unknown';
  revision: number;
  rosterProvenance: 'snapshot' | 'reconstructed' | 'reviewed';
  changeNotice: string | null;
  source: 'dated_occurrence';
}

interface StudentScheduleDTO {
  sessions: StudentSessionDTO[];
  recurringEstimates: ScheduleItemDTO[];
  coverage: {
    from: DateOnly;
    to: DateOnly;
    verifiedDatedHistoryFrom: DateOnly | null;
    incomplete: boolean;
  };
  warnings: string[];
}
~~~

Do not return raw occurrence rows containing creator/staff IDs, internal change reason, capacity configuration, or other students' roster entries. If a change reason is useful to students, publish a separate safe explanation. Knowing a class ID does not authorize its entire roster or all of its past/future sessions.

### 47.2 Schedule selection and historical coverage

Resolve a selected window as follows:

1. Verify current account/athlete and resolve authorized own saved-roster memberships.
2. Load applicable dated occurrences and safe branch/coach labels, including cancelled occurrences needed to explain a prior schedule.
3. Respect actual moved start/end instants. Check occurrence identity/source date before creating any recurring fallback for the old date.
4. Use recurring estimates only where no authoritative occurrence covers the class/date and the permitted enrollment/holiday/pause policy supports an estimate.
5. Keep estimated entries separate from confirmed dated entries; estimates have no invented occurrence UUID or roster provenance.
6. Paginate by actual start time and stable occurrence ID; invalidate on revision change.

The schedule screen's unified window is bounded to 93 days, matching current operations range controls. Longer history uses the sessions endpoint's cursor. `verifiedDatedHistoryFrom` requires explicit migration/roster coverage evidence; the earliest existing occurrence alone does not establish complete history.

Future saved rosters can be refreshed after membership/pause changes by the new operations triggers. Do not describe every saved roster as an immutable proof of past eligibility. Honor `snapshot`, `reconstructed`, and `reviewed` provenance and verify the migration's historical baseline before calculating long-term percentages.

### 47.3 Attendance identity and denominator

Three record modes now coexist:

| Mode | Evidence | Student interpretation |
| --- | --- | --- |
| Legacy daily | No class/occurrence reference | One day-level status; no inferred class, duration, or check-in instant. |
| Class-linked legacy | Class ID/date, no occurrence ID | A class mark with limited historical schedule context. |
| Occurrence-linked | Stable `occurrence_id` plus own saved session context | A mark attached to a dated session; still not a biometric scan/check-in timestamp. |

Add optional `occurrenceId`, source/actual date labels, and record-mode metadata to the attendance DTO. A moved session must not count twice because source date and actual date differ. Do not infer attendance from `class_occurrences.status='completed'`; it describes the session, not the athlete.

A scheduled-session percentage requires an explicit eligible-session set. Proposed denominator: ended, noncancelled, own eligible occurrences in the declared window after supported enrollment/pause/holiday exclusions. Report missing marks separately as `unmarked`, rather than silently rewriting them to Absent. A stricter “unmarked counts as missed” metric requires an approved separate definition and label.

Return both window coverage and provenance caveats. If reliable occurrence coverage starts on a specific date, restrict the percentage to that interval or show the unavailable historical segment. Keep daily/class summary metrics from Section 39 separate.

### 47.4 Makeup attendance source behavior

`makeup_attendance` retains the original class/date, attended replacement date, optional target class, Present/Late result, original Absent/Unmarked classification, staff recording/reason, and void metadata. The newer migration can also link `source_occurrence_id`.

The current candidate helper distinguishes an absent mark from an unmarked ended class, excludes covered holidays/pauses/cancelled sessions, and uses a 30-minute post-session buffer. Its range is bounded to 93 days. Candidate appearance means “eligible for academy review,” not an approved entitlement, booking, attendance fact, or credit balance.

The current `ownedStudentIds` helper collects links from both directions. It does not implement the strict contradiction rejection required by Section 38.3. Before adopting makeup or notification reads, resolve the selected athlete through the student scope service; never use the union of contradictory links as family authorization.

### 47.5 Makeup student response and screen

~~~typescript
interface StudentMakeupDTO {
  id: RecordId;
  source: {
    occurrenceId: RecordId | null;
    classId: RecordId;
    classLabel: string;
    missedDate: DateOnly;
    originalMark: 'absent' | 'unmarked';
  };
  replacement: {
    attendedDate: DateOnly;
    classLabel: string | null;
    status: 'present' | 'late';
  };
  state: 'recorded' | 'voided';
  explanation: string | null;
}
~~~

Display the original mark and replacement as linked facts. A makeup does not erase the original absence, convert an unmarked source into an official Absent record, or add a second normal attendance row automatically. Omit internal staff reasons/void notes unless a safe student-facing explanation has been approved.

In Attendance, offer a “Makeup history” view with source date/class, replacement date/status, and voided state. Candidate information is optional; if shown, label it “Ask the academy about a makeup” and use the verified support channel. No Record, Approve, Void, or attendance-write control appears in the student portal.

### 47.6 Makeup totals and readiness

Do not add every makeup to recorded attendance percentages by default. One source session can have only one active replacement in the source migration, but the attended date may also have a normal class mark. Count fulfilment once using the agreed source-session key; if a matching regular mark already represents the replacement, avoid adding another attended session/day.

Any readiness policy that recognizes makeups must version its unit and credit rule. Present separate “Original sessions attended” and “Recorded makeup sessions” until that policy is approved. The current PRI helper is not proof that occurrence/makeup-aware promotion counting exists.

## 48. Membership pauses invoices receipts and credits

### 48.1 Membership origin and effective billing dates

Current source separates registration from membership origin. `billingBaseDate` prefers a valid persisted `membership_start_date`, then earliest enrollment, then registration as a compatibility fallback. Once an origin is established, later class moves must not silently reset it.

`billing_schedule` contains effective-month/day changes. The helper selects the latest applicable change, clamps days to the month's length, and prevents a first-cycle due date from preceding membership start. Immutable `membership_schedule_changes` records administrative history. Student UI reads that history; it never calls the staff change-day action.

| Example | Required interpretation |
| --- | --- |
| Membership starts 31 January | February due day clamps; later months use the configured anchor again. |
| New billing day takes effect in March | Earlier cycles keep their prior rule unless a reviewed correction explicitly applies. |
| Student changes class in April | Existing membership origin remains authoritative. |
| Stored date invalid or schedule malformed | Show unavailable billing schedule; do not invent a due date or change the record in GET. |
| Historical invoice exists | Show its posted due/cycle/amount values rather than recomputing them from current settings. |

### 48.2 Approved pauses and automated return

The source now supports approved pause intervals with `start_date`, `resume_date`, void evidence, and a student `approved_pause_id`. Activity exclusion uses the half-open interval `[start_date, resume_date)`. “Resume 10 November” means the pause ends before that day's normal activity, subject to the recorded status and scheduler outcome.

`portal_process_membership_dates` can start/finish approved pauses and prepare the current cycle invoice. The current job is invoked inside `/api/jobs/notifications`; the code limits work, records failures, and may create staff follow-up. The presence of this function is not evidence that the external scheduler ran successfully or processed every eligible student.

Student membership response separates:

- Official current recorded membership state and `asOf` time.
- Approved pause start/resume dates and a safe explanation.
- Whether a future return is scheduled, already recorded, or awaiting academy review.
- Billing treatment of posted cycles; no implied cash refund or partial-cycle proration.

Do not turn a Paused label into `profiles.is_active=false`, and do not reactivate an account merely because a pause date passed. Account eligibility and training membership remain distinct authorities. The new guard can prevent staff profile edits from bypassing an approved pause; students have no status-edit path.

### 48.3 Invoice and settlement authority

| Record | Meaning | Student rule |
| --- | --- | --- |
| `membership_invoices` | Unique athlete/cycle obligation with due/end, posted amount, waiver, stored balance, rate snapshot, optional legacy settlement link | Primary source for posted obligation when this migration is deployed. |
| `membership_receipts` | Immutable staff-recorded receipt for positive received funds | Own receipt metadata/download after authorization; not provider webhook proof. |
| `membership_allocations` | Amount from one receipt applied to one invoice | Include only with ownership checks on both parents. |
| `membership_credits` | Existing credit value, possibly from surplus receipt or approved adjustment | Credit source/provenance and available balance, not a new bank receipt. |
| `membership_credit_uses` | Amount of credit applied to an invoice | Reduce available credit and invoice balance once. |
| `payments` | Legacy monthly ledger and projection from newer invoice accounting | Compatibility view; not an extra invoice or second collection. |
| `payment_transactions` | Older immutable collection/receipt evidence | Preserve historical provenance; deduplicate against newer representation. |

For a nonlegacy invoice, current SQL computes balance from posted amount minus waiver, receipt allocations, and credit uses, floored at zero. A legacy settlement link is treated as settled by that source function. Reconcile this with stored `balance_usd`; disagreement yields an integrity/unavailable state rather than choosing whichever value looks preferable.

### 48.4 Student invoice DTO

~~~typescript
type InvoiceState =
  | 'settled' | 'upcoming' | 'due_soon' | 'due_today'
  | 'within_grace' | 'overdue' | 'unknown';

interface StudentInvoiceDTO {
  id: RecordId;
  cycleMonth: DateOnly; // First day identifying the accounting month.
  dueDate: DateOnly;
  cycleEnd: DateOnly;
  amount: Money;
  waiver: Money;
  paidFromReceipts: Money | null;
  appliedCredit: Money | null;
  outstanding: Money;
  state: InvoiceState;
  reminderLeadDays: number;
  lateGraceDays: number;
  graceThrough: DateOnly;
  policyVersion: string;
  asOf: string;
  provenance: 'invoice_accounting' | 'legacy_settlement';
  allocationCoverage: 'complete' | 'legacy_limited';
  allocations: Array<{
    receiptId: RecordId;
    receiptNumber: string;
    amount: Money;
    paymentDate: DateOnly;
  }>;
}
~~~

Historical legacy settlements without complete allocation detail use `allocationCoverage='legacy_limited'`, null breakdown amounts where unknown, and no invented transaction lines. A receipt can cover several invoices; its face amount and the amount allocated to this invoice are separate.

### 48.5 Status and grace rules

The new `invoiceStatus` helper distinguishes Settled, Due today, Within grace, Overdue, Due soon, and Upcoming. Mirror those semantics in the student service under one versioned policy:

1. Outstanding at or below zero -> Settled, with waiver/credit/receipt breakdown explaining how.
2. Due date equals academy Today -> Due today.
3. Past due by at most `late_grace_days` -> Within grace.
4. Past due beyond grace -> Overdue.
5. Future due within `reminder_lead_days` -> Due soon; otherwise Upcoming.

Reminder lead and late grace are different settings. The current `membershipBilling` helper still returns only Current/Due Soon/Overdue and can support dashboard compatibility, but must not collapse an invoice's Within grace state into an unqualified overdue warning.

For the tuition overview, consider all posted own invoices: the earliest due outstanding invoice determines the outstanding-warning phase, and the sum of posted outstanding amounts remains separate from an unissued-cycle estimate. Available credit does not settle an invoice until an authorized credit-use record exists. A paused membership does not erase earlier posted debt.

`TuitionDTO.accountingCoverage` declares whether invoice accounting, legacy-only records, or both are covered. Its legacy entry list omits duplicate projections for cycles already represented by returned invoices, or carries an explicit source-invoice cross-reference in a documented compatibility variant. Do not combine both representations in payable or collected totals.

If the legacy monthly row says Paid while a real invoice has a positive balance, report an accounting conflict for reconciliation. A legacy settled-key shortcut cannot override an outstanding invoice silently. Likewise, a Pending ledger row may already have some collected funds; neither its status nor amount alone is a complete balance calculation.

### 48.6 Whole-cycle pause treatment

The operations policy currently defines `whole_cycles`. Source invoice creation can waive a cycle fully covered from due date through cycle end by a nonvoided approved pause. A partial overlap does not imply daily proration. Source workflows require review around already partially collected cycles.

Display “Waived for approved pause” only when posted invoice evidence supports that explanation. Do not recompute issued amounts/waivers from a current pause list and mutate history on read. Any refund, overpayment credit, or correction is an academy financial operation with its own record.

### 48.7 Cash credit and double-count prevention

| Situation | Correct student presentation |
| --- | --- |
| Invoice 45, receipt allocation 20 | Paid toward this invoice 20, outstanding 25; not Paid in full. |
| Invoice 45, receipt allocation 30, credit use 15 | Settled: 30 received allocation plus 15 applied credit; no claim of 45 new cash. |
| Receipt 60, invoice allocation 45, remaining 15 issued as credit | Receipt total 60, this invoice allocation 45, available credit 15; do not sum to 75 collected. |
| Full waiver 45 | Obligation waived, outstanding zero, received funds zero; no bank receipt invented. |
| `payments` row projected from invoice receipt | One accounting effect represented twice; deduplicate instead of summing both. |
| Posted historical invoice has old tariff | Preserve its posted amount and rate context; current tariff is a future/unbilled estimate. |

Student credits are read-only and normally noncash unless an explicit refund workflow is implemented. Do not expose “Withdraw,” “Transfer to sibling,” or “Apply credit” because those staff operations exist. Authorized guardians also require the appropriate per-athlete billing scope; family access does not combine unrelated balances automatically.

### 48.8 Read and receipt implementation rules

An invoice GET never calls `portal_ensure_invoice`, `portal_project_invoice`, a payment operation, or a job runner. Return only existing posted invoices. Show the absence of an issued cycle separately from a zero balance; a current tariff estimate can be shown with its own label.

Resolve receipt IDs within the selected athlete and recheck all allocation joins. Serve a receipt as a view of the immutable issued record, not regenerated current prices. Exclude staff IDs, raw `rate_snapshot` JSON, internal adjustment reasons, reconciliation bank rows, and scheduler diagnostics from student responses.

Partial receipt/credit accounting is now a shared integration dependency, not a reason to create another student ledger. Merchant-origin settlement still requires a separate verified provider flow that writes into these authoritative objects exactly once.

## 49. Persisted notifications push and grading results

### 49.1 Existing inbox and delivery lifecycle

The current workspace implements account-owned notices, preferences, browser push subscriptions, per-notice delivery records, refresh claims, and a secret-protected worker. These are shared records to adapt, not blank future schemas.

| Existing field/state | Meaning | Student display rule |
| --- | --- | --- |
| `user_id` | Authenticated recipient account | Server-derived; no client recipient selector. |
| `source_key` | Deduplication/source event identity | Internal; do not display or make it an authorization token. |
| `permission_key` | Staff permission requirement on some notices | Recheck when reading/dispatching; no student permission-editor concept. |
| `read_at` | Recipient acknowledged reading | Reading does not settle an invoice or confirm an order. |
| `dismissed_at` | Recipient hid the notice | Does not delete or resolve its underlying record. |
| `resolved_at` | Producer considers its condition no longer current | Not interchangeable with read/dismissed. |
| Delivery sent/dead/retry fields | Transport outcome for a subscription | Delivery is not proof that a person read the message. |

The existing API allows Student roles, but its response selects full notice rows and supplies application-specific routes. The student service must map them to a safe DTO, verify recipient and relevant athlete/resource scope, and retain these distinct state meanings.

### 49.2 Which notices are actually generated

`refreshNotices` currently generates staff attendance/billing/follow-up notices according to staff permissions. For a Student actor, those staff generators are disabled; its own order updates and system/test notices are the established source reference. Do not promise own tuition reminders, schedule changes, grading publication, or guardian-recipient delivery merely because the generic category exists.

| Student event | Current source evidence | Required before enabling |
| --- | --- | --- |
| Own order change | Shared refresh logic and order notification trigger | Safe own order DTO, correct student target route, recipient/link checks. |
| Own tuition due/update | Staff finance notices exist; no complete equivalent student generator verified | Own billing-capability recipients, invoice-aware policy, safe lock-screen text. |
| Session moved/cancelled | Dated session operations exist | Own roster recipients, revision/dedup key, published safe explanation. |
| Grading result | Staff assessment/promotion exists | Explicit publication event and own result scope. |
| Guardian notice | No verified account grant delivery flow | Approved grants, per-child capabilities, revocation and scope checks. |

The existing resolver marks older attendance/billing/order conditions resolved when absent from its generated draft set. New student producers must use explicit generator-owned namespaces and resolve only their own conditions. Otherwise an order-only refresh could resolve an independently generated tuition notice. Test producer coexistence before enabling new categories.

### 49.3 Student notice DTO and typed targets

~~~typescript
type StudentNoticeTarget =
  | { kind: 'dashboard' }
  | { kind: 'order'; orderId: RecordId }
  | { kind: 'invoice'; invoiceId: RecordId }
  | { kind: 'session'; occurrenceId: RecordId }
  | { kind: 'published_grading'; resultId: RecordId };

interface StudentNoticeDTO {
  id: RecordId;
  category: 'attendance' | 'billing' | 'orders' | 'system';
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  dismissedAt: string | null;
  resolvedAt: string | null;
  studentId: StudentId | null;
  target: StudentNoticeTarget;
}
~~~

Typed targets are the proposed API representation; the current shared notice schema stores `href` and does not establish all target/athlete fields above. Add a compatible validated payload or map only well-defined trusted existing events. Never guess another student's scope by parsing arbitrary notice body text.

Translate targets to student routes after rechecking resource access. The current `safeNotificationPath` is an admin-app allowlist and does not define `/tuition`, new shop details, or student results navigation. The source also maps Student order notices to `/profile?orders=open`; replace that with a real own order route in the separate app. Unmappable targets fall back safely to the student's dashboard with no automatic mutation.

Filter by an approved student audience/producer before exposing title/body. A recipient match or generic system category alone does not make an old staff message safe for a later Student role. Unknown staff-origin notices are omitted or represented with explicitly approved generic text; do not expose their body merely because their target falls back to Dashboard.

### 49.4 Inbox read and acknowledgment contract

`GET /api/student/notifications` returns paged own DTOs, authoritative unread count if available, and refresh metadata. Use the Section 20/40 cursor rules rather than copying the reference's fixed most-recent-200 result as an unlimited history promise.

Proposed student GET is read-only. The existing shared GET calls `refreshNotices` and may persist generated notices; move generation to a documented producer/job or explicit internal service step before adopting the student API's read-only contract. Separate generation failure from retrieval failure: an existing inbox may still be readable while refresh is unavailable, and an empty inbox is not proof that all producers ran.

Acknowledgment/dismiss operations constrain by both recipient and notice ID, confirm the affected result, and return the persisted state. A `saved: true` response without an affected-row check is not sufficient evidence that the requested notice existed or changed. Read-all affects the authorized recipient's set only and does not resolve events.

The inbox retains revoked/missing-resource notices according to retention policy, but their targets cannot open data the account no longer owns. A notification is never a durable grant.

### 49.5 Preferences and two-application isolation

Existing notification preferences are separate from theme/language preferences and include `push_enabled`, muted attendance/billing/orders/system categories, and quiet-hour start/end values. Default source quiet hours are 22 to 7 in the academy timezone; equal start/end currently means quiet hours disabled. Explain these semantics in Settings and version any later change.

The current tables are account-based and do not establish an admin-versus-student application identity. With separate PWA origins, define a validated application/origin and delivery routing strategy before combining subscriptions. Do not let an admin notice URL open a nonexistent student page or treat consent in one app as consent for every app.

Subscription registration must verify the active account, supported endpoint/key shape, size/device limits, and the intended app. The reference caps devices and allows specific push providers; those choices need supported-browser tests. A globally unique endpoint can change account on upsert, so define explicit shared-device transfer/logout behavior instead of silently carrying notifications between accounts.

### 49.6 Permission delivery and logout behavior

| State | Student behavior |
| --- | --- |
| Unsupported browser/context | Keep inbox usable; explain push unavailable without repeated prompts. |
| Permission not requested | Intentional Enable notifications action with purpose. |
| Permission denied | Respect denial; browser-setting guidance only on demand. |
| Keys/configuration absent | Background delivery unavailable; no fake subscription success. |
| Quiet period/category muted | Keep inbox events; suppress applicable push transport. |
| Provider 404/410 | Remove/deactivate dead subscription; retain durable notice. |
| Temporary delivery error | Bounded retry/lease handling; no recreated notice or false delivery claim. |
| Account logout/switch | Cancel requests, clear private inbox state, and revoke/unsubscribe this app's registration under the shared-device policy. |

Browser unsubscribe and server subscription revocation must both be reconciled. If offline logout prevents server cleanup, use only an approved safe revocation/revalidation design; do not persist credentials. Generic lock-screen content reduces exposure but does not replace subscription cleanup.

The source push payload is generic academy-update text. Preserve that privacy direction: no full student name, debt amount, health field, raw certificate URL, or staff follow-up note on a lock screen. A click opens the correct app, verifies identity, and resolves an authorized target.

### 49.7 Background job freshness

The current job uses a secret, lease, time budget, and recorded metrics; it also invokes membership-date processing. Its configuration-ready boolean only checks relevant configuration presence. It does not prove valid provider keys, network delivery, scheduler cadence, complete processing, or successful pause return.

The student application must not call job routes or expose job logs. It may show a safe generated-as-of time or service-degraded notice. Staff operational diagnostics remain outside the student UI.

Test partial/failed runs and a backlog larger than one worker budget. Absence of a newly generated notice must not change tuition to Current, membership to Active, or an order to Completed.

The current membership-processing SQL selects at most 1,000 eligible students in stable ID order without a demonstrated continuation cursor. Before claiming academy-wide automatic processing beyond that bound, provide checkpoint/pagination or other proven coverage and test a dataset exceeding the limit. This remains a backend delivery dependency; students see recorded state and safe freshness information, not internal job controls.

### 49.8 Staff grading source and student publication gap

The operations migration defines grading events with target belt/date/thresholds, and candidates with score, draft/assessed/failed/promoted state, revision, examiner/override fields, and an optional belt-history link. Its existing route is staff-only.

Candidate state is not publication state. A draft score or examiner note must not appear simply because the student ID matches. Before enabling student results, add an explicit publication decision/version, safe feedback projection, publication timestamp, and withdrawal/correction semantics.

| Existing concept | Student presentation after publication | Excluded |
| --- | --- | --- |
| Event | Approved title, date, target belt label | Other candidates and examiner controls. |
| Result | Own published score/outcome and safe feedback | Draft score, internal notes, override reason, staff IDs. |
| Promotion | Official linked belt-history event if committed | Student Promote/override action. |
| Corrected result | New published version/correction notice | Silent replacement of an issued certificate or invented historical result. |

A staff grading event is not automatically an open registration cohort. Add application windows/capacity/fee/acknowledgment policy only if student applications are part of the chosen workflow. Use the existing event as the authoritative target where possible; separate application state from candidate assessment state.

### 49.9 Result contract and promotion boundary

~~~typescript
interface PublishedGradingResultDTO {
  id: RecordId;
  event: { id: RecordId; title: string; examDate: DateOnly; targetBelt: string };
  publishedAt: string;
  publicationVersion: number;
  outcome: 'passed' | 'not_passed' | 'promoted' | 'withdrawn';
  score: number | null;
  feedback: string | null;
  beltHistoryId: RecordId | null;
  certificateAvailable: boolean;
}
~~~

These publication fields/outcomes are proposed student contracts; they are not claims that the existing candidate table already has these columns or that assessed means passed. The backend must explicitly map a published decision. Certification availability comes from an issued-file record, not from a score or belt-history ID alone.

The student's readiness report remains advisory and separate from grading/promotion. A recorded makeup may affect an approved eligibility calculation, but no learning/timer/notification action may approve an exam, override thresholds, or create a belt event.

## 50. Current contract acceptance and revision handover

### 50.1 Additional release fixtures and checks

Add these cases to the Section 44 test plan before enabling the corresponding student module. They are required test specifications; this documentation revision did not execute a live database, worker, merchant, or browser acceptance suite.

| ID | Scenario | Expected result |
| --- | --- | --- |
| CURRENT-01 | Contradictory profile/student links | Makeup/inbox/resource reads reject conflict; no union of A/B authority. |
| CURRENT-02 | Student calls staff operations/schedule/makeup mutation | Denied across route and RPC; no records changed. |
| SESSION-01 | Dated class moved to another date | One occurrence identity; actual date shown, no recurring duplicate. |
| SESSION-02 | Cancelled session/holiday/approved pause | No fabricated absence or makeup entitlement; declared denominator exclusions. |
| SESSION-03 | Reconstructed versus reviewed roster history | Provenance/coverage shown; no unsupported official percentage. |
| SESSION-04 | Historical enrollment changes | Own history preserved; no other roster members exposed. |
| MAKEUP-01 | Absent source followed by recorded makeup | Both facts visible, original retained, fulfilment counted at most once. |
| MAKEUP-02 | Unmarked ended class is a candidate | Unmarked/review candidate, not a verified absence. |
| MAKEUP-03 | Voided replacement or duplicate normal target mark | Correct void state and no duplicate readiness/attendance credit. |
| MEMBER-01 | Later enrollment after membership origin exists | Billing anchor does not reset. |
| MEMBER-02 | Effective day 31 through February and next month | Calendar clamp/history consistent; no UTC day shift. |
| MEMBER-03 | Resume date arrives but worker fails | Recorded state plus safe pending/review context; no invented completed return. |
| MEMBER-04 | Partial-cycle pause or prior partial receipt | Posted approved treatment; no automatic proration/refund. |
| INVOICE-01 | Invoice and projected monthly Paid row coexist | One obligation/collection, no duplicated totals. |
| INVOICE-02 | Partial receipt plus applied credit | Correct balance and separate cash/credit labels. |
| INVOICE-03 | Future/Today/grace-limit/grace-plus-one | Upcoming/Due soon/Due today/Within grace/Overdue under one policy. |
| INVOICE-04 | Legacy Paid conflicts with positive invoice balance | Integrity/reconciliation state; no silent shortcut. |
| INVOICE-05 | Legacy settlement lacks allocation detail | Coverage limitation; no fabricated lines or zero-cash assertion. |
| INVOICE-06 | Stored balance differs from derived balance | Safe review/unavailable state; no read-time financial mutation. |
| INVOICE-07 | GET missing current cycle | No invoice creation; distinguish unissued from settled zero. |
| NOTICE-01 | Other recipient has staff-only finance/follow-up notice | Not visible or dispatched to student. |
| NOTICE-02 | Student billing producer plus order-only refresh | Independent notice not incorrectly resolved by another producer. |
| NOTICE-03 | Read/dismiss references another user's ID | No change or false affected-row success. |
| NOTICE-04 | Read-all versus dismissed/resolved | Correct independent states; underlying invoice/order unchanged. |
| PUSH-01 | Device switches accounts/apps | Registration/consent/targets isolated; no prior recipient state or admin link. |
| PUSH-02 | Quiet hours cross midnight or start equals end | Documented academy-time semantics; inbox remains usable. |
| PUSH-03 | Missing keys/dead endpoint/retry lease/partial run | Honest delivery state and deduplication; no fake success. |
| PUSH-04 | Notice click after resource/grant revoked | Safe fallback/denial; notice grants no continuing access. |
| GRADE-01 | Own draft or assessed-but-unpublished candidate | No score/internal note returned. |
| GRADE-02 | Own published promoted result | Correct publication version and official belt link; no classmate/override fields. |
| GRADE-03 | Corrected/withdrawn publication | Safe version/certificate policy; no silently fabricated issuance. |

### 50.2 Work package revisions

| Existing package | Updated implementation scope |
| --- | --- |
| STU-01 Schema inventory | Include October 23/25 additions, mixed accounting, publication gaps, source comments versus verified deployment, and job/grant boundaries. |
| STU-04 Data adapters | Occurrences/rosters, invoices/receipts/credits, membership schedule/pause, makeup, notices, published results. |
| STU-05 Core reads | Prefer own dated sessions and posted invoices; retain labelled legacy history and schema-unavailable states. |
| STU-08 Readiness | Decide occurrence/makeup counting unit without changing official grading authority. |
| STU-12 Guardian access | New resources require per-child capabilities; owned-link union is not guardian access. |
| STU-13 Payments | Reuse invoices/receipts/allocations/credits; add verified provider state, not parallel accounting. |
| STU-14 Notifications/results | Persisted inbox/push with producer/app isolation; student result publication and any separate application workflow. |
| STU-16 Handover | Verify migrations, scheduler cadence/backlog, safe failure presentation, app-specific push routes, rollback. |

### 50.3 Contract precedence and compatibility checklist

Update the single student OpenAPI/DTO source so these coexistence rules are explicit:

- Shared staff/account routes remain reference implementations; the student backend keeps its scope/auth/response boundary.
- Recurring estimates and dated sessions are distinguishable and deduplicated; daily/class/occurrence marks are not mixed silently.
- Makeup history is read-only student evidence, not self-service attendance or an approved reservation.
- Posted invoices supersede current-fee guesses for issued obligations; legacy settlements retain their limitations.
- Staff allocations are not provider verification; credit use is not cash collected again.
- Pause dates, recorded membership state, account activation, and job freshness have separate meanings.
- Existing inbox/push records are reused; producers/apps own their targets/conditions, and notices do not grant access.
- Existing grading records remain authoritative; publication/application/certification are separate controlled lifecycles.

Current source objects in Sections 46–49 take precedence over earlier illustrative future table names. Proposed student extensions remain clearly identified and must not be presented as already deployed.

### 50.4 Revision 4.0 handover

This revision extends the student-only specification with source-backed contracts for membership, dated sessions, makeups, invoice/receipt/credit accounting, notifications/push, and grading. It retains the API/UI/security/PWA/testing plan and adds the current read surfaces, lifecycle rules, integration gaps, and release tests.

Document validation covers heading/anchor/table structure, fenced JSON and TypeScript syntax, and Git whitespace checks. It does not certify live migrations, account isolation, financial totals, notification delivery, background scheduling, or production readiness; those require the staged evidence specified above.

**Current status:** student specification updated to Revision 4.0 from repository/workspace inspection on 26 October 2026. This request edits the document only. Application implementation, database changes, deployment, and external messaging remain outside this documentation change.
