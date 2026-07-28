import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { logoutAction } from '@/app/(frontend)/actions/auth-action'

const mockCookieStore = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}))

const mockRevokeSession = vi.hoisted(() => vi.fn())

vi.mock('next/headers', () => ({
  cookies: () => mockCookieStore,
}))

vi.mock('@/infra/auth/web-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/auth/web-auth')>()
  return {
    ...actual,
    revokeSession: mockRevokeSession,
  }
})

describe('Logout Action', () => {
  beforeEach(() => {
    mockCookieStore.delete.mockClear()
    mockCookieStore.get.mockReturnValue({ value: 'a-token' })
    mockRevokeSession.mockClear()
    mockRevokeSession.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('deletes payload-token cookie', async () => {
    const result = await logoutAction()

    expect(result.success).toBe(true)
    expect(mockCookieStore.delete).toHaveBeenCalledWith({ name: 'payload-token', path: '/' })
  })

  it('revokes the session server-side, not just the cookie', async () => {
    await logoutAction()

    expect(mockRevokeSession).toHaveBeenCalledWith('a-token')
  })

  it('deletes the domain-scoped cookie when shared login is configured', async () => {
    vi.stubEnv('AUTH_COOKIE_DOMAIN', 'a-guy.co.il')

    await logoutAction()

    expect(mockCookieStore.delete).toHaveBeenCalledWith({
      name: 'payload-token',
      path: '/',
      domain: '.a-guy.co.il',
    })
  })
})
