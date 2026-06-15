import { afterEach, describe, expect, it, vi } from 'vitest'

const mockLoginWithPassword = vi.hoisted(() => vi.fn())
const mockCreatePasswordUser = vi.hoisted(() => vi.fn())

vi.mock('@/infra/auth/web-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/auth/web-auth')>()

  return {
    ...actual,
    createPasswordUser: mockCreatePasswordUser,
    loginWithPassword: mockLoginWithPassword,
  }
})

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

describe('password auth cookies', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    mockLoginWithPassword.mockReset()
    mockCreatePasswordUser.mockReset()
  })

  it('uses the partitioned production auth cookie for password login', async () => {
    vi.stubEnv('NODE_ENV', 'production')
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
        partitioned: true,
        path: '/',
        sameSite: 'none',
        secure: true,
      }),
    )
  })

  it('uses the partitioned production auth cookie for password signup', async () => {
    vi.stubEnv('NODE_ENV', 'production')
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
        partitioned: true,
        path: '/',
        sameSite: 'none',
        secure: true,
      }),
    )
  })
})
