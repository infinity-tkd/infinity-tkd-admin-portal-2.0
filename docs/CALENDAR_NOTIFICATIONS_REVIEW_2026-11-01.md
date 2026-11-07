# Calendar and notification implementation review

Infinity Taekwondo · Admin response to the student portal team · 1 November 2026

The admin portal implements the `calendar-v1` calendar, event, protected-file, inbox and preference adapters. All seven integration migrations, including the archive, inbox retry, effective-enrollment targeting and push-queue reliability changes, are installed in the shared database. The [integration release guide](CALENDAR_STUDENT_INTEGRATION_2026-11-01.md) and [migration manifest](../supabase/calendar-release-migrations.json) record the registered versions and final checks.

This response addresses [the student team's implementation request](design/ADMIN_CALENDAR_NOTIFICATIONS_IMPLEMENTATION.md). It records the implemented rules and the evidence still required. No real student announcement or test business record is created by this review.

## Requirements and implementation

| Student team request | Admin implementation and decision |
| --- | --- |
| Draft, publish and public revision | Drafts and published payloads are separate. Ordinary saving sends no notice and leaves the last approved publication visible. Publishing requires the expected working revision. Public revisions retain their actor and timestamp. |
| Stable date changes and cancellations | Event UUIDs stay stable. Date changes retain the previous occurrence. Cancellation and postponement require an explanation; their approved public state remains visible to eligible students. |
| Archive and source withdrawal | An explicit administrator action records `archived_at`, `archived_by` and a reason. It removes student feed, detail, file and inbox access without deleting the event, approved revisions, notifications or existing achievement links. Archived events cannot be edited, published or announced. There is no restore operation in this release. |
| Categories | Holiday, competition, workshop, maintenance, academy activity and informational class change. The admin `academy` value maps to the consumer's `activity`; `class_change` is preserved. |
| Verified identity and audience | Auth verifies the bearer; trusted profile/student records establish exactly one subject. All student operations apply the current source audience. A browser-provided student ID is never authority. |
| Exact adapters | Calendar, event detail, binary files, inbox actions, preferences and push availability/subscription routes use the released `calendar-v1` paths and envelope. See the release guide's endpoint table. |
| Protected files | Event-scoped private storage or supported individual Drive files; verified MIME, size and fingerprint. Downloads reauthorize and return bytes rather than provider redirects or private URLs. |
| Explicit Notify students | Saving never sends. Publishing can opt in; the checkbox starts unchecked. Standalone notify reviews the exact public title/body and audience before confirmation against a published current revision. Both message paths passed browser acceptance and SQL snapshot-parity checks. Recipient/revision uniqueness and stored request receipts prevent duplicate fan-out. |
| Inbox and preferences | Read, mark-all and dismiss are owned and source-safe. Repeated dismiss succeeds while preserving its first timestamp. Event mute merges with existing preference categories. Quiet hours affect alerts, not calendar/inbox visibility. |
| Optional push | Disabled by default for the student app. The existing worker selects due work per owned subscription and rechecks access before claiming a delivery. It does not depend on the first inbox page. |
| Existing achievements | Optional competition FK and saved competition-title snapshot in the existing student form. Manual names remain supported. No additional achievement module or automatic medal creation. |
| Desktop and mobile | Admin uses the current portal shell, theme, dialog controls, responsive layouts and reduced-motion settings. Browser fixtures cover phone, tablet and desktop; physical-device and native-speaker acceptance remain separate. |

Optional `publicNotes` and coordinator `contact` fields currently return null. The implementation does not invent contacts or copy internal holiday/staff notes into public content. Approved stored event text is displayed as supplied; automatic translation is not part of this contract.

## Audience ownership and effective dates

The academy grouping timezone is `Asia/Phnom_Penh`. Access is evaluated at the current academy date, including when the publication is read, an inbox action runs, a file opens and a push delivery is claimed.

- **All students:** eligible, explicitly linked Student accounts, subject to the academy login switch and account state.
- **Individual students:** the approved list of existing student keys.
- **Classes:** a current `class_enrollments` row whose `enrollment_date`, or `enrolled_at` academy date when no date is set, is today or earlier.
- **Branches:** the student's home branch or a branch reached through a currently effective class enrollment.
- **Staff only:** no student publication access or student notification fan-out.

Deleting or changing a current enrollment removes the old class-based grant. Future enrollment dates do not grant access early. Preserved occurrence rosters and membership/enrollment history are attendance and audit evidence; they do not provide continuing event access after enrollment ends. Staff can deliberately select individual students when an alumni or historical-event audience is intended.

Deactivated accounts, incomplete password setup, ambiguous or contradictory ownership, and suspended/deleted student records fail the gateway's access checks. A student's Active, Paused, Inactive or Graduated membership status is separate from the account's activation flag; a membership pause alone does not remove calendar access or create a different portal mode. Account and source access are checked again after a queued push candidate is selected.

## Dates and publication decisions

Calendar queries are half-open `[from,to)` and span at most 93 days. All-day dates remain literal dates. The admin form's inclusive end date is converted to the consumer's exclusive end date. Timed occurrences carry offsets and a venue timezone; a timed event crossing academy midnight is indexed for every academy day it overlaps. Invalid or ambiguous venue times are rejected rather than silently moved.

Save and publish are separate operations. Publication and optional inbox fan-out commit in the same database transaction, with the approved revision, audit entry and request receipt. A stale expected revision fails with HTTP 409; the administrator must refresh and review the latest content. Notification content uses the approved title and change reason, or the standard public update sentence. Internal notes are excluded.

Archive is withdrawal, rather than a public cancellation announcement. Use cancellation when students should continue to see the cancelled occurrence and its explanation. Archive removes current source access; existing inbox snapshots and achievement titles remain stored privately for history. An existing linked achievement can still receive ordinary corrections without changing its saved competition title, while a new link cannot target an archived competition.

Calendar events do not create or cancel dated classes, rewrite occurrence rosters, mark attendance, create makeup obligations, pause memberships, change tuition or record achievements. Actual schedule and financial changes remain explicit operations in their existing workflows.

## Database relationships and history

| Relationship | Enforcement |
| --- | --- |
| Event → public revisions | `(event_id, revision)` identifies the approved public history. Revision updates/deletes are blocked. |
| Event → archive actor | `archived_by` references a real profile; archive timestamp, actor and reason must be complete together. |
| Notice → event and approved revision | Source UUID/revision reference `academy_event_revisions`. Event notices require a positive revision, student subject, correct category and no staff permission shortcut. |
| Notice → recipient and student subject | Existing profile/student FKs are preserved; gateway and producer independently establish their trusted ownership relationship. |
| Achievement → competition | Nullable event FK with restricted deletion. New links require a current published competition; existing saved names remain historical snapshots. |
| Push attempt → notice and subscription | The existing pair identifies channel attempts, lease, backoff and sent state; the subscription must belong to the recipient and correct app. |

Event notification title/body, source, recipient, subject, link, category, creation and inbox delivery timestamps cannot be rewritten after creation. Read, dismiss and resolution state remain separately updateable through their authorized workflows.

There is no automatic retention purge for event revisions, notification evidence, request receipts or audit history. Request keys currently have no expiry: an identical retry recovers the committed receipt; reusing a key for another actor, action or payload is rejected. Recipient plus source revision remains unique. There is no force-resend operation that resets the same message's read/dismiss history; a new announcement to the same recipients uses a newly reviewed publication revision.

Any future retention or privacy deletion policy needs an explicit approved workflow. Do not delete event, notification, idempotency or audit history to roll back an integration connection.

## Inbox delivery and optional push

`deliveredAt` means the approved notice was committed to the durable student inbox. It is not evidence that a push provider accepted it, that a device displayed it or that a person read it. `readAt` is independent. Device delivery attempts and outcomes stay in `portal_push_deliveries`; private provider failures do not enter student DTOs.

Student device alerts remain gated by `STUDENT_PORTAL_PUSH_ENABLED=false` unless deliberately enabled with the deployment's existing VAPID keys, worker and student subscription consent. An unavailable push configuration still returns a working calendar, inbox and preferences, with `available:false` and `publicKey:null`.

The revised worker uses these rules:

- Select the oldest eligible unread, undismissed, unresolved work per owned subscription, rather than the newest inbox page. Completed or deferred deliveries cannot starve older notices.
- Consider notices created in the last 48 hours for push only. Older records remain available in the inbox; they do not produce a burst of historical device alerts.
- Check current role/account state, exact student ownership, academy switch, unarchived source, current audience, app scope, consent, mute and quiet hours at selection and again at claim.
- Defer during paired, distinct `HH:mm` quiet hours in academy time, including overnight windows. The next worker run can pick up eligible work after quiet hours end, within the push age window.
- Lease a claimed attempt for two minutes. Retry transient failures after 30 minutes, with a maximum of five claims. A worker crash can be recovered after the lease expires.
- Remove stale provider subscriptions after HTTP 404/410. Validate provider endpoints before making outbound requests. Bound work and request time for each worker run.

Push delivery is best effort. A provider acceptance followed by a database/network failure can lead to another attempt after recovery; the stable per-notice tag helps devices replace the same notification. No exactly-once device-display claim is made.

## API and failure behavior

The student server forwards its verified bearer and `X-Portal-Contract: calendar-v1`. The admin resolves the subject again. JSON success envelopes include that subject and contract version; the student gateway verifies them before stripping metadata and parsing the strict resource schema.

Responses, including forwarded authentication failures, carry private/no-store cache protection. Missing/invalid identity uses HTTP 401, inaccessible sources 403/404, stale or invalid scoped cursors 409, validation failures 422 and outages safe 5xx responses. The gateway never receives an admin login redirect or raw internal database/provider error. Signed cursors are scoped to the account, subject and query period, expire after one hour and use stable keyset paging. They are continuation positions, not one-use credentials.

Calendar/inbox pages contain at most 50 entries, JSON is bounded to 1 MiB and files to 15 MiB. The student gateway's deadline is eight seconds; the protected upstream file fetch is bounded below that deadline. Cold-start and real-provider latency still need deployment acceptance.

## Verification and remaining acceptance

`npm run check` passed with 231 tests, zero failures, zero skipped tests, zero lint warnings and a successful TypeScript check. The production build passed on Next.js 15.5.28. The actual production server rendered `/` with HTTP 200; signed-out admin list/archive and student calendar/inbox requests returned HTTP 401 with private/no-store responses and no private data.

The automated flow harness exercises the actual admin/student handlers, permission and ownership logic, and PostgreSQL fixture transactions through publish, notify, student reads and inbox actions. It includes two fictional students, excluded audiences, private fields, stale revisions, retry behavior and archive withdrawal. Focused reliability tests cover effective enrollment, preserved history, metadata/FK integrity and cursor conflicts. Worker candidate/claim tests cover eligible backlog selection and current-access rechecks.

The admin browser flow passed at widths of 1440, 834 and 390 pixels, including exact-message notification review, retry, archive confirmation, archived read-only state and the informational class-change category, with zero JavaScript errors. The actual student components passed 447 state checks in each of Chromium and WebKit. Each engine exercised 36 combinations of six viewports, two themes and English/Khmer/Chinese, with zero failures, JavaScript errors or unexpected network requests. The student team's offline checker accepted all 11 fictional examples without live calls. Stored default-message and change-reason previews also matched the notice snapshots produced by the actual API/PostgreSQL flow.

The Auth provider identity responses and file/network providers are mocked in these local tests. Browser checks use fixtures; they do not create genuine Auth sessions or prove provider/device delivery. Live read-only checks found all 144 foreign keys validated, the calendar source tables and RPCs private to the server, both immutable-snapshot triggers active, and push claims running with invoker privileges. Five missing relationship indexes were added and one duplicate template index removed. The remaining performance advisories are unused-index information; these indexes were retained because small/new tables do not yet demonstrate their production usage.

The live linked Student account was unambiguous, with no unlinked active Student account, contradictory ownership or orphaned event notice found. Event and event-notice counts remain zero. The review creates no fabricated live event, account, file or historical student evidence.

Before public release, use approved real test accounts and a genuine protected file to verify the deployed HTTPS origin, included/excluded student access, publication visibility, one intended inbox fan-out, read/dismiss behavior, archive withdrawal and provider access. Test both themes, keyboard/reduced motion, English/Khmer/Chinese controls and physical Safari/iPad/iPhone/Android as applicable. Device push requires its own permission, service-worker and foreground/background acceptance before enabling it.

Final full-suite, build, browser and live-migration results belong in the [release guide](CALENDAR_STUDENT_INTEGRATION_2026-11-01.md). Do not interpret local fixture success as a signed-in real-account production acceptance result.

## Existing security advisories

The live review also retained three existing advisory categories, separate from the new calendar producers:

- `citext` is installed in the public schema. Its namespace and dependent definitions were not moved in this release; a change needs its own dependency review. See [extension namespace guidance](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).
- Eleven existing current-caller role/authorization helper signatures remain executable as policy support. This is distinct from the calendar and delivery RPCs, which are denied to browser roles. Their current scope was reviewed rather than removing grants used by existing policies. See [authenticated security-definer function guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Auth leaked-password protection is disabled. The owner-controlled Auth setting and the previously deferred credential rotation remain unchanged. See [password security and leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Student-owned contract and tooling

The following files exist in the separate student portal repository, not in this admin checkout:

| Student repository path | Purpose |
| --- | --- |
| `docs/design/STUDENT_PORTAL_CALENDAR_API_CONTRACT.md` | Exact consumer contract |
| `docs/design/calendar-admin-kit/responses.json` | Fictional JSON contract examples |
| `.env.calendar-check.example` | Checker process-setting names; never commit filled secrets |
| `lib/academy-integration-contract.ts` | Shared consumer validators |
| `scripts/calendar-admin-check.cjs` | Offline/read-only compatibility checker |
| `tests/load-ts.cjs` | Checker's local TypeScript loader |

Run the student team's commands from that repository with its installed dependencies:

```sh
node scripts/calendar-admin-check.cjs --examples
node scripts/calendar-admin-check.cjs --staging
```

The staging mode is read-only and needs approved temporary account settings through the existing secret-management workflow. It cannot replace the admin-owned mutation, source-withdrawal and worker tests. Set only the intended deployed admin HTTPS origin and `calendar-v1` contract in the student server after both teams accept the integration. Do not paste tokens into documentation or send staff credentials to the student browser.
