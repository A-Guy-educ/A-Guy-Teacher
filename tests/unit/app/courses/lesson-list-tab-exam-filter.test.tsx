// @vitest-environment jsdom

/**
 * Regression guard for the Courses Exams tab (#725).
 *
 * Pinned behavior:
 * - <LessonListTab lessonType="exam"> renders only lessons whose effective type
 *   is "exam" (and excludes learning/practice lessons from the same course).
 * - The learning tab similarly excludes exam lessons.
 * - When no lesson of the requested type exists, the tab renders nothing.
 *
 * Post-#873 roadmap redesign: the tab renders a chapter-accordion layout
 * (LessonRow inside ChapterAccordion) instead of a flat grid of CourseLessonCards.
 * This test asserts the filter contract via the rendered lesson titles + the
 * `course-lesson-row` testid so it doesn't couple to per-tab visual details.
 */

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/client/hooks/useProgressMap', () => ({
  useProgressMap: () => ({ progressMap: {}, statusMap: {}, isLoading: false }),
}))

vi.mock('@/ui/web/providers/I18n', () => ({
  useTranslations: () => (key: string) => key,
}))

import { LessonListTab } from '@/app/(frontend)/courses/[courseSlug]/_components/LessonListTab'
import type { Chapter, Lesson } from '@/infra/types/content'

const learningLesson: Lesson = {
  id: 'lesson-learning-1',
  slug: 'lesson-learning-1',
  title: 'Learning Lesson',
  chapter: 'chapter-1',
  type: 'learning',
  order: 1,
  status: 'published',
  isActive: true,
}

const practiceLesson: Lesson = {
  id: 'lesson-practice-1',
  slug: 'lesson-practice-1',
  title: 'Practice Lesson',
  chapter: 'chapter-1',
  type: 'practice',
  order: 2,
  status: 'published',
  isActive: true,
}

const examLessons: Lesson[] = [
  {
    id: 'lesson-exam-1',
    slug: 'lesson-exam-1',
    title: 'מבחן 1',
    chapter: 'chapter-1',
    type: 'exam',
    order: 3,
    status: 'published',
    isActive: true,
  },
  {
    id: 'lesson-exam-2',
    slug: 'lesson-exam-2',
    title: 'מבחן 2',
    chapter: 'chapter-1',
    type: 'exam',
    order: 4,
    status: 'published',
    isActive: true,
  },
]

const chapters: Chapter[] = [{ id: 'chapter-1', title: 'Chapter 1', slug: 'chapter-1' }]

afterEach(() => {
  cleanup()
})

describe('LessonListTab — exam type filter (#725)', () => {
  it('renders only exam lessons when lessonType="exam"', async () => {
    const allLessons: Lesson[] = [learningLesson, practiceLesson, ...examLessons]

    render(
      <LessonListTab
        lessons={allLessons}
        chapters={chapters}
        courseSlug="grade-9"
        gradeLevel="grade-9"
        lessonType="exam"
      />,
    )

    // Chapter with the featured lesson auto-expands (via useEffect), so the
    // rows for its lessons render. Use findByText to wait for that effect.
    await screen.findByText('מבחן 1')
    expect(screen.getByText('מבחן 2')).toBeTruthy()

    // Non-exam lessons excluded by the type filter → not rendered even as
    // rows in a collapsed chapter (they never enter the roadmap).
    expect(screen.queryByText('Learning Lesson')).toBeNull()
    expect(screen.queryByText('Practice Lesson')).toBeNull()

    // Exactly one row per exam lesson.
    const rows = screen.getAllByTestId('course-lesson-row')
    expect(rows).toHaveLength(2)
  })

  it('returns nothing for the exams tab when the course has no exam lessons', () => {
    const nonExamLessons: Lesson[] = [learningLesson, practiceLesson]

    const { container } = render(
      <LessonListTab
        lessons={nonExamLessons}
        chapters={chapters}
        courseSlug="grade-9"
        gradeLevel="grade-9"
        lessonType="exam"
      />,
    )

    expect(container.firstChild).toBeNull()
    expect(screen.queryAllByTestId('course-lesson-row')).toHaveLength(0)
  })

  it('does not regress the learn tab filter when adding "exam" support', async () => {
    const allLessons: Lesson[] = [learningLesson, practiceLesson, ...examLessons]

    render(
      <LessonListTab
        lessons={allLessons}
        chapters={chapters}
        courseSlug="grade-9"
        gradeLevel="grade-9"
        lessonType="learning"
      />,
    )

    await screen.findByText('Learning Lesson')
    expect(screen.queryByText('מבחן 1')).toBeNull()

    const rows = screen.getAllByTestId('course-lesson-row')
    expect(rows).toHaveLength(1)
  })
})
