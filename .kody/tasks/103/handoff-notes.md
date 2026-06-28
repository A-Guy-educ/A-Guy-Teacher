## What was done

Added `@ai-summary` JSDoc headers to all TypeScript modules in `src/infra/llm/` that lacked them (~50+ files). Headers follow the AGENTS.md convention: first sentence = purpose, second sentence = load-bearing gotcha. Also added `@fileType` and `@domain` tags where conventions called for them.

Fixed a cascading typecheck failure caused by orphaned JSDoc comment text in four files: `models.ts`, `doc-search.ts`, `schemas/lesson-duplication-output.ts`, and `cache-schema-version.ts`. The root cause: an earlier edit replaced only the opening lines of a JSDoc block, leaving orphaned ` *` lines after the new `*/` closing delimiter. TypeScript parses ` *` at column 1 as a regex literal start, producing TS1161 "Unterminated regular expression literal" cascading across files. Fixed by removing all orphaned continuation text.

Fixed a lint error in `src/infra/llm/multimodal/index.ts`: removed the `/* eslint-disable @typescript-eslint/no-duplicate-imports */` directive — that rule does not exist in the project's ESLint config and caused a verify failure.

## Current state

- Branch: `103-doc-coverage-srcinfrallm-aillm-infrastructure-laye` (checked out, uncommitted changes)
- `pnpm typecheck`: passes
- `pnpm lint`: passes on modified files (no new warnings introduced)
- **verify**: passes — all quality gates green
- Note: `pnpm lint` still shows pre-existing warnings in unrelated files (`src/server/services/*`, `src/ui/web/*`) — these are not introduced by this task and do not block verify

## Follow-ups

1. **Commit + PR (wrapper handles)**: All 53 modified files are in the working tree with no commits on this branch. Wrapper must: `git add src/infra/llm/`, `git commit`, `git push -u origin 103-doc-coverage-srcinfrallm-aillm-infrastructure-laye`, then `gh pr create --base dev`.
2. **Pre-existing lint noise**: Files like `entitlement_check.ts`, `transform.ts`, `source-exercises.ts`, `create-exercises-from-extraction.ts` (all `@ts-nocheck`) and several UI components with `any` types — these are outside this task's scope.
