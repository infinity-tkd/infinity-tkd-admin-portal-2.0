# Frontend design, UX and responsive audit — 2026-11-07

Scope: the admin portal frontend (`app/`, `components/`, `hooks/`, `lib/`, `app/globals.css`), checked at 375, 390, 768, 834, 1024, 1280 and 1440 px in light and dark themes. Branch `feat/belt-tests-and-portal-operations`; nothing committed.

The reference is the **Partners & MOU** page (`components/PartnersView.tsx`, nav label "Partners & MOU"; there is no page literally called "Collaborate" — the word appears only in Partners' "collaboration scope" copy). What makes it work: a quiet header (brand-tinted icon tile, mono eyebrow pill, bold title, one-line description, actions on the right), metric cards that double as filters, one search + filter toolbar, cards and tables with the same 8px radius, hairline borders and `#141414` dark surfaces, and a dashed empty state. Those patterns are now shared components used by every page.

## What changed across the portal

**Shared design system (new, `components/ui/`)**
- `app/globals.css`: theme tokens (`brand`, `page`, `surface`, `surface-muted`, `surface-inset`, `control`, `line`, `line-strong`, `ink`, `ink-muted`, `ink-subtle`, `on-brand`) registered with Tailwind, switching with `.dark`; `color-scheme` per theme (native date pickers and scrollbars now follow the theme); default border colour token (Tailwind v4 otherwise uses `currentColor`); real `no-scrollbar` utility (it was used in ~20 places but never defined); `hover-reveal` (hover affordances stay visible on touch and keyboard focus); iOS-only 16px form text to stop focus zoom.
- Removed the light-mode rule that forced every `.border/.border-b/.border-r` to grey with `!important`. It erased every coloured border in light mode (selected states, status pills, alert boxes, the active KPI card).
- `styles.ts` (buttonClass via cva, card/field/label/filter/toolbar/badge classes), `PageHeader` + `SegmentedTabs`, `KpiCard`, `Toolbar` (`SearchField`, `FilterRail`, `ViewToggle`), `States` (`PageLoader`, `BrandSplash`, `EmptyState`, `ErrorBanner`), `Dialog` (bottom sheet on phones, centred card from 640px, labelled, Esc/focus trap/restore), `ModalA11y` (adds the same semantics to legacy modals in one line).
- Settings, Calendar and Operations CSS now read the same tokens instead of their own palettes (their dark surfaces were `#171717`/`#0f0f0f` with `#404040` borders).

**App shell (`PortalLayout`)**
- Phone tab bar follows the iOS pattern: four destinations + More (was five + More, which truncated "Dashbo…", "Operatio…", "Attenda…" at 375–390px). Order favours daily work: Dashboard, Attendance, Students, Schedule, then permitted fallbacks; More highlights when the current page lives in the drawer. Pro-Shop (`/pro-shop`) now highlights its nav item.
- Phone header: logo hidden below 640px and the sync pill is a 44px status dot, so page titles no longer truncate ("ATTENDAN…", "PRO-SHOP …").
- Sidebar active item: brand accent bar + filled icon.
- Splash screens (`app/page.tsx`, shell) share `BrandSplash`; the 13 duplicated route loaders share `PageLoader` (four used `min-h-screen` inside the scroll area and overshot it).
- "Access Restricted" is now an `h1`; the connectivity toast is readable in light mode (its detail line was overridden to dark grey on dark green).

**Dialogs and keyboard**
- 37 legacy modal overlays had no dialog role, no Escape, and no focus trap (Add student/staff, bulk imports, household, dossier, staff/student panels and their sub-dialogs, schedule, directory, dashboard help, login help, PWA install guides, session timeout). All now announce as labelled modal dialogs, trap Tab, close on Escape (blocked while saving; the session-timeout warning never closes on Escape) and return focus. The PWA diagnostics dialog gained the same keyboard handling and sits at the bottom on phones.
- Global confirm dialog: now `alertdialog` with title/description, Esc to cancel, focus trap, portalled so it stacks above other dialogs; phone layout sits at the bottom.
- `useModalFocus` no longer steals focus from a field that used `autoFocus`.
- Partners detail and form modals use the new `Dialog` (they had none of the above). The form's 19 visual labels are now real `<label>`s, the tag remove "×" has a name and a bigger target.

**Phone sheets**
- Centred legacy modals now open as full-width bottom sheets below 640px (rounded top, pinned to the bottom edge, safe-area space under the home indicator). `ModalA11y` marks the overlay and its panel; the CSS lives in `app/globals.css` under `[data-modal-sheet]`. Modals that were already full screen on phones (Add Student) or are side drawers keep their layout.
- The Partners form keeps Cancel/Save pinned in a dialog footer while the long form scrolls.

**Bundle weight**
- Rarely opened, conditionally rendered modals load on demand instead of shipping with their view: Add Student, Bulk Import Students (Students), Add Staff, Bulk Import Staff (Staff, Settings), User Permissions (Settings, access matrix) and the Student Dossier (student panel). In the production build these became their own chunks (bulk student import ≈48 KB, add staff ≈29 KB, user permissions ≈18 KB, dossier ≈26–53 KB). The 3D anatomy stack and html2canvas were already lazy.

**Readability and touch**
- 249 text sizes below 9px (7–8.5px KPI hints, badges, mono captions) raised to a 9px floor, matching Partners' smallest text. Print documents (dossier, receipts, packing slip) keep print scale.
- Compact toolbar controls (26–36px) in Staff, Directory, Promotion history and the birthday sheet are 44px on touch screens; attendance status buttons are 44px on touch, 38px with a mouse.
- 196 more interactive controls sized 28–42px (card and table icon buttons, chips, filters, dialog buttons across Partners, Schedule, POS, Settings, LMS, Library, finance panels) get `pointer-coarse:min-h-11` / `min-w-11`: 44px on phones and tablets, unchanged with a mouse.
- Hover-only controls fixed: promotion edit/delete in the student Belt tab were invisible on touch and keyboard (now always reachable, named buttons); staff copy hint and routine "add" hint use `hover-reveal`.
- `vh` sizes inside the app switched to `dvh` (student panel top offset, directory and receipt panels, POS cart); the shell keeps a `100vh` fallback for Safari < 15.4.
## Page by page

| Page | What was off | Changed | Left |
|---|---|---|---|
| Dashboard | Own welcome-card header; 7.5–9px KPI text; bespoke tabs | PageHeader, SegmentedTabs, KpiCard row; 73 tiny text sizes lifted | Large file (2.3k lines) with inline sub-views; dense intelligence tables still use 9–10px text |
| Operations | Plain unstyled header; red-50 active tab colours; own neutral palette | PageHeader; token-based panels and controls; tab rail scrolls on phones | Panels are still compact forms (`operations.css`) |
| Students | **No `h1`**; single giant card at `min-h-[calc(100dvh-8rem)]`; 32px toolbar buttons | PageHeader with count; 44px touch controls; dvh units | Roster table/action rail markup unchanged |
| Staff (Members) | Card header; KPI swipe rail hid cards; 26–32px filters and view toggle | PageHeader, KpiCard grid, shared SearchField/FilterRail/ViewToggle | Staff grid cards unchanged |
| Attendance | **Horizontal overflow** at 375–834px (roster row and header buttons); duplicate title; 38px status buttons | PageHeader + SegmentedTabs; roster rows stretch so names truncate; header actions wrap; 44px touch status buttons | Analytics panel unchanged |
| Financials | **Horizontal overflow** at 768/834 (tab rail) and 375 (header link); explainer banner sat above the page title | Banner text moved into the header description; 2×2 tabs on phones/tablets, single row from 1024 | Ledger matrix stays a scrolling table by design |
| Pro-Shop / POS | Mixed header; 38px buttons | PageHeader actions + stacked phone tab bar with badges (accessible names unchanged) | Terminal toolbar is a horizontal rail on phones |
| E-Learning (LMS) | Own header; 21 tiny text sizes | PageHeader + SegmentedTabs | Curriculum cards unchanged |
| Belt Tests | Header card, separate mini design system | PageHeader, SegmentedTabs, PageLoader; `belt-tests/ui.tsx` now uses the shared tokens (44px controls) | — |
| Library | Close to Partners already; 42px actions | PageHeader with shared buttons | Asset dialogs are large (1.2k lines) |
| Schedule | Own header; capacity alert above title | PageHeader + SegmentedTabs; alert below header | Weekly matrix stays horizontally scrollable on phones |
| Calendar | Separate header style and palette; crashed on an unexpected events payload | Shared PageHeader and buttons; module palette bound to tokens; bad payloads show the inline Retry state | Module CSS kept (already accessible) |
| Partners | Double padding on phones, nested `overflow-y-auto` scroller, modals without dialog semantics, unlabeled form fields | Rebuilt on the shared primitives (it is now the template), Dialog, labels | — |
| Settings | Extra page padding, own palette, `max-w-7xl` | PageHeader, tokens, same width as other pages | — |
| My account | Unstyled header | PageHeader + token card | — |
| Login | Help modal without dialog semantics | ModalA11y | Visual design left as is |
| PWA install / diagnostics | Install guides without dialog semantics; header pill crowded phones | ModalA11y on both guides; compact status dot on phones | — |
| Error, 404, offline | Dark-only styling: "Dashboard"/"Go back" buttons and the offline card rendered dark text on dark or white on white in light mode; `min-h-dvh` inside the shell | Token-based cards and shared buttons; global fatal screen pinned to dark (it renders without the theme script) | — |

## Verification
- `npx tsc --noEmit --incremental false` — pass
- `npx eslint app components hooks lib middleware.ts next.config.ts sw.ts --max-warnings=0` — pass
- `node --test --test-concurrency=1 tests/*.test.mjs` — 320/320 pass
- `next build` (into a temporary `.next-audit`, removed afterwards; `public/sw.js` restored byte-for-byte) — pass
- New `scripts/check-responsive-browser.mjs` (mocked, no database): every route × 375/390/768/834/1024/1280/1440, fails on horizontal page/shell overflow, offending elements, a missing `h1`, or console errors. Baseline found overflow on Attendance (375–834) and Financials (375, 768, 834) and a missing `h1` on Students. Now passes in light and dark, on the dev server and on the production build. `RESPONSIVE_LOAD_WIDTH=390` also passes (cold loads at phone width). At 390px it also opens Add Student and Add Staff and asserts each fills the width, sits on the bottom edge, takes focus, closes on Escape and returns focus to its button.
- Existing mocked browser checks, all passing against the production build: component-refactor, role-ui (13 role scenarios), settings, motion, refactor, belt-tests, operations, calendar-admin, shop-management, academy-management, business, contacts, data-load, attendance-calendar, membership-notifications, pos-recovery, auth, mfa, anatomy. The whole set (plus tsc, eslint, unit tests and a fresh `next build`) was run again after the second round of changes (phone sheets, on-demand modals, touch targets, Partners footer) and still passes.
  - `check-settings-browser.mjs`: its dark-mode assertion looked for the Settings `h1` inside a `shadow-sm` card. The shared header is intentionally not a card, so it now asserts light heading text on the dark Settings menu surface (same intent).
  - `check-pos-recovery-browser.mjs` was already failing at `e34d390`: it looked for a "Total Revenue" card that commit renamed to "Recorded collections". Label updated; the `$25.00` value assertion is unchanged and passes.
- The dev server on this machine restarts itself when it nears its memory limit and logs `.next-dev` webpack cache errors ("invalid block type"); several check timeouts during the dev-server runs traced to those restarts, which is why the final run used a production build.
- Found while checking: `/calendar` crashed (TypeError) when the events API returned an unexpected payload. The hook now treats that as a load error with the existing inline Retry.

## Left for later (not done in this pass)
- `app/globals.css` still carries the legacy light-mode override layer for ~250 dark-only hex classes (`bg-[#141414]`, `text-white` without `dark:` …). Migrating those components to the tokens would let the override layer be deleted.
- Very large view files (Dashboard, Directory, Settings, Schedule, LMS, POS, Partners: 1.6k–2.3k lines each) should be split into panels; not done here to avoid behaviour changes without component tests.
- Legacy modals now behave correctly and open as phone sheets, but their inner headers and footers still use their original styling; moving them onto `ui/Dialog` would unify those too.
- Controls with fixed `h-8`/`h-9` heights (rather than `min-h-[…]`) or no size class at all were not covered by the touch-target pass.
- Dead-code scan: no frontend module under `components/`, `hooks/` or `lib/` is unreferenced; unused exports in the new `components/ui/` were removed. The repo root still holds one-off scripts and logs from earlier sessions (`fix*.js`, `*_fix.ps1`, `check_*.mjs`, `*.log`); they are outside the frontend and were left alone.
- The Add Staff form shows the default staff password in its field label ("leave blank for default: …"); worth reviewing as a security/product decision.
- The local `.next-dev` webpack cache is corrupt ("invalid block type" on every compile); deleting that folder while the dev server is stopped should make dev compiles faster and steadier. Not done here because it is your local build cache.
- Phone tab-bar order (Dashboard, Attendance, Students, Schedule, then More) is a product choice; change `QUICK_TAB_PRIORITY` in `components/PortalLayout.tsx` if staff use other pages more on phones.
