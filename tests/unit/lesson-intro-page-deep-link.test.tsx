// @vitest-environment jsdom

/**
 * @fileType test
 * @domain frontend
 * @pattern lesson-intro-page, deep-link, route-stubs
 * @ai-summary Verifies the ?block=N deep-link support added to useLessonIntroPage
 *             to keep prev/next buttons working when navigating to
 *             /lessons/[slug]/exercises/[slug] or /lessons/[slug]/content/[slug]
 */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useLessonIntroPage } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/LessonIntroPage/useLessonIntroPage'

describe('useLessonIntroPage initialBlockIndex deep-link (Issue #757)', () => {
  it('starts in intro state when no deep-link parameters are provided', () => {
    const { result } = renderHook(() => useLessonIntroPage({}))

    expect(result.current.pageState.type).toBe('intro')
  })

  it('starts in workspace state when deepLinkedExerciseId is provided', () => {
    const { result } = renderHook(() => useLessonIntroPage({ deepLinkedExerciseId: 'ex-1' }))

    expect(result.current.pageState.type).toBe('workspace')
  })

  it('starts in content state with the given initialExerciseIndex when initialBlockIndex is provided', () => {
    const { result } = renderHook(() => useLessonIntroPage({ initialBlockIndex: 4 }))

    expect(result.current.pageState.type).toBe('content')
    if (result.current.pageState.type === 'content') {
      expect(result.current.pageState.initialExerciseIndex).toBe(4)
    }
  })

  it('starts in content state with initialExerciseIndex 0 when initialBlockIndex is 0', () => {
    const { result } = renderHook(() => useLessonIntroPage({ initialBlockIndex: 0 }))

    expect(result.current.pageState.type).toBe('content')
    if (result.current.pageState.type === 'content') {
      expect(result.current.pageState.initialExerciseIndex).toBe(0)
    }
  })

  it('falls back to intro state when initialBlockIndex is null', () => {
    const { result } = renderHook(() => useLessonIntroPage({ initialBlockIndex: null }))

    expect(result.current.pageState.type).toBe('intro')
  })

  it('falls back to intro state when initialBlockIndex is negative', () => {
    const { result } = renderHook(() => useLessonIntroPage({ initialBlockIndex: -1 }))

    expect(result.current.pageState.type).toBe('intro')
  })

  it('falls back to intro state when initialBlockIndex is NaN', () => {
    const { result } = renderHook(() => useLessonIntroPage({ initialBlockIndex: Number.NaN }))

    expect(result.current.pageState.type).toBe('intro')
  })

  it('deepLinkedExerciseId takes precedence over initialBlockIndex', () => {
    const { result } = renderHook(() =>
      useLessonIntroPage({ deepLinkedExerciseId: 'ex-1', initialBlockIndex: 4 }),
    )

    expect(result.current.pageState.type).toBe('workspace')
  })

  it('handleStart still routes to preamble when hasContentPagesPreamble is true and no deep-link', () => {
    const { result } = renderHook(() => useLessonIntroPage({ hasContentPagesPreamble: true }))

    act(() => {
      result.current.handleStart(0)
    })

    expect(result.current.pageState.type).toBe('preamble')
    if (result.current.pageState.type === 'preamble') {
      expect(result.current.pageState.initialExerciseIndex).toBe(0)
    }
  })
})
