CI failure on PR #66: TypeScript TS2451 — duplicate `toolCalls` declaration in same scope.

**Root cause**: The PR added a new `const toolCalls` extraction from `result.toolCalls` at lines 437-445, but `unified-adapter.ts` already had an extraction from `result.messages` at lines 456-479 that also declared `const toolCalls`. Two `const` declarations with the same name in the same function scope = TS2451.

**Fix applied**: Merged into a single declaration:
- Line 440: `const toolCalls: Array<...> = [...(result.toolCalls?.map(...)) ?? []]`
- Lines 453-473: The existing `result.messages` loop now pushes into the same array instead of re-declaring

**Verification**: `pnpm typecheck` passes cleanly. `pnpm lint` passes (pre-existing warnings only, unrelated to this change).

**Scope of change**: Only `src/infra/llm/genkit/adapters/unified-adapter.ts`. No new files, no behavior changes beyond eliminating the type error.
