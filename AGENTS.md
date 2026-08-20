# A-Guy-Teacher repository rules

- This repository is a thin deployment boundary for `teacher.aguy.co.il`.
- Until Teacher owns product routes, unmatched requests pass through to
  A-Guy-Web so behavior stays identical without copied source.
- A-Guy-Web owns authentication, sessions, users, database access, APIs, and
  secrets.
- Never add `PAYLOAD_SECRET`, `DATABASE_URL`, provider keys, JWT verification,
  password handling, or direct database access.
- Teacher-owned routes must use released shared packages and A-Guy-Web APIs.
- Run typecheck, lint, format check, tests, and a production build.
- Prefix shell commands with `rtk`.
