Added doc coverage to `src/infra/loading/` (11 files total).

Created `src/infra/loading/README.md` with folder-level header covering: what this area does, the entry point (`index.ts`), the load-bearing gotcha (singleton `loadingManager` pollutes tests unless `createLoadingManager` is used), and a structure table.

Added `@ai-summary` + `@fileType` + `@domain` JSDoc headers to all files that lacked them:
- Top-level: `index.ts`, `LoadingManager.ts`, `AsyncAction.ts`, `keys.ts`
- Hooks: `useLoadingState.ts`, `useAsyncAction.ts`, `useRouterWithLoading.ts`
- Components: `RouteLoadingIndicator.tsx`, `SystemLink.tsx`, `Spinner.tsx`
- Utils: `resolveHref.ts`

Each summary captures the *why* and the *trap* (e.g., singleton pollution, hash-only nav silently skipped, useMemo on options required in useAsyncAction).

No code changes — documentation only. Quality gates passed on first attempt.
