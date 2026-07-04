# Server Utilities

**@fileType** folder-index
**@ai-summary** Lightweight server-side utilities: authentication, paid-access gates, course URL construction, SHA-256 content hashing, and PDF metadata/extraction.

---

## Utilities

| File                    | Purpose                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `access-gate-server.ts` | Server-side auth — reads a signed HTTP-only cookie, returns the session user        |
| `check-paid-access.ts`  | Determines whether a course requires a paid entitlement (admin bypass included)     |
| `course-url-builder.ts` | Constructs lesson and exercise URLs from slug components                            |
| `hash.ts`               | SHA-256 hashing for exercise deduplication; canonicalizes whitespace/LaTeX          |
| `pdf-metadata.ts`       | Extracts page count, title, and author from a PDF buffer (pdf-lib, serverless-safe) |
| `pdf-page-splitter.ts`  | Splits a multi-page PDF into individual page buffers for iterative processing       |

## Entry Point

No `index.ts` barrel — import utilities by file name directly.

## Gotchas

- `check-paid-access.ts` grants admin users unconditional access — callers must decide what to do with `requiresEntitlement: false` for admin cases (e.g., hide a purchase button but still allow access).
- `pdf-page-splitter.ts` loads the entire PDF into memory; for very large files on memory-constrained serverless functions, consider streaming alternatives.
- `pdf-metadata.ts` opens encrypted PDFs with `ignoreEncryption: true` — metadata may reflect the document's pre-encryption state or be empty; callers needing encrypted-doc handling should detect failure from an empty return.
- `course-url-builder.ts` assumes all slug arguments are already sanitized; raw user input must be slugified before use.
