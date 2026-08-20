# A-Guy Teacher

The independent deployment boundary for `https://teacher.aguy.co.il`.

## Current behavior

Teacher does not yet own product pages. Unmatched requests pass through to
A-Guy-Web, preserving the current site, login, locale, theme, and navigation
without maintaining a second copy of the application.

When Teacher gains its first product route, that route will live locally and
use the released `@a-guy/ui` and `@a-guy/api-client` packages. Local routes take
priority over the fallback, so this can happen one route at a time.

## Security boundary

A-Guy-Web remains the sole owner of users, sessions, authentication, APIs,
database access, jobs, and provider secrets. A-Guy-Teacher needs no production
environment variables or backend credentials.

## Verification

```bash
pnpm install
pnpm check
```
