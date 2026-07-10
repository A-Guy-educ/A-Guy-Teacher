/**
 * @fileType data-loader
 * @domain infra
 * @pattern server-component-data
 * @ai-summary Server-side loader for the footer global. Picks the nav items
 * for the active locale, falls back to the root list when a variant is
 * empty or unlabeled, and pre-fetches every pages-collection entry
 * referenced by the nav so the legal modal can open with no client request.
 *
 * Lives in @/infra/utils (not @/server/repos) so the UI server-component
 * can import it directly; the data access itself is delegated to
 * @/infra/db/content-db, which is the allowed cross-layer touch point.
 */
import { cache } from 'react'
import { ObjectId, type Document } from 'mongodb'

import type { Footer, Page } from '@/infra/types/content'
import { getContentDb, serializeDoc } from '@/infra/db/content-db'

export type FooterResolvedLink = {
  type?: 'reference' | 'custom' | null
  newTab?: boolean | null
  reference?: { relationTo: 'pages'; value: string | Page } | null
  url?: string | null
  label: string
}

export type FooterNavItem = {
  id?: string | null
  link: FooterResolvedLink
}

export type FooterLegalPage = {
  id: string
  slug: string
  title: string
  layout: unknown[]
}

export type FooterData = {
  meta: Footer['meta']
  text: string | null
  navItems: FooterNavItem[]
  legalPages: Record<string, FooterLegalPage>
}

const EMPTY_FOOTER: FooterData = {
  meta: null,
  text: null,
  navItems: [],
  legalPages: {},
}

async function fetchFooterGlobal(): Promise<Footer | null> {
  try {
    const db = await getContentDb()
    // Payload 3.x MongoDB adapter stores all globals in a single `globals`
    // collection, discriminated by `globalType`. Querying db.collection('footer')
    // (the pre-fix behavior) returns null even when the footer exists in the
    // CMS, so the site rendered an empty footer.
    const doc = await db.collection('globals').findOne({ globalType: 'footer' } as Document)
    if (!doc) return null
    return serializeDoc<Footer>(doc)
  } catch {
    return null
  }
}

function navItemsHaveLabels(items: FooterNavItem[] | null | undefined): boolean {
  if (!items || items.length === 0) return false
  return items.some((item) => {
    const label = item?.link?.label
    return typeof label === 'string' && label.trim().length > 0
  })
}

function pickNavItemsForLocale(footer: Footer, locale: string): FooterNavItem[] {
  const variants = footer?.variants
  if (Array.isArray(variants) && variants.length > 0) {
    const matched = variants.find((v) => v?.locale === locale)
    const variant = matched ?? variants.find((v) => v?.locale === 'en') ?? variants[0]
    if (variant && navItemsHaveLabels(variant.navItems as FooterNavItem[] | null | undefined)) {
      return variant.navItems as FooterNavItem[]
    }
  }

  if (Array.isArray(footer?.navItems)) {
    return footer!.navItems as FooterNavItem[]
  }

  return []
}

function getPageIdsFromNav(navItems: FooterNavItem[]): string[] {
  const ids = new Set<string>()
  for (const item of navItems) {
    const ref = item?.link?.reference
    if (item?.link?.type === 'reference' && ref?.relationTo === 'pages') {
      const value = ref.value
      if (typeof value === 'string') {
        ids.add(value)
      } else if (value && typeof value === 'object' && 'id' in value) {
        const id = (value as { id?: unknown }).id
        if (typeof id === 'string') ids.add(id)
      }
    }
  }
  return Array.from(ids)
}

const OBJECT_ID_HEX = /^[0-9a-fA-F]{24}$/

async function fetchPageByRef(ref: string): Promise<Page | null> {
  try {
    const db = await getContentDb()
    // Payload stores a page reference's `value` as either the page's ObjectId
    // (rendered as a 24-char hex string) OR the page's slug string — depending
    // on how the reference was authored in the Admin. Query by _id if it's
    // 24-hex, otherwise by slug. NOTE: we cannot use ObjectId.isValid(ref)
    // here — it returns true for ANY 12-character string, so slugs like
    // "contact-info" (12 chars) would be misinterpreted as a 12-byte ObjectId
    // and silently miss the lookup. The explicit 24-hex regex is the only
    // reliable check for the string form of an ObjectId.
    const filter: Document = OBJECT_ID_HEX.test(ref) ? { _id: new ObjectId(ref) } : { slug: ref }
    const doc = await db.collection('pages').findOne(filter)
    if (!doc) return null
    return serializeDoc<Page>(doc)
  } catch {
    return null
  }
}

function toLegalPage(page: Page): FooterLegalPage | null {
  if (!page?.id) return null
  const slug = typeof page.slug === 'string' ? page.slug : null
  const title = typeof page.title === 'string' ? page.title : (slug ?? 'Untitled')
  const layout = Array.isArray(page.layout) ? page.layout : []
  return {
    id: page.id,
    slug: slug ?? page.id,
    title,
    layout,
  }
}

export const loadFooterData = cache(async (locale: string): Promise<FooterData> => {
  const footer = await fetchFooterGlobal()
  if (!footer) return EMPTY_FOOTER

  const navItems = pickNavItemsForLocale(footer, locale)
  const pageIds = getPageIdsFromNav(navItems)

  const legalPages: Record<string, FooterLegalPage> = {}
  for (const ref of pageIds) {
    const page = await fetchPageByRef(ref)
    const legal = page ? toLegalPage(page) : null
    if (legal) {
      legalPages[ref] = legal
      if (legal.slug && !legalPages[legal.slug]) {
        legalPages[legal.slug] = legal
      }
    }
  }

  const text = typeof footer.text === 'string' && footer.text.length > 0 ? footer.text : null
  const meta = footer.meta ?? null

  return {
    meta,
    text,
    navItems,
    legalPages,
  }
})

export { resolveMediaUrl } from './resolve-media-url'
