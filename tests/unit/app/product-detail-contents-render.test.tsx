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

// Mirror the real I18n contract: useTranslations(ns) prefixes every key
// with `${ns}.`, and the provider returns the FULL prefixed key on a miss
// (see src/ui/web/providers/I18n/index.tsx). The previous stub returned the
// unprefixed key, which hid a bug where the period-fallback safety net
// compared against the wrong sentinel and never fired in production.
vi.mock('@/ui/web/providers/I18n', () => ({
  useTranslations:
    (namespace?: string) =>
    (key: string): string =>
      namespace ? `${namespace}.${key}` : key,
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
    // The i18n stub returns the key as-is. The component's safety net
    // detects that pass-through (translated === key → admin added a new
    // period value without a matching i18n key) and falls back to the raw
    // period word, so the rendered string is "5 AI questions day" — not
    // "5 AI questions items.periods.day". Format is "{limit} {label}
    // {period}" with a plain space separator; the period value carries
    // its own preposition in real locales (EN: "per day", HE: "ליום").
    const node = screen.getByText(/5 AI questions day/)
    expect(node).toBeTruthy()
  })

  it('falls back to the raw period word when admin uses a value with no matching i18n key (e.g. future "week"/"month")', async () => {
    render(
      <ProductDetailContent
        product={buildProduct([
          {
            blockType: 'featureBlock',
            feature: {
              id: 'f-future',
              key: 'reports',
              label: 'Reports',
              type: 'numeric',
              isSilent: false,
            },
            limit: 3,
            // Cast: TypeScript narrows period to 'day' | 'lifetime', but admin
            // could grow the enum without web following — that's exactly what
            // the fallback exists for.
            period: 'month' as unknown as 'day',
          },
        ])}
      />,
    )
    // Safety net should fall back to the raw word, NOT leak the i18n key.
    expect(screen.getByText(/3 Reports month/)).toBeTruthy()
    expect(screen.queryByText(/items\.periods\.month/)).toBeNull()
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
    // The stub mocks useTranslations(ns) to return `${ns}.${key}` (mirrors
    // the real namespace contract), so the section header — when rendered
    // — contains the literal text 'products.includedItems'. Assert against
    // that prefixed form, not the bare 'includedItems' which would never
    // appear regardless of whether the section rendered and pass vacuously.
    expect(screen.queryByText('products.includedItems')).toBeNull()
  })

  it('RENDERS the "What\'s included" section header when at least one block is visible (positive control)', () => {
    // Counterpart to the above: locks down that the previous test isn't
    // just passing because the heading text never appears under the new
    // namespace stub. With a single non-silent block, the header must
    // appear — both as a sanity check and as a regression guard against
    // future stub/namespace drift.
    render(
      <ProductDetailContent
        product={buildProduct([
          {
            blockType: 'courseBlock',
            course: { id: 'c-visible', title: 'Visible Course', slug: 'visible' },
          },
        ])}
      />,
    )
    expect(screen.queryByText('products.includedItems')).not.toBeNull()
  })
})
