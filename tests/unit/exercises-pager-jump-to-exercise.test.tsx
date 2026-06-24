// @vitest-environment jsdom

/**
 * @fileType test
 * @domain frontend
 * @pattern lesson-navigation, exercise-pager, jump-to-exercise
 * @ai-summary Unit tests for the jump-to-exercise feature in useExercisesPager
 */
import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useExercisesPager } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/useExercisesPager'
import type { Exercise } from '@/infra/types/content'
import type { ResolvedLessonBlock } from '@/server/repos/queries/lesson-blocks'

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

const createMockBlocks = (): ResolvedLessonBlock[] => [
  { type: 'exercise', data: createMockExercises(1)[0] },
  { type: 'contentPage', data: { id: 'cp-1', title: 'Content Page 1' } },
  { type: 'exercise', data: createMockExercises(2)[1] },
  { type: 'contentPage', data: { id: 'cp-2', title: 'Content Page 2' } },
]

describe('useExercisesPager handleJumpToExercise', () => {
  beforeEach(() => {
    // Ensure clean URL state before each test
    vi.stubGlobal('window', {
      ...window,
      history: { ...window.history, replaceState: vi.fn() },
      location: {
        ...window.location,
        pathname: '/courses/test-course/chapters/test-chapter/lessons/test-lesson',
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders with correct initial state (3 exercises)', () => {
    const { result } = renderHook(() =>
      useExercisesPager({
        exercises: createMockExercises(3),
        ...defaultParams,
        initialExerciseIndex: 0,
      }),
    )

    expect(result.current.pageState.type).toBe('exercise')
    expect(result.current.pageState.blockIndex).toBe(0)
    expect(result.current.getExerciseOrdinal()).toBe(1)
    expect(result.current.totalExercises).toBe(3)
    expect(result.current.canGoPrev).toBe(false)
    expect(result.current.canGoNext).toBe(true)
  })

  it('jumps to a valid exercise number (3) and updates state', () => {
    const { result } = renderHook(() =>
      useExercisesPager({
        exercises: createMockExercises(3),
        ...defaultParams,
        initialExerciseIndex: 0,
      }),
    )

    expect(result.current.getExerciseOrdinal()).toBe(1)

    act(() => {
      result.current.handleJumpToExercise(3)
    })

    expect(result.current.getExerciseOrdinal()).toBe(3)
    expect(result.current.pageState.blockIndex).toBe(2)
  })

  it('jumps to middle exercise (2) and updates state correctly', () => {
    const { result } = renderHook(() =>
      useExercisesPager({
        exercises: createMockExercises(3),
        ...defaultParams,
        initialExerciseIndex: 0,
      }),
    )

    expect(result.current.getExerciseOrdinal()).toBe(1)

    act(() => {
      result.current.handleJumpToExercise(2)
    })

    expect(result.current.getExerciseOrdinal()).toBe(2)
    expect(result.current.pageState.blockIndex).toBe(1)
  })

  it('does not navigate when given out-of-range number greater than total', () => {
    const { result } = renderHook(() =>
      useExercisesPager({
        exercises: createMockExercises(3),
        ...defaultParams,
        initialExerciseIndex: 0,
      }),
    )

    expect(result.current.getExerciseOrdinal()).toBe(1)

    act(() => {
      result.current.handleJumpToExercise(10)
    })

    // State should not change
    expect(result.current.getExerciseOrdinal()).toBe(1)
    expect(result.current.pageState.blockIndex).toBe(0)
  })

  it('does not navigate when given out-of-range number less than 1', () => {
    const { result } = renderHook(() =>
      useExercisesPager({
        exercises: createMockExercises(3),
        ...defaultParams,
        initialExerciseIndex: 0,
      }),
    )

    expect(result.current.getExerciseOrdinal()).toBe(1)

    act(() => {
      result.current.handleJumpToExercise(0)
    })

    expect(result.current.getExerciseOrdinal()).toBe(1)
  })

  it('does not navigate when given negative number', () => {
    const { result } = renderHook(() =>
      useExercisesPager({
        exercises: createMockExercises(3),
        ...defaultParams,
        initialExerciseIndex: 0,
      }),
    )

    expect(result.current.getExerciseOrdinal()).toBe(1)

    act(() => {
      result.current.handleJumpToExercise(-1)
    })

    expect(result.current.getExerciseOrdinal()).toBe(1)
  })

  it('jumping to same exercise is a no-op', () => {
    const { result } = renderHook(() =>
      useExercisesPager({
        exercises: createMockExercises(3),
        ...defaultParams,
        initialExerciseIndex: 0,
      }),
    )

    expect(result.current.getExerciseOrdinal()).toBe(1)

    act(() => {
      result.current.handleJumpToExercise(1)
    })

    expect(result.current.getExerciseOrdinal()).toBe(1)
  })

  it('works with single exercise', () => {
    const { result } = renderHook(() =>
      useExercisesPager({
        exercises: createMockExercises(1),
        ...defaultParams,
        initialExerciseIndex: 0,
      }),
    )

    expect(result.current.getExerciseOrdinal()).toBe(1)

    act(() => {
      result.current.handleJumpToExercise(5)
    })

    // Should not navigate since only 1 exercise exists
    expect(result.current.getExerciseOrdinal()).toBe(1)
  })
})

describe('useExercisesPager block reordering', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      ...window,
      history: { ...window.history, replaceState: vi.fn() },
      location: {
        ...window.location,
        pathname: '/courses/test-course/chapters/test-chapter/lessons/test-lesson',
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('places content pages before exercises in resolved blocks', () => {
    const { result } = renderHook(() =>
      useExercisesPager({
        exercises: [],
        blocks: createMockBlocks(),
        ...defaultParams,
      }),
    )

    // resolvedBlocks should be [contentPage, contentPage, exercise, exercise]
    expect(result.current.totalBlocks).toBe(4)
    expect(result.current.totalContentPages).toBe(2)
    expect(result.current.totalExercises).toBe(2)
  })

  it('initial state starts on first content page when blocks are reordered', () => {
    const { result } = renderHook(() =>
      useExercisesPager({
        exercises: [],
        blocks: createMockBlocks(),
        ...defaultParams,
      }),
    )

    // First block (after reorder) is a content page
    expect(result.current.pageState.type).toBe('contentPage')
    expect(result.current.pageState.blockIndex).toBe(0)
    expect(result.current.getContentPageOrdinal()).toBe(1)
    expect(result.current.getExerciseOrdinal()).toBe(null)
  })

  it('getContentPageOrdinal only counts content pages', () => {
    const { result } = renderHook(() =>
      useExercisesPager({
        exercises: [],
        blocks: createMockBlocks(),
        ...defaultParams,
      }),
    )

    // Navigate to second content page (blockIndex 1 after reorder)
    act(() => {
      result.current.handleNext()
    })

    expect(result.current.pageState.blockIndex).toBe(1)
    expect(result.current.getContentPageOrdinal()).toBe(2)
    expect(result.current.getExerciseOrdinal()).toBe(null)
  })

  it('getExerciseOrdinal only counts exercises after content pages', () => {
    const { result } = renderHook(() =>
      useExercisesPager({
        exercises: [],
        blocks: createMockBlocks(),
        ...defaultParams,
      }),
    )

    // Navigate past content pages to first exercise (blockIndex 2)
    act(() => {
      result.current.handleNext()
    })
    act(() => {
      result.current.handleNext()
    })

    expect(result.current.pageState.blockIndex).toBe(2)
    expect(result.current.getContentPageOrdinal()).toBe(null)
    expect(result.current.getExerciseOrdinal()).toBe(1) // first exercise
  })

  it('handleJumpToExercise finds correct block after reorder', () => {
    const { result } = renderHook(() =>
      useExercisesPager({
        exercises: [],
        blocks: createMockBlocks(),
        ...defaultParams,
      }),
    )

    // Jump to exercise 2 (which is at blockIndex 3 after reorder)
    act(() => {
      result.current.handleJumpToExercise(2)
    })

    expect(result.current.pageState.blockIndex).toBe(3)
    expect(result.current.getExerciseOrdinal()).toBe(2)
  })

  it('canGoPrev is false on first page (content page at index 0)', () => {
    const { result } = renderHook(() =>
      useExercisesPager({
        exercises: [],
        blocks: createMockBlocks(),
        ...defaultParams,
      }),
    )

    expect(result.current.canGoPrev).toBe(false)
  })

  it('canGoNext is true on first content page', () => {
    const { result } = renderHook(() =>
      useExercisesPager({
        exercises: [],
        blocks: createMockBlocks(),
        ...defaultParams,
      }),
    )

    expect(result.current.canGoNext).toBe(true)
  })

  it('outro is reached after last exercise', () => {
    const { result } = renderHook(() =>
      useExercisesPager({
        exercises: [],
        blocks: createMockBlocks(),
        ...defaultParams,
      }),
    )

    // Navigate through all 4 blocks to reach outro
    act(() => {
      result.current.handleNext()
    })
    act(() => {
      result.current.handleNext()
    })
    act(() => {
      result.current.handleNext()
    })
    act(() => {
      result.current.handleNext()
    })

    expect(result.current.pageState.type).toBe('outro')
  })
})
