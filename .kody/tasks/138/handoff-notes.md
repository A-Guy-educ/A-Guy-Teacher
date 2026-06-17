## Done

Added `@ai-summary` headers to the 3 files in `src/infra/auth/` that lacked them:

- `access-types.ts` — documents the `resolveAccessType` fallback trap: a course-level lock gates all lessons set to 'inherit'
- `roles.ts` — documents the `parseAccountRole` throw behavior: invalid role strings persisted to DB cause auth checks to crash
- `web-auth.ts` — documents the `linkGoogleUser` non-destructive pattern (preserves password after linking) and JWT/session architecture

All 12 files in the folder now carry `@ai-summary`. Quality gates (typecheck, lint) pass clean.

## What was not done (out of scope)
- No behavioral changes — purely additive documentation headers
- No test files were modified (this was a doc-only task)
