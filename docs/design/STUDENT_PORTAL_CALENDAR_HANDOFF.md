# Student Portal — Calendar, Events and Admin Notifications

Implementation handoff · Infinity Taekwondo · 1 November 2026

Status: the admin/backend release is implemented and its database upgrades are installed. The separate student application's local `calendar-v1` gateway and assignment reader are connected. Public deployment, a genuine authenticated acceptance run and optional device-push validation remain pending. The [calendar and student integration release guide](../CALENDAR_STUDENT_INTEGRATION_2026-11-01.md) is the authoritative reference for released routes, date semantics, configuration and current limits.

The sections below preserve the original feature handoff and proposed API direction. Do not implement against its old generic announcement endpoint or assume proposed class-impact automation is available; use the release guide's actual endpoint table. The prototype contains fictional records and sends no real notices.

## Feature scope

### 1. One student portal

Build one student-facing calendar experience. There is no separate Parent mode, family dashboard or child switcher. Resolve the authorized student from the signed-in account on the server.

### 2. Academy calendar

- Show published holidays, competition events, workshops, maintenance, academy activities and approved class changes.
- Use category colours together with readable labels/icons. Keep type/category separate from audience targeting.
- Provide month and agenda views, date navigation, type filters and an upcoming-events list. Start with agenda on phones.
- Combine relevant events with the student's actual dated class sessions. Use the backend schedule; do not generate a second timetable from weekly templates.
- Show multi-day events, changed dates and cancellations clearly. A moved event keeps the same ID and link, with its previous date visible.
- Load only the selected period, with bounded pagination. Include events that overlap the period, even if they started earlier.

### 3. Event details

Show title, type, dates/times, timezone, location, public description/notes, contact/coordinator information approved for students, and authorized pictures/documents. Open details as a desktop drawer or mobile sheet.

Only published content within the student's audience is returned. Staff notes, drafts, internal costs and other students' personal information must never be present in the student response. Check access again when opening a file.

### 4. Admin announcements through the notification inbox

An announcement is an action on a saved system update, not a separate announcement page or content-management module.

- Admin publishes or changes an event/calendar item, then clicks **Notify students**. Also allow **Notify students** as an optional checkbox during publish/save.
- Show the intended audience and default public message before the send action. Use safe templates; an optional Edit message action can customize the wording.
- Save-only does not send a notification. Drafts cannot be announced to students.
- Queue an inbox notification for eligible recipients. Use the existing push worker for optional device alerts where supported, configured and permitted.
- A notification includes a title, short public message, timestamp, unread/read state, source type, source ID and source revision. Opening it fetches the current authorized source details.
- Reuse the existing inbox, unread count, preferences, read/dismiss actions and push-subscription flow. Do not build a second notification service.
- Show **Queued**, **Delivered**, **Failed** and **Read** accurately. Queued does not mean delivered; delivered does not mean read.
- Repeated clicks and network retries must not create duplicate notices. A deliberate resend is a separate authorized action with a reason.
- Other modules can reuse this action once each module has an approved public projection, source permission and recipient rule. Do not broadcast raw system records or automatically announce every edit.

Examples: a new competition, changed workshop date, holiday notice or approved class reschedule. Notices about personal billing must be account-specific if that module is later connected.

### 5. Competition title link in existing student achievements

Achievement entry stays in **Student Data → Achievements**. There is no achievement tab in Calendar & Events and no event results/medal-entry engine in this feature.

- In the existing achievement form, offer a searchable competition-event picker, including past editions.
- Selecting an event stores its optional `event_id` and fills the competition title into the existing `event_name` field.
- If no event exists, let staff choose **Enter manually** and type the competition name. Save `event_id = null`; do not create a calendar event automatically.
- Keep `event_name` as a historical snapshot. Later event renaming or archiving must not rewrite or delete an achievement.
- Resolve the title when creating a linked achievement or changing its event link. Editing notes/medal fields with the same link preserves the saved title; it must not refresh the snapshot from a renamed event. Title correction is an explicit audited action.
- Show the linked event only when the viewer can access it. If unavailable, keep the achievement's saved competition name visible.
- The calendar never creates achievements automatically. Medal, date, category and division continue through the existing student-data workflow and permissions.

### 6. UI and behaviour

Keep the approved prototype layout and the portal's existing red accent, typography, compact spacing, 8px panels, light/dark theme and shared motion settings. Reuse each application's own header, navigation, notification inbox and modal patterns. Do not copy the prototype's preview controls into the product.

Support phone/tablet/desktop layouts, keyboard navigation, reduced motion and safe-area spacing. The footer must not cover the last calendar item or dialog actions.

## Responsibilities and integration contract

**Admin/backend team:** event CRUD and publication history, audience resolution, protected media, class-impact operations, notification generation/outbox/audit, permissions, and the optional competition link in the existing achievement API/database.

**Student-portal team:** calendar/agenda, event details, notification presentation and opening source links, account-scoped reads, loading/error/empty/offline states, and refresh after an update. Display existing student achievements through the student-data integration when applicable; do not create a calendar achievement editor.

**Both teams:** agree authentication, API base URL, field names, timezone/end-date semantics, allowed source types, notification categories and route mapping. A separate portal must not assume staff cookies or staff API access. No backend secret/service-role key belongs in either browser client.

### Proposed endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/portal/calendar?from=&to=&cursor=` | Published, authorized events and dated classes overlapping a half-open date range |
| `GET /api/portal/events/:id` | Public-safe event details and permitted media descriptors |
| `POST /api/admin/notifications/announcements` | Authorized source-based notification intent; returns notice ID and queue state |
| Existing `GET /api/notifications` and `POST /api/notifications` | Extend the current inbox/read/dismiss/preferences/subscription contract for event notices |
| Existing admin achievement save API | Add an optional competition-event ID while retaining manual event names |

These routes and extensions are proposed, not currently implemented event APIs. Current notification routes already exist, but event categories, source authorization, student-portal routing and cross-application authentication still need integration.

### Required data contract

- **Event:** `id`, `revision`, `title`, `type`, lifecycle status, all-day or timed occurrence fields, timezone, public description, location, allowed attachments and published timestamp. Preserve occurrence IDs through rescheduling.
- **Dates:** default timezone `Asia/Phnom_Penh`; date-only all-day ranges use an exclusive end. Timed occurrences use explicit timestamps and venue timezone. Keep date-only values as dates across device timezones.
- **Notification intent:** `sourceType`, `sourceId`, `sourceRevision`, `requestKey`, and optional public message/target narrowing. The server resolves recipients; a client-supplied student ID or recipient list is not authorization. Reject stale revisions and unpublished/private sources.
- **Notice:** stable notice ID, immutable message snapshot, source reference/revision, created/read timestamps and delivery state. The student app maps authorized source references to its own routes rather than following arbitrary admin URLs.
- **Achievement:** optional nullable `eventId` in the API, mapped to `event_id`, plus existing `eventName` / `event_name`. For updates, omission preserves the existing link; explicit `null` selects manual mode. Validate the referenced record is a permitted competition event. Derive the name on the server for a new/changed link; preserve the saved snapshot for an unchanged link. Record explicit unlink/title-correction actions in the audit trail.
- **Errors:** retain the existing `{ success, data, error }` envelope. Use field errors for invalid input, 409 for stale revisions, and a queued/accepted result for asynchronous notification requests. Never report delivery before it is confirmed.

## Implementation checks

- Drafts/private notes are absent from student DTOs, not merely hidden in the UI.
- A user cannot fetch another student's notices, files or classes by changing an ID.
- Notification recipients stay within the authorized source audience, including students enrolled at another branch. Recheck access when dispatching and opening a source.
- Sending a notification never changes attendance, makeup obligations, tuition or achievement data. Schedule operations remain separate and reviewed.
- Events, session changes and requested notification intents use transactional writes/outbox patterns. Retried intents and per-recipient fan-out are idempotent.
- An event update does not edit previously issued notification text. It creates a new revision; an optional new notification references it.
- Existing achievement entries without links still work. Multiple achievements may legitimately reference the same event.
- Linked and manual achievement saves are both tested, including old clients that omit the new field.
- Event dates remain correct across month/year boundaries and device timezones.
- Notification failures are visible and retryable. Opening an unavailable source shows a useful message and keeps the inbox usable.
- Light/dark themes, 390px phone, 834px tablet, desktop, keyboard focus and reduced motion are checked. Browser-size checks do not replace physical-device acceptance.

## Existing backend touchpoints

The current admin source already contains `academy_holidays`, `class_occurrences`, `achievements`, `/api/admin/achievements`, `/api/notifications`, notification preferences and a push worker. Extend these integrations rather than duplicating them.

The achievement validator is strict, so new fields must be added to the schema, serializers, save RPC and response mapping together. Align accepted text lengths with database columns. Add the `events` notification category across database checks, preferences, clients and worker; update the current fixed muted-category limit and safe notification-path validation. Implement source-access checks for event notices rather than relying only on the notification's recipient ID.

Excluded from this handoff: a separate achievement module, automatic medals/results, a separate announcement board, Parent mode, registration/waitlists, event payments and certificate workflows. Those require a separate request if needed later.
