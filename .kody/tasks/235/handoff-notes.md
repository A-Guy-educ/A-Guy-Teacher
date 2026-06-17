## Task 235: Doc coverage — src/infra/loading/

Added documentation headers to all 12 items in the loading state manager module:

**README (new):** `src/infra/loading/README.md` — folder-level header covering architecture, entry point, core concepts, and gotchas (singleton lifetime, route timing, hash-safe comparison).

**Modules with @ai-summary added (11 files):**
- `index.ts` — public API surface
- `LoadingManager.ts` — singleton store with safety timeout trap
- `AsyncAction.ts` — async wrapper with duplicate-prevention trap
- `keys.ts` — central key registry
- `hooks/useLoadingState.ts` — useSyncExternalStore subscription
- `hooks/useAsyncAction.ts` — key-selector trap (key must match LOADING_KEYS)
- `hooks/useRouterWithLoading.ts` — same-path navigation filtering trap
- `components/RouteLoadingIndicator.tsx` — flicker-prevention timing trap
- `components/SystemLink.tsx` — external/hash/same-path skip trap
- `components/Spinner.tsx` — CSS animation (no JS state)
- `utils/resolveHref.ts` — hash-stripping for route comparison

All headers follow the `@fileType @domain @pattern @ai-summary` format from existing infra modules (oauth_session, config-constants, smart-doc-loader). No code logic was changed.
