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

  it('renders with correct initial state (skipIntro=true, 3 exercises)', () => {
    const { result } = renderHook(() =>
      useExercisesPager({
        exercises: createMockExercises(3),
        ...defaultParams,
        skipIntro: true,
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
        skipIntro: true,
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
        skipIntro: true,
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
        skipIntro: true,
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
        skipIntro: true,
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
        skipIntro: true,
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
        skipIntro: true,
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
        skipIntro: true,
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
