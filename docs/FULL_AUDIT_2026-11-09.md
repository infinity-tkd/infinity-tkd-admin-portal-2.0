# Admin portal full audit — 2026-11-09

Scope: the whole admin portal at `main` (`bad9158`, after pull requests #1–#8): code health, dependencies, live database (read-only), runtime errors, API access control, code hygiene, and every mocked browser check against a production build. It follows the frontend design audit of 2026-11-07 (`FRONTEND_DESIGN_AUDIT_2026-11-07.md`).

**Verdict:** the code is in good shape: every automated check passes and the live data is consistent. What still stands between "checks pass" and real use is the owner-side list at the end (key rotation, the background job, Auth settings, repository visibility, backups).

## Results

| Area | Result |
|---|---|
| Typecheck (`tsc --noEmit`) | pass |
| Lint (ESLint, `--max-warnings=0`) | pass |
| Unit and database tests (serial) | 344 / 344 pass |
| Production build | pass; most pages load about 153 kB of first-load JavaScript (Calendar 283 kB, Profile 277 kB, Operations 287 kB) |
| `npm audit --omit=dev` (what CI runs) | 0 vulnerabilities |
| `npm audit` including dev tools | 6 moderate, all one advisory in lint tooling (see "Accepted") |
| Mocked browser checks on the production build | 22 / 22 pass. Covered: academy management, anatomy, attendance calendar, auth, belt tests, business, calendar admin, component refactor, contacts, data load, membership notifications, MFA, motion, offline attendance, operations, POS recovery, PWA, refactor, responsive (15 routes × 7 widths), role UI (13 roles), settings, shop management |
| Supabase security advisor | no actionable errors (details below) |
| Supabase performance advisor | 6 unindexed foreign keys, now fixed and applied (see below); 124 unused indexes (expected at current traffic) |
| Live data integrity (read-only) | consistent (details below) |
| Runtime errors, last 7 days | none from production; 4 telemetry rows, all from local dev servers and already fixed |

## Fixed in this pass

- **Operations hub CSP trap.** `components/operations/OperationsHub.tsx` lazy-loaded the student portal panel with `next/dynamic` without `ssr: false`. Server-rendered dynamic chunks don't get the CSP nonce, so the strict `script-src` blocks them. This is the same bug that broke two pages on 2026-11-08. It is now client-only, like every other dynamic import.
- **Dead code removed.** Six modules that nothing imports (not in the app, scripts or tests):
  - `components/PermissionGuard.tsx`
  - `components/PasswordStrengthMeter.tsx`
  - `components/canvas/CanvasErrorBoundary.tsx`
  - `hooks/use-mobile.ts`
  - `lib/actions/safeAction.ts` (the app uses API routes, not server actions)
  - `lib/api/resilientFetch.ts`
- **Foreign-key indexes (applied).** `supabase/migrations/20261109063848_belt_test_foreign_key_indexes.sql` adds covering indexes for the 6 foreign keys the advisor flagged (belt test syllabi, candidates, item scores, grading event branch). It is additive only. With the owner's approval it was applied to the live project on 2026-11-09 as version `20261109063848`. All 6 indexes exist, and the advisor no longer reports unindexed foreign keys.

## Database (live project, read-only checks)

- **Students:** 86 live (77 Active, 7 Inactive, 2 Suspended).
  - Every student has a belt.
  - `belt_id`, `current_belt` and the latest promotion all agree.
  - No impossible birth dates, no duplicate name + birth date pairs, every student has a home branch.
- **Attendance:** no orphan rows, no marks on deleted students, no future-dated marks, no duplicate marks for the same class and day.
- **Payments:** no orphans, no zero or negative amounts, no duplicate receipt numbers.
- **Stock:** no negative stock on products or variants.
- **For the office to review:** 4 Active students are not enrolled in any class, so they won't appear on class rosters.
- **Security advisor items that are by design:**
  - 29 tables have RLS on with no policies. These are service-only tables: all access goes through server routes with the service role, and anon/authenticated grants are revoked.
  - 11 `SECURITY DEFINER` helpers are executable by signed-in users (`auth_role`, `is_admin_or_root`, `portal_has_permission`, …). The RLS policies need them, and they only answer questions about the caller.
  - `citext` lives in the `public` schema. Moving it is risky for little gain.
- **Student portal 400s (by design):** the only recent HTTP errors from the live API are `GET /rest/v1/students … ranking_opt_out` returning 400. They come from the student portal, which deliberately asks for a `students.ranking_opt_out` column and falls back when it is missing. If the academy wants a ranking opt-out, adding that column (plus a toggle in the admin student profile) is a small feature.

## API access control

All 61 route handlers were reviewed.
- Every staff and student route authenticates through `verifyCaller` with an explicit role list, or through the shared calendar and student-domain helpers (`calendarStaff`, `calendarStudent`, `studentDomain`).
- The job endpoint requires its secret.
- Public on purpose:
  - `auth/login`: validated and rate limited.
  - `image-proxy`: rate limited, SSRF-hardened.
  - `telemetry/log`: validated and rate limited.
  - `auth/username-to-email`: retired; always answers 410.
- **Code scan:**
  - No `eval`.
  - `dangerouslySetInnerHTML` appears only for the theme bootstrap script and static `<style>` blocks; none interpolate data.
  - Every `target="_blank"` link has `rel`.
  - No stray debug logging, apart from the service worker registration message.

## Accepted

- **Dev-only advisory:** GHSA-g3hv-75wg-m249 (minimatch, denial of service), reached only through `@typescript-eslint` → `typescript-estree` → `minimatch@10.2.6`. Only minimatch 11 is patched.
  - Plain `npm audit fix` "solves" it by downgrading typescript-eslint to 6.x, which crashes ESLint 9. I tried it and reverted.
  - It runs only when linting our own code and never ships. CI audits production dependencies, which have 0 vulnerabilities.
  - It will clear when typescript-eslint moves to minimatch 11.
- **Unused indexes:** 124 indexes have never been used, including the 6 just added. With 86 students that is expected; revisit after a few months of real traffic before dropping any.

## Owner actions still open (re-checked today)

1. **Rotate the exposed Supabase keys.** `.env.local` still uses the legacy JWT anon and service-role keys, including the service-role key that was once committed. Follow `CREDENTIAL_ROTATION.md`.
2. **Make the GitHub repository private.** It is still public. Students' names and birthdays exist in an old commit's screenshot.
3. **Schedule the background job.** `/api/jobs/notifications` has never run (`portal_job_runs` is empty). It creates monthly `membership_invoices` (still 0), starts and ends pauses, and sends alerts.
4. **Supabase Auth settings.**
   - Turn on leaked-password protection (the advisor still flags it).
   - Set the Site URL to the real portal address.
   - Add the student portal's `/reset-password` to the Redirect URLs.
5. **Backups.** Rehearse one backup and restore.

## Worth doing later

- **Leftovers from the 2026-11-07 frontend audit:**
  - Retire the legacy light-mode override layer in `app/globals.css` by moving the remaining dark-only hex classes to theme tokens.
  - Split the 1,600–2,300-line views (Dashboard, Directory, Settings, Schedule, LMS, POS, Partners) into panels.
  - Move the remaining legacy modals onto `components/ui/Dialog`.
- **Vendored reference code:** `CloneIntegrate/` (118 files from a third-party repository) is tracked in Git and excluded from the build and lint. If it is only reference material, consider keeping it outside the repository.
- **Notice the office will see:** 81 legacy lessons remain unpublished for students until staff publish them in the Library.
