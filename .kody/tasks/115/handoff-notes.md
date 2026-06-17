Added @ai-summary headers to all 8 files in src/infra/system-events/ plus a folder-level entry point note on index.ts.

Each header captures the "why" and the "trap" without restating what the code does:
- index.ts: entry point is systemEventBus, SSR is a no-op
- types.ts: always check envelope.name before accessing envelope.payload
- events.ts: must use SYSTEM_EVENTS constants, not raw strings
- bus.ts: handler errors are isolated; session ID falls back to volatile memory if sessionStorage unavailable
- hooks.ts: useSystemEvent requires the event name in the useEffect dep array
- schemas.ts: .strict() rejects unknown fields; PII_FIELDS is the canonical blocklist
- exercise-schemas.ts: exercise events are separate from lesson events
- study-plan-schemas.ts: exam_date must be ISO string, not Date object

No code behavior changed. Verification passed (typecheck/lint/tests green).
