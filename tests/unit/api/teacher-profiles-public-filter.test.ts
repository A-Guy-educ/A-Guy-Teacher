import { isPublicTeacherProfile } from '@/app/api/teacher-profiles/route'
import { describe, expect, it } from 'vitest'

describe('isPublicTeacherProfile', () => {
  it('keeps normal enabled teacher profiles visible', () => {
    expect(
      isPublicTeacherProfile({
        slug: 'teacher-focused',
        label: 'Focused teacher',
        description: 'Keeps the lesson focused and clear.',
      }),
    ).toBe(true)
  })

  it('hides the settings test teacher profile', () => {
    expect(
      isPublicTeacherProfile({
        slug: 'settings-test-teacher',
        label: 'Settings Test Teacher',
        description: 'Teacher profile for settings tests',
      }),
    ).toBe(false)
  })
})
