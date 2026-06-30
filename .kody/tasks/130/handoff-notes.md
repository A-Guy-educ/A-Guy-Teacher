## Review Feedback Application: PR #130 — Fix Round 4

### Items addressed

**Item 1 — `'use client'` placement inconsistent in `useDebounce.ts`**

Moved `'use client'` from line 1 to after the JSDoc block (now line 8), matching the pattern in `useAccessGate.ts:10`, `useCurrentUser.ts:10`, `useCourseSearch.ts:10`, etc.

**Item 2 — `'use client'` placement inconsistent in `useMediaQuery.ts`**

Same fix: moved `'use client'` from line 1 to after the JSDoc block (now line 10), matching the established folder pattern.

### No other changes

No functional changes — only the directive ordering was updated to align within the folder.
