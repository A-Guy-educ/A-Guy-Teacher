/**
 * Integration tests: chat-quota route returns real server-enforced state
 * (issue #928 — acceptance criterion 2).
 *
 * `/api/agent/chat-quota` previously returned a hardcoded
 * `{ remaining: 999, allowed: true }`. After the fix it should proxy
 * `getChatQuotaStatus`, surfacing the rolling-window numbers that the
 * server actually enforces.
 *
 * Uses `vi.doMock` + `vi.resetModules` so the requireUser helper sees a
 * fake session, and `chat-quota` service returns a known shape — this lets
 * us assert the route forwards the server-enforced state verbatim.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/infra/types/backend', async () => {
  const actual =
    await vi.importActual<typeof import('@/infra/types/backend')>('@/infra/types/backend')
  return {
    ...actual,
    getPayload: vi.fn(async () => ({ db: { collections: {} } })),
  }
})

describe('chat-quota route (issue #928)', () => {
  it('proxies getChatQuotaStatus when authenticated', async () => {
    vi.resetModules()

    vi.doMock('@/infra/auth/web-auth', async () => {
      const actual =
        await vi.importActual<typeof import('@/infra/auth/web-auth')>('@/infra/auth/web-auth')
      return {
        ...actual,
        getSessionFromToken: vi.fn(async () => ({
          token: 'mock-token',
          user: { id: 'mock-user-id', email: 'x', role: 'student', collection: 'users' } as any,
        })),
      }
    })

    const expected = {
      allowed: true,
      questionsUsed: 4,
      maxQuestions: 15,
      resetAt: '2026-07-22T10:00:00.000Z',
    }
    vi.doMock('@/server/services/chat-quota', () => ({
      checkAndIncrementChatQuota: vi.fn(async () => expected),
      getChatQuotaStatus: vi.fn(async () => expected),
    }))

    const { GET } = await import('@/app/api/agent/chat-quota/route')
    const res = await GET(new NextRequest('http://localhost/api/agent/chat-quota'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(expected)
  })
})
