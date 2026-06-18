Added @ai-summary headers to all 8 source files in src/infra/loading/ plus a folder-level header on index.ts.

index.ts — folder-level header: describes the entry point, the register/unregister contract, and the singleton trap (leaked loading state if unregister is missing).

Each module header captures WHY the code exists and the specific TRAP to avoid:
- LoadingManager.ts: 15s route safety timeout, new object per getSnapshot call
- AsyncAction.ts: preventDuplicate defaults true, registration at call time not async start
- keys.ts: raw strings still work but key collisions are the trap
- useLoadingState.ts: key selector must be stable (not inline object) or memoization is defeated
- useAsyncAction.ts: execute is stable only when action/options are stable references
- useRouterWithLoading.ts: RouteLoadingIndicator must be mounted to unregister the key
- RouteLoadingIndicator.tsx: fast navigations (<300ms) never register the key at all; 15s timeout is fallback
- SystemLink.tsx: external/hash/modifier-key links skip registration intentionally
- Spinner.tsx: pure presentational, no loading state wired in
- resolveHref.ts: ignoreHash must be explicitly true for route-transition detection

No behavioral changes. Quality gates passed on first attempt.
