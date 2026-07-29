/**
 * Characterization tests for GET /api/stats/dashboard.
 *
 * The dashboard is pure arithmetic over progress records and conversations, so
 * the counting rules are what matter: which lessons count as practised, how the
 * success rate is averaged, and which chat messages count as questions.
 */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockContentDb, type Doc } from './helpers/fake-content-db'

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof mockContentDb> | null }))
const mockGetWebUser = vi.hoisted(() => vi.fn())
const mockGetOrCreateUserStats = vi.hoisted(() => vi.fn())
const mockFindUserProgress = vi.hoisted(() => vi.fn())

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
  }
})

const USER_ID = '507f1f77bcf86cd799439011'
const LESSON_ID = '507f191e810c19729de860ea'

function seed(seedData: Record<string, Doc[]> = {}) {
  db.current = mockContentDb(seedData)
  return db.current
}

async function dashboard() {
  const { GET } = await import('@/app/api/stats/dashboard/route')
  const response = await GET(new NextRequest('http://localhost/api/stats/dashboard'))
  return { status: response.status, body: await response.json() }
}

describe('GET /api/stats/dashboard', () => {
  beforeEach(() => {
    seed({ lessons: [], conversations: [] })
    mockGetWebUser.mockReset().mockResolvedValue({ id: USER_ID })
    mockGetOrCreateUserStats.mockReset().mockResolvedValue({
      totalTimeSpentSeconds: 3600,
      currentStreak: 4,
    })
    mockFindUserProgress.mockReset().mockResolvedValue({ progressRecords: [] })
  })

  it('returns an empty dashboard for an anonymous visitor, not an error', async () => {
    mockGetWebUser.mockResolvedValue(null)

    const { status, body } = await dashboard()

    expect(status).toBe(200)
    expect(body.summary).toEqual({ timeSpent: 0, dailyStreak: 0 })
    expect(body.practicedLessons).toEqual([])
  })

  it('reports total time and streak from the user stats', async () => {
    const { body } = await dashboard()

    expect(body.summary).toEqual({ timeSpent: 3600, dailyStreak: 4 })
  })

  it('counts completed lessons against the total started', async () => {
    mockFindUserProgress.mockResolvedValue({
      progressRecords: [
        { recordType: 'lesson', recordId: 'a', status: 'completed' },
        { recordType: 'lesson', recordId: 'b', status: 'in_progress' },
      ],
    })

    const { body } = await dashboard()

    expect(body.categoryProgress.learn).toEqual({ count: 1, total: 2 })
  })

  it('averages the success rate over completed exercises only', async () => {
    mockFindUserProgress.mockResolvedValue({
      progressRecords: [
        { recordType: 'exercise', recordId: 'x', status: 'completed', score: 80 },
        { recordType: 'exercise', recordId: 'y', status: 'completed', score: 60 },
        { recordType: 'exercise', recordId: 'z', status: 'in_progress', score: 0 },
      ],
    })

    const { body } = await dashboard()

    expect(body.categoryProgress.practice).toEqual({
      attempted: 3,
      completed: 2,
      successRate: 70,
    })
  })

  it('reports a zero success rate rather than dividing by nothing', async () => {
    mockFindUserProgress.mockResolvedValue({
      progressRecords: [{ recordType: 'exercise', recordId: 'x', status: 'in_progress' }],
    })

    const { body } = await dashboard()

    expect(body.categoryProgress.practice.successRate).toBe(0)
  })

  it('counts only the visible questions the user asked', async () => {
    seed({
      lessons: [],
      conversations: [
        {
          _id: 'c1',
          user: USER_ID,
          messages: [
            { role: 'user', content: 'one' },
            { role: 'assistant', content: 'reply' },
            { role: 'user', content: 'hidden', hidden: true },
            { role: 'user', content: 'two' },
          ],
        },
      ],
    })

    const { body } = await dashboard()

    expect(body.categoryProgress.ask).toEqual({ questionsAsked: 2, conversations: 1 })
  })

  it('ignores archived conversations', async () => {
    seed({
      lessons: [],
      conversations: [
        { _id: 'c1', user: USER_ID, messages: [{ role: 'user' }], archivedAt: new Date() },
      ],
    })

    const { body } = await dashboard()

    expect(body.categoryProgress.ask).toEqual({ questionsAsked: 0, conversations: 0 })
  })

  it('copes with a conversation that has no messages', async () => {
    seed({ lessons: [], conversations: [{ _id: 'c1', user: USER_ID }] })

    const { body } = await dashboard()

    expect(body.categoryProgress.ask).toEqual({ questionsAsked: 0, conversations: 1 })
  })

  it('lists practised lessons with their titles, most recent first', async () => {
    seed({
      lessons: [{ _id: LESSON_ID, title: 'Fractions' }],
      conversations: [],
    })
    mockFindUserProgress.mockResolvedValue({
      progressRecords: [
        {
          recordType: 'lesson',
          recordId: LESSON_ID,
          timeSpentSeconds: 120,
          lastAccessedAt: '2026-01-02',
        },
        {
          recordType: 'lesson',
          recordId: '507f191e810c19729de860eb',
          timeSpentSeconds: 60,
          lastAccessedAt: '2026-01-03',
        },
      ],
    })

    const { body } = await dashboard()

    expect(body.practicedLessons).toHaveLength(2)
    expect(body.practicedLessons[0]).toMatchObject({ lessonId: '507f191e810c19729de860eb' })
    expect(body.practicedLessons[1]).toMatchObject({ lessonId: LESSON_ID, title: 'Fractions' })
  })

  it('falls back to a generic title for a lesson it cannot find', async () => {
    mockFindUserProgress.mockResolvedValue({
      progressRecords: [{ recordType: 'lesson', recordId: LESSON_ID, timeSpentSeconds: 30 }],
    })

    const { body } = await dashboard()

    expect(body.practicedLessons[0].title).toBe('Lesson')
  })

  it('excludes a lesson that was opened but never spent time on', async () => {
    mockFindUserProgress.mockResolvedValue({
      progressRecords: [
        { recordType: 'lesson', recordId: LESSON_ID, timeSpentSeconds: 0, status: 'in_progress' },
      ],
    })

    const { body } = await dashboard()

    expect(body.practicedLessons).toEqual([])
  })

  it('includes a completed lesson even with no time recorded', async () => {
    mockFindUserProgress.mockResolvedValue({
      progressRecords: [
        { recordType: 'lesson', recordId: LESSON_ID, timeSpentSeconds: 0, status: 'completed' },
      ],
    })

    const { body } = await dashboard()

    expect(body.practicedLessons).toHaveLength(1)
  })

  it('shows at most ten practised lessons', async () => {
    mockFindUserProgress.mockResolvedValue({
      progressRecords: Array.from({ length: 15 }, (_, index) => ({
        recordType: 'lesson',
        recordId: `lesson-${index}`,
        timeSpentSeconds: 10,
        lastAccessedAt: `2026-01-${String(index + 1).padStart(2, '0')}`,
      })),
    })

    const { body } = await dashboard()

    expect(body.practicedLessons).toHaveLength(10)
  })
})
