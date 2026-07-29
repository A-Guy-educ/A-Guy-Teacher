import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getOnboardingRedirect } from '@/infra/onboarding/redirect'

const mockIsPasswordLoginEnabled = vi.hoisted(() => vi.fn())

vi.mock('@/infra/config/system-params', () => ({
  isPasswordLoginEnabled: mockIsPasswordLoginEnabled,
}))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirected to ${to}`)
  },
}))

async function renderSignupPage(returnTo: string) {
  const { default: SignupPage } = await import('@/app/(frontend)/signup/page')
  const element = (await SignupPage({
    searchParams: Promise.resolve({ returnTo }),
  })) as { props: { returnTo: Parameters<typeof getOnboardingRedirect>[0] } }

  return element.props.returnTo
}

/**
 * The signup form hands its destination straight to `getOnboardingRedirect`.
 * When that function still sanitized internally, it re-checked the value under
 * the browser's empty policy and quietly reset every sibling destination to the
 * home page — so the whole path is asserted here, not just the page.
 */
describe('signup keeps a sibling destination end to end', () => {
  beforeEach(() => {
    mockIsPasswordLoginEnabled.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('carries a trusted sibling destination through onboarding', async () => {
    vi.stubEnv('ROOT_DOMAIN', 'a-guy.co.il')

    const destination = await renderSignupPage('https://app2.a-guy.co.il/dashboard')

    expect(destination).toBe('https://app2.a-guy.co.il/dashboard')
    expect(getOnboardingRedirect(destination)).toBe(
      '/onboarding/persona?returnTo=https%3A%2F%2Fapp2.a-guy.co.il%2Fdashboard',
    )
  })

  it('drops an untrusted destination before it reaches the form', async () => {
    vi.stubEnv('ROOT_DOMAIN', 'a-guy.co.il')

    expect(await renderSignupPage('https://evil.com/steal')).toBe('/')
  })
})
