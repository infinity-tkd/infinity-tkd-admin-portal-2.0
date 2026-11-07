# Contacts and backend review

## Contact records

Students use `public.students.telegram_username`; staff use `public.members.telegram_username`. Both fields are optional text. The application accepts a basic public Telegram username, `@username`, or an HTTPS profile link on `t.me` or `telegram.me`, then stores the lowercase username. Database checks require 5–32 letters, numbers or underscores, beginning with a letter. Contacts may be shared between family members. Login emails, passwords and profile identities remain separate.

Contact controls appear in student profiles, staff cards and tables, the finance ledger, renewal alerts, the renewal agenda, the renewal-day roster and financial dossiers. The controls use validated Telegram, email and phone destinations. They do not send messages automatically. Contacts without a recorded destination do not show a link.

Both registration and editing APIs save contacts through the existing database transactions. Omitting the field preserves the current contact; explicitly clearing it removes the contact. Student and staff CSV imports support optional Telegram columns.

## Database migration

`supabase/migrations/20261013052326_portal_telegram_contacts_and_access.sql` was rehearsed against the installed schema in an isolated PostgreSQL-compatible database before being applied to the connected Infinity TKD project. Its filename matches the verified live migration version, `20261013052326`. It can be reapplied without removing contact records or rewinding student identifiers.

The migration also fixes student registration: the earlier function generated `TKD-...` IDs, while the installed schema requires `STU-M-...` or `STU-F-...`. IDs now come from a protected database sequence, retain the required gender prefix and fit the existing 20-character column. Existing students keep their IDs.

Staff reads of students and enrollments require a relevant operational permission. Address reads require student-directory or student-edit access. Students retain access to their own records. Existing staff contact policies require staff-directory access or staff-management permission, with access to one's own member record allowed.

Live metadata checks confirmed both columns, both contact constraints, the corrected ID function and row-level security on all 43 public tables. The four updated privileged write functions cannot be executed by `anon` or `authenticated`; administrative APIs call them with server credentials after checking the caller.

## Backend corrections

- Student forms now send an explicit field allowlist instead of UI state, CSV fields or server-owned identifiers. Blank optional measurements become null, and empty optional addresses are omitted.
- Validation errors include field names and useful messages without echoing arbitrary input. Malformed JSON, oversized requests, unavailable records and proxy HTML responses have distinct handling. Failed saves preserve drafts.
- Staff username and gender validation now matches installed constraints. Blank optional birth and certificate dates are accepted as null rather than failing unrelated contact edits.
- Staff registration and contact edits omit empty address objects, preventing blank address rows from being inserted simply because the form defaults to Cambodia.
- The student-shop endpoint now checks staff POS permissions before reading or creating orders. Its order history uses pagination rather than the database's default row limit.
- REST product updates use the catalog transaction, including variant checks and stock logging. Product deletion returns a missing-record response when no row exists.
- Unknown roles fail closed. The in-memory request limiter has a bounded size and does not evict active limits to accept new callers.

## Verification and limits

Automated tests exercise student and staff contact creation, updates, clearing, retained contacts on unrelated edits, input failures, account-creation compensation, unauthorized REST handlers, permission overrides, product updates and migration rollback. Database tests also cover enrollment capacity, invalid-contact rollback, student ownership, denied staff reads and protected identifier allocation.

Browser checks use fictional data and block live database writes. They cover student editing, contact destinations, finance navigation, renewal views and staff contacts at desktop, tablet and phone widths. Type checking, linting, the production build and read-only live readiness/data checks are part of verification.

Verification results: 97 automated tests passed; lint reported no errors and 188 existing warnings; the production build completed. The production HTTP check passed 65 route and security cases. Contact, business and failed-data browser regressions passed. Actual data rendered successfully in the read-only harness, including 77 students, 194 payment rows and 10 products. The updated readiness check confirmed the new contact columns and required write functions.

These checks do not certify every workflow or replace real-account staging acceptance. Historical finance records still include 193 paid entries without payment dates; those dates should be reconciled from actual records, not guessed. The previously exposed service-role key still needs rotation before release.

The Supabase security advisor also reports disabled [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) and the existing [`citext` extension in the public schema](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public). Moving that extension requires checking dependent types and routines. The authenticated [security-definer helper notices](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) concern caller-specific permission helpers used by policies. The [tables without client policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) are server-only telemetry and rate-limit storage.

The performance advisor reported only [unused-index notices](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), at informational severity. Keep those indexes until a representative workload and database statistics justify removing them; several support foreign keys or lookup paths that may become important as the academy grows.
