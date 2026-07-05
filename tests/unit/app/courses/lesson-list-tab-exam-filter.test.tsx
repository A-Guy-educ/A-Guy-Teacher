// @vitest-environment jsdom

/**
 * Regression guard for the Courses Exams tab (#725).
 *
 * Pinned behavior:
 * - <LessonListTab lessonType="exam"> renders only lessons whose effective type
 *   is "exam" (and excludes learning/practice lessons from the same course).
 * - Cards rendered for the exams tab use the "Exam N" label, not "Lesson N".
 *   This matches what the Study plan page and the per-lesson card already do
 *   when lessonType="exam".
 */

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the progress hook so the test never hits the network and `lessonProgressMap`
// entries are not picked up — this test is purely about filtering & rendering.
vi.mock('@/client/hooks/useProgressMap', () => ({
  useProgressMap: () => ({ progressMap: {}, statusMap: {}, isLoading: false }),
}))

// LessonListTab calls `useTranslations` only. Stub with a key passthrough.
vi.mock('@/ui/web/providers/I18n', () => ({
  useTranslations: () => (key: string) => key,
}))

const renderCardSpy = vi.fn()
vi.mock('@/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard', () => ({
  CourseLessonCard: (props: Record<string, unknown>) => {
    renderCardSpy(props)
    return (
      <div data-testid="course-lesson-card">
        <span data-testid="card-lesson-title">{String(props.lesson?.title ?? '')}</span>
        <span data-testid="card-lesson-type">{String(props.lessonType ?? '')}</span>
      </div>
    )
  },
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

beforeEach(() => {
  renderCardSpy.mockClear()
})

afterEach(() => {
  cleanup()
})

describe('LessonListTab — exam type filter (#725)', () => {
  it('renders only exam lessons and passes lessonType="exam" to each card', () => {
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

    // Cards rendered
    const cards = screen.getAllByTestId('course-lesson-card')
    expect(cards).toHaveLength(2)

    // Only exam lesson titles are present (learning/practice excluded)
    expect(screen.getByText('מבחן 1')).toBeTruthy()
    expect(screen.getByText('מבחן 2')).toBeTruthy()
    expect(screen.queryByText('Learning Lesson')).toBeNull()
    expect(screen.queryByText('Practice Lesson')).toBeNull()

    // Each card received lessonType="exam" so it renders the "Exam N" badge
    const passedTypes = renderCardSpy.mock.calls.map((call) => {
      const props = call[0] as { lessonType?: string }
      return props.lessonType
    })
    expect(passedTypes.every((t) => t === 'exam')).toBe(true)
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

    // LessonListTab renders `null` when filteredLessons is empty
    expect(container.firstChild).toBeNull()
    expect(renderCardSpy).not.toHaveBeenCalled()
  })

  it('does not regress the learn/practice type filter when adding "exam" support', () => {
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

    const cards = screen.getAllByTestId('course-lesson-card')
    expect(cards).toHaveLength(1)
    expect(screen.getByText('Learning Lesson')).toBeTruthy()
    expect(screen.queryByText('מבחן 1')).toBeNull()
  })
})
