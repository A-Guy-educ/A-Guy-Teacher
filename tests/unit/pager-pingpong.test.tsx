// @vitest-environment jsdom

import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useExercisesPager } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/useExercisesPager'
import type { Exercise } from '@/infra/types/content'

const createMockExercises = (count: number): Exercise[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `ex-${i + 1}`,
    slug: `ex-${i + 1}`,
    title: `Exercise ${i + 1}`,
    content: { blocks: [] },
  }))

const defaultParams = {
  courseSlug: 'test-course',
  chapterSlug: 'test-chapter',
  lessonSlug: 'test-lesson',
  lessonId: 'lesson-1',
  gradeLevel: 'Test Grade',
}

describe('useExercisesPager - URL sync effect ping-pong regression', () => {
  let replaceStateSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    replaceStateSpy = vi.fn()
    vi.stubGlobal('window', {
      ...window,
      history: { ...window.history, replaceState: replaceStateSpy },
      location: {
        ...window.location,
        pathname: '/courses/test-course/chapters/test-chapter/lessons/test-lesson/exercises/ex-1',
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('handleNext should advance state to next exercise when URL matches an exercise', () => {
    // exercises reference must be stable across renders (matches production, where the
    // array comes as a prop and is memoized upstream).
    const exercises = createMockExercises(3)

    const { result } = renderHook(() =>
      useExercisesPager({
        exercises,
        ...defaultParams,
        initialExerciseIndex: 0,
      }),
    )

    expect(result.current.pageState.blockIndex).toBe(0)

    act(() => {
      result.current.handleNext()
    })

    expect(result.current.pageState.blockIndex).toBe(1)
  })
})
