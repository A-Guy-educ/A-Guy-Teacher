// @vitest-environment jsdom

/**
 * @fileType test
 * @domain frontend
 * @pattern route-stub, deep-link, redirect
 * @ai-summary Verifies that /exercises/[exerciseSlug] and /content/[pageSlug]
 *             route stubs redirect to the parent lesson URL with ?block=N
 *             instead of returning notFound (Issue #757 P0).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const redirectMock = vi.fn()
const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
  notFound: (...args: unknown[]) => notFoundMock(...args),
}))

const queryLessonBySlugMock = vi.fn()
const queryLessonBlocksMock = vi.fn()

vi.mock('@/server/repos/queries/lessons', () => ({
  queryLessonBySlug: (args: unknown) => queryLessonBySlugMock(args),
}))

vi.mock('@/server/repos/queries/lesson-blocks', () => ({
  queryLessonBlocks: (args: unknown) => queryLessonBlocksMock(args),
}))

vi.mock('@/infra/config/server-init', () => ({}))

describe('exercise route stub redirects (Issue #757)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notFoundMock.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND')
    })
  })

  it('redirects to parent lesson URL with ?block=N when exercise slug matches', async () => {
    queryLessonBySlugMock.mockResolvedValue({
      id: 'lesson-1',
      slug: 'intro-lesson',
      chapter: { id: 'ch-1', slug: 'chapter-1', course: { id: 'co-1', slug: 'math-101' } },
    })
    queryLessonBlocksMock.mockResolvedValue([
      {
        type: 'exercise',
        data: { id: 'ex-1', slug: 'first-exercise', title: 'First' },
      },
      {
        type: 'exercise',
        data: { id: 'ex-2', slug: 'second-exercise', title: 'Second' },
      },
    ])

    const { default: ExercisePage } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/page')

    await ExercisePage({
      params: Promise.resolve({
        courseSlug: 'math-101',
        chapterSlug: 'chapter-1',
        lessonSlug: 'intro-lesson',
        exerciseSlug: 'second-exercise',
      }),
    })

    expect(redirectMock).toHaveBeenCalledWith(
      '/courses/math-101/chapters/chapter-1/lessons/intro-lesson?section=0&block=1',
    )
    expect(notFoundMock).not.toHaveBeenCalled()
  })

  it('matches exercise by id when slug is absent', async () => {
    queryLessonBySlugMock.mockResolvedValue({
      id: 'lesson-1',
      slug: 'intro-lesson',
      chapter: { id: 'ch-1', slug: 'chapter-1', course: { id: 'co-1', slug: 'math-101' } },
    })
    queryLessonBlocksMock.mockResolvedValue([
      { type: 'exercise', data: { id: 'ex-fallback-id', title: 'Fallback' } },
    ])

    const { default: ExercisePage } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/page')

    await ExercisePage({
      params: Promise.resolve({
        courseSlug: 'math-101',
        chapterSlug: 'chapter-1',
        lessonSlug: 'intro-lesson',
        exerciseSlug: 'ex-fallback-id',
      }),
    })

    expect(redirectMock).toHaveBeenCalledWith(
      '/courses/math-101/chapters/chapter-1/lessons/intro-lesson?section=0&block=0',
    )
  })

  it('calls notFound when lesson slug does not exist', async () => {
    queryLessonBySlugMock.mockResolvedValue(null)

    const { default: ExercisePage } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/page')

    await expect(
      ExercisePage({
        params: Promise.resolve({
          courseSlug: 'math-101',
          chapterSlug: 'chapter-1',
          lessonSlug: 'missing',
          exerciseSlug: 'any',
        }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('calls notFound when course/chapter slug mismatch', async () => {
    queryLessonBySlugMock.mockResolvedValue({
      id: 'lesson-1',
      slug: 'intro-lesson',
      chapter: { id: 'ch-1', slug: 'different-chapter', course: { id: 'co-1', slug: 'math-101' } },
    })

    const { default: ExercisePage } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/page')

    await expect(
      ExercisePage({
        params: Promise.resolve({
          courseSlug: 'math-101',
          chapterSlug: 'chapter-1',
          lessonSlug: 'intro-lesson',
          exerciseSlug: 'any',
        }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('calls notFound when exercise slug does not match any block', async () => {
    queryLessonBySlugMock.mockResolvedValue({
      id: 'lesson-1',
      slug: 'intro-lesson',
      chapter: { id: 'ch-1', slug: 'chapter-1', course: { id: 'co-1', slug: 'math-101' } },
    })
    queryLessonBlocksMock.mockResolvedValue([
      { type: 'exercise', data: { id: 'ex-1', slug: 'first', title: 'First' } },
    ])

    const { default: ExercisePage } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/page')

    await expect(
      ExercisePage({
        params: Promise.resolve({
          courseSlug: 'math-101',
          chapterSlug: 'chapter-1',
          lessonSlug: 'intro-lesson',
          exerciseSlug: 'nonexistent',
        }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(redirectMock).not.toHaveBeenCalled()
  })
})

describe('content route stub redirects (Issue #757)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notFoundMock.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND')
    })
  })

  it('redirects to parent lesson URL with ?block=N when content page slug matches', async () => {
    queryLessonBySlugMock.mockResolvedValue({
      id: 'lesson-1',
      slug: 'intro-lesson',
      chapter: { id: 'ch-1', slug: 'chapter-1', course: { id: 'co-1', slug: 'math-101' } },
    })
    queryLessonBlocksMock.mockResolvedValue([
      { type: 'contentPage', data: { id: 'cp-1', slug: 'intro-page', title: 'Intro' } },
      { type: 'contentPage', data: { id: 'cp-2', slug: 'second-page', title: 'Second' } },
    ])

    const { default: ContentPageRoute } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/content/[pageSlug]/page')

    await ContentPageRoute({
      params: Promise.resolve({
        courseSlug: 'math-101',
        chapterSlug: 'chapter-1',
        lessonSlug: 'intro-lesson',
        pageSlug: 'second-page',
      }),
    })

    expect(redirectMock).toHaveBeenCalledWith(
      '/courses/math-101/chapters/chapter-1/lessons/intro-lesson?section=0&block=1',
    )
    expect(notFoundMock).not.toHaveBeenCalled()
  })

  it('matches content page by id when slug is absent', async () => {
    queryLessonBySlugMock.mockResolvedValue({
      id: 'lesson-1',
      slug: 'intro-lesson',
      chapter: { id: 'ch-1', slug: 'chapter-1', course: { id: 'co-1', slug: 'math-101' } },
    })
    queryLessonBlocksMock.mockResolvedValue([
      { type: 'contentPage', data: { id: 'cp-fallback', title: 'Fallback' } },
    ])

    const { default: ContentPageRoute } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/content/[pageSlug]/page')

    await ContentPageRoute({
      params: Promise.resolve({
        courseSlug: 'math-101',
        chapterSlug: 'chapter-1',
        lessonSlug: 'intro-lesson',
        pageSlug: 'cp-fallback',
      }),
    })

    expect(redirectMock).toHaveBeenCalledWith(
      '/courses/math-101/chapters/chapter-1/lessons/intro-lesson?section=0&block=0',
    )
  })

  it('does not match exercise slug against content page blocks', async () => {
    queryLessonBySlugMock.mockResolvedValue({
      id: 'lesson-1',
      slug: 'intro-lesson',
      chapter: { id: 'ch-1', slug: 'chapter-1', course: { id: 'co-1', slug: 'math-101' } },
    })
    queryLessonBlocksMock.mockResolvedValue([
      { type: 'exercise', data: { id: 'ex-1', slug: 'first', title: 'First' } },
    ])

    const { default: ContentPageRoute } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/content/[pageSlug]/page')

    await expect(
      ContentPageRoute({
        params: Promise.resolve({
          courseSlug: 'math-101',
          chapterSlug: 'chapter-1',
          lessonSlug: 'intro-lesson',
          pageSlug: 'first',
        }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('calls notFound when lesson slug does not exist', async () => {
    queryLessonBySlugMock.mockResolvedValue(null)

    const { default: ContentPageRoute } =
      await import('@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/content/[pageSlug]/page')

    await expect(
      ContentPageRoute({
        params: Promise.resolve({
          courseSlug: 'math-101',
          chapterSlug: 'chapter-1',
          lessonSlug: 'missing',
          pageSlug: 'any',
        }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(redirectMock).not.toHaveBeenCalled()
  })
})
