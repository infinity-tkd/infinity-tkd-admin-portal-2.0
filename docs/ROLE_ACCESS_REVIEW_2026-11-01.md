# Role access review

Infinity Taekwondo · Administrator portal · 1 November 2026

This review checks whether navigation, visible controls, API authorization and database permissions agree. It includes real Root, Head Coach, Coach and Assistant Coach sessions, the current live role configuration, and isolated permission tests for the other roles and overrides. It does not claim that every role has been signed in with a real account.

Three tested migrations were installed in the live database on 1 November 2026: [role_permission_boundaries.sql](../supabase/migrations/20261101161201_role_permission_boundaries.sql), [role_read_privacy_boundaries.sql](../supabase/migrations/20261101161209_role_read_privacy_boundaries.sql) and [staff_member_privacy_boundaries.sql](../supabase/migrations/20261101162248_staff_member_privacy_boundaries.sql). Their local versions match the registered Supabase versions, and their SQL hashes were preserved when the local files were aligned. They do not modify saved role grants, user overrides or business records. The [release manifest](../supabase/role-release-migrations.json) records their versions and hashes.

## Accounts and verification scope

The live account inventory contained:

| Role | Profiles | Verification in this review |
| --- | ---: | --- |
| Root | 1 | Real signed-in read-only desktop and mobile inspection; isolated API and SQL tests |
| Super Root | 0 | Isolated model, API and database tests; no genuine account available |
| Admin | 0 | Isolated model, API and database tests; no genuine account available |
| Head Coach | 1 | Genuine signed-in read-only UI checks; live configuration and isolated permissions/control tests |
| Coach | 1 | Genuine normal sign-in completed; read-only role checks and isolated permissions/control tests |
| Assistant Coach | 4 | One existing account signed in normally for read-only UI checks; live configuration and isolated permission tests |
| Student | 1 | Isolated staff-boundary, restored-session and self-service tests; no staff access granted |

No user-specific permission overrides were present in the inspected live configuration. Saved role overrides still matter: the Admin role's `action:staff_manage` and `action:student_delete` denials remain effective even when an older management alias is granted.

The real Root session review covered Settings and the access matrix at desktop width 1280 and mobile width 390, plus calendar, navigation and data display checks. The owner also signed in normally with the existing Head Coach account for read-only role checks and handled its required password setup themselves. No live account was created, deleted, disabled, promoted or demoted; no saved permission grant or user override was changed for testing. No student, payment, attendance or inventory record was deleted or removed.

Head Coach checks covered actual dashboard data, calendar permissions, Settings/Finance direct-route denial and attendance at widths 1440, 834 and 390. Coach checks covered actual schedule and calendar data, absent management controls and direct Staff-route denial. Assistant Coach checks covered actual dashboard/library data, unavailable library editing controls, navigation and widths 1440, 834 and 390. Its final development-server session survived a reload with no data-loading alert. Mobile content had 87px of bottom padding above the 63px navigation footer. The existing capacity warning remained visible rather than changing the roster.

Additional role tests use fictional identities and isolated PostgreSQL fixtures. Provider identity responses are mocked in API tests. Those tests exercise the production authorization code and real SQL/RLS behavior, but they are not evidence of a genuine sign-in, MFA challenge or device session for each role.

## Permission rules

The central resolution order remains:

1. Root and Super Root keep the system owner's full authority.
2. A user-specific override wins over a role override.
3. A role override wins over the factory default.
4. A missing override inherits the documented factory default; it does not create a saved grant.

For a non-owner role, a granted action also needs an applicable page permission. Shared curriculum editing can use either LMS or Library access; shared staff administration can use Staff or Settings access. A legacy alias must also satisfy its canonical permission and applicable page requirements. An old broad alias cannot override an explicit canonical denial.

Student accounts cannot acquire staff actions through discretionary grants. Their self-service account endpoint remains limited to their own permitted personal fields. The administrator portal rejects Student sessions rather than displaying a partial staff interface. Unknown roles fail closed.

Role defaults are starting points, not a substitute for the saved matrix. A custom Coach action grant can enable an otherwise unavailable staff function when its page requirement is also satisfied. Owner-only controls, Root account protection, administrator-only archive authority and other explicit approval boundaries remain separate checks.

## Problems corrected

| Area | Finding and corrected behavior |
| --- | --- |
| Permission loading | Failed or incomplete permission reads could leave stale grants or data visible. The store now clears the old permission state and fails closed until the required permissions have loaded. |
| Parent page checks | An action grant could remain usable after its module's page permission was denied. Shared dependency checks now apply to browser controls, API authorization and the SQL evaluator. |
| Legacy aliases | Older management aliases could disagree with a canonical denial. Canonical and parent-page requirements now apply to those aliases too. |
| API permission reads | Checking only the requested action omitted its page dependencies. The API now fetches the required role/user permission rows in two bounded queries. |
| Event archive | The central API guard mistakenly checked event creation for an archive request. Archive now checks publication authority, while retaining its administrator-only boundary and revision checks. |
| Account provisioning | A delegated non-Admin staff role could reach Auth-provider creation before SQL rejected a requested Root account. Every non-Root role is now rejected before that provider call. |
| Student self-service | An erroneous Student staff-management override could be treated as cross-account administrative authority. The API and installed SQL now preserve the Student self-only boundary regardless of that override. |
| Direct database writes | The installed SQL routes browser permission evaluation through the active-account/MFA guard. A lower-assurance administrator token cannot bypass the API by writing attendance directly. |
| Settings writes | Billing timing and quality-review mutations used the read-only Settings page key. They now require staff-management write authority; read-only views remain available to their authorized readers. |
| Private responses | Central authentication, validation and error responses now explicitly use private/no-store cache protection. |
| Visible controls | Schedule, Library, Staff, Dashboard, attendance and LMS controls now use effective permissions rather than broad role-name tests. Read-only learning and 3D viewing remain available when their page access allows them. |
| Finance information | Student amount banners and payment controls require the corresponding financial read/write permissions. A directory or attendance view alone is not a reason to display a collection action. |
| Shared student reads | Operational screens previously had full-table student read access, including private fields unrelated to their module. The restrictive policy reserves full student rows for Directory readers. Other authorized modules use a verified server endpoint with a small purpose-specific field allowlist. |
| Shared staff reads | Schedule readers could directly query other staff profiles. The policy reserves full staff profiles for Staff readers, retains own-profile login/MFA bootstrap, and supports small staff labels through a separate verified endpoint. |
| Settings account management | Account administration can intentionally be granted through Settings while Staff read is denied. Restrictive policies reserve full other-member/address records and certificate history for Staff readers; the account list uses its own narrow server projection. Own active-member access is retained. |
| Catalog and learning reads | Being active could bypass POS, learning and schedule page denials. Restrictive read policies now require a supported module, including the shared class and dossier resources their authorized screens need. |
| Navigation | Attendance-only users can reach the supported Operations session view. Restricted-page guidance leads to the first permitted page instead of a fixed destination the user may also be denied. |
| Learning records | Opening a video no longer records official completion automatically. Viewing and genuine recorded progress remain different actions. |
| Mobile lesson viewer | Overlapping full-height panels were replaced with a scrollable layout and reachable close control, with keyboard and focus behavior retained. |
| Capacity display | Dashboard class summaries use the same unique active-student count. An over-capacity roster is flagged for review; its saved capacity and enrollment records are not changed. |

The existing Weekend-Morning capacity decision is preserved: capacity stays 35 and the roster requires review. This pass does not remove students to make a warning disappear.

## Database changes

The first migration changes access-control functions and their grants. It does not run a business-data cleanup, backfill, deletion or role-grant reset.

- `portal_permission_default` provides the same factory fallback as the application model.
- `portal_permission_allowed` applies account state, canonical aliases, explicit denials and parent-page dependencies to a verified actor.
- `portal_has_permission` remains an own-session browser check and includes the active-account/MFA requirement.
- `portal_assert_actor` remains server-only and rejects Student actors for staff operations, including operations that use a read key internally.
- `portal_update_user` retains its self-service path while excluding Student staff authority.
- `portal_operations_mutate` requires write authority for billing timing and quality-review changes.

The private explicit-actor helpers are not executable by anonymous or authenticated browser roles. Existing protected profile-table writes remain unavailable directly to those browser roles. SQL tests verify that page and canonical denials also block direct student updates and service transaction assertions.

Before preparing the replacements, the four existing live function bodies were compared with their canonical local sources. Their hashes matched. The migration therefore preserves the existing profile, transaction and audit behavior around the changed permission checks.

The second migration adds seven restrictive SELECT policies. It preserves existing write policies and Student server boundaries, and prevents an older permissive policy from widening these reads:

| Data | Required staff read access |
| --- | --- |
| Full student records | Directory |
| Other staff profiles | Staff; an active own profile remains readable for login/MFA bootstrap |
| Products and variants, including cost/stock | POS |
| Library assets and workout templates | Library, LMS or Directory dossier access |
| Class schedule records | Schedule, Attendance, Dashboard, Directory, Financials, LMS or POS |

The third migration adds three restrictive read policies for `members`, `member_addresses` and `staff_dan_history`. Full other-member records and certificate history require Staff page access; Settings account management uses its own narrow server endpoint. An active user retains their own member/address rows. Certificate history had no separate self-service read policy, and this change does not add one. This prevents the intentional Settings-or-Staff management dependency from also granting unrelated medical, address or certificate reads. Its installed version is `20261101162248`.

Server summary endpoints verify the staff identity and effective page permission before querying an explicit column list, and project that allowlist again before returning the result. These responses are private and not cached. They provide the operational identity, billing or learning fields needed by the requested purpose; medical notes, allergies, emergency contacts, addresses, signatures and certificates are not returned by the minimal roster endpoint. This is a baseline module boundary, not a new per-field consent or emergency-access policy.

## Evidence and release checks

Focused backend verification passed 18 tests, including the new seven-role capability matrix, account-provisioning boundary, Student self-service boundary and isolated PostgreSQL/RLS cases. The final SQL-focused run passed seven tests, including four added privacy/read-boundary cases. Targeted backend lint and diff formatting checks passed.

The SQL cases compare the central permission model with database decisions for all seven roles, canonical actions, aliases, factory fallback and explicit overrides. They also check direct browser update denial, private helper execution denial, administrator MFA and safe Student self-service. These are meaningful allow/deny tests rather than a claim based on hidden buttons alone.

The added privacy cases run genuine PostgreSQL SELECT statements under the authenticated role. A finance-only identity cannot read student medical fields, other staff profiles, POS costs or unrelated learning records. Supported shared resources remain available; the next direct query after a permission revocation is denied. Own-profile MFA bootstrap still works at the lower assurance level while private module records remain denied. Misconfigured Student grants do not open a direct staff-table route.

Live post-installation inspection confirmed all ten restrictive SELECT policies across the three migrations. Before/after counts remained unchanged: 86 students, 194 payments, 475 attendance records, 8 profiles, 10 products, 86 enrollments and 1 event. The stored role-grant fingerprint was unchanged and there were still no user-specific override rows. These checks confirm preservation of the inspected data during this release; they do not claim that counts alone prove every possible business transaction.

The notification queue regression also now declares its starting quiet-hours state explicitly. Its publication/scope assertions no longer depend on the time of day the test runs; a separate assertion in the same test still activates and verifies a precise quiet window. The combined post-alignment SQL/notification rerun passed all eight tests.

The final `npm run check` passed: TypeScript passed, lint reported no warnings, and all **260 tests** passed. The final production build passed. The live, read-only database-readiness check passed, including the new permission helpers and zero-row startup query shapes.

The isolated browser matrix passed against the production build: **13 scenarios**, **33 navigation/shell viewport checks** at widths 1440, 834 and 390, and no JavaScript or hydration errors. Module-action, student-detail, restricted Settings account-management and LMS keyboard/close checks ran at mobile width 390. Student-session restoration and permission-service failure were separate fail-closed scenarios. No business mutation was submitted by those fixtures. Fixtures use fictional identities and mocked provider/data responses; they do not establish real production authentication or real-device performance.

Additional regressions cover the Settings-only account manager, narrow account summaries, existing Student-link preservation, and merging fresh account identities with skipped or temporarily unavailable member details. A skipped member read no longer overwrites a freshly loaded account list. Only authorized matching member fields may be retained during a temporary outage; revoked access removes private cached fields.

Two development servers were found listening on port 3000 on different local addresses. They were consolidated into one development listener for the real-account checks. Production HTTP preview rejects sign-in by its HTTPS origin policy; real HTTPS deployment sign-in remains a separate acceptance check. The real account inspections used the local development server with the live database, while the release browser matrix used an isolated production server.

Evidence includes `scratch/role-release-check-accepted.log`, `scratch/role-release-build-final.log`, `scratch/role-live-readiness-final.log`, `scratch/role-ui-production-final.log` and `scratch/role-ui-browser-evidence.json`. Scratch evidence is local and intentionally excluded from Git.

## Remaining acceptance and policy decisions

- Repeat genuine authentication and authorized/denied writes in approved staging accounts before deployment. Live checks here were read-only; write paths were tested with isolated API/SQL fixtures. Admin and Super Root have no live account in the inspected inventory; no substitute account was fabricated.
- Complete real HTTPS production-domain sign-in, proxy, cookie/session and monitoring acceptance after a deployment target is chosen. The HTTP production preview deliberately retained the existing HTTPS origin policy; it was not treated as a successful end-to-end production login test.
- Repeat authorized and denied actions after a role or permission change in a controlled environment. Confirm that an already-open desktop tab and mobile view update correctly.
- Validate physical phone/tablet behavior and any assistive-technology requirements. Browser viewport checks are useful evidence but do not replace physical-device acceptance.
- Decide any finer personal-field policy within Directory and Staff access, including sensitive-access audit, consent and emergency exceptions. The new module boundaries and operational projections do not define those academy policies on their own.
- Decide the optional improvements in [Improvement ideas](IMPROVEMENT_IDEAS_2026-11-01.md). None of those proposals is implemented by this report.

Credential rotation and separate student-portal feature expansion remain outside this pass, as previously agreed. The current calendar/student integration and its separate acceptance limits are documented in the [calendar integration guide](CALENDAR_STUDENT_INTEGRATION_2026-11-01.md).
