# Task 172: Doc coverage — src/client/hooks/

Added folder-level README and `@ai-summary` headers to all 8 client-side React hook files.

## What changed

- **src/client/hooks/README.md** (new) — folder-level header: entry point is individual files, gotcha is that all hooks are client-only and props must be serializable for Server Component boundaries.

- **src/client/hooks/useAccessGate.ts** — added `@ai-summary` documenting the localStorage-persisted timer keyed by courseSlug, the modal-pause behavior, and the stale-timer-on-OAuth-full-reload cleanup.

- **src/client/hooks/useDebounce.ts** — added `@ai-summary` on the generic debounce hook.

- **src/client/hooks/useActiveTimeTracker.ts** — added `@ai-summary` documenting that heartbeat is suppressed in hidden tabs (visibility API).

- **src/client/hooks/useExamCountdown.ts** — added `@ai-summary` documenting localStorage keying by courseId, per-device isolation, and 60-second polling staleness window.

- **src/client/hooks/useMediaQuery.ts** — added `@ai-summary` documenting the initial `null` (treated as `false`) on SSR/hydration and the hydration mismatch risk.

- **src/client/hooks/useCurrentUser.ts** — added `@ai-summary` documenting the brief `user: null` window during OAuth callback.

- **src/client/hooks/useCourseSearch.ts** — added `@ai-summary` documenting 300ms debounce, request abortion, 2-char minimum, and the `courseSlug` scoping behavior.

- **src/client/hooks/useProgressMap.ts** — added `@ai-summary` documenting anonymous-user short-circuit, and the gradeLevel fallback from localStorage and its semantic difference from the user's onboarding grade.

## Verification

`pnpm ci:local` (typecheck + lint + tests) passed on first attempt.
