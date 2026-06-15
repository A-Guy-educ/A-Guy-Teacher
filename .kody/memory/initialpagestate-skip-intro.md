---
name: initialpagestate-skip-intro
title: Initialpagestate Skip Intro
type: decision
source: task:67
recorded_at: 2026-06-11T15:32:26Z
---

PdfLessonPager and its hook usePdfLessonPager accept an optional `initialPageState` prop that overrides URL-based state initialization. When provided, the hook skips the URL-based state detection and uses the passed state directly.

Why: PdfLessonPager manages its own intro/pdf/outro state machine and was previously the sole manager of that flow. When embedded as a child of LessonIntroPage, we need it to skip its own intro and go directly to the PDF view (initialPageState: { type: 'pdf', pageNumber: 1 }).

How to apply: Pass initialPageState={{ type: 'pdf', pageNumber: 1 }} when rendering PdfLessonPager from within LessonIntroPage.

**Why:** PdfLessonPager had its own state machine that was URL-dependent. Embedding it as a child required bypassing that initialization.

**Source task:** `67`
