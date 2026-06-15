# Issue #67 Fix — Unified Lesson Entry Page

## What was changed

**Problem:** PDF lessons (with `mediaFiles`) went directly to `PdfLessonPager`, bypassing `LessonIntroPage`. This meant PDF lesson users never saw the unified intro (description, difficulty, time, content counts).

**Root cause:** `page.tsx` had a three-way branch — `hasExerciseBlocks → ExercisesPager`, `mediaFiles.length > 0 → PdfLessonPager`, else `LessonIntroPage`. PDF lessons hit the second branch.

**Fix:** All lesson types now render `LessonIntroPage` first. `LessonIntroPage` is extended to accept `exercises`, `mediaFiles`, `mediaMap`, `courseSlug`, `chapterSlug`, `lessonSlug`, `lessonId`, `gradeLevel` as props. After the user clicks "Start", it transitions to the appropriate view:
- `pageState === 'exercises'` → renders `ExercisesPager`
- `pageState === 'pdf'` → renders `PdfLessonPager` with `initialPageState={{ type: 'pdf', pageNumber: 1 }}` (skips its own intro)
- `pageState === 'workspace'` → renders `ExerciseWorkspace` (for blocks-only lessons)

## Files changed

- `page.tsx` — removed the three-way branching; always renders `LessonIntroPage` with full lesson data
- `LessonIntroPage/index.tsx` — added exercises/mediaFiles/mediaMap/courseSlug/chapterSlug/lessonSlug/lessonId/gradeLevel props; added `exercises`/`pdf` state handling to render child pagers
- `LessonIntroPage/useLessonIntroPage.ts` — state machine extended from `'intro' | 'workspace'` to `'intro' | 'exercises' | 'pdf' | 'workspace'`; `handleStart` now accepts a `contentType` argument
- `PdfLessonPager/usePdfLessonPager.ts` — added `initialPageState` prop; when provided, skips URL-based state detection
- `PdfLessonPager/index.tsx` — added `initialPageState` prop and passes it to the hook
- `tests/int/lesson-intro-page.int.spec.ts` — added PDF lesson fixture and test for issue #67

## Open follow-ups

1. **Add difficulty/time display** (medium priority): LessonIntroPage doesn't yet display difficulty or estimated time — issue #67 listed these as required fields
2. **Remove PdfLessonPager self-intro** (low priority): The intro/outro branches in PdfLessonPager are now dead code since we always pass `initialPageState`
3. **ExercisesPager intro dead code** (low priority): ExercisesPager's intro is only reached when used standalone (e.g., DualModeLessonView), not when embedded in LessonIntroPage
