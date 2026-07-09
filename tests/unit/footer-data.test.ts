/**
 * @fileType test
 * @domain frontend
 * @pattern footer-data-loader
 * @ai-summary Unit tests for loadFooterData + resolveMediaUrl — exercises
 *   the locale-aware navItem picker, the page-reference resolver, and the
 *   media URL helper used to render the footer logo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadFooterData, resolveMediaUrl } from '@/ui/web/footer/footer-data'

const globalState: { footer: unknown; pages: Record<string, unknown> } = {
  footer: null,
  pages: {},
}

const findOneMock = vi.fn(async (filter: { _id?: unknown } = {}) => {
  if (filter._id) {
    const id = String(filter._id)
    if (globalState.pages[id]) return globalState.pages[id]
  }
  return globalState.footer
})

vi.mock('@/infra/db/content-db', () => ({
  getContentDb: async () => ({ collection: () => ({ findOne: findOneMock }) }),
  objectIdFromString: (id: string) => id,
  serializeDoc: <T>(doc: T) => doc,
}))

beforeEach(() => {
  findOneMock.mockClear()
  globalState.footer = null
  globalState.pages = {}
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('loadFooterData', () => {
  it('returns the empty shape when the global cannot be loaded', async () => {
    globalState.footer = null
    const result = await loadFooterData('en')
    expect(result).toEqual({ meta: null, text: null, navItems: [], legalPages: {} })
  })

  it('returns the locale-matched variant nav items, with the per-locale footer schema', async () => {
    globalState.footer = {
      meta: {
        titleColumn: 'Aguy Learning Platform',
        subtitleColumn: 'Math that sticks',
        contact: { email: 'support@aguy.co.il' },
      },
      text: 'Footer description',
      variants: [
        {
          locale: 'en',
          navItems: [{ id: 'en-1', link: { type: 'custom', url: '/about', label: 'About' } }],
        },
        {
          locale: 'he',
          navItems: [{ id: 'he-1', link: { type: 'custom', url: '/about', label: 'אודות' } }],
        },
      ],
    }

    const result = await loadFooterData('he')
    expect(result.meta?.titleColumn).toBe('Aguy Learning Platform')
    expect(result.text).toBe('Footer description')
    expect(result.navItems).toHaveLength(1)
    expect(result.navItems[0]?.link.label).toBe('אודות')
  })

  it('pre-fetches pages referenced by nav items so the modal opens without a request', async () => {
    globalState.footer = {
      variants: [
        {
          locale: 'en',
          navItems: [
            {
              id: 'nav-1',
              link: {
                type: 'reference',
                reference: { relationTo: 'pages', value: 'page-123' },
                label: 'Terms',
              },
            },
          ],
        },
      ],
    }
    globalState.pages['page-123'] = {
      id: 'page-123',
      slug: 'terms-of-service',
      title: 'Terms of Service',
      layout: [{ id: 'b1', blockType: 'html', html: '<p>Hello</p>' }],
    }

    const result = await loadFooterData('en')

    expect(result.legalPages['page-123']).toEqual({
      id: 'page-123',
      slug: 'terms-of-service',
      title: 'Terms of Service',
      layout: [{ id: 'b1', blockType: 'html', html: '<p>Hello</p>' }],
    })
    // The page is also indexed by slug for the modal to look up by URL.
    expect(result.legalPages['terms-of-service']).toBeDefined()
  })

  it('falls back to the root navItems when the matched variant has no labels', async () => {
    globalState.footer = {
      navItems: [{ link: { type: 'custom', url: '/x', label: 'Root link' } }],
      variants: [{ locale: 'he', navItems: [{ link: { type: 'custom', url: '/x', label: '' } }] }],
    }

    const result = await loadFooterData('he')
    expect(result.navItems[0]?.link.label).toBe('Root link')
  })

  it('skips page fetches that return null and continues to return the rest of the data', async () => {
    globalState.footer = {
      variants: [
        {
          locale: 'en',
          navItems: [
            {
              link: {
                type: 'reference',
                reference: { relationTo: 'pages', value: 'good' },
                label: 'Good',
              },
            },
            {
              link: {
                type: 'reference',
                reference: { relationTo: 'pages', value: 'bad' },
                label: 'Bad',
              },
            },
          ],
        },
      ],
    }
    globalState.pages['good'] = {
      id: 'good',
      slug: 'good',
      title: 'Good page',
      layout: [],
    }
    // 'bad' is not in the pages map so the mocked findOne returns null
    // — the loader must still produce a usable result.

    const result = await loadFooterData('en')
    expect(result.legalPages['good']).toBeDefined()
    expect(result.legalPages['bad']).toBeUndefined()
  })
})

describe('resolveMediaUrl', () => {
  it('returns the URL from a Media object', () => {
    expect(resolveMediaUrl({ url: '/uploads/logo.svg' })).toBe('/uploads/logo.svg')
    expect(resolveMediaUrl({ externalUrl: 'https://cdn/logo.svg' })).toBe('https://cdn/logo.svg')
  })

  it('returns the string when given a raw string', () => {
    expect(resolveMediaUrl('/uploads/foo.svg')).toBe('/uploads/foo.svg')
  })

  it('returns null for nullish values or objects without URLs', () => {
    expect(resolveMediaUrl(null)).toBeNull()
    expect(resolveMediaUrl(undefined)).toBeNull()
    expect(resolveMediaUrl({})).toBeNull()
  })
})
