# Settings review and improvements — 11 October 2026

The Settings page now separates personal preferences, shared academy details, account management, permissions, security, and application data tools. Existing functionality is retained.

## Layout and design

The direction is a restrained administrative workspace: Infinity's red accent, existing Montserrat/Khmer fonts, clear labels, and neutral surfaces. New styles use theme variables, an 8px spacing rhythm, and visible focus outlines. Desktop uses a section rail and two-column academy forms. Phones use compact section/category selectors and single-column forms. Motion remains limited to existing interactions.

Academy fields are searchable and grouped into brand, contact, billing, training references, and portal/social preferences. The save bar reports the number of edited fields. It remains visible while editing and moves into normal flow for empty search results or unchanged forms. Its mobile placement accounts for the portal's bottom navigation.

## Bugs corrected

- Opening or reloading a protected page briefly cleared authentication while verification ran, redirecting Settings to Dashboard. The store now stays in its loading state during identity verification while clearing private data.
- Incoming academy updates previously replaced the complete local form. Local edits now survive section switches and unrelated incoming changes. Same-field conflicts require review.
- Settings previously submitted the complete profile. Saves now submit changed fields and compare the original database timestamp. A stale write returns HTTP 409 and refreshes the baseline rather than overwriting another administrator's changes.
- Blank contact/link values previously reappeared as built-in defaults. Both empty strings and database nulls now remain empty; missing columns retain compatibility defaults. KHR's fallback symbol is also correct.
- Clearing a numeric input previously became zero. Empty numeric fields now fail validation. The form and API share limits and URL validation; blank names, unsafe URL protocols, and empty updates are rejected.
- Settings edits are disabled without the staff management permission, while initial data loads, or when academy settings could not be loaded.
- Account saves and status toggles now wait for the server. Errors retain the editor and do not report a successful update. Repeated account saves and per-account status changes are blocked while pending.
- Account, password-reset, and cache dialogs now have dialog semantics, keyboard focus containment, Escape handling, and focus restoration. Closing is disabled during pending saves.
- Security password inputs are labelled, and their save button enforces the same 12-character minimum as the server. Other-device sign-out handles provider exceptions and has a pending state.
- The closed mobile portal drawer could cover controls. Explicit responsive drawer visibility now prevents pointer/focus interception. Main content can shrink to its viewport.
- Sound preference reads/writes tolerate unavailable browser storage. Cache size accounts for UTF-16 storage strings. Application export shows its pending state.
- Loaded-record counts no longer claim to certify database health. Academy header status no longer claims an unverified realtime connection. Linked student labels use explicit record/profile IDs instead of email matching.

## Business logic boundaries

Tuition and grace-period defaults feed current billing calculations. Stored payment amounts remain unchanged, while unpaid dues use current rates; historical pricing by effective date is not introduced here. Displaying KHR does not convert stored USD amounts.

Tax rate, preferred date format, class-duration/exam/attendance references, and student portal/audio preferences were stored without full enforcement in the current portal. Their descriptions now state those limits. Automatic tax calculation, exam eligibility enforcement, and enforcement by a separately deployed student portal require additional implementations. Browser sound remains a personal preference.

## Verification

- **52 automated regression tests passed**, including settings validation, stale-save rejection, partial writes, failure responses, repeated login SQL installation, and database transaction/permission checks.
- Type checking passed. The revised Settings, academy panel, security panel, schema/API, and sound files have **zero lint errors or warnings**. The full production build passed and still reports 190 warnings in other existing files.
- Settings browser checks passed in development and production with fictional identities and mocked provider/API responses. Checked draft retention, blank-number errors, failed saves, concurrent edits, partial request bodies, cleared fields after reload, search/empty results, read-only permissions, failed account updates, dialog focus trapping, and password rules.
- Verified **375, 768, and 1440px** layouts without horizontal page overflow, mobile section selectors, control sizes, keyboard field order, actual dark-mode selection, and screenshots. Readable text/focus contrast was visually inspected; a complete accessibility audit and screen-reader/device testing remain outstanding.
- Existing auth browser regression passed: held legacy Navigator lock, cross-tab sessions, reload, refresh, overlapping logout/login, and provider logout failure. Production hydration checks passed.
- CI now runs `npm run test:settings-browser -- http://127.0.0.1:3100` after the production build alongside the existing browser checks. Screenshot output goes to the ignored `scratch` directory.

No live credentials, accounts, or database records were changed. These Settings improvements require no additional SQL migration. The previously prepared portal upgrade and login repair still need deployment if they remain absent from the live database. Mocked browser results do not confirm live sign-in or live saves. Browser Back/Forward navigation and a complete accessibility audit are outside the verified checks.

Implementation: `components/SettingsView.tsx`, `components/settings/AcademySettingsPanel.tsx`, `components/settings/settings.module.css`, `lib/academy-settings.ts`, `app/api/admin/update-academy-profile/route.ts`, and related store/layout/security fixes.
