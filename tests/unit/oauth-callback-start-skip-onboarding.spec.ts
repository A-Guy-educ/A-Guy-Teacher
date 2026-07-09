/**
 * Regression tests for issue #783 — mobile Google login after the `/start`
 * wizard must land the new user directly on the picked course (or its
 * returnTo), not bounce them through `/onboarding/persona`.
 *
 * Locks in the contract that the OAuth callback:
 * - Reads the `start_wizard_completed` cookie set by `/start`.
 * - For new users with that cookie present, redirects to the sanitized
 *   returnTo instead of `/onboarding/persona?returnTo=...`.
 * - For new users without the cookie, still wraps in persona (legacy flow).
 * - For returning users, never wraps in persona.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockStoreOAuthState = vi.fn()
const mockGetOnboardingRedirect = vi.fn()

const mockValidateOAuthState = vi.fn()
const mockFindUserByGoogleSub = vi.fn()
const mockFindUserByEmail = vi.fn()
const mockCreateGoogleUser = vi.fn()
const mockLinkGoogleUser = vi.fn()
const mockCreateSession = vi.fn()
const mockSetAuthCookie = vi.fn()
const mockGetPublicBaseUrl = vi.fn()

vi.mock('@/infra/auth/oauth_state', () => ({
  storeOAuthState: mockStoreOAuthState,
  validateOAuthState: mockValidateOAuthState,
}))

vi.mock('@/infra/auth/oauth_url', () => ({
  getPublicBaseUrl: mockGetPublicBaseUrl,
}))

vi.mock('@/infra/auth/oauth_logger', () => ({
  logOAuthEvent: vi.fn().mockResolvedValue(undefined),
  logOAuthError: vi.fn(),
}))

vi.mock('@/infra/auth/web-auth', () => ({
  findUserByGoogleSub: mockFindUserByGoogleSub,
  findUserByEmail: mockFindUserByEmail,
  createGoogleUser: mockCreateGoogleUser,
  linkGoogleUser: mockLinkGoogleUser,
  createSession: mockCreateSession,
  setAuthCookie: mockSetAuthCookie,
}))

vi.mock('@/infra/onboarding/redirect', () => ({
  getOnboardingRedirect: mockGetOnboardingRedirect,
  START_WIZARD_COMPLETED_COOKIE: 'start_wizard_completed',
}))

function buildRequest({ wizardCookie }: { wizardCookie?: string } = {}): {
  req: unknown
  res: { cookies: { set: ReturnType<typeof vi.fn> }; headers: Headers }
} {
  const cookieHeader = wizardCookie ? `start_wizard_completed=${wizardCookie}` : ''
  const headers = new Headers({
    cookie: cookieHeader,
    'sec-fetch-dest': 'document',
  })
  const req = {
    url: 'https://app.example.com/api/oauth/google/callback?code=test-code&state=test-state',
    headers,
    cookies: {
      get(name: string) {
        if (cookieHeader && name === 'start_wizard_completed') {
          return { value: wizardCookie }
        }
        if (cookieHeader && name === 'oauth_state') {
          return { value: 'test-state' }
        }
        if (cookieHeader && name === 'oauth_return_to') {
          return { value: '/courses/algebra' }
        }
        return undefined
      },
    },
    nextUrl: {
      searchParams: new URLSearchParams('code=test-code&state=test-state'),
    },
  }
  const res = {
    cookies: { set: vi.fn() },
    headers: new Headers(),
  }
  return { req, res }
}

describe('OAuth callback — /start wizard skip-persona flow (issue #783)', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.resetAllMocks()

    mockGetPublicBaseUrl.mockReturnValue('https://app.example.com')
    mockValidateOAuthState.mockReturnValue({ valid: true, returnTo: '/courses/algebra' })
    mockFindUserByGoogleSub.mockResolvedValue(null)
    mockFindUserByEmail.mockResolvedValue(null)
    mockCreateGoogleUser.mockResolvedValue({ _id: 'new-user-id', email: 'new@example.com' })
    mockLinkGoogleUser.mockResolvedValue(undefined)
    mockCreateSession.mockResolvedValue({ token: 'session-token', user: { id: 'new-user-id' } })
    mockSetAuthCookie.mockReturnValue(undefined)
    mockGetOnboardingRedirect.mockImplementation(
      (returnTo: string, options?: { skipPersona?: boolean }) =>
        options?.skipPersona
          ? returnTo
          : `/onboarding/persona?returnTo=${encodeURIComponent(returnTo)}`,
    )

    // Mock the two outbound fetches: token exchange + userinfo.
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('oauth2.googleapis.com/token')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ access_token: 'access-token' }),
        })
      }
      if (url.includes('userinfo')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            sub: 'google-sub',
            email: 'new@example.com',
            email_verified: true,
            name: 'New User',
          }),
        })
      }
      return Promise.reject(new Error(`unexpected fetch url: ${url}`))
    }) as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('skips /onboarding/persona for new users when start_wizard_completed cookie is present', async () => {
    const { req, res } = buildRequest({ wizardCookie: '1' })
    const { GET } = await import('@/app/api/oauth/google/callback/route')

    const nextRes = await GET(req as never)

    expect(mockGetOnboardingRedirect).toHaveBeenCalledWith('/courses/algebra', {
      skipPersona: true,
    })
    expect(nextRes.headers.get('Location')).toBe('https://app.example.com/courses/algebra')
    expect(nextRes.headers.get('Location')).not.toContain('/onboarding/persona')
  })

  it('wraps in /onboarding/persona for new users when the wizard cookie is missing (legacy flow preserved)', async () => {
    const { req, res } = buildRequest()
    const { GET } = await import('@/app/api/oauth/google/callback/route')

    const nextRes = await GET(req as never)

    expect(mockGetOnboardingRedirect).toHaveBeenCalledWith('/courses/algebra', {
      skipPersona: false,
    })
    expect(nextRes.headers.get('Location')).toBe(
      'https://app.example.com/onboarding/persona?returnTo=%2Fcourses%2Falgebra',
    )
  })

  it('passes the request headers to setAuthCookie so the top-level OAuth context uses lax cookies', async () => {
    const { req, res } = buildRequest({ wizardCookie: '1' })
    const { GET } = await import('@/app/api/oauth/google/callback/route')

    await GET(req as never)

    expect(mockSetAuthCookie).toHaveBeenCalledTimes(1)
    const [, token, headersArg] = mockSetAuthCookie.mock.calls[0]
    expect(token).toBe('session-token')
    expect(headersArg).toBeDefined()
    expect(headersArg.get('sec-fetch-dest')).toBe('document')
  })
})
