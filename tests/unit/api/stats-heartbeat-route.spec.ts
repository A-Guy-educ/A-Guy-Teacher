/**
 * Characterization tests for POST /api/stats/heartbeat.
 *
 * The heartbeat accumulates study time, so the arithmetic and the
 * accumulate-vs-create decision on lesson progress are pinned before the
 * `user-stats` write moves into the service layer.
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
const LESSON_ID = 'lesson-1'

function seed(seedData: Record<string, Doc[]> = {}) {
  db.current = mockContentDb(seedData)
  return db.current
}

async function heartbeat(body: unknown) {
  const { POST } = await import('@/app/api/stats/heartbeat/route')
  const response = await POST(
    new NextRequest('http://localhost/api/stats/heartbeat', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  )
  return { status: response.status, body: await response.json() }
}

describe('POST /api/stats/heartbeat', () => {
  beforeEach(() => {
    seed({ 'user-stats': [{ _id: 'stats-1', totalTimeSpentSeconds: 100 }] })
    mockGetWebUser.mockReset().mockResolvedValue({ id: USER_ID })
    mockGetOrCreateUserStats.mockReset().mockResolvedValue({
      _id: 'stats-1',
      totalTimeSpentSeconds: 100,
    })
    mockFindUserProgress.mockReset().mockResolvedValue({ progressRecords: [] })
    mockUpsertUserProgress.mockReset().mockResolvedValue(undefined)
  })

  it('refuses an anonymous caller', async () => {
    mockGetWebUser.mockResolvedValue(null)

    const { status, body } = await heartbeat({ seconds: 30 })

    expect(status).toBe(401)
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  it.each([
    ['no body at all', undefined],
    ['zero seconds', { seconds: 0 }],
    ['more seconds than a heartbeat can cover', { seconds: 121 }],
    ['a non-numeric duration', { seconds: 'thirty' }],
  ])('rejects %s', async (_label, body) => {
    const result = await heartbeat(body)

    expect(result.status).toBe(400)
    expect(result.body.error).toBe('Invalid request')
  })

  it('adds the elapsed seconds to the running total', async () => {
    const fake = seed({ 'user-stats': [{ _id: 'stats-1', totalTimeSpentSeconds: 100 }] })

    const { status, body } = await heartbeat({ seconds: 30 })

    expect(status).toBe(200)
    expect(body).toEqual({ success: true, totalTimeSpentSeconds: 130 })
    expect(fake.collections['user-stats'][0]).toMatchObject({ totalTimeSpentSeconds: 130 })
  })

  it('treats a missing total as zero rather than failing', async () => {
    mockGetOrCreateUserStats.mockResolvedValue({ _id: 'stats-1' })

    expect((await heartbeat({ seconds: 45 })).body).toEqual({
      success: true,
      totalTimeSpentSeconds: 45,
    })
  })

  it('records a lastHeartbeatAt timestamp', async () => {
    const fake = seed({ 'user-stats': [{ _id: 'stats-1', totalTimeSpentSeconds: 0 }] })

    await heartbeat({ seconds: 10 })

    expect(fake.collections['user-stats'][0].lastHeartbeatAt).toBeInstanceOf(Date)
  })

  it('leaves lesson progress alone when no lesson is named', async () => {
    await heartbeat({ seconds: 30 })

    expect(mockUpsertUserProgress).not.toHaveBeenCalled()
  })

  it('starts a lesson record the first time a lesson is seen', async () => {
    await heartbeat({ seconds: 30, lessonId: LESSON_ID })

    expect(mockUpsertUserProgress).toHaveBeenCalledWith(USER_ID, 'default', {
      progressRecords: [
        expect.objectContaining({
          recordType: 'lesson',
          recordId: LESSON_ID,
          status: 'in_progress',
          completionPercentage: 0,
          timeSpentSeconds: 30,
        }),
      ],
    })
  })

  it('accumulates onto an existing lesson record instead of duplicating it', async () => {
    mockFindUserProgress.mockResolvedValue({
      progressRecords: [
        { recordType: 'lesson', recordId: LESSON_ID, status: 'completed', timeSpentSeconds: 60 },
      ],
    })

    await heartbeat({ seconds: 30, lessonId: LESSON_ID })

    const [, , update] = mockUpsertUserProgress.mock.calls[0]
    expect(update.progressRecords).toHaveLength(1)
    expect(update.progressRecords[0]).toMatchObject({
      timeSpentSeconds: 90,
      status: 'completed',
    })
  })

  it('does not disturb progress records for other lessons', async () => {
    mockFindUserProgress.mockResolvedValue({
      progressRecords: [{ recordType: 'lesson', recordId: 'other', timeSpentSeconds: 5 }],
    })

    await heartbeat({ seconds: 30, lessonId: LESSON_ID })

    const [, , update] = mockUpsertUserProgress.mock.calls[0]
    expect(update.progressRecords).toHaveLength(2)
    expect(update.progressRecords[0]).toMatchObject({ recordId: 'other', timeSpentSeconds: 5 })
  })
})
