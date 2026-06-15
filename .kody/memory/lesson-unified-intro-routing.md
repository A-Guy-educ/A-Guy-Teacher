---
name: lesson-unified-intro-routing
title: Lesson Unified Intro Routing
type: decision
source: task:67
recorded_at: 2026-06-11T15:32:26Z
---

LessonIntroPage acts as the unified entry for all lesson types (exercises, PDF, blocks-only). It receives all lesson data (exercises, mediaFiles, blocks, courseSlug, etc.) and renders the appropriate child component (ExercisesPager, PdfLessonPager, or ExerciseWorkspace) after the user clicks Start.

Why: Previously PDF lessons went directly to PdfLessonPager (bypassing LessonIntroPage), denying users the unified intro page with description, difficulty, and content counts. The fix routes all lesson types through LessonIntroPage first.

How to apply: When adding a new lesson content type, add a new state to useLessonIntroPage and handle rendering in LessonIntroPage.

**Why:** Issue #67 required all lesson types to share a common intro page. The LessonIntroPage component was already designed to be the canonical entry point but was bypassed for PDF lessons.

**Source task:** `67`
