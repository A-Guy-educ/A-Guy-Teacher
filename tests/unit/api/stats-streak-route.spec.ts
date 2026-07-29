/**
 * Characterization tests for /api/stats/streak.
 *
 * The whole point of this route is the day-boundary arithmetic: a streak
 * continues if the last active day was yesterday *in the user's timezone*,
 * and repeat visits on the same day must not inflate it. Those rules are
 * pinned before the `user-stats` write moves into the service layer.
 */

import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mockContentDb, type Doc } from './helpers/fake-content-db'

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof mockContentDb> | null }))
const mockGetWebUser = vi.hoisted(() => vi.fn())
const mockGetOrCreateUserStats = vi.hoisted(() => vi.fn())

vi.mock('@/infra/db/content-db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/db/content-db')>()
  return { ...actual, getContentDb: async () => db.current!.db }
})

vi.mock('@/infra/web-api/mongo-payload', () => ({ getWebUser: mockGetWebUser }))

vi.mock('@/server/web-api/progress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/web-api/progress')>()
  return { ...actual, getOrCreateUserStats: mockGetOrCreateUserStats }
})

const USER_ID = 'user-1'
const TIME_ZONE = 'Asia/Jerusalem'

/** Midday, so the chosen timezone cannot tip the date either way. */
const NOW = new Date('2026-03-10T12:00:00Z')
const TODAY = '2026-03-10'
const YESTERDAY = '2026-03-09'

function seed(seedData: Record<string, Doc[]> = {}) {
  db.current = mockContentDb(seedData)
  return db.current
}

function statsDoc(overrides: Doc = {}): Doc {
  return { _id: 'stats-1', currentStreak: 0, longestStreak: 0, ...overrides }
}

async function get() {
  const { GET } = await import('@/app/api/stats/streak/route')
  const response = await GET(new NextRequest('http://localhost/api/stats/streak'))
  return { status: response.status, body: await response.json() }
}

async function post(timeZone?: string) {
  const { POST } = await import('@/app/api/stats/streak/route')
  const query = timeZone === undefined ? '' : `?timeZone=${encodeURIComponent(timeZone)}`
  const response = await POST(
    new NextRequest(`http://localhost/api/stats/streak${query}`, { method: 'POST' }),
  )
  return { status: response.status, body: await response.json() }
}

describe('GET /api/stats/streak', () => {
  beforeEach(() => {
    seed({ 'user-stats': [statsDoc()] })
    mockGetWebUser.mockReset().mockResolvedValue({ id: USER_ID })
    mockGetOrCreateUserStats
      .mockReset()
      .mockResolvedValue(statsDoc({ currentStreak: 3, longestStreak: 9 }))
  })

  it('reports a zero streak for an anonymous visitor rather than refusing', async () => {
    mockGetWebUser.mockResolvedValue(null)

    const { status, body } = await get()

    expect(status).toBe(200)
    expect(body).toEqual({ streak: 0 })
  })

  it('reports the current and longest streak', async () => {
    const { body } = await get()

    expect(body).toEqual({ streak: 3, currentStreak: 3, longestStreak: 9 })
  })

  it('treats missing counters as zero', async () => {
    mockGetOrCreateUserStats.mockResolvedValue({ _id: 'stats-1' })

    expect((await get()).body).toEqual({ streak: 0, currentStreak: 0, longestStreak: 0 })
  })
})

describe('POST /api/stats/streak', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    seed({ 'user-stats': [statsDoc()] })
    mockGetWebUser.mockReset().mockResolvedValue({ id: USER_ID })
    mockGetOrCreateUserStats.mockReset().mockResolvedValue(statsDoc())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refuses an anonymous caller', async () => {
    mockGetWebUser.mockResolvedValue(null)

    expect(await post(TIME_ZONE)).toMatchObject({ status: 401, body: { error: 'Unauthorized' } })
  })

  it.each([
    ['no timezone', undefined],
    ['an empty timezone', ''],
    ['a timezone that does not exist', 'Mars/Olympus_Mons'],
  ])('rejects %s', async (_label, timeZone) => {
    const result = await post(timeZone)

    expect(result.status).toBe(400)
    expect(result.body.error).toBe('Invalid parameters')
  })

  it('starts a streak at one for a first visit', async () => {
    const fake = seed({ 'user-stats': [statsDoc()] })

    const { status, body } = await post(TIME_ZONE)

    expect(status).toBe(200)
    expect(body).toEqual({ success: true, currentStreak: 1, longestStreak: 1 })
    expect(fake.collections['user-stats'][0]).toMatchObject({
      currentStreak: 1,
      lastActiveDate: TODAY,
    })
  })

  it('extends the streak when the last visit was yesterday', async () => {
    mockGetOrCreateUserStats.mockResolvedValue(
      statsDoc({ lastActiveDate: YESTERDAY, currentStreak: 4, longestStreak: 6 }),
    )

    expect((await post(TIME_ZONE)).body).toEqual({
      success: true,
      currentStreak: 5,
      longestStreak: 6,
    })
  })

  it('raises the longest streak once the current one passes it', async () => {
    mockGetOrCreateUserStats.mockResolvedValue(
      statsDoc({ lastActiveDate: YESTERDAY, currentStreak: 6, longestStreak: 6 }),
    )

    expect((await post(TIME_ZONE)).body).toMatchObject({ currentStreak: 7, longestStreak: 7 })
  })

  it('restarts the streak after a missed day', async () => {
    mockGetOrCreateUserStats.mockResolvedValue(
      statsDoc({ lastActiveDate: '2026-03-01', currentStreak: 9, longestStreak: 9 }),
    )

    expect((await post(TIME_ZONE)).body).toEqual({
      success: true,
      currentStreak: 1,
      longestStreak: 9,
    })
  })

  it('does not inflate the streak on a second visit the same day', async () => {
    const fake = seed({ 'user-stats': [statsDoc({ lastActiveDate: TODAY, currentStreak: 5 })] })
    mockGetOrCreateUserStats.mockResolvedValue(
      statsDoc({ lastActiveDate: TODAY, currentStreak: 5, longestStreak: 8 }),
    )

    const { body } = await post(TIME_ZONE)

    expect(body).toEqual({ success: true, currentStreak: 5, longestStreak: 8 })
    // Nothing to write: the day has not turned.
    expect(fake.touched('user-stats', 'updateOne')).toBe(false)
  })

  it('uses the caller timezone to decide which day it is', async () => {
    // 22:00 UTC on the 10th is already the 11th in Auckland, so a streak whose
    // last active day was the 10th is being extended, not restarted.
    vi.setSystemTime(new Date('2026-03-10T22:00:00Z'))
    mockGetOrCreateUserStats.mockResolvedValue(
      statsDoc({ lastActiveDate: TODAY, currentStreak: 2, longestStreak: 2 }),
    )

    expect((await post('Pacific/Auckland')).body).toMatchObject({ currentStreak: 3 })
  })
})
