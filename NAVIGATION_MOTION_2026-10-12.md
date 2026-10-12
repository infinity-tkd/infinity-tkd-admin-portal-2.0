# Responsive navigation and motion update — 12 October 2026

The shared portal shell now hides its header and bottom navigation when scrolling down on phones and tablets, and brings them back on an upward scroll. Content spacing follows the actual navigation height, including device safe areas. The academy's existing colors, typography and component styles are retained.

## Navigation behavior

| View | Behavior |
| --- | --- |
| Width below 1280 px | Compact header, drawer and bottom navigation |
| Wide touch tablet, including 1366 px landscape | Compact navigation using the primary coarse pointer / no-hover media query |
| Desktop with a fine pointer, at least 1280 px | Persistent sidebar and header |
| Compact downward scrolling | Hide after 32 px of deliberate movement, below the initial 80 px |
| Compact upward scrolling | Reveal after 14 px; navigation also returns near the page top |
| Drawer open or keyboard navigation | Keep navigation accessible; Tab reveals hidden navigation |
| Reduced-motion preference | Keep navigation visible and skip animated transitions |

Small scroll jitter and out-of-bounds scrolling do not reverse navigation direction. Hidden controls are inert and cannot intercept taps or receive keyboard focus. A touched navigation link retaining focus no longer prevents scrolling from hiding the chrome.

## Spacing and interaction fixes

- Header and footer use a `ResizeObserver` configured for their **border boxes**. Safe-area padding changes now update content clearance even when their content-box sizes stay constant.
- The content reserves the measured footer height plus at least 24 px. Scroll padding and field scroll margins help focused controls clear the fixed navigation. Reserving spacing while navigation hides avoids content jumps.
- The page wrapper uses `min-height` instead of a fixed full height. Long forms can grow naturally, so their final actions no longer extend past the content's bottom padding.
- All six bottom navigation controls fit at 320 px without horizontal overflow and retain touch targets of at least 44 × 44 px.
- Settings save actions stay in normal document flow on compact views. Desktop retains its sticky action bar.
- The return-to-top button hides near the page end to keep final actions clear.
- Closing the drawer releases its backdrop's pointer events immediately while its visual fade completes.
- Navigation is below floating controls, the drawer backdrop and drawer; these layers remain below existing modal layers. Informational connectivity notices cannot intercept taps and fit narrow screens.
- Toasts and update prompts use the shared footer clearance. Persistent connection badges and notice dots have no decorative pulse loop.
- Portal views show one connectivity notice. The provider's duplicate page-level connection bars are suppressed there, and queue/sync notices float above navigation instead of increasing page height. Queue activity takes precedence over the ordinary connection notice.

## Motion and performance

The shell uses short transform/opacity transitions: 200 ms panels on coarse pointers and 220 ms otherwise. Shared control feedback takes 120 ms; page fades use the shared 160 ms touch / 180 ms desktop token. Existing shared dialog transitions and the app-wide reduced-motion policy remain in use.

Scroll handling runs at most once per animation frame. The progress indicator changes `scaleX`, not width; React updates only when navigation or return-to-top visibility changes. Content padding remains stable while the chrome moves. Page fades preserve mounted form nodes and drafts.

The implementation adds no animation dependency or database migration. It does not provide offline write synchronization; connection notices ask users to review interrupted saves before retrying.

## Verification

The final compiled production build passed these checks. Browser regressions use fictional accounts and mocked provider traffic; they do not write to the live database.

- `npm run check`: TypeScript passed; ESLint had **0 errors** and 189 existing warnings; **77 tests passed**.
- `npm run build`: passed with type and lint validation enabled.
- Production motion regression: all 11 admin navigation destinations loaded; Settings kept its form nodes and drafts. Touch layouts at 320, 375, 768, 1024 and 1366 px passed hide-down/reveal-up, minimum touch targets, drawer focus, keyboard reveal, inert controls, overflow and final Save-button hit tests. Fine-pointer desktop layouts at 1280 and 1440 px retained their sidebar/header.
- Safe-area regression: adding a simulated 24 px top inset and 34 px bottom inset updated measured header/footer sizes to 80/97 px and content bottom padding to 121 px. Removing the insets restored the measured spacing.
- Connectivity regression: the narrow phone notice fit the viewport without intercepting controls; reconnect produced one portal notice and did not increase page height.
- Reduced-motion checks: fresh-session and live preference changes passed; navigation remained visible, dialogs skipped motion, and no UI animations remained running.
- Sampled headless Settings scroll: **no long tasks**, **0 layout shift**; progress changed its transform without changing its width. This is an observation, not a physical-device performance benchmark.
- Production HTTP smoke test: **65 route and security cases passed**.
- Hydration: three pages and a dark-theme reload passed.
- Settings and Partners browser regression: passed responsive layout, keyboard/dark-mode, draft retention, validation, error recovery and save/conflict cases.
- Phone and tablet screenshots were visually reviewed. Logs and screenshots are in `scratch/navigation-*`; the browser regression is `scripts/check-motion-browser.mjs`.

Physical iPad/Safari behavior, on-screen keyboard resizing and frame rates on actual devices remain device acceptance checks. Headless Chromium measurements cannot establish performance for every device or every dataset.
