# Student portal data producer review

1 November 2026 · Infinity Taekwondo

This review compares the handoff with the admin source, the sibling student-portal source and read-only metadata/aggregate queries against the connected Infinity TKD database. It contains no student names, contact details, credentials or individual health results. The aggregate counts below are a pre-implementation snapshot; they are not a certification of every record or a live publication approval.

## Findings that affect the student experience

- The 39 integrated public resources checked exist, and every requested field in the checked contract set exists. All 133 declared public-schema foreign keys were validated. Declared FKs do not prove every business relationship or content field is correct.
- There are 86 student records and 86 current enrollments. One Student profile is explicitly linked; the aggregate check found no unlinked Student profiles, contradictory forward/reverse links or duplicate forward ownership claims. Most student records do not yet have their own Student login profile. Provision accounts through the existing secure account workflow; do not infer ownership from contacts.
- All 475 attendance marks are daily marks. There are no class-linked marks, dated occurrences or occurrence rosters. The student application can display recorded daily history and recurring estimates, but must not call those confirmed dated sessions. Start real occurrence generation/roster capture prospectively; do not manufacture historical attendance or session provenance.
- There are 194 legacy payment records and no posted membership invoices, issued receipts, allocations or credits. Legacy history is real history, but it is not evidence of an issued receipt or a reconciled invoice ledger. Do not mint receipt numbers or paid invoices from those labels merely to populate the portal.
- The rank catalog `belts` is empty. Student rank labels and promotion history exist, but the academy must supply its approved canonical catalog, aliases and Poom/Dan designations. This review did not seed a guessed rank catalog.
- The 81 library assets match the 81 curriculum records by ID and title. The established library transaction enforces this mirror and protects conflicting IDs; no new ID scheme is needed. However, its old mirror omitted lesson description/video/thumbnail. All 81 curriculum descriptions/media were empty; all 81 library video URLs were also empty. Fixing a mirror does not supply missing real media.
- The three recorded physical evaluations have evaluator IDs, but use legacy binary grade labels outside the agreed four-point scale. They require genuine coach review. No numeric score was inferred from those labels.
- There are no workout templates or training assignments. A catalog routine alone would not appear as an assigned student plan. A supported assignment producer has now been added to the admin code.

## Preparation checklist

All rows marked Present were verified through the public catalog. Required field names exist; FK validation was checked in the shared catalog. Detailed student-reader references are in the sibling `lib/student-data.ts`, `lib/student-scope.ts`, `lib/student-schedule.ts`, `lib/student-readiness.ts`, `lib/student-history.ts` and receipt/report modules. The sibling application was inspected read-only and was not edited.

| Resource / count | Contract and current admin owner | Student mapping / remaining work | Work category / approval |
| --- | --- | --- | --- |
| Managed auth / `profiles` (8 profiles, 1 Student) | Present; `profiles.id` references managed auth. Create/update account workflows and Manage Student account provisioning | Student resolver requires active Student role, explicit ownership and password-change completion; no contact matching | Data completion: provision approved accounts. Use genuine invitations/password recovery; no fabricated accounts |
| `students` (86) | Present; Directory/Manage Student; `/api/admin/create-student`, `/api/admin/update-student` | Official read-only profile in `readProfile`; membership/account status remain separate | Existing integration; staff correct real source records |
| `student_addresses` (86) | Present; same student edit transaction | Own profile selects primary address, then stable address ID | Existing integration; inspect address accuracy through staff workflow |
| `branches` (2) | Present; Schedule/branch management | Home branch and class labels | Existing integration; verify public contact content |
| `scholarships` (10) | Present; scholarship settings/student assignment | Own scholarship display; issued invoice snapshot stays authoritative | Existing integration; do not recalculate old posted charges |
| `academy_profile` (1) | Present; Settings/Academy Profile; `/api/admin/update-academy-profile` | Login switch and approved contact reader only | Data review: contact/media settings; unused settings are not automatic student features |
| `attendance` (475) | Present; Attendance and audited correction/save workflow | Daily/class/dated provenance is preserved by student reader; all current marks are daily | Existing integration plus prospective recording practice; no backdated evidence |
| `class_enrollments` (86) | Present; Schedule enrollment transaction | Own recurring timetable and current enrollment | Existing integration; preserve enrollment history |
| `class_sessions` (10) | Present; Schedule; `/api/admin/classes` | Recurring class labels/times and branch | Existing integration; recurring timetable is an estimate |
| `class_occurrences` (0) | Present; Operations → Dated classes; `/api/operations` | `student-schedule` confirmed sessions | Data completion: create actual dated sessions prospectively, with reviewed changes |
| `class_occurrence_roster` (0) | Present; same dated-session operation | Own saved roster identifies actual session access | Data completion: preserve roster provenance; no reliable historical range exists yet |
| `makeup_attendance` (0) | Present; Attendance makeup workflow; `/api/attendance/makeup` | Own recorded makeup history/void state | Existing recorded-makeup integration; student request/booking remains separate |
| `membership_pauses` (0) | Present; Operations → Invoices & pauses | Own approved pause context | Data completion only for genuinely approved pauses |
| `membership_invoices` (0) | Present; Operations billing-cycle posting | Student tuition projection | Data completion: post correct cycles/rate snapshots. No invented historical debt |
| `membership_receipts` (0) | Present; Operations → Invoices & pauses payment workflow | Own issued receipts and receipt PDF | Real verified receipt issuance required; a legacy Paid flag is insufficient |
| `membership_allocations` (0) | Present; same transactional receipt allocation | Receipt/invoice links; cross-student aggregate anomalies: 0 | Existing integration; verification has no populated allocation sample yet |
| `membership_credits` (0) | Present; controlled credit issue workflow | Own issued credit | Real authorized accounting action only |
| `membership_credit_uses` (0) | Present; controlled application to invoices | Student tuition balance; cross-student aggregate anomalies: 0 | Existing integration; do not double-count cash and credit |
| `payments` (194) | Present; Finance and legacy payment transaction APIs | Separate legacy payment history | Existing integration; preserve provenance and settlement links |
| `academy_operations_policy` (1) | Present; Operations policy/job-health settings | `late_grace_days` used by tuition reader | Existing integration; reminder lead time remains separate |
| `curriculum` (81) | Present; same-ID mirror from `/api/admin/library-assets` | `readLearning` reads active eligible curriculum IDs | Code fix prepared for future public text/media saves. Existing content needs academy review; media missing |
| `library_assets` (81) | Present; Library editor and guarded save RPC | Admin rich metadata; student reader does not consume it directly | Keep rich/internal JSON separate from allowed public projection |
| `belts` (0) | Present; catalog used by Directory/readiness/eligibility | Student canonical rank/order mapping | Academy-approved catalog data needed; no guessed backfill |
| `belt_techniques` (27) | Present; LMS syllabus editor | Exact skill/belt references | Data review: approved readiness skill list and labels must match |
| `lms_progress` (0) | Present; LMS grading; `/api/admin/library-assets/progress` | Recorded learning history | Do not present historical Completed rows as coach confirmation; use trusted confirmation workflow |
| `student_portal_progress` (0) | Present; student-owned progress transaction | Personal practice only | No admin seed or automatic official grade |
| `workout_templates` (0) | Present; Library → Routines | Catalog structure used only through assignments | Code validation/timer fix added; coaches supply genuine routines |
| `student_training_plans` (0) | Present; new Student Training Assignment panel and `/api/admin/student-training-plans` | `readPortalBootstrap` reads active own plans and normalizes saved steps | New authorized assignment workflow prepared; no live assignments seeded |
| `student_physical_evaluations` (3) | Present; LMS/Student physical grading | Readiness requires exact skills, real evaluators and current-policy dates | Academy review: legacy binary labels are not automatically converted |
| `student_body_compositions` (1) | Present; Student Biometrics; `/api/admin/body-compositions` | Own measurements | Existing integration; keep unknown values null and health information private |
| `muscles` (423) | Present; Library anatomy editor | Anatomy vocabulary, Khmer/Chinese names | Existing integration; descriptions/localization need approved authoring where absent |
| `library_asset_muscles` (324) | Present; guarded Library save transaction | Same-ID curriculum/library mirror preserves current lesson linkage | IDs align currently; protect the existing mirror rather than assuming arbitrary future catalogs match |
| `belt_histories` (48) | Present; Student belt history and Operations grading/promotion transaction | Own actual promotion journey/certificates | Existing integration; preserve missing/unknown historical details |
| `achievements` (55) | Present; Student Data achievement editor; `/api/admin/achievements` | Own private achievements | Optional competition-title link is handled by the calendar integration. Internal notes are not automatically student-safe |
| `products` (10) | Present; Inventory/POS product transaction APIs | Active, student-orderable catalog | Existing integration; review actual prices, photos and stock |
| `product_variants` (7) | Present; same POS transaction | Required sizes/colours and variant stock/prices | Existing integration; never bypass required variant selection |
| `pos_orders` (0) | Present; POS and `/api/shop/order`; `portal_place_order` | Own student-channel history and guarded pending cancellation | Existing pay-at-academy integration; no online settlement invented |
| `pos_order_items` (0) | Present; same server order transaction | Historical SKU/name/quantity/price snapshots | Existing integration; immutable financial provenance |
| `student_portal_preferences` (1) | Present; student preference API | Own theme/language | Student-owned presentation settings; do not seed staff overrides |
| `student_portal_events` (0) | Present; `student_portal_record_event` | Idempotent personal lesson/template/workout/stat events | Student-owned practice; not official coaching data |

Readiness policies, ranking publications and trusted coach confirmations are covered by the separate admin preparation implementation. They must remain unpublished/draft until real academy approval and required evidence exist. Public rankings require explicit consented entries; none were generated by this review.

## Implemented corrections

### Account ownership

`lib/student-ownership.ts` replaces the old union of forward/reverse student IDs. It accepts one consistent explicit relationship and rejects contradictory, duplicate, reassigned, deleted or ineligible links. A valid unlinked account returns no student scope. Paused/Inactive/Graduated training membership does not deactivate an otherwise eligible account. The calendar gateway additionally checks the academy-wide login switch. Query failures remain failures rather than empty authorized results.

### Library to student learning

`lib/library-student-projection.ts` extracts only authored `text` and validated HTTPS video/thumbnail links; arbitrary rich/staff metadata is excluded. The library API passes this server-derived projection to the existing guarded transaction and confirms the matching curriculum row was returned.

Migration `20261101033142_library_student_projection.sql` updates the existing transaction without changing its signature, IDs, actor checks or browser grants. Future supported saves synchronize the public text/media, retain existing inactive status, and protect personal practice/readiness references from deletion. Legacy replay payloads remain recognizable. No existing content is backfilled and no readiness/policy approval is inferred. The legacy category adapter still needs an approved mapping; this change does not guess new category semantics.

### Routines and assignment

`lib/workout-structure.ts` aligns supported routine limits with the actual student normalizer: 1–20 rounds, 1–50 named exercises, preparation ≤300 seconds, work 1–3600 seconds, rest ≤1800 seconds, and a total ≤12 hours. Empty exercise lists are rejected instead of filling invented exercises. Duration and the admin timer now count the full repeated sequence and omit the final rest.

Migration `20261101033150_student_training_assignment_workflow.sql` and the new staff API/panel add a deliberate assign/replace/withdraw operation. It rechecks permissions and the coach's current class scope in the transaction, snapshots the exercise structure, preserves prior assignments, protects assigned templates from deletion, and uses request keys plus expected-active-plan IDs for retries/concurrency. The private request table is service-only with RLS. Students do not write assignments. No live plan/template was created.

### Media and legacy grades

Google Drive image references now retain `resourcekey`, support valid individual file IDs, reject folder references and avoid spoofed Drive host parsing. Video preview links retain the key too. The image proxy carries a validated key only to its allowlisted Google targets and marks image responses private rather than shared-cacheable. This does not provide access to a Google-authenticated private file: genuine server access and real-file acceptance are still required.

Unknown/binary physical grades no longer count as completed numeric grading progress in the legacy admin readiness calculation. Their stored values remain unchanged for real coach review.

## Verified shared service dependencies

The live signatures match the student caller contract and remain executable by `service_role`, not `authenticated`, with empty search paths:

- `portal_take_rate_slot(p_key text, p_limit integer, p_seconds integer)`
- `student_portal_record_event(p_actor uuid, p_student text, p_request uuid, p_kind text, p_payload jsonb)`
- `portal_place_order(p_actor uuid, p_channel text, p_payload jsonb, p_request_key uuid)`
- `student_portal_cancel_pending_order(p_actor uuid, p_student text, p_order uuid, p_reason text)`
- `portal_set_video_progress(p_actor uuid, p_student text, p_asset integer, p_completed boolean)`

These were inspected read-only, not executed against live student records.

## Separate student application connection

The current sibling source already contains a server-only academy gateway. It requires `ACADEMY_PORTAL_CONTRACT_VERSION=calendar-v1` and `ACADEMY_PORTAL_API_ORIGIN` configured to the admin backend origin. Production requires HTTPS. It forwards the verified bearer, includes `X-Portal-Contract: calendar-v1`, bounds response sizes/timeouts, validates strict DTOs, and requires `data.subjectStudentId` to match its own independently resolved student.

A read-only check of the three relevant non-secret environment keys found the sibling `.env.local` Supabase URL points to the connected Infinity project. At the time of that check, the two academy gateway keys above were absent; `.env` was absent. No other environment values were emitted. Local gateway configuration is a separate integration step and may change after this snapshot.

Student calendar/inbox routes will only become available when the backend routes and DTOs are released and that origin/version configuration is installed. A shared database alone does not activate them. The student API deliberately returns unavailable otherwise.

Exact reader references include `lib/calendar-contract.ts`, `lib/student-calendar.ts`, `lib/student-notices.ts`, `lib/notification-contract.ts` and `lib/academy-portal-backend.ts`. The student notification GET/PATCH proxies `/api/portal/notifications`; preference GET/PATCH proxies `/api/portal/notifications/preferences`. No staff cookie, service key or guessed student ID should be supplied by the browser.

## Validation and remaining acceptance

Meaningful isolated tests cover strict student ownership; public lesson projection and protected history; supported routine timing/limits; assignment permission/concurrency/replay/history; and Drive key/cache handling. The SQL tests use fictional local fixtures only. Targeted lint passed for the reviewed producer/UI files; final full application checks belong to the combined release verification.

The six already installed student migrations have also been imported under their registered versions, with hash/source proof and an isolated schema/RLS test. See [shared migration reconciliation](SHARED_MIGRATION_RECONCILIATION_2026-11-01.md). These historical imports must not be replayed on live.

Still required: academy-approved catalog/content and genuine media; prospective dated sessions/rosters; real posted invoices/receipts when issued; genuine reassessment of legacy binary grades; readiness/ranking approval; actual student gateway configuration; and authenticated cross-application/physical-device acceptance. Credential rotation remains deferred at the owner's request. QR check-in, online settlement, public certificate verification, guardian access and student makeup-request workflows are not enabled by these producer changes.
