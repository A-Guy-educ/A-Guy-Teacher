// @vitest-environment jsdom

/**
 * Regression guard for the responsive layout fix on the BuyButton and
 * CouponInput checkout sub-components of /products/[slug].
 *
 * Issue #785: Product detail pages are cut off / cramped on mobile.
 *
 * The fix must:
 *   - Stack the two BuyButton payment buttons below `sm` and have each one
 *     fill the row (`flex flex-col sm:flex-row`, `w-full sm:flex-1`).
 *   - Mirror the same pattern on the auth-loading twin at BuyButton top.
 *   - Stack the CouponInput row's input + apply button below `sm`
 *     (`flex flex-col sm:flex-row sm:items-end`, input wrapper `w-full sm:flex-1 min-w-0`,
 *     apply button `w-full sm:w-auto`).
 *
 * Uses vi.hoisted to wire the auth state per-test, and renders the real
 * BuyButton / CouponInput components. ProductDetailContent's wrapper layout
 * is covered by tests/unit/app/products-detail-responsive.test.tsx.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { User } from '@/infra/types/content'

const useCurrentUserMock = vi.hoisted(() => vi.fn())
vi.mock('@/client/hooks/useCurrentUser', () => ({
  useCurrentUser: useCurrentUserMock,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}))

vi.mock('@/ui/web/providers/I18n', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/app/(frontend)/products/validate-coupon-action', () => ({
  validateCouponAction: vi.fn(async () => ({ success: false, error: 'unavailable' })),
}))

import { BuyButton } from '@/app/(frontend)/products/[slug]/BuyButton'
import { CouponInput } from '@/app/(frontend)/products/[slug]/CouponInput'

const sampleUser: User = {
  id: 'u1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  roles: ['user'],
  collection: 'users',
}

describe('BuyButton — responsive layout (#785)', () => {
  beforeEach(() => {
    useCurrentUserMock.mockReset()
  })

  afterEach(() => {
    cleanup()
    useCurrentUserMock.mockReset()
  })

  it('stacks the two auth-loading spinners vertically on mobile, side-by-side on sm+', () => {
    useCurrentUserMock.mockReturnValue({
      user: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    })

    const { container } = render(
      <BuyButton productId="p1" productSlug="test-product" productName="Test" />,
    )
    const row = container.firstChild as HTMLElement
    expect(row.className).toContain('flex')
    expect(row.className).toContain('flex-col')
    expect(row.className).toContain('sm:flex-row')
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(2)
    buttons.forEach((btn) => {
      expect(btn.className).toContain('w-full')
      expect(btn.className).toContain('sm:flex-1')
    })
  })

  it('renders the unauthenticated login CTA as a single full-width button', () => {
    useCurrentUserMock.mockReturnValue({
      user: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    const { container } = render(
      <BuyButton productId="p1" productSlug="test-product" productName="Test" />,
    )
    const button = container.querySelector('button') as HTMLButtonElement
    expect(button).toBeTruthy()
    expect(button.className).toContain('w-full')
  })

  it('stacks the two payment buttons vertically on mobile and side-by-side on sm+', () => {
    useCurrentUserMock.mockReturnValue({
      user: sampleUser,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    const { container } = render(
      <BuyButton
        productId="p1"
        productSlug="test-product"
        productName="Test"
        couponCode="SUMMER10"
        discountedAmount={3900}
      />,
    )
    const row = container.querySelector('div.flex.flex-col.sm\\:flex-row') as HTMLElement
    expect(row).toBeTruthy()
    expect(row.className).toContain('gap-3')
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(2)
    buttons.forEach((btn) => {
      expect(btn.className).toContain('w-full')
      expect(btn.className).toContain('sm:flex-1')
    })
  })
})

describe('CouponInput — responsive layout (#785)', () => {
  const noop = () => {}
  afterEach(() => cleanup())

  it('stacks the input + apply button vertically on mobile and side-by-side on sm+', () => {
    const { container } = render(
      <CouponInput productId="p1" currency="ILS" onCouponValidated={noop} onCouponCleared={noop} />,
    )
    const row = container.querySelector('div.flex.flex-col.sm\\:flex-row') as HTMLElement
    expect(row).toBeTruthy()
    expect(row.className).toContain('gap-2')
    expect(row.className).toContain('sm:items-end')

    const inputWrapper = container.querySelector('div.w-full.sm\\:flex-1') as HTMLElement
    expect(inputWrapper).toBeTruthy()
    expect(inputWrapper.className).toContain('min-w-0')

    const applyButton = container.querySelector('button') as HTMLButtonElement
    expect(applyButton.className).toContain('w-full')
    expect(applyButton.className).toContain('sm:w-auto')
  })
})
