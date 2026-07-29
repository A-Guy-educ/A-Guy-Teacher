import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCookieStore = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}))

const mockRevokeSession = vi.hoisted(() => vi.fn())

vi.mock('next/headers', () => ({
  cookies: () => mockCookieStore,
  headers: vi.fn(),
}))

vi.mock('@/infra/auth/web-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/auth/web-auth')>()
  return {
    ...actual,
    revokeSession: mockRevokeSession,
  }
})

describe('logoutAction', () => {
  beforeEach(() => {
    mockCookieStore.delete.mockClear()
    mockCookieStore.get.mockReturnValue({ value: 'a-token' })
    mockRevokeSession.mockClear()
    mockRevokeSession.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('deletes the host-only cookie when shared login is off', async () => {
    const { logoutAction } = await import('@/app/(frontend)/actions/auth-action')

    const result = await logoutAction()

    expect(result.success).toBe(true)
    expect(mockCookieStore.delete).toHaveBeenCalledWith({ name: 'payload-token', path: '/' })
  })

  it('revokes the session server-side, not just the cookie', async () => {
    const { logoutAction } = await import('@/app/(frontend)/actions/auth-action')

    await logoutAction()

    // Without this a copied token keeps working, and sibling apps that verify
    // against the database would still see the user as signed in.
    expect(mockRevokeSession).toHaveBeenCalledWith('a-token')
  })

  it('deletes the domain-scoped cookie when shared login is on', async () => {
    vi.stubEnv('ROOT_DOMAIN', 'aguy.co.il')
    const { logoutAction } = await import('@/app/(frontend)/actions/auth-action')

    await logoutAction()

    // A delete without Domain cannot remove a domain-scoped cookie, so the
    // user would stay signed in on every sibling app.
    expect(mockCookieStore.delete).toHaveBeenCalledWith({
      name: 'payload-token',
      path: '/',
      domain: '.aguy.co.il',
    })
  })
})
