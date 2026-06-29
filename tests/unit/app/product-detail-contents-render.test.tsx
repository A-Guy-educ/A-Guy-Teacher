// @vitest-environment jsdom

/**
 * Tests the ProductDetailContent "What's included" rendering against the new
 * product.contents shape.
 *
 * Pinned behavior:
 *   - courseBlock with a populated course → shows the course title
 *   - featureBlock with isSilent=false → shows "{limit} {label} / {period}"
 *   - featureBlock with isSilent=true   → NOT shown (background features)
 *   - boolean feature (no limit)        → shows just the label
 *   - no visible blocks                 → "What's included" section not rendered
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '@/infra/types/content'

// Stub out the children components — they pull in browser/Next-runtime deps
// (next/navigation, fetch, toast) that we don't need for this test.
vi.mock('@/app/(frontend)/products/[slug]/BuyButton', () => ({
  BuyButton: () => null,
}))
vi.mock('@/app/(frontend)/products/[slug]/CouponInput', () => ({
  CouponInput: () => null,
}))

const t = (key: string) => key
vi.mock('@/ui/web/providers/I18n', () => ({
  useTranslations: () => t,
}))

import { ProductDetailContent } from '@/app/(frontend)/products/[slug]/ProductDetailContent'

function buildProduct(contents: Product['contents']): Product {
  return {
    id: 'p1',
    title: 'Test Product',
    name: 'Test Product',
    slug: 'test',
    price: 49,
    currency: 'ILS',
    billingType: 'one_time',
    contents,
  }
}

describe('ProductDetailContent — contents rendering', () => {
  afterEach(() => cleanup())

  it('renders a courseBlock as the course title', () => {
    render(
      <ProductDetailContent
        product={buildProduct([
          {
            blockType: 'courseBlock',
            course: { id: 'c1', title: '7th Grade Prep', slug: '7th-grade-prep' },
          },
        ])}
      />,
    )
    expect(screen.getByText('7th Grade Prep')).toBeTruthy()
  })

  it('renders a non-silent numeric featureBlock as "{limit} {label} / {period}"', () => {
    render(
      <ProductDetailContent
        product={buildProduct([
          {
            blockType: 'featureBlock',
            feature: {
              id: 'f1',
              key: 'ai-questions',
              label: 'AI questions',
              type: 'numeric',
              isSilent: false,
            },
            limit: 5,
            period: 'day',
          },
        ])}
      />,
    )
    // i18n stub returns the key as-is, so the rendered period word is
    // "items.periods.day" — the exact final glyph doesn't matter, the
    // assertion is that limit + label + period are all on screen.
    const node = screen.getByText(/5 AI questions \/ items\.periods\.day/)
    expect(node).toBeTruthy()
  })

  it('renders a boolean (no-limit) featureBlock as just the label', () => {
    render(
      <ProductDetailContent
        product={buildProduct([
          {
            blockType: 'featureBlock',
            feature: {
              id: 'f2',
              key: 'certificate',
              label: 'Certificate',
              type: 'boolean',
              isSilent: false,
            },
            limit: null,
            period: null,
          },
        ])}
      />,
    )
    expect(screen.getByText('Certificate')).toBeTruthy()
    // No numeric prefix should appear for a boolean feature.
    expect(screen.queryByText(/null Certificate/)).toBeNull()
  })

  it('hides silent featureBlocks even when populated', () => {
    render(
      <ProductDetailContent
        product={buildProduct([
          {
            blockType: 'featureBlock',
            feature: {
              id: 'f3',
              key: 'chat-limit',
              label: 'Chat limit',
              type: 'numeric',
              isSilent: true,
            },
            limit: 100,
            period: 'day',
          },
        ])}
      />,
    )
    expect(screen.queryByText(/Chat limit/)).toBeNull()
  })

  it('does not render the "What\'s included" section when every block is silent or empty', () => {
    render(
      <ProductDetailContent
        product={buildProduct([
          {
            blockType: 'featureBlock',
            feature: {
              id: 'f4',
              key: 'chat-limit',
              label: 'Chat limit',
              type: 'numeric',
              isSilent: true,
            },
            limit: 100,
            period: 'day',
          },
        ])}
      />,
    )
    // The heading translation key the section would have rendered.
    expect(screen.queryByText('includedItems')).toBeNull()
  })
})
