/**
 * @fileType test
 * @domain frontend
 * @pattern nav-locale-resolution
 * @ai-summary Unit tests for getNavItemsForLocale — covers the locale fallback
 * chain (matched variant → any variant → root navItems) and the new
 * "fall back to root when the matched variant is empty / unlabeled" rule.
 */
import { describe, expect, it } from 'vitest'

import { getNavItemsForLocale } from '@/ui/web/nav-variants'

describe('getNavItemsForLocale', () => {
  it('returns items from the variant matching the active locale', () => {
    const data = {
      variants: [
        {
          locale: 'en',
          navItems: [{ link: { label: 'English link' } }],
        },
        {
          locale: 'he',
          navItems: [{ link: { label: 'קישור בעברית' } }],
        },
      ],
    }

    const en = getNavItemsForLocale(data, 'en')
    const he = getNavItemsForLocale(data, 'he')

    expect(en).toHaveLength(1)
    expect(en[0]?.link.label).toBe('English link')
    expect(he[0]?.link.label).toBe('קישור בעברית')
  })

  it('falls back to root navItems when the matched variant is missing its label', () => {
    // Mirrors the bug from issue #797: a per-locale variant was created with
    // its nav items present but every label empty, so links rendered blank.
    const data = {
      navItems: [{ link: { label: 'Root label' } }],
      variants: [
        { locale: 'he', navItems: [{ link: { label: '' } }] },
        { locale: 'en', navItems: [{ link: { label: '   ' } }] },
      ],
    }

    const he = getNavItemsForLocale(data, 'he')
    const en = getNavItemsForLocale(data, 'en')

    expect(he[0]?.link.label).toBe('Root label')
    expect(en[0]?.link.label).toBe('Root label')
  })

  it('falls back to the first variant when no variant matches the locale', () => {
    const data = {
      variants: [{ locale: 'he', navItems: [{ link: { label: 'he-link' } }] }],
    }

    const en = getNavItemsForLocale(data, 'en')

    expect(en).toHaveLength(1)
    expect(en[0]?.link.label).toBe('he-link')
  })

  it('returns an empty array for empty/undefined data', () => {
    expect(getNavItemsForLocale(undefined, 'en')).toEqual([])
    expect(getNavItemsForLocale({}, 'en')).toEqual([])
    expect(getNavItemsForLocale({ variants: [] }, 'en')).toEqual([])
  })
})
