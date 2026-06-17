Added documentation to `src/client/hooks/`:

1. **New `src/client/hooks/index.ts`** — folder-level header covering: what this folder is, the key files table (with gotchas), and an anti-patterns section warning against using `useCurrentUser` in server components and passing mutable objects to `useDebounce`.

2. **`@ai-summary` added to all 8 hooks:**
   - `useAccessGate` — timer survives refresh via localStorage; pauses during warning modal
   - `useActiveTimeTracker` — sends heartbeat only when tab visible; streak resets at midnight local time
   - `useCourseSearch` — aborts in-flight requests via AbortController; requires `courseSlug` for scoped results
   - `useCurrentUser` — do not use in server components; listens to `auth:changed` event
   - `useDebounce` — delay-returned value until input stops changing
   - `useExamCountdown` — reads from localStorage, polls every 60s, not server-synced
   - `useMediaQuery` — SSR-safe, returns false on first render
   - `useProgressMap` — gradeLevel must be content grade, not user grade; silent empty maps for unauthenticated

All changes verified: typecheck, lint, and tests pass.
