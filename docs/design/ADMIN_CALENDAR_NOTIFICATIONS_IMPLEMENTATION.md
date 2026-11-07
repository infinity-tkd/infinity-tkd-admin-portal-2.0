# Admin implementation handoff: calendar and student notifications

Infinity TKD · 1 November 2026 · contract `calendar-v1` · prepared for admin review

Admin review status · 1 November 2026: all seven integration upgrades are installed, including archive, inbox retry, effective-audience and push-queue fixes. The full admin check passed 231 tests; notification review, archive and student display fixtures passed desktop/mobile checks in Chromium and WebKit. The [admin review response](../CALENDAR_NOTIFICATIONS_REVIEW_2026-11-01.md) and [release guide](../CALENDAR_STUDENT_INTEGRATION_2026-11-01.md) record the exact evidence and remaining genuine-account/physical-device acceptance. The requirements below are preserved as the student team's original handoff. This document is not approval to publish a particular event or notify recipients.

Original handoff status, retained for context:

> The student calendar, event dialog, inbox, preferences and optional push client are implemented. Real academy events and notices remain disconnected because the admin publication and student-safe delivery adapters have not been released. The student portal already reads its own actual dated classes independently.

Use this with the student repository's exact consumer contract at `docs/design/STUDENT_PORTAL_CALENDAR_API_CONTRACT.md`, the [original requirements](STUDENT_PORTAL_CALENDAR_HANDOFF.md), its fictional HTTP examples at `docs/design/calendar-admin-kit/responses.json`, and the [all-student-data handoff](../admin-portal-data-handoff-2026-11-01.md). The consumer contract and JSON examples belong to the separate student checkout; they are not missing admin runtime files. The original prototype routes are design suggestions; the `calendar-v1` consumer routes below are the current integration target.

## Copy into the admin portal work queue

1. **Event publishing:** implement authorized draft, publish, public revision, reschedule, cancellation and archive workflows. Support holiday, competition, workshop, maintenance, activity and approved class-change categories. Keep event UUIDs stable; require a public cancellation explanation. Drafts/staff notes never enter student responses.
2. **Audience:** resolve the signed-in active Student from a verified bearer and trusted profile/student link. Apply effective academy/branch/class/student targeting on every feed, detail, file and notice operation and again at dispatch. Return only this student's approved records. Category selection and client student IDs are never permission checks.
3. **Student API adapters:** implement the seven paths / ten HTTP operations below with the exact `calendar-v1` envelope, bounded pages and private/no-store responses. Reuse existing notification services; do not expose the staff inbox API directly.
4. **Protected media:** bind approved pictures/documents to the published event. Serve authorized bytes through the file adapter, including private Google Drive integration where needed. Do not expose private Drive links, credentials or storage paths.
5. **Notify students:** attach an explicit action to a saved published revision. Preview the authorized audience and approved public message. Save-only sends nothing; the publication checkbox starts unchecked. Transactionally save an idempotent intent/outbox/audit, then fan out with audience rechecks and recipient deduplication. Keep queue/delivery/failure/read states separate.
6. **Existing inbox/preferences:** preserve immutable public message snapshots; implement this student's read, mark-all and dismiss actions and authorized unread total. Merge the `events` preference category without overwriting staff settings. Quiet hours use academy time; muted alerts must not remove published events or inbox records.
7. **Optional push:** reuse subscription ownership and the delivery worker. Respect consent, quiet hours and muted categories; revoke stale endpoints, validate providers and keep push state separate from reading. Inbox release must not depend on push permission or availability.
8. **Existing achievements form:** add an optional competition-event picker and nullable `event_id` through the existing validator/save/serializer/audit path. Save the competition title snapshot; preserve manual history and never rewrite it after event rename/archive. No automatic medals or separate achievement module.
9. **Staging acceptance:** supply fictional test accounts/events for included and excluded audiences, a protected file, multiple pages, rescheduled/cancelled events and an explicitly notified revision. Run the read-only checker and the admin-owned mutation/isolation/worker cases below. Return evidence and the signed contract decisions before enabling the student deployment.

## Data to prepare and ownership

Storage names for new event/publication structures are an admin implementation decision. These are required concepts and fields, not instructions to create duplicate tables. The student API exposes a small public projection rather than the full records.

| Data / existing resource | Admin must prepare | Student use |
| --- | --- | --- |
| Trusted account/student linkage | Existing Auth user/profile, active Student role, portal-login flag, password setup and exactly one authorized string student key | Resolve identity independently from bearer. `students.id` is the existing `varchar(20)` key, not an Auth UUID. |
| Event publication | Stable UUID, positive public revision, public title, category, publication/status, occurrence, venue timezone, location, description, public notes, approved coordinator, published timestamp | Calendar/detail fields in the contract; titles ≤240 characters. |
| Event audience | Effective academy/branch/class/student rules, trusted enrollment/roster evaluation, author/approval evidence | Feed, detail, binary and dispatch access; no student/attendee lists in the DTO. |
| Event revision/change history | Previous public occurrence, public change reason, cancellation explanation, author/timestamps | Same deep link after a date change; visible cancellation rather than silent disappearance. |
| Protected event files | UUID, event association, approved filename/kind/MIME/byte count, private provider key, approval/access rules | Public descriptors only; authenticated binary reads up to 15 MiB. |
| `academy_holidays` | Separately approve any student-facing holiday publication and public explanation | Never serialize internal `reason` as public notes automatically. |
| `class_occurrences` + `class_occurrence_roster` | Correct dated occurrence records and student's roster association; approved schedule changes through existing schedule workflow | Already read directly by the student server. Do not return a second generated class feed or create sessions from weekly templates. |
| `portal_notifications` | Explicit student audience/source mapping, immutable approved title/body, source event/revision, recipient ownership, created/read/dismiss state | Safe inbox adapter. Matching `user_id` or a null staff permission alone is insufficient. |
| Existing outbox/audit + `portal_push_deliveries` | Idempotent notify intent, unique recipient fan-out, channel outcomes, retries, staff audit and operational monitoring | Public notice delivery state only; no raw worker failures or private audit in student responses. |
| `portal_notification_preferences` | Mergeable `events` category, push consent, validated paired quiet times in `Asia/Phnom_Penh` | Read/save only the supported student preference projection. |
| `portal_push_subscriptions` | Owner, endpoint/key validation, registration/revocation, expiry cleanup and worker integration | Optional consent-based device alerts; no browser service credential. |
| `achievements` / existing save service | Nullable event link, competition-only picker, immutable `event_name`, compatibility with old clients | Recorded achievements remain authoritative. The student does not currently query the missing `event_id` column. |

Existing shared-resource names above come from the earlier workspace inspection/migration boundary. The admin must confirm their actual field mapping and migrations against its current schema. No new shared schema has been applied by this preparation.

## Exact admin adapter checklist

Every JSON success is `{success:true,data:{contractVersion:"calendar-v1",subjectStudentId:<resolved string key>,...endpoint fields},error:null}`. The gateway verifies the subject/version, projects allowed fields and removes identity metadata before returning to its browser. The compatibility checker also rejects undocumented extra fields, including nested staff data.

| Method | Admin path | Required result / behavior |
| --- | --- | --- |
| GET | `/api/portal/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=50&cursor=…` | Published relevant `events`, opaque `nextCursor`; ≤50, live stable paging. |
| GET | `/api/portal/events/:id` | Current authorized `event` details and protected attachment descriptors. |
| GET | `/api/portal/events/:id/files/:fileId` | Authorized binary with declared MIME and exact byte count; no redirect to storage. |
| GET | `/api/portal/notifications?limit=50&cursor=…` | Eligible `notifications`, full authorized `unreadCount`, opaque `nextCursor`. |
| PATCH | `/api/portal/notifications` | One strict read/dismiss/mark-all body; `{updated:true}` after idempotent owned update. |
| GET / PATCH | `/api/portal/notifications/preferences` | Full supported student preference projection; preserve unrelated staff settings. |
| GET | `/api/portal/notifications/push` | `{available:false,publicKey:null}` is a valid first release; real availability requires the worker/subscription service. |
| POST / DELETE | `/api/portal/notifications/push/subscribe` | `{subscribed:true}` / `{removed:true}` after authorized idempotent operation. |

The student sends its verified bearer and `X-Portal-Contract: calendar-v1` server-to-server. Admin must independently verify the token, account state, role and student link. Never use browser-provided student IDs, editable user metadata, a raw decoded JWT, staff cookies or a forwarded service key as authority. `getUser(token)` is a supported Auth-server identity check; authorization still requires the academy's trusted records. See [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser). Keep privileged database access server-side and use explicit ownership/audience constraints; see [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

Return private/no-store on success, access denial and unavailable/error responses. Use 401 for missing/invalid identity, 403/404 for inaccessible sources, 409 for stale revisions/cursors, 429 for throttling and a safe 5xx for outages. Do not redirect to an admin login HTML page or return raw internal errors. JSON ≤1 MiB, files ≤15 MiB, student gateway deadline 8 seconds. Document rate limits/retry behavior and tune upstream timeouts below that deadline.

## Decisions the admin must confirm

- **Dates:** academy calendar timezone is `Asia/Phnom_Penh`; ranges are `[from,to)` and at most 93 days. All-day end dates are exclusive literal dates; timed events have offset-bearing timestamps. Include overlapping multi-day events. Venue-local times can differ from the calendar's academy grouping.
- **Audience changes:** specify effective targeting and behavior when enrollment changes, a source is withdrawn or an account is deactivated. Recheck before delivery and before opening the current source. Preserve approved inbox snapshots under the agreed retention rules without granting current source access.
- **Revision/notify races:** notify the previewed revision only; reject stale confirmation. Define the request-key retention window, recipient uniqueness and audited deliberate-resend rule. No automatic sends on ordinary saves. A retry after unknown outcome must look up the same intent rather than create another one.
- **Delivery mapping:** document exactly which confirmed channel boundary supplies `deliveryState`/`deliveredAt`. Keep per-channel push attempts in delivery storage; neither push acceptance nor a created inbox row proves a device displayed anything or a person read it. `readAt` remains independent.
- **Quiet hours:** paired distinct `HH:mm` values, including overnight ranges, use academy time. Define deferred push scheduling and retries; inbox/calendar visibility continues during the quiet window.
- **Source language:** interface controls already support English, Khmer and Chinese. Event/public-notice text currently displays the approved stored copy. If localized source content is required, agree a versioned reviewed-content mapping/fallback before adding fields; do not invent automatic translations or silently change this contract.
- **Retention/archive:** keep stable event IDs and cancellation explanations. Specify archive visibility, file retention, source-loss behavior and the achievement FK policy without rewriting recorded competition names.

## Ready-to-run compatibility tooling

Run in the student workspace (Node.js 22+, existing dependencies):

```powershell
# Offline only: validate all 11 fictional JSON examples against consumer validators.
node scripts/calendar-admin-check.cjs --examples

# Read-only calls to your approved staging deployment, after setting CALENDAR_CHECK_*.
node scripts/calendar-admin-check.cjs --staging
```

The student repository's `.env.calendar-check.example` settings template lists a staging origin, temporary Student bearer, expected linked student key, period, authorized event UUID and optional known-forbidden event fixture. Set these in the local process through your normal secret-management workflow. The checker does not load the portal's `.env.local`, print credentials, save response bodies or modify integration settings. Never paste a token into this handoff or commit it.

The staging checker uses **GET only**: anonymous denial, published event/calendar/inbox/preferences/push DTOs, at most one continuation page per list, period overlap, repeated-cursor rejection and the first protected attachment's MIME/size. It can check denial for a supplied known-forbidden event. Missing attachment/isolation fixtures are explicitly `not-tested`; a successful compatibility smoke is not full release acceptance. It does not register push, mark messages read, save preferences, publish or send.

The student repository's `lib/academy-integration-contract.ts` supplies the same validators as its production gateway. The checker requires that repository's `tests/load-ts.cjs` and installed dependencies. Run it from the student checkout rather than copying a single script into the admin repository. The [admin review response](../CALENDAR_NOTIFICATIONS_REVIEW_2026-11-01.md#student-owned-contract-and-tooling) lists the source paths and their ownership.

## Admin-owned acceptance evidence

| Scenario | Required proof |
| --- | --- |
| Two students / separate branches | Correct included/excluded feed, detail, file, unread count and message mutations; forged/cross-account IDs and cursors cannot expose anything. Include inactive, unlinked, incomplete-password and staff accounts. |
| Draft / private data | No draft or staff notes anywhere in student JSON, media metadata, notices, logs or push payloads. |
| Calendar boundaries | All-day exclusive end, overnight/multi-day overlap, offset times, equal sort timestamps, multiple pages, insert/update during paging, expired/wrong-scope cursor. |
| Change/cancel/archive | Same event ID/link after movement; previous date and approved explanation visible; cancellation retained; source withdrawal rechecked. |
| Protected files | Authorized bytes match descriptors; wrong event/file ID, changed audience, withdrawn publication, oversized/unapproved MIME and expired provider access all fail safely. |
| Save versus notify | Ordinary save sends zero notices. Preview then explicit notify produces one intended recipient fan-out; concurrent/retried clicks and worker retries create no duplicates. Stale preview returns 409. |
| Worker/recovery | Audience loss between enqueue and dispatch is respected. Retry/backoff and failed-job monitoring work. Separate delivery/read states are accurate. Worker restart does not duplicate recipients. |
| Inbox actions | Read/dismiss retain first timestamps on retry; mark-all touches only the student's eligible notices; pagination and unread totals remain consistent. |
| Preferences / optional push | Staff categories preserved; event mute and overnight quiet hours affect alerts only. Ownership/revocation/provider validation hold. Push-unavailable still gives a working inbox. |
| Achievement compatibility | Old/manual records survive. Unchanged link preserves saved title; rename/archive does not rewrite history; explicit unlink/title correction is audited. No automatic medal creation. |
| Student UI / real devices | Both themes, English/Khmer/Chinese, keyboard/reduced motion, phone/tablet/desktop; physical Safari/iPad/iPhone/Android and native-speaker acceptance. Device push is a separate acceptance step. |

## Return to the student team and enable in stages

Return the deployed staging/production origins, contract/authentication decision, schema/field mapping, audience owner, date rules, protected-media adapter, source/revision and delivery-state mappings, pagination/rate-limit policy, outbox/idempotency evidence, retention policy and test results. Identify any optional push or achievement-link work still disabled. Share fixture labels/evidence, not credentials or real children's records.

After both teams accept the contract and isolation evidence, configure only these **server** settings in the intended student environment:

```dotenv
ACADEMY_PORTAL_API_ORIGIN=https://<approved-admin-api-origin>
ACADEMY_PORTAL_CONTRACT_VERSION=calendar-v1
```

First release authorized calendar/inbox/preferences with push explicitly unavailable. Verify real approved test records, no cross-account data and no unintended notification on save. Enable explicit Notify students and the proven delivery worker under admin permissions; optionally enable device push after its own checks. Schedule/class, tuition and achievement writes remain separate authorized operations.

Rollback disables the student adapter settings and stops the admin notification producer/worker through its existing operational controls. Disabling the student adapter alone does **not** cancel queued admin deliveries. Preserve outbox/audit/idempotency history; do not delete events or notices to roll back a connection.
