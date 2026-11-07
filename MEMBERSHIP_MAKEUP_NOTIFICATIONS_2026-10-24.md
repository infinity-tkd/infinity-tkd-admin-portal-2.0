# Membership, makeup attendance and notifications

## What changed

Membership renewal dates now follow the student's first enrollment date. That date is stored separately from the class roster, so moving classes or removing an enrollment does not silently move a student's payment date. Students without an enrollment use their registration date until their first enrollment is saved.

An administrator with payment-recording permission can change the billing day from the student profile or finance dossier. Each change requires a reason and an effective billing month. The system records the previous day, new day, administrator and time in an immutable history. Coaches can review the history where their existing permissions allow it. Students cannot change it. The database permits students to read their own history for integration with the separate student portal.

Changes apply to the selected current or future billing cycle. Earlier unpaid cycles and receipts keep their original dates. A day of 29, 30 or 31 falls on the last day of shorter months. A payment date cannot precede the student's membership start date in the first cycle. Conflicting edits require a reload; retrying the same request does not create another history entry.

## Makeup attendance

Open **Makeup classes** on Attendance or in the student attendance calendar. Scheduled classes enter the review list when their class ends plus a 30-minute marking allowance. The student must have been enrolled on that date and must currently be active.

- Both **Absent** and **Unmarked** appear. Unmarked means the roster needs review; the system does not invent an absence.
- Choose a completed attendance date, including a different weekday, a target class or an additional session, Present or Late, and a reason.
- A makeup records its original class and date separately. It does not overwrite the original attendance or inflate the regular-attendance percentage.
- Each missed class can have one active makeup. A student cannot reuse the same target session for several makeups.
- Correct an error with **Void makeup** and a reason. The original entry and correction remain available for review.
- To change the original class to Present or Late after a makeup was recorded, void that makeup first.

The source filter defaults to the past 30 days and supports a range of up to 93 days. Choose an older range to review older classes. Ordinary additional attendance and linked makeup attendance are labelled separately in the calendar.

## Notifications

The header bell opens an account-specific staff inbox. Notifications link to the relevant student finance dossier, attendance date/class or pending order list. Existing permission checks still apply when a link opens.

The admin portal remains staff-only. Order triggers also create student-owned inbox records, and the notification APIs support authenticated students reading only their own records. Student-facing inbox, push registration and destination links must be wired into the separate student portal before student delivery is enabled there. This repository does not contain that application's interface.

Reminders cover:

- Unmarked attendance from the past 14 days, grouped by class and date. Assigned coaches receive reminders for their classes. An unresolved reminder can return after three days.
- Upcoming membership renewals and overdue unpaid cycles. An unresolved overdue cycle can return weekly. Staff should review the ledger before contacting a student.
- New student-portal orders needing staff confirmation, plus the student's own order status and payment updates. Database triggers create order notices immediately; the reminder refresh also reconciles them.

Read, dismiss, category filtering, quiet hours and per-device push controls are available in the drawer. Preferences affect background push; the inbox keeps all updates. Quiet hours use Cambodia time. Equal start and end hours disable quiet hours.

The inbox refreshes when opened, when the app returns online/foreground, and every minute while visible. Reminder generation is throttled to once per five minutes for each account. Resolved follow-ups leave the unread list. Failed refreshes retain saved notifications and show a retry action.

Background push requires explicit device permission. Lock-screen messages contain a generic academy update, without student names, balances, medical data or authentication tokens. Push endpoints and encryption keys stay in server-only tables. Sign-out attempts to detach the device without trapping the user if a browser API fails.

Deliveries use a database lease, a maximum of five attempts and a 30-minute delay after transient failures. Expired subscriptions are removed. A stable notification tag reduces duplicate device cards if a delivery is retried after an interrupted acknowledgement. Delivery remains subject to browser, operating-system and network policies.

## Database and access control

The SQL is in [20261023155619_membership_makeup_notifications.sql](supabase/migrations/20261023155619_membership_makeup_notifications.sql). It was applied to the connected Infinity TKD Supabase project and recorded in its migration history. Do not rerun a historical migration manually against that project.

All seven new tables have row-level security enabled. Browser users can read only permitted membership/makeup records and their own inbox/preferences. Browser roles cannot execute the privileged mutation or worker functions. API routes derive the actor from the verified session, validate payloads and enforce the action permission before calling server-only functions. The database repeats the business-rule checks, locks the student during linked writes, and writes audit entries in the same transaction.

Live post-migration checks retained **86 students, 194 payments and 475 regular attendance records**. No real billing override or makeup attendance was created for verification. Tests use isolated database and browser fixtures.

## Production setup

The portal has not been deployed. The inbox and database changes are implemented; app-closed reminder generation needs a running production worker or external scheduler.

1. Deploy the application with HTTPS and set `APP_URL` to its production origin.
2. Run `npm run notifications:setup` once in the secure configuration environment. It creates missing VAPID keys and a random job secret in `.env.local`, without printing them. It preserves existing keys and refuses a partial key pair.
3. Supply `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` and `NOTIFICATION_JOB_SECRET` to the application server. Keep the same VAPID pair across releases. Only the public key is returned to authenticated clients.
4. Run `npm run notifications:worker` under a process supervisor. Alternatively, run `npm run notifications:worker -- --once` once a minute through an external scheduler. The worker sends an authenticated request to `/api/jobs/notifications`; keep its bearer secret out of URLs and client code. Run one scheduling method, not both.
5. Check worker output for failed or pending work, and restart it automatically after a process failure. It logs aggregate counts, not push endpoints or student records. The one-shot command exits unsuccessfully on job or delivery failures.
6. Open the deployed app, enable notifications from the drawer, and send a test notification. Check read/dismiss, a real staged order and an overdue staged record with representative staff permissions.

On iPhone and iPad, web push requires a supported version of iOS/iPadOS and the portal installed to the Home Screen, then opened there. Desktop and Android support depends on the browser. Unsupported or denied push still leaves the in-app inbox usable. Physical-device delivery, operating-system battery restrictions and app-closed behaviour require device acceptance testing after deployment.

Keep the previously exposed Supabase service-role credential rotation as a release requirement. Removing a credential from Git history does not revoke it. Supply the replacement securely to the server and verify authentication before release.

## Verification

- Production compilation completed with Next.js 15.5.28.
- The dependency audit reports no known production vulnerabilities after updating the validator to Zod 4.6.7 and overriding the PWA packages' older pinned copy. The memory-exhaustion advisory is [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- Type checking passed; the regression suite passed **130 tests**.
- Isolated Postgres tests cover immutable billing history, admin-only changes, optimistic concurrency, idempotency, makeup/original-attendance separation, order triggers and row-level access.
- API tests cover actor spoofing, invalid payloads, action permissions, account-owned inbox mutations, unsupported push endpoints and scheduler authentication.
- Push tests cover leases, generic payloads, expired subscriptions, retry delays, permission changes, malformed worker payloads and same-origin notification clicks.
- Browser checks cover failed-save recovery, request-key reuse, double activation, makeup recording/voiding, preferences, reminder links and drawer layouts at 390, 834 and 1440 pixels.
- The production HTTP smoke test passed 71 routes and security cases. The existing contact, finance/business, student attendance calendar and anatomy browser suites also passed with mocked services and no live writes.
- The new feature files pass lint without warnings. The wider repository retains existing lint warnings.
- Secret scans found no matching private configuration values in 134 public build files or the changed source files. `.env.local` remains ignored by Git.
- Student order API responses omit internal staff notes. Staff-only sign-in remains enforced by both the server login and client session checks.

The repository still has pre-existing lint warnings and other release work recorded in [Production readiness](PRODUCTION_READINESS.md). These checks establish the tested behaviours; they do not substitute for staging acceptance with real staff and devices.

Supabase still reports its earlier warnings for the public `citext` extension, intentional authenticated authorization helpers, and disabled leaked-password protection. The new mutation functions are server-only. Review the provider's [extension guidance](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [function guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [password protection settings](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) before release. The five tables with RLS and no read policy are deliberately server-only; adding broad client policies would weaken their boundary.
