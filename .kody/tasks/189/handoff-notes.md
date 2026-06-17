Added documentation headers to `src/server/utils/` (6 files) per issue #189.

Created `README.md` at the folder level listing all utilities, entry point note, and gotchas. Added `@ai-summary` (with `@fileType`, `@domain`, `@pattern`) to every module header — the summaries capture the "why" and the trap, not restatements of the code.

Key traps documented:
- `check-paid-access.ts`: admin bypass means callers must independently handle admin UI (hide purchase button but allow access).
- `pdf-page-splitter.ts`: loads entire PDF into memory — unsuitable for very large files on serverless.
- `pdf-metadata.ts`: `ignoreEncryption: true` may return empty title/author for encrypted docs.
- `course-url-builder.ts`: slugs must be pre-sanitized; raw user input will produce malformed URLs.

Quality gates (typecheck, lint) passed on first attempt. No code logic was changed — only JSDoc headers and the new README.
