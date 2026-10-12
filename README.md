# Infinity Taekwondo Admin Portal

Infinity Taekwondo Admin Portal brings the academy's daily operations into one place. Staff can manage student records, attendance, classes, tuition, shop orders and academy settings through a shared interface.

The portal supports desktop, tablet and mobile layouts. Access depends on the signed-in staff member's role and permissions, with account and database checks protecting administrative operations.

## Features

| Area | What it covers |
| --- | --- |
| Dashboard | Academy overview, activity and quick access to daily tasks |
| Students | Registration, contact details, household links, medical information, belt history and achievements |
| Staff | Instructor records, staff accounts, permissions and Dan history |
| Attendance | Class attendance, student check-in and attendance history |
| Schedule | Branches, class times, coaches, enrollment and capacity |
| Financials | Monthly tuition, payment records, household payments, receipts and reporting |
| Shop and POS | Products, variants, stock, counter sales and student order management |
| Learning resources | Curriculum, training materials, progress tracking and an interactive anatomy viewer |
| Partners | Partner contacts, collaboration details, agreements and supporting documents |
| Settings | Academy information, preferences, account access and security controls |
| My profile | Personal account details and password changes |

On phones and touch tablets, the header and bottom navigation hide while scrolling down and return when scrolling up. The layout accounts for device safe areas and reserves room for the bottom menu. Shared transitions are brief, and reduced-motion preferences are respected.

## Technology

| Layer | Technology |
| --- | --- |
| Application | Next.js 15 App Router, React 19 and TypeScript |
| Database and accounts | Supabase PostgreSQL, Auth, Storage and Realtime |
| Styling and interaction | Tailwind CSS 4 and Motion |
| Anatomy viewer | Three.js and React Three Fiber |
| Installable web app | Serwist service worker and web app manifest |
| Verification | Node.js tests, PGlite and Playwright |

The browser renders the interface and reads data permitted by database policies. Next.js API routes handle protected administrative workflows. Database functions keep related operations, such as payment recording and inventory changes, within transactions.

## Getting started

### Requirements

- Node.js 22, 64-bit, and npm
- Access to the repository
- A Supabase project with the existing Infinity TKD schema and required upgrades
- An active staff account linked to its database profile

### 1. Install dependencies

Open a terminal in the repository folder and run:

```sh
npm ci
```

This installs the versions recorded in `package-lock.json`.

### 2. Configure the environment

For the first setup, copy `.env.example` to `.env.local`. If `.env.local` already exists, update it rather than replacing it.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Set the following values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-service-role-key
APP_URL=http://localhost:3000
TRUST_PROXY_HEADERS=false
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public key used by the browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server credential for protected administrative operations and repository diagnostics |
| `APP_URL` | Configured application URL; use the deployed HTTPS address for production |
| `TRUST_PROXY_HEADERS` | Enable only when the hosting proxy replaces incoming forwarded IP headers |

Keep `.env.local` and server credentials out of version control. The service-role key must stay on the server and must never use a `NEXT_PUBLIC_` prefix.

### 3. Check the database

```sh
npm run db:readiness
```

This checks required database functions, columns and startup query shapes without changing records. Resolve any missing requirements using the database setup guidance below.

### 4. Start the portal

```sh
npm run dev
```

Open [localhost:3000](http://localhost:3000) and sign in with an approved staff account using its username or email and password. Student accounts use the separate student portal.

The development launcher applies a memory budget suited to the machine. Development output is stored in `.next-dev`, separately from production output in `.next`.

To use another port:

```sh
npm run dev -- --port 3002
```

Restart the server after changing environment values. For development crash troubleshooting, see [Development setup and memory notes](DEVELOPMENT_CRASH_FIX_2026-10-12.md).

## Database setup and upgrades

This repository contains upgrades for an existing Infinity TKD database. It does not include a complete schema for a new database. The simplified database fixtures under `tests/` are for isolated tests.

For an existing installation, check its migration history before applying SQL. Back up the database and rehearse missing upgrades on a staging copy with the same schema, Auth configuration and Storage policies.

The main upgrade files are:

| File | Purpose |
| --- | --- |
| `supabase/preflight-20261009.sql` | Checks the existing database before the baseline upgrade |
| `supabase/production-upgrade-20261009.sql` | Combined baseline of nine upgrade migrations through 11 October 2026 |
| `supabase/migrations/20261011215930_portal_realtime_sync.sql` | Separate follow-up for realtime publication |
| `supabase/migrations/20261012065927_portal_achievement_integrity.sql` | Separate follow-up for achievement transactions and validation |
| `supabase/postflight-20261009.sql` | Verification queries after the baseline upgrade |

Apply the baseline bundle **or** its individual migrations, then the missing follow-ups in chronological order. Do not apply both versions of the baseline. The connected Infinity TKD database already has these upgrades; the full bundle should not be reapplied there.

The [database review](DATABASE_REVIEW_2026-10-11.md) and [release preparation guide](PRODUCTION_READINESS.md) explain prerequisites, migration order and reconciliation work.

## Development and verification

Run the standard checks before submitting or releasing changes:

```sh
npm run check
npm run build
```

`check` runs TypeScript validation, linting and automated tests. The production build also enforces type and lint checks.

Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Check TypeScript without generating application output |
| `npm run lint` | Review application code with ESLint |
| `npm test` | Run isolated regression tests |
| `npm run db:readiness` | Check database requirements without changing records |
| `npm run db:readiness -- --startup-only` | Check startup query schemas without downloading records |
| `npm run db:check-data` | Read and validate actual startup records; print aggregate diagnostics |
| `npm audit --omit=dev` | Check runtime dependencies for reported vulnerabilities |

### Browser checks

Install the test browser once:

```sh
npx playwright install chromium
```

Start a local development or production server, then run the relevant checks in a second terminal. These examples use the development server:

```sh
node scripts/check-hydration.mjs http://127.0.0.1:3000
npm run test:auth-browser -- http://127.0.0.1:3000
npm run test:settings-browser -- http://127.0.0.1:3000
npm run test:data-load-browser -- http://127.0.0.1:3000
npm run test:pos-recovery-browser -- http://127.0.0.1:3000
npm run test:motion-browser -- http://127.0.0.1:3000
npm run test:business-browser -- http://127.0.0.1:3000
```

These browser regressions use fictional accounts and mocked provider responses. They cover account sessions, failed reads and saves, permissions, draft retention, reporting, navigation and reduced motion.

`npm run test:live-render -- http://127.0.0.1:3000` checks rendering with actual database records read into an isolated browser session. It requires server-side database credentials and blocks administrative writes. Real-account staging tests are still needed to verify sign-in and complete transaction workflows.

The quality workflow in `.github/workflows/quality.yml` runs the standard checks, production build, dependency audit and browser regressions.

## Data handling and recovery

When a read fails, the portal shows an incomplete-data notice and offers a retry. Previously confirmed records remain available where supported. Resolve the notice before relying on financial reports or totals.

Interrupted saves need special care: check whether the operation completed before submitting it again. Automatic retries are limited to safe reads; supported transaction workflows use request identifiers to recognize repeat submissions.

The installable web app provides an offline fallback and update prompts. It does not guarantee that every page or save will work without a connection. Keep an internet connection for administrative writes.

Application exports are useful for reviewing records, but they do not replace a complete database backup with Auth and Storage recovery.

## Preparing a release

The portal has been verified locally as a release candidate and has not yet been deployed. Before releasing it:

1. Confirm the target database has the required migrations and a tested backup and restore process.
2. Configure production secrets, the application URL, HTTPS and trusted proxy behavior.
3. Check provider password, redirect and session settings.
4. Test real staff accounts, permission restrictions and representative payment, enrollment and stock workflows on staging.
5. Check the separate student portal against shared database and workflow changes.
6. Verify mobile, tablet, accessibility and installed-app behavior on actual devices.
7. Set up error monitoring and review any outstanding historical record reconciliation.

Build and start the production application with:

```sh
npm run check
npm run build
npm run start
```

For deployment requirements and recorded test results, see [Production readiness](PRODUCTION_READINESS.md), [the system audit](DEEP_AUDIT_2026-10-12.md) and [responsive navigation verification](NAVIGATION_MOTION_2026-10-12.md).

## Project structure

```text
app/                    Pages, API routes, layouts and global styles
components/             Views, forms, dialogs and shared interface components
components/atlas/       Anatomy viewer
components/providers/   Application providers
components/pwa/         Installation and update controls
components/settings/    Settings panels and styles
hooks/                  Shared React hooks
lib/                    Data access, business rules, security and utilities
public/                 Icons, models, manifest and static assets
scripts/                Development, diagnostics and browser checks
supabase/migrations/    Database upgrade migrations
tests/                  Regression tests and isolated database fixtures
.github/workflows/      Continuous verification workflow
```

## Further documentation

| Guide | Covers |
| --- | --- |
| [Production readiness](PRODUCTION_READINESS.md) | Deployment requirements, database upgrades and operational checks |
| [System audit](DEEP_AUDIT_2026-10-12.md) | Business-rule fixes, database verification and remaining release work |
| [Database review](DATABASE_REVIEW_2026-10-11.md) | Schema, access policies, integrity and historical reconciliation |
| [Settings guide](SETTINGS_REVIEW_2026-10-11.md) | Settings behavior, permissions and validation |
| [Data-loading guide](DATA_LOAD_WARNING_2026-10-11.md) | Incomplete-data notices, diagnostics and recovery |
| [Navigation and motion](NAVIGATION_MOTION_2026-10-12.md) | Phone/tablet navigation, spacing, accessibility and performance observations |

## License

Proprietary. © Infinity Taekwondo Academy. All rights reserved. Third-party code and assets remain subject to their respective licenses.
