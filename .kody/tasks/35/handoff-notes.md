## What was done

Added JSDoc headers with `@ai-summary` tags to all 8 top-level files in `src/server/services/` that were missing them, plus a new `index.ts` folder-level header.

## Files changed

- **New:** `src/server/services/index.ts` — folder-level header cataloging all services, key patterns, and gotchas
- **Modified (headers added):** `agent-behavior-prompt-resolver.ts`, `course-list-service.ts`, `course-search-service.ts`, `course-tree-isolation.ts`, `pdf-fetcher.ts`, `rate-limit.ts`, `teacher-profile-resolver.ts`, `user-learning-context.ts`

## Pattern followed

Headers use `@fileType service`, `@domain`, `@pattern`, and `@ai-summary` tags matching existing conventions in sibling files (`entitlement_check.ts`, `guest-session.ts`, `conversation-service.ts`, etc.).

## Notes

- The index.ts re-exports a few commonly used services but is primarily a documentation header
- No code logic was changed — only JSDoc headers added
- Quality gates (typecheck, lint) pass cleanly
