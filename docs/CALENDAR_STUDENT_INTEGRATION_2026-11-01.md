# Calendar and student portal integration

Release guide · 1 November 2026 · Infinity Taekwondo

Calendar & Events is implemented in the admin portal, and the shared database upgrades are installed. The separate student application now has the matching `calendar-v1` gateway configuration and reader fixes. The applications have not been publicly deployed; a signed-in acceptance run and production deployment checks remain necessary.

This guide describes the implemented release. The [calendar and notification review response](CALENDAR_NOTIFICATIONS_REVIEW_2026-11-01.md) records the final business rules, database relationships and response to the student team's implementation request. The [original design](design/ACADEMY_EVENTS_2026-11-01.md) and [student-team handoff](design/STUDENT_PORTAL_CALENDAR_HANDOFF.md) include broader design ideas; their proposed endpoints and future class-impact operations are not additional released features.

## What staff can use

Open **Calendar & Events** in the existing admin navigation. The workspace follows the portal's theme, shared controls, responsive shell and reduced-motion settings.

- Create holidays, competitions, workshops, maintenance notices, academy activities and informational class-change events.
- Browse the selected period in calendar or agenda form and open an event's details.
- Record all-day dates or timed occurrences, venue timezone, location, public description and separate internal notes.
- Target all eligible students, selected branches, classes, individual students, or staff only.
- Save private drafts, publish a revision, and review the exact public message and audience before announcing an eligible published revision to student inboxes.
- Upload protected PDF, JPEG, PNG or WebP files, or provide supported file links for publication checks. Each file is limited to 15 MB; publication verifies its actual content, size and fingerprint.
- Link a student's existing achievement to a published competition title, or retain a manually entered event name.
- Archive an event with a recorded reason while retaining its public history and existing achievement links.

There is one student-facing experience. This release adds no Parent mode, calendar achievement editor, event results engine or standalone announcement board. Competition registration, event fees, certificates, arbitrary message broadcasts and automatic notices from every admin edit are outside this release.

## Save, publish and notify

| Action | Result |
| --- | --- |
| Save draft | Saves staff changes privately. The previous published revision remains visible to its authorized students. No notice is sent. |
| Publish | Makes the reviewed public snapshot available to its audience. Internal notes and staff-only source fields are excluded. Publication alone sends no notice. |
| Publish with Notify students | Publishes the reviewed snapshot and creates eligible student inbox notices in the same transaction. Opt-in starts unchecked. |
| Notify students | Reviews the exact public title/body and audience, then confirms against the current published revision. Recipient and revision deduplication prevents repeat clicks from creating duplicate notices. |
| Archive event | Withdraws student calendar, detail, file and inbox access. Records administrator, time and reason while retaining the event, approved revisions, notification evidence and existing achievements. |

The notice action reports the inbox notices created. It does not prove that a device received a push alert or that a student read the message. Read state is recorded separately. A revision with no eligible linked student accounts can produce zero notices.

Inbox `deliveredAt` records the durable inbox commit, separately from push-provider outcomes and `readAt`. Read/dismiss retries preserve their first timestamps. Request receipts, public history and recipient/revision deduplication currently have no automatic expiry or purge. A new announcement to the same recipient uses a newly reviewed public revision; there is no force-resend operation that resets existing read/dismiss state.

Changed dates keep the event identity and previous date context. Cancellation and postponement require a reason. New or changed competition links resolve the title on the server, reject an achievement dated before the competition starts, and preserve the saved title on ordinary later edits. Manual entry uses a null event link and does not create a calendar event. Publishing a non-competition type is blocked while achievements still reference that competition.

Calendar information does not cancel classes, change attendance, create makeup obligations, waive tuition or pause memberships. Use **Operations → Dated classes** and the existing reviewed holiday/reschedule workflows for actual timetable changes. Existing student schedule readers continue to handle confirmed sessions separately from recurring estimates.

## Permissions and data boundaries

Staff need `page:calendar` to open the workspace. Create, edit, publish and announce actions have separate permissions. Non-administrative staff can change only their own events when their action permissions allow it; the API and database transaction recheck those rules. Archive additionally requires Root, Super Root or Admin role and publishing authority. Student selection also respects the directory lookup permission.

The student server forwards a verified Student bearer token and `X-Portal-Contract: calendar-v1`. The admin backend resolves the account's explicit student ownership, checks the academy login switch and applies the current event audience. Contradictory or duplicate account links fail closed. A student ID supplied by a browser does not select another student's scope.

Class audiences use current enrollments effective as of the academy date, taking `enrollment_date` or the academy date of `enrolled_at`. Branch audiences use the home branch or an effective current class branch. Future enrollments do not grant access early; historical occurrence rosters do not preserve event access after enrollment ends. Staff can explicitly target individual alumni when intended. Archive and current audience/account changes are rechecked on student reads, inbox actions, protected files and device delivery claims.

Student responses contain public fields only. Drafts, internal notes, audience member lists, raw file URLs and other students' records are excluded. Opening an attachment checks access again and compares it with the approved publication fingerprint. If an external file changes, staff must review and republish it.

The `academy-events` bucket is private and configured for the supported file types and 15 MB limit. The live storage review found no browser policies on `storage.objects`; this release uses authorized server routes for event files. Event tables, request records and privileged functions are not available to anonymous or authenticated browser roles. These controls do not depend on hiding interface buttons.

## Database release

The seven migrations below were applied to the connected Infinity TKD project. Local filenames now match the versions actually registered in Supabase; [the release manifest](../supabase/calendar-release-migrations.json) records that alignment.

| Registered migration | Purpose |
| --- | --- |
| `20261101030518_student_portal_admin_preparation.sql` | Admin preparation for student readiness, ranking and trusted coaching workflows |
| `20261101030526_academy_calendar_and_student_notices.sql` | Private drafts, public snapshots, revision history, audience checks and student inbox contract |
| `20261101033142_library_student_projection.sql` | Public learning text/media projection through the established same-ID library transaction |
| `20261101033150_student_training_assignment_workflow.sql` | Authorized routine assignment, replacement, withdrawal and preserved history |
| `20261101033250_academy_event_achievement_links.sql` | Optional competition links and protected historical achievement titles |
| `20261101042452_calendar_archive_and_inbox_reliability.sql` | Audited archive, effective audience, idempotent dismiss, immutable notice/revision snapshots, complete source metadata and revision FK |
| `20261101042503_calendar_delivery_candidates_and_relations.sql` | Oldest eligible push candidates, dispatch-time access checks, five relationship indexes and duplicate-index removal |

Live verification found all 144 foreign keys validated, browser access denied for calendar sources and privileged RPCs, immutable history/notice triggers active, and the push claim function using invoker privileges. Event and event-notice counts remain zero; no live test announcement was sent. Remaining performance advisories are unused-index information, so the indexes were retained. Existing Auth/extension advisories and their official guidance are recorded in the [review response](CALENDAR_NOTIFICATIONS_REVIEW_2026-11-01.md#existing-security-advisories).

The six historical student migrations were reconciled under their existing registered versions, without replaying them. See [shared migration reconciliation](SHARED_MIGRATION_RECONCILIATION_2026-11-01.md). The schema work created no event announcements, training assignments, student accounts, rankings, coach confirmations, payment records or fabricated historical data.

Do not rerun these installed upgrades or use a blanket database push to resolve an older history discrepancy. For another environment, compare its registered history, rehearse only missing upgrades over the established academy schema, and preserve the documented dependency order. This repository remains an upgrade repository; its test fixtures are not a complete empty-database installer.

To check the imported migration files locally:

```sh
node scripts/check-shared-student-migrations.mjs
```

For a new approved environment, `node scripts/ensure-event-storage.mjs` creates the missing private event bucket or checks the existing bucket's privacy. Review existing Storage policies separately; creating a private bucket does not remove unrelated browser policies.

## Connect the separate student application

Both applications must use the intended shared Supabase project. The student gateway settings are server-only; they do not belong in a browser bundle.

The sibling student application's local configuration now contains:

```dotenv
ACADEMY_PORTAL_API_ORIGIN=http://127.0.0.1:3000
ACADEMY_PORTAL_CONTRACT_VERSION=calendar-v1
```

Start the admin backend on port 3000. From the admin repository, use the existing development command, or serve the completed production build:

```sh
npm run start -- --hostname 127.0.0.1 --port 3000
```

From the separate student repository, start or restart its development server on port 3001:

```sh
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Open the student application at `http://127.0.0.1:3001`. Its server reaches the admin backend at the configured `http://127.0.0.1:3000` origin. This local handoff handles admin startup only; start or restart the student application separately so it reads the new environment settings.

The sibling reader now accepts the gateway's subject/version metadata before applying its strict payload schema. Assigned routines use their saved title and difficulty snapshots and calculate duration from the assigned preparation, rounds, work and rest, rather than a later edited template.

For production, replace the local origin with the deployed admin **HTTPS** origin. The student server must be able to reach it. Keep authentication forwarding on the server; do not substitute staff cookies, a browser-selected student ID or a browser-visible service key.

The released backend routes are:

| Route | Use |
| --- | --- |
| `GET /api/admin/events` / `POST /api/admin/events` | Staff period lookup / create draft |
| `GET` / `PATCH /api/admin/events/:id` | Staff detail / save draft |
| `POST /api/admin/events/:id/publications` | Publish an expected revision, optionally with notification |
| `POST /api/admin/events/:id/notices` | Announce the published revision |
| `POST /api/admin/events/:id/archive` | Withdraw an expected revision with an administrator's recorded reason |
| `POST /api/admin/events/:id/files` | Upload an authorized event file |
| `GET /api/admin/events/competitions` | Competition picker for existing achievement entry |
| `GET /api/portal/calendar?from=&to=&cursor=` | Published, authorized event page for the verified student |
| `GET /api/portal/events/:id` | Public event detail |
| `GET /api/portal/events/:id/files/:fileId` | Authorized, publication-verified file |
| `GET` / `PATCH /api/portal/notifications` | Student inbox and read/dismiss actions |
| `GET` / `PATCH /api/portal/notifications/preferences` | Event preferences and quiet hours |
| `GET /api/portal/notifications/push` | Device-alert availability and public subscription key |
| `POST` / `DELETE /api/portal/notifications/push/subscribe` | Register or remove the verified account's subscription |

Calendar periods are half-open (`from` inclusive, `to` exclusive), limited to 93 days, with pages of 50. Cursors are signed and tied to account, student and period. The admin form records inclusive all-day end dates; the student projection converts them to the exclusive `calendar-v1` end date. Keep date-only values as dates rather than converting them through the device timezone. The default academy timezone is `Asia/Phnom_Penh`.

Invalid, expired or wrong-scope cursors return HTTP 409 so the client can reload the period. Authentication denials and other adapter errors retain private/no-store cache headers; signed-out requests do not redirect to an admin login page.

The gateway returns the standard success/error envelope with `contractVersion` and `subjectStudentId`; the student server validates the subject independently. The current student contract maps academy events to `activity`, postponement to its cancellation/change presentation, and completed events to its supported scheduled representation. Public coordinator contacts and extra public notes are currently null. Do not infer unimplemented fields or call the old proposed generic announcement endpoint from the design handoff.

## Inbox and optional device alerts

Student inbox notices work independently of device push. This release leaves student push disabled by default:

```dotenv
STUDENT_PORTAL_PUSH_ENABLED=false
```

Enabling device alerts requires an explicit server flag, configured `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY` and `WEB_PUSH_SUBJECT`, the existing notification worker/job setup, and the student's permission and subscription on a supported device. Reuse the same deployed key pair. Validate the separate student application's service worker, foreground/background behaviour, quiet hours and platform installation requirements before enabling this in production. Responsive browser checks do not prove physical-device push delivery.

The worker selects oldest eligible work per owned subscription rather than a capped inbox page, and rechecks ownership, account/source access, consent, mute and academy quiet hours when claiming a delivery. Push considers the last 48 hours; older inbox records remain readable. Quiet-hour work is deferred to a later run within that window. Claims use a two-minute lease, transient failures retry after 30 minutes, and attempts stop at five. Stale provider subscriptions are removed after HTTP 404/410.

`PORTAL_CURSOR_SECRET` is optional. A separate value must be a stable, random server secret of at least 32 characters. If omitted, the existing server credential is used as the cursor-signing fallback. Never give either signing value a `NEXT_PUBLIC_` prefix.

## Real data that still needs academy work

The [data producer review](STUDENT_PORTAL_DATA_AUDIT_2026-11-01.md) contains the full resource checklist. Its pre-installation snapshot found:

| Area | Recorded state and next step |
| --- | --- |
| Student accounts | 86 student records but one explicitly linked Student profile. Provision real approved accounts through the secure account workflow. |
| Attendance and sessions | 475 daily marks, with no dated occurrences or saved occurrence rosters. Generate real upcoming sessions and record their attendance prospectively. |
| Finance | 194 legacy payments; no posted invoices, issued receipts, allocations or credits. Preserve legacy provenance and create accounting documents only through genuine authorized transactions. |
| Learning content | 81 matching library/curriculum IDs; student lesson descriptions/media were empty, and library video URLs were absent. Supported future saves project approved public content; no media or approval was invented or backfilled. |
| Rank and assessment data | Empty canonical belt catalog and three legacy binary physical grades. Supply the academy-approved catalog and genuine coach assessments; no numeric conversion or public ranking is inferred. |
| Training | No templates or assignments at review time. Coaches can now create real routines and deliberately assign them; assignment replacement preserves history. |

Readiness policies, coach confirmations and ranking publications require real academy evidence and approval. Draft/unpublished preparation stays private. An empty student section can be a truthful reflection of missing source records; it should not be filled with sample business data.

## Verification and release acceptance

`npm run check` passed: 231 tests, zero failures and zero skipped tests, with zero lint warnings and a successful TypeScript check. The final production build succeeded on Next.js 15.5.28. A real production server returned HTTP 200 for `/`; signed-out admin list/archive and student calendar/inbox requests returned 401 with private, no-store responses and no private data.

The tests cover validation, ownership, permission denial, public projections, stale revisions, transactional rollback, idempotent retry, protected attachments, archive withdrawal, effective enrollment, push backlog/rechecks, assignment history and migration dependency order. Database tests use isolated fictional fixtures. The sibling's actual strict gateway compatibility test passed, including rejection of the wrong subject, wrong contract version and extra fields. Its eight existing native assignment/compatibility tests also passed. Actual-handler/PostgreSQL assertions confirm that default-message and change-reason previews match committed notices.

The admin calendar browser flow passed at phone, tablet and desktop widths with zero JavaScript errors, including notification review, retries, archive and class-change states. Actual student components passed 447 state checks in each of Chromium and WebKit: 36 combinations per engine across six viewports, two themes and English/Khmer/Chinese, with zero failures, JavaScript errors or unexpected network requests. The student team's offline checker accepted all 11 fictional examples with no live calls.

Auth identity responses and protected-file/network providers are mocked in local flow/browser tests. These checks do not establish a completed real-account flow or physical-device push/performance certification. No genuine signed-in student-to-admin acceptance flow was exercised.

Before public deployment, complete an authenticated acceptance run with approved real accounts: create and save a draft, confirm student invisibility, publish to a restricted audience, check another account is denied, notify once and retry, read/dismiss the inbox item, open a genuine protected file, and verify a renamed template does not change an existing assignment's steps or labels. Use approved release-test records and do not alter historical student evidence to exercise these paths.

Finish the production HTTPS origin, server environment, database readiness, scheduled-job monitoring, backup/recovery and deployment checks in [Production readiness](../PRODUCTION_READINESS.md). Validate device alerts separately if they will be enabled. Schema installation and passing local checks are preparation for that acceptance, not a guarantee that every real record, device or production deployment has been exercised.
