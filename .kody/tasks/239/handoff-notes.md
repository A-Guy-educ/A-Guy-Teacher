## What

Added JSDoc headers with `@ai-summary` to all 7 files in `src/infra/types/` and a folder-level `@ai-summary` on the central export index.

## How

- `index.ts` — replaced bare comment with full `@fileType utility @domain types @pattern centralized-types @ai-summary` header; summarises that it is a re-export boundary and coupling smell if types only used in one place are added here
- `backend.ts` — added full header; `@ai-summary` notes these are fallback `any` shims for ungenerated Payload types, and that adding entries signals a schema/type-gen drift
- `content.ts` — added full header; `@ai-summary` notes these hand-written Payload shapes drift from generated types over time
- `exercise.ts` — added `@ai-summary` to existing JSDoc; notes ContentBlock is `any` and type narrowing is runtime, not compile-time
- `environment.d.ts` — added `@ai-summary` warning about NEXT_PUBLIC_ vars and security boundary
- `jsxgraph.d.ts` — added `@ai-summary` noting it's minimal and should be extended rather than casting
- `markdown.d.ts` — added `@ai-summary` noting bundler-only scope

## Verified

- `pnpm typecheck` passes
- `pnpm lint` passes
- All 7 files follow existing `@fileType @domain @pattern @ai-summary` convention from sibling modules
