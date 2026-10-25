# A-Guy-Teacher repository rules

- This repository is the classroom-teacher dashboard at `teacher.aguy.co.il`.
- It serves only its own routes. Nothing is proxied to A-Guy-Web; login and
  learning-site links go to Web's origin directly.
- A-Guy-Web owns authentication, sessions, users, database access, APIs, and
  secrets.
- Never add `PAYLOAD_SECRET`, `DATABASE_URL`, provider keys, JWT verification,
  password handling, or direct database access.
- Teacher-owned routes must use released shared packages and A-Guy-Web APIs.
- Run typecheck, lint, format check, tests, and a production build.
- Prefix shell commands with `rtk`.
