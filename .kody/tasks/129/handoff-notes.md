# Task 129 — Doc coverage: src/client/hooks/

Added documentation headers to all 8 client-side React hooks plus a folder-level README.

## What was done

1. **Created `src/client/hooks/README.md`** — folder-level header with `@domain frontend`, `@fileType utilities`, `@ai-summary`, and a table describing each hook's purpose and the key gotcha (e.g., timer-pause behavior in `useAccessGate`, silent failure in `useActiveTimeTracker`, etc.).

2. **Added `@ai-summary` JSDoc headers to all 8 hooks** — formatted as `@fileType hook / @domain frontend / @ai-summary <one sentence on the why and the trap>`:
   - `useAccessGate.ts` — timed gate enforcement, pauses timer while warning modal visible
   - `useActiveTimeTracker.ts` — heartbeat + streak pings, silently swallows network errors
   - `useCourseSearch.ts` — debounced search with `AbortController` request cancellation
   - `useCurrentUser.ts` — fetches user from `/api/users/me`, listens to `auth:changed`
   - `useDebounce.ts` — delays value propagation by `delay` ms
   - `useExamCountdown.ts` — localStorage-backed exam dates, 60 s auto-refresh interval
   - `useMediaQuery.ts` — `window.matchMedia` reactive tracking, SSR-safe (initial `null`)
   - `useProgressMap.ts` — batch-fetch completion percentages by `gradeLevel`, silent for anonymous users

## No code changes

All hooks are functionally identical; only JSDoc headers and the README were added.

## Quality gates

`pnpm ci:local` passed on first attempt (typecheck + lint + tests).
