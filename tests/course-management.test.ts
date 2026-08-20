import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CourseManagementView } from '../src/components/course-management-view'
import { courseManagementResponseSchema } from '../src/types/courses'

const courses = [
  {
    id: 'course-1',
    title: 'Algebra foundations',
    slug: 'algebra-foundations',
    courseLabel: '8',
    status: 'published',
    isActive: true,
    accessType: 'free',
    locale: 'en' as const,
    order: 1,
    updatedAt: '2026-08-20T12:00:00.000Z',
  },
  {
    id: 'course-2',
    title: 'Geometry draft',
    status: 'draft',
    isActive: false,
    locale: 'en' as const,
  },
]

describe('Teacher course management', () => {
  it('validates the API response contract', () => {
    expect(courseManagementResponseSchema.parse({ docs: courses })).toEqual({ docs: courses })
    expect(() =>
      courseManagementResponseSchema.parse({ docs: [{ title: 'Missing id' }] }),
    ).toThrow()
  })

  it('renders course state and safe public links', () => {
    const html = renderToStaticMarkup(
      createElement(CourseManagementView, { courses, locale: 'en' }),
    )

    expect(html).toContain('Course management')
    expect(html).toContain('2 courses')
    expect(html).toContain('Published')
    expect(html).toContain('Draft')
    expect(html).toContain('https://www.aguy.co.il/courses/algebra-foundations')
    expect(html).not.toContain('/courses/undefined')
  })

  it('renders the Hebrew contract with RTL-friendly copy', () => {
    const html = renderToStaticMarkup(
      createElement(CourseManagementView, { courses, locale: 'he' }),
    )

    expect(html).toContain('ניהול קורסים')
    expect(html).toContain('2 קורסים')
  })
})
