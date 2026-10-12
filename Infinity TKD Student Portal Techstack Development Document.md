# Infinity TKD Student Portal — Technical Development & Techstack Specification

**Revision:** 2.0 — repository-verified student specification
**Reviewed:** 10 October 2026, Asia/Bangkok
**Reference baseline:** admin portal commit `f4fe973`; additional uncommitted workspace changes reviewed separately in Section 1.5
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

For implementation, read Sections 2–8 for the verified baseline, Sections 9–20 for student contracts and behavior, Sections 21–25 for architecture and quality, Sections 26–31 for future modules, and Sections 32–37 for migration, delivery, and acceptance.

### 1.5 Newer working-tree implementation observed on 10 October

The admin repository changed while this review was in progress. The October migration files and related code below were **uncommitted in the reviewed workspace**; their presence does not prove that the migrations ran or that a deployed database has these policies. Sections 3, 8, 12, 13, 18, and 27 distinguish the earlier baseline defect from a newer proposed repair. Before implementing the student app, compare the final committed migrations with the live schema and repeat access tests.

| Area | New source observed | Student consequence |
| --- | --- | --- |
| Staff sign-in | `app/api/auth/login/route.ts` now performs internal identifier/password sign-in with a database rate slot and explicitly rejects Student roles; `app/api/auth/username-to-email/route.ts` returns HTTP 410. | Build a separate student sign-in path; do not reuse the staff login. Confirm old email lookup RPC grants are revoked in the deployed database. |
| Authorization | `supabase/migrations/20261009090000_portal_security_and_transactions.sql` replaces many earlier permissive policies, restricts profile writes, uses live profile state in helpers, and revokes older RPC overload grants. | Treat the earlier exposures as historical baseline findings pending migration verification; inspect every effective policy, grant, and table/view column exposure after applying this migration. |
| Orders | The shop handler now requires `requestKey` and calls `portal_place_order` without its former separate-insert fallback; the October migration adds server pricing, transactional reservation, and idempotency. | The former order mismatch/fallback is repaired in source. Do not enable student checkout until the migration, actor authorization, response projection, and concurrency/replay tests pass in staging. |
| Attendance | An October migration adds nullable `attendance.class_id` and a unique occurrence key; older daily rows retain `class_id = NULL`. | Support mixed daily/class-linked history. A class ID alone still does not prove actual check-in or check-out timestamps. |
| Billing and households | `lib/billing.ts`, `lib/dates.ts`, admin household endpoints, and October migrations add configurable fees, a Phnom Penh calendar, persisted household rows, and transaction receipts. | Read the newer contracts, but keep guardian login/grants, provider settlement, and student-facing receipt authorization as separate deliverables. |
| Client/PWA | The admin store now fetches full tables through pagination and removes legacy personal cache keys; the worker source excludes private API/navigation caching. | The student application still needs its own scoped queries and separate PWA identity. Retest the final built worker, not only its source. |

## 2. Admin system integration map

| Reference area | Source files | Student integration |
| --- | --- | --- |
| Student identities/records | `lib/store.tsx`; `app/api/admin/create-student/route.ts`; `app/api/admin/create-user/route.ts`; `app/api/admin/update-student/route.ts` | Resolve a verified athlete and project approved fields. |
| Authorization | `lib/backend-security.ts`; `lib/security.ts`; `lib/permissions.ts`; `middleware.ts`; security migrations | Identity, live account eligibility, ownership, operation permission. |
| Dashboard/dossier | `components/DashboardView.tsx`; `components/StudentDossierModal.tsx`; `components/ManageStudentPanel.tsx` | Reuse pure presentation concepts in a separate student shell. |
| Timetable/enrollment | `components/ScheduleView.tsx`; `app/api/admin/classes/route.ts`; enrollment store actions | Own enrolled schedule and safe branch/coach labels. |
| Attendance | `components/AttendanceView.tsx`; attendance store actions | Own daily history, never attendance writes. |
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
| Assigned plans | Table referenced by RLS enablement | Schema, policies, assignment flow unverified. |
| Anatomy | Components and local models | Adaptable reference. |
| Student order GET/POST | `app/api/shop/order/route.ts` | Blocked for student release. |
| Guardian switching | New admin household persistence; no verified guardian account grants | Student guardian authorization and switching proposed. |
| Verified ABA/KHQR settlement | Method labels, UI concepts, QR-related columns | Provider transaction/webhook not implemented here. |
| Push/inbox, rotating pass, wallet | No persisted student implementation found | Proposed. |
| Exams/public certificate resolver | No matching implementation found | Proposed. |
| Camera pose analysis | No MediaPipe implementation/dependency found | Optional future feature. |

## 3. Findings affecting student development

Findings below record the initial `f4fe973` baseline. Several have source-level repairs in the newer uncommitted working tree (Section 1.5); their deployed status remains unverified. Use the final migration and staging test result to close each finding, rather than treating this table as a statement that the newer code still contains the old behavior.

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
| SP-23 | P1 | Complete base schema absent; migrations share date-only version prefixes. | Canonical schema and reconciled unique migration history. |
| SP-24 | P2 | Addresses use `district_commune/state_province_city`; branches use `branch_name`. | Generated types and adapters, not old guessed DDL. |
| SP-25 | P2 | Baseline local dates/UTC slicing appeared in billing/attendance; newer `lib/dates.ts` uses `Asia/Phnom_Penh`, but an academy-configurable timezone field remains unverified. | Agree academy timezone and test date-only arithmetic across all student views. |
| SP-26 | P2 | Academy defaults have placeholder contacts; portal-enabled flag is mapped without student enforcement route. | Verified academy values and server gate. |

P0 blocks release of the affected capability. P1 requires integration/reliability correction. P2 requires correctness/presentation follow-up. This is a student delivery review, not certification of the admin portal’s entire production security posture.

## 4. Techstack baseline

### 4.1 Exact reference versions

| Package | Declared reference | Lockfile resolution | Purpose |
| --- | --- | --- | --- |
| Next.js | `^15.4.9` | `15.5.27` | App Router, layouts, route handlers. |
| React/DOM | `^19.2.1` | `19.2.6` | Student UI. |
| TypeScript | `5.9.3` | `5.9.3` | Strict contracts. |
| Tailwind | `4.1.11` | `4.1.11` | Tokens/responsiveness. |
| Supabase JS | `^2.106.2` | `2.106.2` | Auth/data/realtime. |
| Serwist Next | `^9.5.12` | `9.5.12` | PWA build. |
| Motion | `^12.23.24` | `12.40.0` | Optional accessible transitions. |
| Zod | `^4.6.1` | `4.6.1` | Input/metadata validation. |
| Phosphor | `^2.1.10` | `2.1.10` | Primary icon family. |
| Three | `^0.184.0` | `0.184.0` | Optional anatomy rendering. |
| R3F/Drei | `^9.6.1/^10.7.7` | `9.6.1/10.7.7` | Optional anatomy UI. |
| ESLint/Next ESLint config | `9.39.1/16.0.8` | Same | Validate framework/config compatibility. |

Ranges are not installed versions. This table is a repository baseline, not a recommendation to retain an unreviewed version forever. Select supported compatible releases, review official security advisories at implementation time, and commit the tested lockfile.

The newer uncommitted `package.json` changes declared Next.js to `^15.5.27`, Supabase JS to `^2.117.3`, and Serwist Next to `^9.5.13`, and adds direct test tooling and `typecheck`/`test`/`check` scripts. Resolve the final lockfile and CI result before pinning student dependencies; the baseline resolutions above do not describe that newer package manifest.

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

These are proposed defaults. Return server capabilities; do not scatter status rules in UI. `pause_end_date` does not establish an automatic reactivation job.

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
| students contact | `email, phone, emergency_contact_name, emergency_contact_phone, emergency_contact_relation` | Detail view only; no push/telemetry payload. |
| students membership | `current_belt, scholarship_id, home_branch_id, student_status, status_reason, status_changed_at, pause_end_date` | Approved status reason wording only. |
| students sensitive | `height_cm, weight_kg, medical_notes, allergies, profile_picture_path, esign_path, kukkiwon_id, notes` | Health authorization; omit internal notes/raw signature path by default. |
| student_addresses | `address_id, student_id, address_line1, address_line2, district_commune, state_province_city, postal_code, country, is_primary` | Own address; deterministic primary selection. |

Current Student types say Male/Female while create/update validation accepts Other. Generate database types and use a tolerant display contract; neither proves the SQL check constraint.

Earlier document fields such as `belt_id` and named avatar/signature buckets are not established by these mapped contracts. The newer October migrations query and update `students.deleted_at`, providing migration evidence for an archive field; verify its type and effective deployment before relying on it.

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
| attendance | Baseline `id, student_id, date, status, marked_by` conflicted on `student_id,date`; October migration adds nullable `class_id` and `(student_id,date,class_id)` uniqueness | Mixed legacy daily and newer class-linked records; no verified check-in/check-out timestamp or duration. |
| payments | `id, student_id, year, for_month, status, amount_usd`; conflict `student_id,year,for_month` | Monthly ledger; October migrations add staff-recorded transaction/receipt evidence, not payment-provider settlement. |

Attendance states: Present/Absent/Late. Baseline tuition states were Paid/Unpaid/Pending; October code also writes `Waived`. Verify the final database constraint and generated types. Keep tuition states separate from uppercase shop states.

The October migrations define `payment_transactions` with staff-recorded method, amount, date, request key, and receipt number. Verify the applied schema and student row/column access before exposing receipts; partial payments, adjustments, and provider settlement remain separate contracts.

### 8.5 Learning and training

| Table | Query evidence | Meaning |
| --- | --- | --- |
| library_assets | `id, title, description, library_type, tkd_category, fitness_category, target_level, video_url, created_at` | Primary admin content; JSON may be encoded in description. |
| curriculum | Writer supplies `id, title, target_belt, category, is_active` | Progress target/mirror; mapping unverified. |
| lms_progress | `id, student_id, curriculum_id, status, last_watched_at` | Started/Completed tracking. Rich watch metrics are proposed. |
| workout_templates | `id, title, description, difficulty, duration_mins, creator_name, structure` | Routine reference. |
| student_training_plans | RLS migrations reference the table and October policy changes | Assignment schema/policies/workflow still require final-schema verification. |
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
  | 'Active' | 'Paused' | 'Inactive' | 'Suspended' | 'Graduated';

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

interface DailyAttendance {
  id: RecordId;
  studentId: StudentId;
  date: DateOnly;
  status: 'Present' | 'Absent' | 'Late';
}

interface TuitionLedgerEntry {
  id: RecordId;
  studentId: StudentId;
  year: number;
  month: string; // Adapter validates the legacy month label.
  status: 'Paid' | 'Unpaid' | 'Pending';
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
| `/dashboard` | Personal home | Core. |
| `/profile` | Official personal record | Core. |
| `/schedule` | Enrolled timetable | Core. |
| `/attendance` | Daily attendance history | Core. |
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
| `/shop/orders` | Own order history | Feature-gated. |
| `/shop/orders/[id]` | Own order status/details | Feature-gated. |
| `/settings` | Language/theme/audio/security | Core. |
| `/notifications` | Personal inbox | Future. |
| `/digital-pass` | Online rotating pass | Future. |
| `/exams` | Eligible exam opportunities | Future. |
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

Recurring schedules do not prove individual occurrences, holiday closures, cancellations, or room bookings. Display “Weekly schedule” until an occurrence model exists.

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

This is a weekly timetable estimate. Cancellation/holiday support requires a proposed occurrence/exception model.

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

A schedule-based rate requires reliable occurrences, holidays, enrollment changes, closures, pause intervals, and class-level marks. The baseline daily key could not represent multiple classes on the same day. The October migration adds `attendance.class_id` and a class-aware unique key, but legacy rows remain daily and scheduled occurrences/exceptions are still unverified. Do not mix these record types in a rate without a defined denominator and migration policy.

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

That helper did not itself apply membership pause/inactive exemption. Some finance views filtered Active students separately. The newer `lib/billing.ts` replaces the calculation with academy-calendar dates, configurable early/standard fees, a configurable upcoming window, and a scan for earlier unpaid cycles. It does not by itself establish invoice issuance, proration, provider verification, or a complete pause/overdue-grace policy. Compare the final helper and payment transaction migration with academy policy before exposing a student balance.

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
| Pending/partial/refunded settlement | Requires transaction/allocation modeling, not status toggling alone. |

Proposed summary:

~~~text
policyVersion, calculatedAt, timeZone,
cycleStart, cycleEnd, dueDate, overdueAfter,
status: current | due_soon | overdue | exempt | paused | unknown,
postedAmount, settledAmount, remainingAmount,
nextRenewalDate, explanationCodes[]
~~~

Fields unsupported by current persistence remain null/unknown until implemented. Do not pretend the monthly ledger already contains a complete invoice balance.

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

Reference content is fetched from `library_assets`; progress uses `lms_progress.curriculum_id`. Current admin completion writes a curriculum row first, using the asset’s numeric ID and simplified metadata.

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

Proposed playback fields such as position, watched duration, completion timestamp, attempts, repetitions, and movement FPS require additive migrations and a reliable capture definition. Never fill them with guessed data.

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
| GET /api/student/attendance | Daily history + labeled summary | Bounded dates/cursor. |
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
{ "status": "Completed", "clientMutationId": "a-unique-uuid" }
~~~

Server resolves asset-to-curriculum mapping, writes the authorized student’s progress, and returns persisted status/timestamp. No client-controlled student ownership, curriculum metadata, or coach grade.

Order request:

~~~json
{
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

The reference registers `public/sw.js`; its source is root `sw.ts`. Compilation is conditional on `BUILD_PWA_SW=true`. It is not automatically `app/sw.ts`, and an existing generated file may represent a different build.

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

Every object below is **proposed** unless Section 8 identifies existing evidence. Exact names/types must be finalized against the canonical schema. Do not create parallel replacements for existing student/payment/content tables.

### 26.1 Extension registry

| Extension | Minimum fields/constraints | Purpose/dependency |
| --- | --- | --- |
| `student_access_grants` | UUID id; account_id UUID -> profiles; student_id compatible -> students; relationship; explicit capabilities; approved_by/at; valid_from; expires_at; revoked_at; audit timestamps | Verified guardian/multi-athlete access. |
| `student_preferences` | account_id PK; language/theme/audio; updated_at | Optional account-synced preferences; no role/link columns. |
| `curriculum.library_asset_id` or canonical mapping table | Unique verified asset reference; curriculum reference; migration/backfill evidence | Repair library/progress bridge. |
| `workout_completions` | Student/template/plan/version; UUID session/idempotency; timestamps; self-reported results/status | Persist training history separately from coach grades. |
| Provider payment intents/events | Provider/idempotency/reference; student; amount/currency; verified event IDs/timestamps; allocation state | Future verified provider payments. Existing October `payment_transactions` records staff-entered settlement and receipts, not provider webhook evidence. |
| `payment_allocations` | Transaction -> authoritative invoice/cycle/ledger obligation; allocated amount; uniqueness/total checks | Keep settlement and monthly ledger synchronized. |
| `push_subscriptions` | Account/device; unique endpoint or digest; keys; revoked/last-success timestamps | Opt-in push delivery. |
| `student_notifications` | Recipient account/student scope; event/type; safe text/deep link; created/read timestamps; dedup key | Personal inbox, independent of push success. |
| `exam_cohorts` | Branch/date/level/capacity/window/fee; publication; policy version | Future examination opportunities. |
| `exam_registrations` | Student/cohort unique; state; eligibility snapshot; approvals; payment reference | Application/approval lifecycle. |
| `issued_certificates` | Student/promotion; unique serial; issued snapshot; opaque verification token; issuer; revoked_at; file ref | Verifiable issued document. |
| `checkin_pass_nonces` or replay ledger | Hashed nonce/token ID; audience; student/class occurrence; expiry/consumed timestamp | Future online rotating pass. |
| `class_occurrences` / schedule exceptions | Class/date/start/end/timezone; cancellation/override; stable occurrence identity | Per-session timetable/attendance analytics. |
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

**Proposed:** durable in-app inbox first, optional push as an additional delivery channel.

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

Future APIs: `GET /api/student/notifications`, `PATCH /api/student/notifications/[id]/read`, `POST/DELETE /api/student/push-subscriptions`.

Deep links are internal allowlisted routes and still require live authorization. Delivery failure does not erase the durable inbox event.

## 31. Exams, certificates, and optional pose analysis

### 31.1 Examination registration

**Proposed dependencies:** published cohorts, registration windows, capacity, fees, reliable readiness inputs, and coach approval.

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

The reference checkout has incremental migrations but no complete executable base schema. Date-only prefixes are duplicated: two files begin 20260914 and five begin 20260928. Helpers/RPCs are redefined with differing types, policies, and behavior. Newer October migrations use unique timestamp-style names and attempt to reconcile policies and RPCs, but do not establish the starting schema or prove the applied migration order.

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
    development/page.tsx
    belt-journey/page.tsx
    awards/page.tsx
    settings/page.tsx
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
  student/dto.ts
  student/adapters.ts
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

The reference uses `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and server `APP_URL`. Select/document one naming scheme in the student project; do not copy real .env values into this file.

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

Deliver separate student project, server auth/scope guard, login/recovery, navigation, dashboard, profile, schedule, daily attendance, tuition ledger, belt journey, awards, language/theme, and error states.

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
- Newer uncommitted `supabase/migrations/20261009090000_portal_security_and_transactions.sql`, `20261009090100_portal_catalog_and_households.sql`, `20261009090200_portal_billing_attendance_and_rbac.sql`, `20261009090300_portal_account_integrity.sql`, `20261009090400_portal_settlement_validation.sql`, and `20261010090000_portal_workflow_integrity.sql`.
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
| Initial attendance | Daily recorded status | Per-session feature requires migration. |
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
