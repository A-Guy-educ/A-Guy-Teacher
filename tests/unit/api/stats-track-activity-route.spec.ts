/**
 * Characterization tests for POST /api/stats/track-activity.
 *
 * Two behaviours matter beyond the happy path: the activity log is capped and
 * newest-first, and a completed lesson is never quietly demoted back to
 * in-progress by a later visit. Both are pinned before the `user-stats` write
 * moves into the service layer.
 */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockContentDb, type Doc } from './helpers/fake-content-db'

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof mockContentDb> | null }))
const mockGetWebUser = vi.hoisted(() => vi.fn())
const mockGetOrCreateUserStats = vi.hoisted(() => vi.fn())
const mockFindUserProgress = vi.hoisted(() => vi.fn())
const mockUpsertUserProgress = vi.hoisted(() => vi.fn())

vi.mock('@/infra/db/content-db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/db/content-db')>()
  return { ...actual, getContentDb: async () => db.current!.db }
})

vi.mock('@/infra/web-api/mongo-payload', () => ({ getWebUser: mockGetWebUser }))

vi.mock('@/server/web-api/progress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/web-api/progress')>()
  return {
    ...actual,
    getOrCreateUserStats: mockGetOrCreateUserStats,
    findUserProgress: mockFindUserProgress,
    upsertUserProgress: mockUpsertUserProgress,
  }
})

const USER_ID = 'user-1'

const LESSON_COMPLETED = {
  eventType: 'lesson_completed',
  lessonId: 'lesson-1',
  lessonTitle: 'Fractions',
}

const EXERCISE_COMPLETED = {
  eventType: 'exercise_completed',
  exerciseId: 'exercise-1',
  score: 80,
  totalQuestions: 10,
  correctCount: 8,
}

function seed(seedData: Record<string, Doc[]> = {}) {
  db.current = mockContentDb(seedData)
  return db.current
}

async function track(body: unknown) {
  const { POST } = await import('@/app/api/stats/track-activity/route')
  const response = await POST(
    new NextRequest('http://localhost/api/stats/track-activity', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  )
  return { status: response.status, body: await response.json() }
}

function lastProgressRecords() {
  const [, , update] = mockUpsertUserProgress.mock.calls.at(-1)!
  return update.progressRecords
}

describe('POST /api/stats/track-activity', () => {
  beforeEach(() => {
    seed({ 'user-stats': [{ _id: 'stats-1', activityLog: [] }] })
    mockGetWebUser.mockReset().mockResolvedValue({ id: USER_ID })
    mockGetOrCreateUserStats.mockReset().mockResolvedValue({ _id: 'stats-1' })
    mockFindUserProgress.mockReset().mockResolvedValue({ progressRecords: [] })
    mockUpsertUserProgress.mockReset().mockResolvedValue(undefined)
  })

  it('refuses an anonymous caller', async () => {
    mockGetWebUser.mockResolvedValue(null)

    expect(await track(LESSON_COMPLETED)).toMatchObject({
      status: 401,
      body: { error: 'Unauthorized' },
    })
  })

  it.each([
    ['an unknown event type', { eventType: 'something_else', lessonId: 'l1' }],
    ['a lesson event with no lesson', { eventType: 'lesson_completed' }],
    ['a score above 100', { ...EXERCISE_COMPLETED, score: 101 }],
    ['zero total questions', { ...EXERCISE_COMPLETED, totalQuestions: 0 }],
  ])('rejects %s', async (_label, body) => {
    const result = await track(body)

    expect(result.status).toBe(400)
    expect(result.body.error).toBe('Invalid request')
  })

  it('records a completed lesson at 100 per cent', async () => {
    const { status, body } = await track(LESSON_COMPLETED)

    expect(status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(lastProgressRecords()).toEqual([
      expect.objectContaining({
        recordType: 'lesson',
        recordId: 'lesson-1',
        status: 'completed',
        completionPercentage: 100,
      }),
    ])
  })

  it('writes the newest activity to the front of the log', async () => {
    const fake = seed({ 'user-stats': [{ _id: 'stats-1', activityLog: [{ label: 'older' }] }] })

    await track(LESSON_COMPLETED)

    const log = fake.collections['user-stats'][0].activityLog as Doc[]
    expect(log[0]).toMatchObject({
      actionType: 'lesson_completed',
      label: 'Fractions',
      targetId: 'lesson-1',
      targetCollection: 'lessons',
    })
    expect(log[1]).toMatchObject({ label: 'older' })
  })

  it('caps the activity log at 100 entries', async () => {
    const existing = Array.from({ length: 100 }, (_, index) => ({ label: `entry-${index}` }))
    const fake = seed({ 'user-stats': [{ _id: 'stats-1', activityLog: existing }] })

    await track(LESSON_COMPLETED)

    expect((fake.collections['user-stats'][0].activityLog as Doc[]).length).toBe(100)
  })

  it('falls back to a generated label when no title is supplied', async () => {
    const fake = seed({ 'user-stats': [{ _id: 'stats-1', activityLog: [] }] })

    await track({ eventType: 'lesson_completed', lessonId: 'lesson-9' })

    const log = fake.collections['user-stats'][0].activityLog as Doc[]
    expect(log[0].label).toBe('Lesson lesson-9')
  })

  it('marks a completed exercise done, and records the score separately', async () => {
    // completionPercentage is "did you finish it", not "how well" — the mark
    // lives in `score`. Worth pinning, because conflating the two is the
    // obvious mistake to make when this moves.
    await track(EXERCISE_COMPLETED)

    expect(lastProgressRecords()[0]).toMatchObject({
      recordType: 'exercise',
      recordId: 'exercise-1',
      status: 'completed',
      completionPercentage: 100,
      score: 80,
    })
  })

  it('rounds a score that does not divide evenly', async () => {
    await track({ ...EXERCISE_COMPLETED, totalQuestions: 3, correctCount: 2 })

    expect(lastProgressRecords()[0].score).toBe(67)
  })

  it('leaves an attempted exercise in progress with no score', async () => {
    await track({ eventType: 'exercise_attempted', exerciseId: 'exercise-1' })

    expect(lastProgressRecords()[0]).toMatchObject({
      status: 'in_progress',
      completionPercentage: 0,
    })
    expect(lastProgressRecords()[0].score).toBeUndefined()
  })

  it('never demotes an already-completed record back to in progress', async () => {
    mockFindUserProgress.mockResolvedValue({
      progressRecords: [
        {
          recordType: 'exercise',
          recordId: 'exercise-1',
          status: 'completed',
          completionPercentage: 100,
        },
      ],
    })

    await track({ eventType: 'exercise_attempted', exerciseId: 'exercise-1' })

    const [record] = lastProgressRecords()
    expect(record.status).toBe('completed')
    expect(record.completionPercentage).toBe(100)
  })

  it('does let a later completion overwrite an in-progress record', async () => {
    mockFindUserProgress.mockResolvedValue({
      progressRecords: [{ recordType: 'exercise', recordId: 'exercise-1', status: 'in_progress' }],
    })

    await track(EXERCISE_COMPLETED)

    expect(lastProgressRecords()[0]).toMatchObject({
      status: 'completed',
      completionPercentage: 100,
      score: 80,
    })
  })
})
