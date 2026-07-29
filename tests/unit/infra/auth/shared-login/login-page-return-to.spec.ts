import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetMeUser = vi.hoisted(() => vi.fn())

vi.mock('@/infra/utils/getMeUser', () => ({ getMeUser: mockGetMeUser }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirected to ${to}`)
  },
}))

async function renderLoginPage(returnTo: string) {
  const { default: LoginPage } = await import('@/app/(frontend)/login/page')
  const element = (await LoginPage({
    searchParams: Promise.resolve({ returnTo }),
  })) as { props: { returnTo: string } }

  return element.props.returnTo
}

/**
 * The login page resolves `returnTo` because only the server knows which
 * sibling apps are trusted. When the form did this itself the check ran in the
 * browser, where the configuration is invisible, and every sibling redirect
 * silently became the home page.
 */
describe('login page resolves returnTo on the server', () => {
  beforeEach(() => {
    mockGetMeUser.mockResolvedValue({ user: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('passes a trusted sibling destination through to the form', async () => {
    vi.stubEnv('ROOT_DOMAIN', 'aguy.co.il')

    expect(await renderLoginPage('https://app2.aguy.co.il/dashboard')).toBe(
      'https://app2.aguy.co.il/dashboard',
    )
  })

  it('falls back to the site root for an untrusted destination', async () => {
    vi.stubEnv('ROOT_DOMAIN', 'aguy.co.il')

    expect(await renderLoginPage('https://evil.com/steal')).toBe('/')
  })

  it('keeps relative destinations working when shared login is off', async () => {
    expect(await renderLoginPage('/courses/algebra')).toBe('/courses/algebra')
  })
})
