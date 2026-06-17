Added documentation headers to all 8 source files in `src/infra/loading/` plus a folder-level README.

What was done:
- Created `src/infra/loading/README.md` with folder-level `@ai-summary`, domain, fileType, architecture overview, loading types table, and 4 key gotchas (route safety timeout, hash-only link handling, duplicate prevention, SSR snapshot).
- Added `@ai-summary` JSDoc to each module: LoadingManager.ts, AsyncAction.ts, keys.ts, useAsyncAction.ts, useLoadingState.ts, useRouterWithLoading.ts, resolveHref.ts, RouteLoadingIndicator.tsx, Spinner.tsx, SystemLink.tsx.

Each header captures the *why* and the *trap* without restating what the code does. Key gotchas documented: 15s route auto-unregister, hash-only link exclusion, duplicate prevention default, and SSR snapshot behavior. Quality gates (typecheck, lint, tests) passed on first attempt.
