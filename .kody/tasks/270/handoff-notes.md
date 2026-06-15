# Merge Conflict Resolution for PR #270

Resolved 5 conflicted files during merge with origin/main for release v0.25.11.

## Resolution Strategy

Took HEAD's version for all conflicts, preserving the PR's new architecture:
- **practice/page.tsx, study/page.tsx, test/page.tsx**: HEAD uses `resolveLearningPageSelection` for unified grade/locale resolution with searchParams support
- **study-page.ts**: HEAD adds `prefetchEmbeddedLearningFallback` function required by the new study page architecture
- **pattern-index.json**: HEAD's newer scan (443 files, 128 patterns) supersedes origin/main (435 files, 122 patterns)

## Files Modified

- `.ai-docs/indexes/pattern-index.json` - 7 conflict regions resolved, all taking HEAD
- `src/app/(frontend)/practice/page.tsx` - New `resolveLearningPageSelection` architecture
- `src/app/(frontend)/study/page.tsx` - New architecture with `shouldUseEmbeddedLearningFallback`
- `src/app/(frontend)/test/page.tsx` - New `resolveLearningPageSelection` architecture
- `src/server/repos/queries/study-page.ts` - Added `queryPublishedCourses` import and `prefetchEmbeddedLearningFallback` function

## Quality Checks

- TypeScript: Passed (`pnpm typecheck`)
- ESLint: Passed (warnings only, pre-existing in unrelated files)
- Conflict markers: None remaining