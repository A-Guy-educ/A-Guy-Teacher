# A-Guy Teacher

The independent deployment boundary for `https://teacher.aguy.co.il`.

## Current behavior

Teacher is a class dashboard for classroom teachers (proof of concept). The
home page shows each of the teacher's classes as a students × lessons table
with a score and independence index per lesson, and a per-question side panel.

Data comes from A-Guy-Web through `https://api.aguy.co.il` using the shared
A-Guy session:

- `GET /api/teacher/classes`: the classes the signed-in teacher is assigned to
- `GET /api/teacher/classes/:id/progress`: per-student, per-question counts

Web decides who may see which class. Teacher computes the scores for display
(`src/lib/class-metrics.ts`).

Set `TEACHER_DEMO_DATA=1` to serve built-in demo classes instead of calling Web.

Teacher serves only its own routes; nothing is proxied to A-Guy-Web.

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
