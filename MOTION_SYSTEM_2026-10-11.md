# Infinity motion system

The [12 October navigation update](NAVIGATION_MOTION_2026-10-12.md) extends this system with scroll-aware phone/tablet navigation, wide touch tablet support, measured safe-area clearance and additional interaction regressions. The results below describe the original 11 October checks.

## Design direction

Calm, minimal motion for fast administration. Infinity's red accent, Montserrat/Kantumruy fonts, neutral surfaces, compact corners and existing spacing are retained. Feedback should make navigation and state changes easier to follow while keeping forms immediately usable.

| Interaction | Timing | Behavior |
| --- | --- | --- |
| Buttons, links and fields | 120 ms | Color and border feedback; restrained press response |
| Page and Settings section changes | 160 ms | Small opacity fade; existing forms stay mounted |
| Dialogs and popovers | 180 ms | Subtle fade, 8 px movement and 1.5% scale change |
| Dialog exits | 120 ms | Brief fade and 4 px movement |
| Mobile drawer | 200 ms on touch pointers; 220 ms otherwise | Horizontal slide and lightweight backdrop |
| Reduced motion | Immediate | CSS transitions and Motion animations skipped; native scrolling retained |

The easing curve is `cubic-bezier(.22, 1, .36, 1)`. There are no bounce effects, cascading row entrances, global DOM observers or new animation dependencies. Loading indicators retain movement while work is pending. Persistent connectivity badges are static.

## Implementation

- `app/motion.css`: shared timing variables, utility transitions, control feedback, CSS-only surface fades, notices, loading shimmer and reduced-motion rules. Broad `transition-all` utilities no longer animate layout dimensions, blur or shadows.
- `lib/motion.ts`: shared Motion transition and dialog props, adopted by 34 dialog surfaces across 17 components.
- `components/providers/PortalMotionProvider.tsx`: applies the policy across the app and React portals. It supplies the CSP nonce and skips JS animations when reduced motion is requested.
- `hooks/use-reduced-motion.ts`: subscribes to the system preference and uses a consistent server/hydration snapshot.
- `components/PageTransition.tsx`: fades the current content using the browser animation API, without retaining the previous route, delaying navigation or remounting form drafts. Animations cancel on route changes and reduced-motion changes.
- `hooks/use-portal-scroll.ts`: batches scroll work to one callback per animation frame. The hairline progress bar uses `scaleX` rather than width. React updates only when navigation visibility or the return-to-top threshold changes. Nested page scroll containers are supported.
- Mobile navigation traps focus while open, returns focus to its trigger on close, and makes closed drawer controls inert. Navigation stays visible for reduced motion and focused keyboard controls.
- LMS and staff progress bars use transforms instead of width animations. The anatomy viewer disables automatic rotation and damping for reduced motion; manual camera controls remain available.
- Shared notifications and confirmations remain mounted briefly for their exit animation; exiting overlays become inert to prevent repeated actions.

Motion's [configuration documentation](https://motion.dev/docs/react-motion-config) explains its inherited transitions and reduced-motion policy. CSS and the installed Motion `skipAnimations` API complement that policy so opacity and explicit component transitions also stop under reduced motion.

## Verification

The browser regression `npm run test:motion-browser -- http://127.0.0.1:3100` uses fictional accounts and mocks all provider traffic. It checks all admin routes, retained Settings draft nodes, desktop/tablet/mobile widths, drawer focus, nested scrolling, return-to-top, live preference changes and reduced-motion startup. It records headless scroll long tasks and layout shifts as observations, not a device FPS guarantee.

The existing Settings and authentication browser regressions remain required. No SQL or live database changes are needed for this motion update. Real phone frame rates and the anatomy viewer's GPU performance require testing on physical devices with representative data.

### Recorded results

- Production build and TypeScript validation passed. The build still reports pre-existing lint warnings; the new motion modules lint cleanly.
- All 55 existing automated tests passed.
- Production motion regression passed all 11 admin navigation destinations, retained form nodes, 1440/768/390/375 px layouts, drawer keyboard behavior, nested scrolling, live reduced-motion changes and a fresh mobile touch session with reduced motion.
- Settings and Partners regression passed in development and in the corrected production build, including focus recovery while an error overlay exits.
- Authentication regression passed legacy lock contention, cross-tab sessions, refresh, interrupted private-data loads, overlapping login/logout and failed logout reporting.
- Hydration regression passed three pages and a dark-theme reload.
- The sampled headless Settings scroll recorded no long tasks and a layout-shift total of 0. The progress bar updated its transform and did not update its width. This is a short observation, not a before/after performance benchmark.
- Desktop and mobile screenshots were visually reviewed. The local development server is available on port 3000; the temporary production test server was stopped after verification.
