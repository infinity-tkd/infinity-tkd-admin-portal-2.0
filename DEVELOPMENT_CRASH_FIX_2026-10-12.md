# Development crash and account route repair — 12 October 2026

The reported failures were a Node native allocation crash during development compilation and a missing `/profile` route. A 401 followed by a 200 from `/api/auth/login` represents a rejected attempt followed by successful authentication; it does not itself indicate a server failure.

## Changes

- `npm run dev` now uses `scripts/dev.mjs`. The launcher sets a stable 2048 MiB Node heap budget on machines with at least 8 GiB RAM, or 1024 MiB on smaller machines. Explicit `NODE_OPTIONS` heap settings take precedence. CLI arguments are forwarded without a shell.
- Next.js 15.5.27's installed development CLI otherwise derives its heap allowance from half the machine's physical memory. On this approximately 16 GiB Windows machine that allowed roughly 8 GiB, despite substantially less available memory and another portal running.
- Node stack source maps are disabled by default using Next's supported `--disable-source-maps` flag. Browser debugging maps remain enabled. Set `PORTAL_DEV_SOURCE_MAPS=1` to restore Node stack mapping.
- Enabled Next's Webpack memory optimizations. Disabled eager server entry preloading. This reduces startup loading; it does not unload every module after requests.
- Replaced 41 Phosphor icon barrel imports with supported direct component imports, avoiding unnecessary icon-module traversal while preserving icon names and aliases.
- Added `/profile` with the signed-in user's own profile and the existing account security panel. The sidebar account card now links to it. Existing login and forced-password-change guards still apply.

An initial 1536 MiB heap budget caused Next's memory watchdog to restart after compiling several routes. It was replaced with the stable 2048 MiB budget before final verification. Next checks used heap against 80% of its heap limit, so an overly small budget caused repeated restarts and connection resets.

## Verification

- Production build passed, including TypeScript and ESLint checks. Next compiled successfully in 21.6 seconds and completed page generation. There are 188 non-blocking lint warnings in the existing codebase; this repair does not claim that every warning has been resolved.
- All 60 isolated regression tests passed, including a real child-process check that Node applies the development heap limit and preserves explicit user overrides.
- All 15 actual page routes returned HTTP 200 in development, followed by repeated dashboard, LMS and account requests. The server remained on the same PID throughout this run and subsequent browser checks; no fatal allocation error or memory-watchdog restart was recorded.
- The fully loaded development process reached approximately 2.82 GiB peak private commit. The 2 GiB setting limits V8 old-space, not total process memory; Webpack/native allocations consume additional memory.
- Production smoke checks passed all 64 page/security cases, including `/profile`, protected APIs, CSP nonces, origin rejection and safe invalid-input responses. No database mutations were submitted.
- Browser authentication regressions passed in both development and production: contended legacy Navigator lock, login, cross-tab session sync, session restoration, token refresh, logout races, failed-logout reporting and account navigation/direct reload. `/profile` fitted a 375 px mobile viewport without horizontal page overflow.
- Production hydration checks passed on three pages and a dark-theme reload, including browser-hidden nonce attributes matching the response CSP.

Browser authentication checks use fictional identities and mocked providers. They verify application behavior without validating anyone's real password. No SQL or live database changes were required for this repair. These results cover the exercised workload on this machine; they cannot guarantee unlimited memory availability under every workload.

## Running

```powershell
npm run dev
```

Use the npm command so the launcher applies the memory settings. Restart an older development process after updating the code. Optional port:

```powershell
npm run dev -- --port 3002
```

For production use the compiled server:

```powershell
npm run build
npm run start
```

## References

- [Next.js 15 memory usage guidance](https://nextjs.org/docs/15/app/guides/memory-usage)
- [Phosphor React import performance guidance](https://github.com/phosphor-icons/react#import-performance-optimization)
- Installed Next.js CLI and server implementation: `node_modules/next/dist/cli/next-dev.js` and `node_modules/next/dist/server/lib/start-server.js`.

Detailed local verification logs are in the ignored `scratch/` directory: `crash-production-build.log`, `crash-tests-final.log`, `crash-dev-route-results.json`, and `crash-dev-v2.*.log`.
