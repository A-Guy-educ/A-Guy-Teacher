import { beforeEach, describe, expect, it, vi } from 'vitest'

const redirect = vi.fn()

vi.mock('next/navigation', () => ({ redirect }))

describe('A-Guy-Web dashboard redirect', () => {
  beforeEach(() => redirect.mockReset())

  it('sends the old dashboard route to A-Guy-Dash', async () => {
    const { default: DashboardRedirectPage } = await import('@/app/(frontend)/dashboard/page')

    await DashboardRedirectPage({ searchParams: Promise.resolve({}) })

    expect(redirect).toHaveBeenCalledWith('https://dash.aguy.co.il/')
  })

  it('preserves a valid selected period', async () => {
    const { default: DashboardRedirectPage } = await import('@/app/(frontend)/dashboard/page')

    await DashboardRedirectPage({ searchParams: Promise.resolve({ period: 'week' }) })

    expect(redirect).toHaveBeenCalledWith('https://dash.aguy.co.il/?period=week')
  })

  it('drops unsupported query values', async () => {
    const { default: DashboardRedirectPage } = await import('@/app/(frontend)/dashboard/page')

    await DashboardRedirectPage({ searchParams: Promise.resolve({ period: 'forever' }) })

    expect(redirect).toHaveBeenCalledWith('https://dash.aguy.co.il/')
  })
})
