import { describe, expect, it } from 'vitest'

import {
  orderLearningFallbackCourses,
  resolveLearningPageSelection,
  shouldUseEmbeddedLearningFallback,
} from '@/app/(frontend)/study/learningPageSelection'

describe('resolveLearningPageSelection', () => {
  it('uses cookies when no query params are present', () => {
    expect(
      resolveLearningPageSelection({
        cookieCourseId: 'cookie-course',
        cookieGrade: '7',
        systemLocale: 'he',
      }),
    ).toEqual({
      contentLocale: 'he',
      courseId: 'cookie-course',
      grade: '7',
    })
  })

  it('lets query params override cookies for preview views', () => {
    expect(
      resolveLearningPageSelection({
        cookieCourseId: 'cookie-course',
        cookieGrade: '7',
        searchParams: {
          courseId: 'query-course',
          grade: '9',
          locale: 'he',
        },
        systemLocale: 'en',
      }),
    ).toEqual({
      contentLocale: 'he',
      courseId: 'query-course',
      grade: '9',
    })
  })

  it('ignores empty query values', () => {
    expect(
      resolveLearningPageSelection({
        cookieCourseId: 'cookie-course',
        cookieGrade: '7',
        searchParams: {
          courseId: ' ',
          grade: [''],
          locale: 'bad-locale',
        },
        systemLocale: 'he',
      }),
    ).toEqual({
      contentLocale: 'he',
      courseId: 'cookie-course',
      grade: '7',
    })
  })

  it('uses the embedded fallback only for iframe requests without a course selection', () => {
    expect(
      shouldUseEmbeddedLearningFallback({
        headersList: new Headers({ 'sec-fetch-dest': 'iframe' }),
        selection: {},
      }),
    ).toBe(true)

    expect(
      shouldUseEmbeddedLearningFallback({
        headersList: new Headers({ 'sec-fetch-dest': 'document' }),
        selection: {},
      }),
    ).toBe(false)

    expect(
      shouldUseEmbeddedLearningFallback({
        headersList: new Headers({ 'sec-fetch-dest': 'iframe' }),
        selection: { courseId: 'selected-course', grade: '7' },
      }),
    ).toBe(false)
  })

  it('prefers structured course labels before scratch courses for fallback content', () => {
    expect(
      orderLearningFallbackCourses([
        { id: 'scratch', courseLabel: 'guy', order: 0 },
        { id: 'grade-9', courseLabel: '9', order: 2 },
        { id: 'grade-8', courseLabel: '7', order: 1 },
      ]).map((course) => course.id),
    ).toEqual(['grade-8', 'grade-9', 'scratch'])
  })
})
