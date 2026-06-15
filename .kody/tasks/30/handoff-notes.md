# Issue #30: LessonIntroPage Implementation

## What was done

Created a unified `LessonIntroPage` component shown to students for blocks-only lessons (no exercises, no PDFs). Previously these lessons rendered `ExerciseWorkspace` + `EmptyLessonPlaceholder` directly with no intro screen.

## Files changed

- **New**: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/LessonIntroPage/index.tsx` — Client component with intro UI (title, description, content type indicators, Start button) and workspace fallback
- **New**: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/LessonIntroPage/useLessonIntroPage.ts` — Simple state machine (`intro` | `workspace`), reads `?exerciseId=` search param to skip intro on deep-links
- **Modified**: `page.tsx` — Added `queryLessonBlocks` call, replaced `ExerciseWorkspace + EmptyLessonPlaceholder` path with `LessonIntroPage`, removed unused `ChatInterface` and `ExerciseWorkspace` imports
- **Modified**: `src/i18n/en.json` and `src/i18n/he.json` — Added `lessonIntro`, `lessonIntroWelcome`, `lessonIntroStart` keys
- **New**: `tests/int/lesson-intro-page.int.spec.ts` — Integration test for data layer (queryLessonBlocks, queryLessonBySlug). Follows existing `lesson-types.int.spec.ts` pattern. Added to `vitest.config.mts` `activeIntegrationTests`
- **Modified**: `vitest.config.mts` — Added test file to active list

## Key decisions

- Mirrored the intro screen layout/typography of `ExercisesPager` (intro) and `LessonPager` (intro) — using `BookOpen` icon, `text-display-xl` heading, badge-style content counters, `rounded-3xl` card
- `LessonIntroPage` is a client component because it needs `useSearchParams` for deep-linking and `useLessonIntroPage` hook for state
- `page.tsx` is a server component — `queryLessonBlocks` is called server-side, result passed as prop to `LessonIntroPage`
- Deep-link skip: when `?exerciseId=` is present in URL, `pageState` initializes to `'workspace'` (intro skipped)

## What was NOT done (followups)

- Exam route (`/exams/[examSlug]`) doesn't exist in codebase — no `ExamIntroPage` could be added
- Deep-link into blocks-only lessons correctly skips intro but shows EmptyLessonPlaceholder (expected — no per-exercise content)
- Integration test unverified in this environment (pre-existing `payload` monorepo workspace issue)
