# Loading State Manager

**@domain** ui
**@fileType** infrastructure
**@ai-summary** Singleton store + hooks + components for coordinating loading indicators across routes, actions, screens, and inline contexts

---

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
│   ├── SystemLink.tsx            # Link with local loading indication
│   └── Spinner.tsx              # Animated spinner
└── utils/
    └── resolveHref.ts           # Next.js href normalization (ignores hash)
```

## Core Concepts

**LoadingManager (singleton)** — In-memory store of active loading operations, keyed by string. Supports four operation types: `route`, `screen`, `inline`, `action`. Route operations auto-unregister after a 15 s safety timeout to prevent stuck progress bars.

**Loading keys** — String constants in `LOADING_KEYS` (e.g., `ROUTE_TRANSITION`, `LOGIN`). Prevents typos and centralizes all keys in one place.

**Reactivity** — Uses `useSyncExternalStore`, so hooks re-render only when the specific condition (busy/screen/route/key) changes — not on every LoadingManager mutation.

## Usage Patterns

### Route loading indicator

Place `<RouteLoadingIndicator />` once in a root layout. It subscribes to `LOADING_KEYS.ROUTE_TRANSITION` and shows an indeterminate progress bar when a route transition is in progress.

### Programmatic navigation with loading

```typescript
const router = useRouterWithLoading()
router.push('/next-page') // Registers ROUTE_TRANSITION immediately
```

### Link with loading feedback

```typescript
<SystemLink href="/courses">Browse Courses</SystemLink>
// Dims and aria-disabled while ROUTE_TRANSITION is active
```

### Async action with loading

```typescript
const { execute, isLoading } = useAsyncAction((formData: FormData) => loginAction(formData), {
  key: LOADING_KEYS.LOGIN,
})
```

## Loading Types

| Type     | Description                       | Safety Timeout      |
| -------- | --------------------------------- | ------------------- |
| `route`  | Next.js navigation                | 15s auto-unregister |
| `screen` | Full-screen operations            | None                |
| `inline` | Inline/component-level operations | None                |
| `action` | Form submissions, async actions   | None                |

## Gotchas

- **Route loading registered at trigger time, not completion.** `useRouterWithLoading` and `SystemLink` register the loading key when navigation is triggered. `RouteLoadingIndicator` unregisters it when `usePathname()` / `useSearchParams()` change — meaning the bar disappears when the URL updates, even if the page isn't fully rendered.
- **preventDuplicate defaults to true.** `asyncAction` returns `{ success: false, error: 'Action already in progress' }` for duplicate calls unless `preventDuplicate: false` is passed.
- **SSR safe.** All hooks return `false` from `getServerSnapshot`. No server-client hydration mismatches.
- **Keys are not automatically unregistered on error.** `asyncAction` always calls `manager.unregister(key)` in `finally`, but custom callers must ensure they do the same.
- `loadingManager` is a **module singleton** — not reset between tests unless `createLoadingManager()` is used for DI
- Route loading is registered at **trigger time** (click/push), not when navigation completes — if navigation is instant, the indicator may not appear due to threshold/flicker guards
- `useRouterWithLoading` only registers loading for cross-page navigation — same-path changes (hash anchors, query-only changes) are intentionally ignored

## Entry Point

Import everything from `@/infra/loading`:

```typescript
import {
  loadingManager,
  useLoadingState,
  asyncAction,
  RouteLoadingIndicator,
} from '@/infra/loading'
```

## Related Documentation

- [AGENTS.md](../../../AGENTS.md) — Complete Payload patterns
- [`src/infra/README.md`](../README.md) — Infrastructure layer overview
