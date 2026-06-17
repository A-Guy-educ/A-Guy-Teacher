# Loading State Manager

**@domain** ui
**@fileType** infrastructure
**@ai-summary** Singleton store + hooks + components for coordinating loading indicators across routes, actions, screens, and inline contexts

---

## Entry Point

[`index.ts`](index.ts) — public API exports

## Architecture

```
src/infra/loading/
├── index.ts                      # Public API exports
├── LoadingManager.ts             # Singleton store (useSyncExternalStore compatible)
├── AsyncAction.ts                # asyncAction wrapper with duplicate prevention
├── keys.ts                      # Central LOADING_KEYS registry
├── hooks/
│   ├── useLoadingState.ts       # Subscribe to loading state from store
│   ├── useAsyncAction.ts        # Hook wrapper for asyncAction
│   └── useRouterWithLoading.ts  # useRouter that registers route loading
├── components/
│   ├── RouteLoadingIndicator.tsx # Global indeterminate progress bar
│   ├── SystemLink.tsx           # Link with local loading indication
│   └── Spinner.tsx             # Animated spinner
└── utils/
    └── resolveHref.ts          # Next.js href normalization (ignores hash)
```

## Core Concepts

- **Singleton store** (`loadingManager`): module-level Map of active operations with versioned snapshots for React `useSyncExternalStore`
- **Route safety timeout**: 15s auto-unregister guard against stuck navigation state
- **Duplicate prevention**: `asyncAction` refuses to re-run the same key while busy
- **Hash-safe comparison**: `resolveHrefToString` strips hash so same-page anchor links don't trigger loading

## Gotchas

- `loadingManager` is a **module singleton** — not reset between tests unless `createLoadingManager()` is used for DI
- Route loading is registered at **trigger time** (click/push), not when navigation completes — if navigation is instant, the indicator may not appear due to threshold/flicker guards
- `useRouterWithLoading` only registers loading for cross-page navigation — same-path changes (hash anchors, query-only changes) are intentionally ignored

## Related Documentation

- [AGENTS.md](../../AGENTS.md) — Complete Payload patterns
- [`src/infra/README.md`](../README.md) — Infrastructure layer overview
