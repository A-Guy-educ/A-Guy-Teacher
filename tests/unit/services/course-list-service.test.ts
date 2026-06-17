import { beforeEach, describe, expect, it, vi } from 'vitest'

import { queryPublishedCourses } from '@/server/repos/queries/courses'
import { getPublishedCourseList } from '@/server/services/course-list-service'

vi.mock('@/server/repos/queries/courses', () => ({
  queryPublishedCourses: vi.fn(),
}))

const queryPublishedCoursesMock = vi.mocked(queryPublishedCourses)

describe('getPublishedCourseList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns only courses from the requested content locale', async () => {
    queryPublishedCoursesMock.mockResolvedValueOnce([])

    await expect(getPublishedCourseList('en')).resolves.toEqual([])

    expect(queryPublishedCoursesMock).toHaveBeenCalledTimes(1)
    expect(queryPublishedCoursesMock).toHaveBeenCalledWith('en')
  })
})
