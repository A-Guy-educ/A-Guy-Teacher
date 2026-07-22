/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useActiveTimeTracker } from '@/client/hooks/useActiveTimeTracker'

const fetchMock = vi.fn()

describe('useActiveTimeTracker streak timezone', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('sends the browser IANA timezone with the streak update', async () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    renderHook(() => useActiveTimeTracker({ isAuthenticated: true }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/stats/streak?timeZone=${encodeURIComponent(timeZone)}`,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('does not send a streak update for an unauthenticated user', async () => {
    renderHook(() => useActiveTimeTracker({ isAuthenticated: false }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
