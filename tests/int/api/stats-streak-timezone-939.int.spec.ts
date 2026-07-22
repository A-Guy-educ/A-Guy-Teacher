import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getContentDbMock, getOrCreateUserStatsMock, getWebUserMock, updateOneMock } = vi.hoisted(
  () => ({
    getContentDbMock: vi.fn(),
    getOrCreateUserStatsMock: vi.fn(),
    getWebUserMock: vi.fn(),
    updateOneMock: vi.fn(),
  }),
)

vi.mock('@/infra/db/content-db', () => ({
  getContentDb: getContentDbMock,
}))

vi.mock('@/infra/web-api/mongo-payload', () => ({
  getWebUser: getWebUserMock,
}))

vi.mock('@/server/web-api/progress', () => ({
  getOrCreateUserStats: getOrCreateUserStatsMock,
}))

import { POST } from '@/app/api/stats/streak/route'

function makeRequest(timeZone?: string) {
  const url = new URL('http://localhost/api/stats/streak')
  if (timeZone) url.searchParams.set('timeZone', timeZone)
  return new NextRequest(url, { method: 'POST' })
}

describe('POST /api/stats/streak timezone rollover', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    getWebUserMock.mockResolvedValue({ id: 'user-1' })
    getContentDbMock.mockResolvedValue({
      collection: vi.fn(() => ({ updateOne: updateOneMock })),
    })
    updateOneMock.mockResolvedValue({ modifiedCount: 1 })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('increments at the user local midnight in New York', async () => {
    vi.setSystemTime(new Date('2026-01-15T05:00:00.000Z'))
    getOrCreateUserStatsMock.mockResolvedValue({
      _id: 'stats-1',
      lastActiveDate: '2026-01-14',
      currentStreak: 4,
      longestStreak: 8,
    })

    const response = await POST(makeRequest('America/New_York'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, currentStreak: 5, longestStreak: 8 })
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: 'stats-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          currentStreak: 5,
          lastActiveDate: '2026-01-15',
        }),
      }),
    )
  })

  it('does not increment before the user local midnight in New York', async () => {
    vi.setSystemTime(new Date('2026-01-15T04:59:59.999Z'))
    getOrCreateUserStatsMock.mockResolvedValue({
      _id: 'stats-1',
      lastActiveDate: '2026-01-14',
      currentStreak: 4,
      longestStreak: 8,
    })

    const response = await POST(makeRequest('America/New_York'))

    expect(await response.json()).toEqual({ success: true, currentStreak: 4, longestStreak: 8 })
    expect(updateOneMock).not.toHaveBeenCalled()
  })

  it('increments at the user local midnight in Tokyo', async () => {
    vi.setSystemTime(new Date('2026-01-14T15:00:00.000Z'))
    getOrCreateUserStatsMock.mockResolvedValue({
      _id: 'stats-1',
      lastActiveDate: '2026-01-14',
      currentStreak: 2,
      longestStreak: 2,
    })

    const response = await POST(makeRequest('Asia/Tokyo'))

    expect(await response.json()).toEqual({ success: true, currentStreak: 3, longestStreak: 3 })
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: 'stats-1' },
      expect.objectContaining({
        $set: expect.objectContaining({ lastActiveDate: '2026-01-15' }),
      }),
    )
  })

  it('uses the previous calendar date across a daylight-saving transition', async () => {
    vi.setSystemTime(new Date('2026-11-02T04:30:00.000Z'))
    getOrCreateUserStatsMock.mockResolvedValue({
      _id: 'stats-1',
      lastActiveDate: '2026-10-31',
      currentStreak: 6,
      longestStreak: 6,
    })

    const response = await POST(makeRequest('America/New_York'))

    expect(await response.json()).toEqual({ success: true, currentStreak: 7, longestStreak: 7 })
  })

  it.each([undefined, 'Mars/Olympus_Mons'])(
    'rejects an invalid timezone value: %s',
    async (timeZone) => {
      const response = await POST(makeRequest(timeZone))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual(
        expect.objectContaining({ error: 'Invalid parameters', details: expect.any(Array) }),
      )
      expect(getOrCreateUserStatsMock).not.toHaveBeenCalled()
      expect(updateOneMock).not.toHaveBeenCalled()
    },
  )
})
