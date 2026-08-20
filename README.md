# A-Guy Teacher

The independent deployment boundary for `https://teacher.aguy.co.il`.

## Current behavior

Teacher owns its course-management home page. The page uses the released
`@a-guy/ui` shell and reads the authenticated course index through
`https://api.aguy.co.il` using the shared A-Guy session.

Unmatched routes still pass through to A-Guy-Web. This keeps the migration
incremental while Teacher gains product routes one at a time.

The first version is a secure course overview for administrators and advanced
content editors. Course writes remain in A-Guy-Admin until its validation and
publishing hooks are available behind the shared API contract.

## Security boundary

A-Guy-Web remains the sole owner of shared users, sessions, authentication,
the public API hostname, database access, jobs, and provider secrets.
A-Guy-Teacher needs no production environment variables or backend credentials.

## Verification

```bash
pnpm install
pnpm check
```
