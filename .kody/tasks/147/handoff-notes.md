Resolved merge conflict in `src/infra/loading/utils/resolveHref.ts` by merging both sides of the JSDoc comment.

The conflict was symmetric — both HEAD and origin/dev modified the same `@ai-summary` block. HEAD had a more detailed description of what the function does; origin/dev had a brief "Handles edge cases" note. I kept both: the full HEAD `@ai-summary` plus origin/dev's edge-cases note as a second line, preserving the PR's comprehensive documentation intent.

TypeScript typecheck passes cleanly. No implementation changes were needed — only a JSDoc comment merge.
