import { afterEach, describe, expect, it, vi } from 'vitest'

const mockLoginWithPassword = vi.hoisted(() => vi.fn())
const mockCreatePasswordUser = vi.hoisted(() => vi.fn())
const mockHeaders = vi.hoisted(() => vi.fn())

vi.mock('@/infra/auth/web-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/auth/web-auth')>()

  return {
    ...actual,
    createPasswordUser: mockCreatePasswordUser,
    loginWithPassword: mockLoginWithPassword,
  }
})

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: mockHeaders,
}))

function loginFormData() {
  const data = new FormData()
  data.set('email', 'student@example.com')
  data.set('password', 'correct-password')
  return data
}

function signupFormData() {
  const data = new FormData()
  data.set('name', 'Student')
  data.set('email', 'new-student@example.com')
  data.set('password', 'correct-password')
  data.set('confirmPassword', 'correct-password')
  data.set('website', '')
  return data
}

/**
 * Outside a request scope `headers()` throws — the same thing that happens when
 * these actions are invoked directly, as the non-embedded cases here do.
 */
function noRequestScope() {
  mockHeaders.mockImplementation(() => {
    throw new Error('headers() was called outside a request scope')
  })
}

describe('password auth cookies', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    mockLoginWithPassword.mockReset()
    mockCreatePasswordUser.mockReset()
    mockHeaders.mockReset()
  })

  it('writes a shareable (non-partitioned) cookie for a top-level password login', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    noRequestScope()
    mockLoginWithPassword.mockResolvedValue({
      token: 'session-token',
      user: { id: 'user-1' },
    })
    const cookieStore = { set: vi.fn() }
    const { loginAction } = await import('@/app/(frontend)/login/login_authenticate-action')

    const result = await loginAction(loginFormData(), cookieStore)

    expect(result).toEqual({ success: true })
    expect(cookieStore.set).toHaveBeenCalledWith(
      'payload-token',
      'session-token',
      expect.objectContaining({
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7,
        // Partitioned cookies are keyed to the embedding top-level site, so a
        // partitioned login cookie can never be read by a sibling app.
        partitioned: false,
        path: '/',
        sameSite: 'lax',
        secure: true,
      }),
    )
  })

  it('writes a shareable (non-partitioned) cookie for a top-level password signup', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    noRequestScope()
    mockCreatePasswordUser.mockResolvedValue({
      token: 'session-token',
      user: { id: 'user-1' },
    })
    const cookieStore = { set: vi.fn() }
    const { signupAction } =
      await import('@/app/(frontend)/signup/actions/signup_createUser-action')

    const result = await signupAction(signupFormData(), cookieStore)

    expect(result).toEqual({ success: true, userId: 'user-1', data: { userId: 'user-1' } })
    expect(cookieStore.set).toHaveBeenCalledWith(
      'payload-token',
      'session-token',
      expect.objectContaining({
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7,
        partitioned: false,
        path: '/',
        sameSite: 'lax',
        secure: true,
      }),
    )
  })

  it('scopes the login cookie to the shared domain when configured', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ROOT_DOMAIN', 'aguy.co.il')
    noRequestScope()
    mockLoginWithPassword.mockResolvedValue({
      token: 'session-token',
      user: { id: 'user-1' },
    })
    const cookieStore = { set: vi.fn() }
    const { loginAction } = await import('@/app/(frontend)/login/login_authenticate-action')

    await loginAction(loginFormData(), cookieStore)

    expect(cookieStore.set).toHaveBeenCalledWith(
      'payload-token',
      'session-token',
      expect.objectContaining({ domain: '.aguy.co.il' }),
    )
  })

  it('keeps the partitioned cookie for a login posted from inside the preview iframe', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    mockHeaders.mockResolvedValue(
      new Headers({ 'sec-fetch-dest': 'empty', 'sec-fetch-site': 'cross-site' }),
    )
    mockLoginWithPassword.mockResolvedValue({
      token: 'session-token',
      user: { id: 'user-1' },
    })
    const cookieStore = { set: vi.fn() }
    const { loginAction } = await import('@/app/(frontend)/login/login_authenticate-action')

    await loginAction(loginFormData(), cookieStore)

    expect(cookieStore.set).toHaveBeenCalledWith(
      'payload-token',
      'session-token',
      expect.objectContaining({ partitioned: true, sameSite: 'none' }),
    )
  })
})
