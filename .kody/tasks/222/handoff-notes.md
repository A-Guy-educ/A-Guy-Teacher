## What was done

Style fix round — addressed two CONCERNS from the parallel style review.

**Two changes:**

1. **Blank line between @ai-summary and @fileType in chat-message-role.ts (concern)** — `models.ts` and `doc-search.ts` have `@fileType` immediately after `@ai-summary` with no blank line between them. `chat-message-role.ts` had an extra ` *$` blank line (line 9) separating `@ai-summary` from `@fileType`. Removed the blank line so the pattern is: `@ai-summary` → `@fileType` → `@domain` → blank → content. The `@fileType`/`@domain` tags were already correctly positioned before the "Values:" block (the concern's line-number reference appears to have been based on the pre-fix state).

2. **Missing @fileType/@domain tags in context-policy.ts (concern)** — `config-resolver.ts` and `models.ts` in `src/infra/llm/` both include `@fileType implementation` and `@domain ai`. `context-policy.ts` had no such tags, making it inconsistent with the directory's established pattern. Added both tags after the `@ai-summary` block.

**Verification:** `verify` passes (typecheck + lint clean on all modified files).
