# System Events

**@domain** analytics
**@fileType** infrastructure
**@ai-summary** Client-side pub/sub event bus with Zod-validated payloads. Entry point is `systemEventBus`; consumer surface is `@/infra/system-events`. All `emit()` calls are no-ops on the server (SSR guard).

---

[`index.ts`](index.ts) — public API exports (`systemEventBus`, `SYSTEM_EVENTS`, hooks, schemas, types)

## Architecture

```
src/infra/system-events/
├── index.ts                      # Public API exports
├── bus.ts                        # Singleton bus (SSR guard, handler error isolation)
├── events.ts                     # SYSTEM_EVENTS constants + SystemEventName union
├── types.ts                      # Envelope, handler, payload type mapping
├── schemas.ts                    # Zod schemas registry (eventSchemas) + PII guard
├── exercise-schemas.ts           # Zod schemas for exercise help events
├── study-plan-schemas.ts         # Zod schemas for study plan events
└── hooks.ts                      # useSystemEvent / useSystemEventAny / useEmitSystemEvent
```

## Core Concepts

**Singleton bus** — `systemEventBus` is the only emitter. It is a module-level singleton; do not instantiate another one. The `reset()` method is `@internal` (testing only).

**SSR guard** — every public method (`emit`, `on`, `onAny`) checks `typeof window === 'undefined'` and returns early. Safe to import from Server Components and layouts — `emit()` will silently no-op.

**Envelope** — every event is wrapped in `SystemEventEnvelope<T>` carrying `{ name, payload, meta }`. `meta` includes `timestamp`, `session_id` (from `sessionStorage`), `route` (`window.location.pathname`), and `bus_version`.

**Payload validation** — every schema in `schemas.ts` uses `.strict()`: unknown fields fail validation (throws in dev, warns in prod). `PII_FIELDS` (`email`, `password`, `name`, `phone`, `address`) must never appear in any payload — `.strict()` will reject them.

**Handler isolation** — one throwing handler does not block delivery to other handlers or stop the bus. Errors are logged via `console.error` with the `[SystemEvents]` prefix.

## Usage

### Emit an event

```typescript
'use client'
import { systemEventBus, SYSTEM_EVENTS } from '@/infra/system-events'

systemEventBus.emit(SYSTEM_EVENTS.PAGE_VIEWED, { page_path: '/courses' })
```

### Subscribe to an event (hook)

```typescript
'use client'
import { useSystemEvent, SYSTEM_EVENTS } from '@/infra/system-events'

useEffect(() => {
  useSystemEvent(SYSTEM_EVENTS.LESSON_STARTED, (envelope) => {
    console.log(envelope.payload.lesson_id)
  })
}, [])
```

### Subscribe to all events (catch-all)

```typescript
'use client'
import { useSystemEventAny } from '@/infra/system-events'

useSystemEventAny((envelope) => {
  console.log(envelope.name, envelope.payload)
})
```

## Adding a New Event

Adding an event touches **4 files** in a fixed order. The bus will throw at validation time if any link in this chain is missing.

1. **`events.ts`** — add a `system.<name>` constant under the appropriate section in `SYSTEM_EVENTS`.
2. **`<domain>-schemas.ts` (or `schemas.ts`)** — define a Zod schema with `.strict()` and export its inferred type.
3. **`schemas.ts`** — register the new schema in the `eventSchemas` map, and add the inferred type to `SystemEventPayloads` in `types.ts`.
4. **`index.ts`** — re-export the new schema if consumers need it; otherwise no change needed.

Skipping step 3 silently breaks runtime validation: `emit()` will warn but the new event will not route correctly through `eventSchemas`.

## Gotchas

- **Always use `SYSTEM_EVENTS.*` constants.** Plain string event names will not match the registry's keys and will fail validation. The `system.` namespace prefix is required.
- **`useSystemEvent` does not re-subscribe on event-name change.** The subscription effect's dep array is `[event]` only — include the event in your component's dep array or you will have a stale subscription when the name is computed at runtime.
- **Strict schemas reject unknown fields.** Adding a field to a payload requires updating the matching Zod schema first. `.strict()` will throw (dev) or warn (prod) for unknown keys.
- **Session ID is per-tab, not per-user.** A fresh ID is minted when `sessionStorage` is empty or unavailable (e.g., private browsing) — do not rely on it as a stable user identifier.
- **Validation throws in dev.** A malformed payload in development is a hard error, not a warning. If you conditionally build payloads, validate the shape with the schema first or guard the call site.
- **`PII_FIELDS` is the canonical blocklist.** Even with `.strict()`, treat these five fields (`email`, `password`, `name`, `phone`, `address`) as never-emit. Use IDs instead.

## Related Documentation

- [`src/infra/README.md`](../README.md) — Infrastructure layer overview
- [`src/infra/analytics/README.md`](../analytics/README.md) — Downstream Mixpanel/GA4 adapters that consume this bus
