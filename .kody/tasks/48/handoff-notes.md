Resolved merge conflicts in all 9 src/client/hooks files by taking origin/dev's JSDoc headers throughout.

**Conflict pattern**: All 9 files had HEAD vs origin/dev conflicts in JSDoc block headers only — the actual hook implementations were identical on both sides.

**Resolution rationale**:
- `index.ts`: origin/dev rewrites the header to clarify there is no barrel export ("Import hooks directly from their module files"). This is an important architectural note worth preserving.
- Individual hooks: origin/dev uses a more structured `@ai-summary` format with richer descriptive text; HEAD added `@pattern` fields that are not load-bearing.

**Files resolved**: index.ts, useAccessGate.ts, useActiveTimeTracker.ts, useCourseSearch.ts, useCurrentUser.ts, useDebounce.ts, useExamCountdown.ts, useMediaQuery.ts, useProgressMap.ts.

Typecheck passes (`pnpm typecheck`).
