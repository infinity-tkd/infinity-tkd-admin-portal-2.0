# Academy Calendar & Events

Design proposal · 1 November 2026 · Infinity Taekwondo

Status: the admin feature is implemented, its five shared-database upgrades are installed, and the separate student application's local `calendar-v1` gateway is configured. No sample events, announcements or other business records were seeded. Public deployment and authenticated acceptance remain pending. Use the [calendar and student integration release guide](../CALENDAR_STUDENT_INTEGRATION_2026-11-01.md) for actual routes, configuration, verified boundaries and remaining work.

The design below records the agreed direction and broader ideas. Proposed class-impact operations, generic announcement APIs and other future details are not additional released features. The interactive prototype remains a fictional design preview.

## 1. Agreed scope

Create one **Calendar & Events** workspace in the admin portal and one calendar experience in the student portal. Keep Calendar and Events as workspace tabs.

- Admin manages events, dates, audiences, public notes, pictures and documents.
- Admin can announce a saved update through **Notify students**, using the existing notification inbox and worker. Announcements are an action, without a separate announcement board.
- Achievements remain in **Student Data → Achievements**. Add an optional competition-event picker to that existing form. If no event exists, staff enter the competition name manually.
- There is no calendar achievement tab, event results/medal engine, Parent mode or child switcher.
- Registration/waitlists, event payments, event check-in and certificates are outside this handoff. They can be scoped separately later.

The implementation handoff is [Student Portal — Calendar, Events and Admin Notifications](STUDENT_PORTAL_CALENDAR_HANDOFF.md).

| Type | Calendar treatment | Information and optional schedule effect |
| --- | --- | --- |
| Holiday / academy closure | Red label and closure icon | Date range and branch; review affected sessions before closing them |
| Competition | Amber trophy label | Edition, dates, venue, organizer information, rules and documents; selectable title in student achievements |
| Workshop / seminar | Violet learning label | Dates, learning description, instructor information and attachments |
| Maintenance | Slate tools label | Affected branch and hours; distinguish partial-day from full-day closures |
| Academy event | Teal community label | Demonstrations, meetings, celebrations and other academy activities |
| Class change | Blue change label | Derived from the authoritative dated-class record |

Type, tags and audience are separate. A competition may have Kyorugi/Poomsae tags and a junior-team audience. A coloured tag neither grants access nor changes attendance.

## 2. Approved visual direction and admin integration

Keep the prototype's compact calendar, category chips, upcoming-events panel, restrained borders and event-detail drawer. The direction is calm and minimalist, with the calendar as the main visual anchor. Use the existing application theme and shared components when implementing the workspace.

| Area | Integration requirement |
| --- | --- |
| Page shell | Render inside the existing `PortalLayout` and `PageTransition`. Reuse the sidebar, header, scroll container and mobile navigation; do not nest the stand-alone prototype shell inside the application. |
| Typography | Inherit Montserrat / Kantumruy Pro from `app/layout.tsx` and existing language fallbacks from `app/globals.css`. No independent calendar font download. |
| Brand | Use the existing red tokens: `#EF2F38`, `#d6242c`, and contrast/hover variants. Category colours are semantic labels. |
| Surfaces | Reuse white/neutral light styles and `.dark` styles: canvas `#0A0A0A`, surface `#0f0f0f`, border `#262626`, text `#E4E4E4`, muted text `#999`. Respect the application theme preference. |
| Geometry | Shared 8px panels/controls, 4/8px spacing, readable density and 44px touch targets. |
| Motion | Reuse `app/motion.css`: 120ms feedback, 180ms ordinary transitions, 220ms panels, shared easing and reduced motion. Avoid grid-size animation and decorative loops. |
| Forms and feedback | Reuse existing validation, confirmation, notification, loading, error and permission patterns. Keep calendar styles scoped. |
| Responsive layout | Month/agenda on desktop/tablet; agenda first on phones. Respect the shell's navigation visibility and safe areas. Footer navigation must not cover content or dialog actions. |

The prototype's Admin portal / Student portal and theme controls are design-preview controls only. They are not account-mode controls in the product.

## 3. Existing system findings

Source and read-only database metadata were reviewed on 1 November. No student personal records were read for this design.

| Existing feature | Finding | Integration consequence |
| --- | --- | --- |
| `academy_holidays` | Inclusive date ranges, optional branch, internal reason; RLS enabled | Adapt existing closure operations rather than creating another holiday engine |
| `class_occurrences` | Actual dates, status, revision, original date and holiday reference; RLS enabled | Use these records for the student timetable and class changes |
| Schedule operations | Protect marked sessions and check revisions/conflicts | Recheck these guards when applying an event's operational effects |
| `achievements` | Existing event-name text and medal fields; no event relationship | Add only a nullable competition-event link and retain manual names/history |
| Achievement validation | Strict request schema; category/division API limit 150 versus live column limit 100 | Update the full save path for the new field and align text limits during implementation |
| Notifications | Existing inbox, profile recipients, preferences, push worker and health reporting | Reuse them for source-based announcements |
| Notification categories/routes | No event category or calendar routes in the current contract | Update database checks, clients, worker, preference limits and safe links together |

Relevant source includes `lib/achievements.ts`, `app/api/admin/achievements/route.ts`, `app/api/notifications/route.ts`, `lib/notifications.ts`, `lib/notifications-server.ts`, `lib/operations-server.ts` and `components/PortalLayout.tsx`.

## 4. Calendar and event workflow

### Admin

Create an event with title, category, description, dates/times, timezone, venue, coordinator, tags, audience, public files and separate internal notes. Save a private draft, preview the student-facing content, then publish a revision.

Publication state and event lifecycle are independent: a published event may be scheduled, postponed, cancelled or completed. Draft edits stay private until the next revision is published. A cancellation remains visible with its reason. Moving dates keeps the same event/occurrence identities and shows a change marker on the original date.

**Save/publish** updates the source. **Notify students** announces that saved source. Admin can choose the notification checkbox during publication or use the action afterwards. Saving alone sends nothing.

### Student portal

One interface shows the student's actual class sessions and authorized published events. Open a card for dates, location, public description, allowed coordinator contact information and protected attachments. The existing notification bell opens announcements; selecting one opens the current event or other authorized source.

There is no new achievement editor within the calendar. Any existing student achievement display reads its records through student data, with an optional event link when authorized.

The server resolves the signed-in student's ownership. A supplied student ID, hidden button or prototype preview switch never grants access. Any later family-account design must retain this same student-facing interface and be separately authorized.

## 5. Dates, audience and class effects

- Default timezone: `Asia/Phnom_Penh`. Timed events store timestamps and venue timezone; show venue and academy times clearly when different.
- All-day events store dates and an exclusive end. Displaying 9–11 November corresponds to an end date of 12 November. Adapt carefully to the existing inclusive holiday range.
- Read periods with overlap semantics: start < query end AND end > query start. Load only the selected period and bounded pages.
- An annual competition has a separate ID for each edition. Keep historical titles and links stable.
- Audience rules use OR within a dimension and AND across selected dimensions. Branch notices include students enrolled at that branch, even when their home branch differs. Changed-class notices use saved occurrence rosters.
- Publishing or announcing information does not cancel a class. Default class impact is Information only.
- For closures/reschedules, preview exact dated sessions, conflicts, rosters and existing attendance. Recheck permissions and revisions at commit. Apply the approved effects, event publication, audit record and requested notification intent atomically; fan out notices later.
- Partial-day maintenance affects overlapping sessions only; do not send a two-hour window through the full-day holiday action.
- Protected/marked historical sessions cannot be silently rewritten. Cancelled classes create no new absence/makeup obligation under current rules. Holidays/events do not change tuition, grace periods or membership pauses automatically.
- A narrow or staff-only event audience cannot hide a schedule change from affected students. Their own timetable must show the approved change; use a separate public-safe class notice for that roster if admin requests notification.
- Removing a notification never reopens classes. Reopening is a reviewed operation that checks overlapping closure causes and independent cancellations.
- Import existing closures as linked drafts without applying their cancellation operations again.

## 6. Competition title in student achievements

Keep achievement recording in the current student-data form and permission path.

1. **Choose competition:** search permitted competition events, including past editions. Save `event_id` and a server-resolved title snapshot in existing `event_name`.
2. **Enter manually:** if no event exists, staff type the competition name; save `event_id = null` and the required `event_name`. Do not create an event automatically.

Keep medal/date/category/division validation and student ownership checks in the existing achievement workflow. No event publication, attendance or notification creates a medal. Multiple achievements may reference one competition.

Event renaming/archiving must not change the saved achievement name or delete records. Resolve the title on a new/changed link; ordinary notes/medal edits with an unchanged link preserve the stored snapshot. A title correction is explicit and audited. An unavailable event link leaves the saved name visible. Show a source link only when the viewer may access the event. Relinking/unlinking is an explicit audited edit, not an automatic name match.

Add optional nullable `eventId` to the strict API schema, serializers, save RPC, database and responses together. Omitted values on an update preserve the current link; explicit null selects manual mode. Validate the target is a permitted competition record. While linked, an arbitrary typed title cannot silently disagree with the source; choosing manual mode is explicit. Preserve older manual records and older clients that omit the new field.

## 7. Announcement action and notification delivery

The source record remains the place to edit event/calendar content. The announcement action captures an immutable public message snapshot and source reference in the existing notification pipeline. No separate announcement board or parallel worker is introduced.

- On a published source, show the intended audience and public message, with **Notify students** and an optional Edit message action. During publish, offer an unchecked notification checkbox.
- Drafts/internal-only sources cannot be broadcast. Other modules need their own approved source adapter, permissions, safe projection and recipient rule before using the action.
- Require the source's permission and `action:announcements_send`. Event publication and schedule changes retain their own additional permissions. Preserve explicit per-user denies.
- Reject stale source revisions. The server derives eligible recipients; any requested narrowing must stay within that audience.
- A notification intent and its audit record commit together. A request key identifies the same send attempt across network retries; fan-out is unique over notice ID and recipient. A deliberate resend needs a distinct authorized intent and reason.
- Keep source revision, sender, message, target rule and delivery history. A date edit does not rewrite a previously sent notice. Publishing a new revision does not send unless requested.
- Reuse the inbox, preferences, optional device push, quiet hours, retries and job-health screen. Add the `events` category throughout the current contract, including its fixed muted-category validation limit.
- Keep queued, delivered, failed and read states distinct. A notification receipt is not consent, payment, registration or attendance.
- Keep sensitive account information out of device lock-screen previews; those use a generic message and an authenticated source link.
- Recheck access at dispatch, inbox reads and source/file opening. Student routes must use validated source references and the student app's own route mapping.
- An unavailable/archived source shows a useful message without breaking the inbox. Persist notices across refresh; the prototype's local array is only a demonstration.

## 8. Data and API boundaries

These are proposed entities/contracts, not executable SQL or installed endpoints.

| Entity | Responsibility |
| --- | --- |
| `academy_events` | Stable ID/edition, category, coordinator, lifecycle, draft and published revision references; restricted internal notes |
| `academy_event_revisions` | Frozen public-safe content, audience version, publication/change metadata |
| `academy_event_occurrences` and occurrence versions | Stable occurrence identity and revision-scoped dates, times, venue and cancellation state |
| `academy_event_audiences` | Revision-linked branch/class/team/belt/student target rules |
| `academy_event_media` | Protected object path, visibility, approval/scan state and published revision association |
| `academy_event_session_effects` | Approved effects on dated classes, before/after revisions, cause and reversal history |
| Existing `achievements` | Nullable competition `event_id` plus existing required name snapshot |
| Existing notification/outbox/audit tables | Source-based announcement intent, per-recipient delivery/read state and actor history; extend as needed without a second inbox |

Published reads join only the published revision's dates, audience and approved media. Working edits must not leak through mutable child rows. Enforce foreign keys, valid ranges, type checks, revision checks and idempotency in the database. Index referencing columns and period queries. Archive published events; do not cascade deletion into achievements or historical class effects.

Use RLS on exposed data and server-side authorization on every operation. Keep service-role credentials server-side. Use private media storage, content/type/size validation and staged approval. Store object paths, not permanent signed URLs; perform fresh access checks for sensitive files. Previously downloaded copies cannot be recalled.

Proposed student routes are `GET /api/portal/calendar?from=&to=&cursor=` and `GET /api/portal/events/:id`. Proposed admin announcement route is `POST /api/admin/notifications/announcements`. Extend the existing `/api/notifications` and achievement contracts rather than duplicating them. The shared backend must explicitly support the separate portal's authentication and route mapping; staff endpoints do not become student endpoints.

Retain the current `{ success, data, error }` envelope, field-level validation, stale-version conflicts and explicit queued status for asynchronous sends. Preserve user input on failure, retry safe reads, and resolve uncertain writes through request status/idempotency rather than blind resubmission.

## 9. Delivery order

1. Admin event foundation, publication history, audience/media and reviewed class effects inside the existing themed shell.
2. Optional competition link/manual name in the existing achievement form and save path.
3. Source-based Notify students action using the current inbox, outbox, worker and job health.
4. Student calendar/details and notification integration against the agreed released backend contract. Keep one student-facing view.

## 10. Acceptance checks

- [ ] Drafts, staff notes and uncommitted edits never appear in student responses.
- [ ] Cross-account event/notice/file access is rejected, including guessed IDs.
- [ ] Branch notices include enrolled visitors and class changes use correct rosters.
- [ ] Month/year overlap, all-day exclusive ends and device timezones are correct.
- [ ] A moved multi-day event preserves duration and identity; cancellations remain understandable.
- [ ] Class-impact conflicts roll back the combined operation; a notification cannot modify attendance/tuition.
- [ ] Overlapping closures cannot accidentally reopen a class.
- [ ] Linked and manual competition names save correctly; older records/clients remain supported.
- [ ] Event renaming/archiving preserves achievement snapshots; non-competition links are rejected.
- [ ] Save-only sends no notice; optional save-and-notify or Notify students sends once.
- [ ] Double clicks/retries do not duplicate notices; source revisions and deliberate resend reasons are recorded.
- [ ] Delivery failure, permissions, preferences, read state and unavailable source links work correctly.
- [ ] Calendar/events reuse the existing theme/navigation and notification inbox, without separate achievement/announcement modules.
- [ ] Phone/tablet/desktop, keyboard focus, contrast, safe areas and reduced motion are checked.

## 11. Companion prototype

Run `node scripts/serve-events-design.mjs 3192` from the project root and open [the local design preview](http://127.0.0.1:3192). It binds only to this computer. The HTML file also opens directly. Fictional changes reset on reload; there is no real login, upload, message delivery or database write.

Try Calendar/Events, event details, sample documents and the theme preview. In Admin portal preview, publish a draft with or without Notify students, or use Notify students on an existing event. Switch to Student portal preview and open its notification bell; a notice opens the corresponding event and updates the local read state. Achievement entry remains in student data and is described in the handoff rather than duplicated here.

Run `node scripts/check-events-design.mjs http://127.0.0.1:3192` for the isolated interaction check. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an installed Chromium/Edge executable. The check covers responsive layouts, light/dark palette contrast, keyboard focus, draft visibility and demo notification behaviour; it does not prove production authorization, actual delivery or physical-device performance. The implementation acceptance checklist remains open.
