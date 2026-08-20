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

## Environment endpoints

Teacher resolves every platform origin on the server. Local development uses
`lvh.me` by default so the shared cookie works, while QA and preview deployments
must set their own HTTPS endpoints instead of falling back to production.

| Environment  | `AGUY_API_URL`           | `AGUY_WEB_URL`           | `TEACHER_PUBLIC_URL`         |
| ------------ | ------------------------ | ------------------------ | ---------------------------- |
| Local        | `http://app.lvh.me:3000` | `http://app.lvh.me:3000` | `http://teacher.lvh.me:3001` |
| QA / preview | Required QA API URL      | Required QA Web URL      | Required QA Teacher URL      |
| Production   | `https://api.aguy.co.il` | `https://www.aguy.co.il` | `https://teacher.aguy.co.il` |

Copy `.env.example` for local development. Configure all three variables in the
QA deployment; production keeps the canonical defaults shown above.

## Security boundary

A-Guy-Web remains the sole owner of shared users, sessions, authentication,
the public API hostname, database access, jobs, and provider secrets.
A-Guy-Teacher needs no production environment variables or backend credentials.

## Verification

```bash
pnpm install
pnpm check
```
