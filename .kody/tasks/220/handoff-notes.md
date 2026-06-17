Resolved merge conflicts between PR #219 doc-coverage branch and origin/dev in three files:

1. `src/infra/loading/AsyncAction.ts` — HEAD had a simple `// @ai-summary` comment; origin/dev had full JSDoc block. Took origin/dev (properly documented per project conventions).

2. `src/infra/loading/LoadingManager.ts` — Same pattern as AsyncAction.ts; took origin/dev full JSDoc.

3. `src/infra/loading/README.md` — HEAD had YAML frontmatter + usage patterns + file structure; origin/dev had @domain/@fileType block + architecture section + consolidated gotchas. Took origin/dev for structure/intro, HEAD for the usage patterns section (RouteLoadingIndicator, useRouterWithLoading, SystemLink, useAsyncAction examples), and combined gotchas from both.

Verified: `pnpm typecheck`, `pnpm lint`, `pnpm format:check` all pass.
