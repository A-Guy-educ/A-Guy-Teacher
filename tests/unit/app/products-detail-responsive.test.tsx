// @vitest-environment jsdom

/**
 * Regression guard for the responsive layout fix on the ProductDetailContent
 * wrapper around /products/[slug].
 *
 * Issue #785: Product detail pages are cut off / cramped on mobile.
 *
 * The fix must:
 *   - Reduce horizontal padding on very narrow viewports (`px-4 sm:px-6`).
 *   - Use smaller card-section padding on mobile (`p-card-padding sm:p-card-padding-lg`).
 *   - Stack title + price vertically below `sm` (`flex flex-col sm:flex-row`).
 *   - Step the title down one size below `sm` (`text-heading-lg sm:text-heading-xl`).
 *   - Truncate long product names in the breadcrumb (`truncate min-w-0`),
 *     and `shrink-0` the preceding siblings so they don't get squeezed.
 *
 * BuyButton / CouponInput are stubbed at the top — they have their own deps
 * (useCurrentUser, server actions) and their responsive layout is covered by
 * the companion file tests/unit/app/products-checkout-responsive.test.tsx.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '@/infra/types/content'

vi.mock('@/app/(frontend)/products/[slug]/BuyButton', () => ({
  BuyButton: () => null,
}))
vi.mock('@/app/(frontend)/products/[slug]/CouponInput', () => ({
  CouponInput: () => null,
}))

// Mirror the real I18n contract: useTranslations(ns) prefixes every key with
// `${ns}.`, so a miss returns the prefixed form (matches
// src/ui/web/providers/I18n/index.tsx).
vi.mock('@/ui/web/providers/I18n', () => ({
  useTranslations:
    (namespace?: string) =>
    (key: string): string =>
      namespace ? `${namespace}.${key}` : key,
}))

import { ProductDetailContent } from '@/app/(frontend)/products/[slug]/ProductDetailContent'

function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    title: 'Test Product',
    name: 'Test Product',
    slug: 'test-product',
    price: 49,
    currency: 'ILS',
    billingType: 'one_time',
    contents: [],
    ...overrides,
  }
}

describe('ProductDetailContent — responsive layout (#785)', () => {
  afterEach(() => cleanup())

  it('uses tighter outer padding on mobile and standard padding on sm+', () => {
    const { container } = render(<ProductDetailContent product={buildProduct()} />)
    const outer = container.firstChild as HTMLElement
    expect(outer.className).toContain('px-4')
    expect(outer.className).toContain('sm:px-6')
  })

  it('uses smaller card-section padding on mobile and the larger padding on sm+', () => {
    const { container } = render(<ProductDetailContent product={buildProduct()} />)
    const sections = container.querySelectorAll('div.p-card-padding')
    expect(sections.length).toBeGreaterThan(0)
    sections.forEach((section) => {
      expect(section.className).toContain('p-card-padding')
      expect(section.className).toContain('sm:p-card-padding-lg')
    })
  })

  it('stacks the header (title + price) vertically on mobile and horizontally on sm+', () => {
    const { container } = render(<ProductDetailContent product={buildProduct()} />)
    const headerRow = container.querySelector('div.flex.flex-col.sm\\:flex-row') as HTMLElement
    expect(headerRow).toBeTruthy()
    expect(headerRow.className).toContain('flex-col')
    expect(headerRow.className).toContain('sm:flex-row')
    expect(headerRow.className).toContain('gap-content-gap')
  })

  it('steps the title down one size on mobile and uses the larger size on sm+', () => {
    render(<ProductDetailContent product={buildProduct()} />)
    const title = screen.getByRole('heading', { level: 1 })
    expect(title.className).toContain('text-heading-lg')
    expect(title.className).toContain('sm:text-heading-xl')
  })

  it('right-aligns the price only at sm+ (left-aligned on mobile)', () => {
    const { container } = render(<ProductDetailContent product={buildProduct()} />)
    const priceWrapper = container.querySelector('div.text-start.sm\\:text-end') as HTMLElement
    expect(priceWrapper).toBeTruthy()
    expect(priceWrapper.className).toContain('text-start')
    expect(priceWrapper.className).toContain('sm:text-end')
  })

  it('truncates long product names in the breadcrumb and shrink-protects the catalog link and slash', () => {
    const longName = 'A Very Long Product Name That Would Overflow A Narrow Mobile Viewport'
    const { container } = render(
      <ProductDetailContent product={buildProduct({ name: longName, title: longName })} />,
    )
    const breadcrumbList = container.querySelector('nav[aria-label="breadcrumb"] ol') as HTMLElement
    expect(breadcrumbList.className).toContain('min-w-0')
    const breadcrumbItems = breadcrumbList.querySelectorAll('li')
    expect(breadcrumbItems.length).toBe(3)
    expect(breadcrumbItems[0].className).toContain('shrink-0')
    expect(breadcrumbItems[1].className).toContain('shrink-0')
    expect(breadcrumbItems[2].className).toContain('truncate')
    expect(breadcrumbItems[2].className).toContain('min-w-0')
    expect(breadcrumbItems[2].getAttribute('aria-current')).toBe('page')
  })
})
