/**
 * @fileType component
 * @domain frontend
 * @pattern footer-client
 * @ai-summary Client wrapper that renders the dynamic footer and owns the
 * open/close state of the legal-page modal. Clicking a nav link that points
 * to a pages-collection entry opens the modal; clicking the same link again
 * toggles it closed. Clicking a different link swaps the modal content
 * instead of stacking another open.
 */
'use client'

import NextImage from 'next/image'
import { useCallback, useMemo, useState } from 'react'

import { cn } from '@/infra/utils/ui'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { BrandLogo } from '@/ui/web/BrandLogo'
import { CMSLink } from '@/ui/web/Link'
import { ThemeSelector } from '@/ui/web/providers/Theme/ThemeSelector'

import { resolveMediaUrl } from '@/infra/utils/resolve-media-url'

import { FooterLegalModal } from './FooterLegalModal'
import type { FooterData, FooterLegalPage, FooterNavItem } from './footer-data'

interface FooterClientProps {
  data: FooterData
  version: string
  /**
   * Render the bottom row (version, theme selector). Kept on so it matches the
   * existing footer behavior; can be flipped off in tests.
   */
  showExtras?: boolean
}

function buildPageHref(legalPages: Record<string, FooterLegalPage>, pageId: string): string | null {
  const page = legalPages[pageId]
  if (!page?.slug) return null
  return `/${page.slug}`
}

function resolveNavHref(
  item: FooterNavItem,
  legalPages: Record<string, FooterLegalPage>,
): string | null {
  const link = item.link
  if (!link) return null

  if (link.type === 'reference' && link.reference?.relationTo === 'pages') {
    const value = link.reference.value
    const id =
      typeof value === 'string' ? value : value && typeof value === 'object' ? value.id : null
    if (typeof id === 'string') {
      return buildPageHref(legalPages, id) ?? `/${id}`
    }
    return null
  }

  if (link.url && link.url.length > 0) return link.url
  return null
}

export const FooterClient: React.FC<FooterClientProps> = ({ data, version, showExtras = true }) => {
  const [activePageId, setActivePageId] = useState<string | null>(null)

  const activePage = useMemo(() => {
    if (!activePageId) return null
    return data.legalPages[activePageId] ?? null
  }, [activePageId, data.legalPages])

  const openIfPageRef = useCallback(
    (item: FooterNavItem) => {
      const link = item.link
      if (link?.type === 'reference' && link.reference?.relationTo === 'pages') {
        const value = link.reference.value
        const id =
          typeof value === 'string' ? value : value && typeof value === 'object' ? value.id : null
        if (typeof id !== 'string') return false
        if (!data.legalPages[id]) return false
        setActivePageId((current) => (current === id ? null : id))
        return true
      }
      return false
    },
    [data.legalPages],
  )

  const closeModal = useCallback(() => setActivePageId(null), [])

  const logoUrl = resolveMediaUrl(data.meta?.image ?? null)
  const titleColumn = data.meta?.titleColumn ?? null
  const subtitleColumn = data.meta?.subtitleColumn ?? null
  const introColumn = data.meta?.introColumn ?? null
  const contactEmail = data.meta?.contact?.email ?? null
  const contactPhone = data.meta?.contact?.phone ?? null
  const contactAddress = data.meta?.contact?.address ?? null
  const text = data.text ?? null

  return (
    <footer className="mt-auto border-t border-border bg-footer text-card-foreground relative z-0">
      <div className="container py-3 flex flex-row flex-wrap items-center justify-center gap-content-gap-xs">
        <SystemLink className="flex items-center" href="/">
          {logoUrl ? (
            <NextImage
              src={logoUrl}
              alt={titleColumn ?? 'Logo'}
              width={120}
              height={20}
              className="h-5 w-auto"
              unoptimized
            />
          ) : (
            <BrandLogo className="h-5 w-auto" />
          )}
        </SystemLink>

        {titleColumn ? (
          <span className="hidden flex-1 text-center text-body-xs font-bold text-muted-foreground/40 uppercase tracking-[0.2em] sm:block">
            {titleColumn}
          </span>
        ) : null}

        <div className="flex min-w-0 items-center gap-content-gap-xs text-body-xs">
          {data.navItems.map((item, i) => {
            const link = item.link
            const label = link?.label && link.label.length > 0 ? link.label : '‎'
            const isPageRef = link?.type === 'reference' && link.reference?.relationTo === 'pages'
            const href = resolveNavHref(item, data.legalPages)

            if (isPageRef) {
              const pageId =
                typeof link!.reference!.value === 'string'
                  ? link!.reference!.value
                  : (link!.reference!.value?.id ?? null)
              const isActive = pageId !== null && pageId === activePageId

              return (
                <button
                  type="button"
                  key={i}
                  data-testid={`footer-nav-${i}`}
                  onClick={(event) => {
                    event.preventDefault()
                    openIfPageRef(item)
                  }}
                  className={cn(
                    'text-card-foreground hover:text-primary transition-all duration-normal text-body-xs whitespace-nowrap',
                    isActive && 'text-primary',
                  )}
                  aria-expanded={isActive}
                  aria-haspopup="dialog"
                >
                  {label}
                </button>
              )
            }

            if (!href) {
              return (
                <span key={i} className="text-card-foreground text-body-xs whitespace-nowrap">
                  {label}
                </span>
              )
            }

            return (
              <CMSLink
                className="text-card-foreground hover:text-primary transition-all duration-normal text-body-xs whitespace-nowrap"
                key={i}
                {...link}
              />
            )
          })}

          {showExtras ? (
            <>
              <span className="text-muted-foreground/30">|</span>
              <span className="text-body-xs text-muted-foreground/70 font-normal">v{version}</span>
              <ThemeSelector />
            </>
          ) : null}
        </div>
      </div>

      {(subtitleColumn ||
        introColumn ||
        text ||
        contactEmail ||
        contactPhone ||
        contactAddress) && (
        <div className="container pb-3 -mt-1 text-body-xs text-muted-foreground/80 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-content-gap-sm">
          {subtitleColumn ? <span className="font-medium">{subtitleColumn}</span> : null}
          {introColumn ? <span>{introColumn}</span> : null}
          {text ? <span>{text}</span> : null}
          {contactEmail ? <span>{contactEmail}</span> : null}
          {contactPhone ? <span>{contactPhone}</span> : null}
          {contactAddress ? <span>{contactAddress}</span> : null}
        </div>
      )}

      <FooterLegalModal page={activePage} isOpen={activePage !== null} onClose={closeModal} />
    </footer>
  )
}
