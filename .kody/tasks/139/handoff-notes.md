Updated docs/exercises/README.md to document the LessonIntroPage unified entry point introduced in PRs #30 and #67.

Changes:
- Added Lesson Entry Page step to the architecture diagram (between Exercises Collection and Scroll View)
- Added new "Lesson Entry Point (#30, #67)" section documenting: routing logic (exercises → ExercisesPager, PDF → PdfLessonPager, scroll → ExerciseWorkspace), deep-linking via ?exerciseId= search param, content type indicators, and the file structure of the lesson page component tree

The core drift: page.tsx now always renders LessonIntroPage for all lesson types. Previously, PDF lessons bypassed it and went directly to PdfLessonPager (#67 fix). The doc previously made no mention of LessonIntroPage.
