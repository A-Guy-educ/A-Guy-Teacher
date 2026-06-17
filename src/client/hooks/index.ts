/**
 * @filetype index
 * @domain frontend
 * @ai-summary React hooks for client-side state, authentication, search, and progress tracking.
 *
 * ## Entry Point
 *
 * Import hooks directly from their module files — there is no barrel export here.
 *
 * ## Key Files
 *
 * | Hook | Purpose | Gotcha |
 * |------|---------|--------|
 * | `useAccessGate` | Timed content lock for anonymous users | Timer survives page refresh via localStorage; pauses during warning modal to prevent phantom lock-out |
 * | `useActiveTimeTracker` | Heartbeat + streak tracking | Sends only when tab is visible; streak resets at midnight local time |
 * | `useCurrentUser` | Auth state from `/api/users/me` | Listens to `auth:changed` window event; returns null user (not throw) when unauthenticated |
 * | `useProgressMap` | Per-grade progress batch-fetch | `gradeLevel` must be content grade, not user grade — mismatch silently returns empty maps |
 * | `useCourseSearch` | Debounced course/lesson/exercise search | Aborts in-flight requests on new query; requires `courseSlug` for scoped search |
 * | `useExamCountdown` | Exam dates from localStorage | Polls every 60s; dates are local-only (not synced to server) |
 *
 * ## Anti-Patterns
 *
 * - **Do not** call `useCurrentUser().user` in server components — the hook uses `window.addEventListener` and will break on the server
 * - **Do not** pass a mutable object as the second arg to `useDebounce` — it uses `useEffect` deep-equality trap that won't fire
 */
