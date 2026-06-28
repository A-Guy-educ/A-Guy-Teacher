# Client-Side React Hooks

**@domain** frontend
**@fileType** utilities
**@ai-summary** Reusable React component logic hooks — all are client-only (marked `'use client'`), fire on mount, and read/write browser state directly; use `useCurrentUser` as the auth entry point.

## Hooks

| Hook                   | Purpose                                                         | Gotcha                                                                                                             |
| ---------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `useAccessGate`        | Enforce timed gated/mandatory course access with warning modals | Timer pauses when warning modal is open and resumes on dismiss; uses `localStorage` for cross-tab timer continuity |
| `useActiveTimeTracker` | Send heartbeat + streak pings to Stats API while tab is visible | Only fires when `isAuthenticated=true` and `enabled=true`; silently swallows network errors                        |
| `useCourseSearch`      | Debounced search across courses, lessons, exercises, questions  | Abort controller cancels in-flight requests on new query; requires `courseSlug` for scoped search                  |
| `useCurrentUser`       | Fetch and cache the authenticated user                          | Returns `null` for unauthenticated users (not an error); listens to `auth:changed` events                          |
| `useDebounce`          | Delay a value by `delay` ms to throttle rapid updates           | Default delay is 200 ms; returns the previous value until the timeout fires                                        |
| `useExamCountdown`     | Track upcoming/past exam dates in `localStorage`                | Auto-refreshes every 60 s via `setInterval`; `courseId` scopes stored dates                                        |
| `useMediaQuery`        | Reactively track `window.matchMedia` query matches              | Returns `false` on the server (initial `null` state); add/remove listener on effect cycle                          |
| `useProgressMap`       | Batch-fetch completion percentages for a list of record IDs     | Requires `gradeLevel` from user profile in `localStorage`; silently returns empty for anonymous users              |

## Entry Point

`useCurrentUser` is the primary auth entry point — most other hooks depend on it for user state.

## Related

- [`src/client/state/localStorage/`](./state/localStorage/) — Browser persistence layer used by `useExamCountdown`, `useProgressMap`, and `useAccessGate`
