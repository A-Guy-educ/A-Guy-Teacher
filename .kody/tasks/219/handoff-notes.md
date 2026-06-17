## What

Added doc coverage to src/infra/loading: a folder-level README and @ai-summary comments on all 9 previously undocumented modules.

## How

- Created `README.md` following the pattern from `src/infra/llm/README.md` — frontmatter with `@domain`, `@fileType`, `@ai-summary` plus structured usage docs and a "Gotchas" section covering the most important traps (route loading registered at trigger time, preventDuplicate defaults true, SSR safety, key cleanup on error).
- Added a `// @ai-summary` comment at the top of each module file, placed before any imports. Each captures the *why* and the load-bearing trap without restating what the code does.

## Modules documented

- `LoadingManager.ts` — singleton store, 15 s route safety timeout
- `AsyncAction.ts` — wrapper with duplicate guard, always-unregisters-in-finally contract
- `keys.ts` — central key registry
- `hooks/useLoadingState.ts` — useSyncExternalStore selector hook, SSR-safe
- `hooks/useAsyncAction.ts` — memoized options to avoid re-registering
- `hooks/useRouterWithLoading.ts` — registers at trigger not completion, ignores anchors
- `components/RouteLoadingIndicator.tsx` — 300 ms threshold, 500 ms min visible, 15 s backstop
- `components/SystemLink.tsx` — skips external/modifier/anchor links
- `components/Spinner.tsx` — pure CSS, no JS loops
- `utils/resolveHref.ts` — normalized comparison, optional hash strip

## Verified

`pnpm ci:local` — typecheck, lint, tests all pass on first attempt.
