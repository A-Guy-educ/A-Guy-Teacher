/**
 * Link component that registers route loading at trigger time
 *
 * @fileType component
 * @domain ui
 * @pattern system-link
 * @ai-summary next/link wrapper that registers loading before navigation and reduces opacity on the link itself while loading; intentionally skips external links, hash-only anchors, and same-path navigations (preserving anchor-scroll behavior)
 */

'use client'

/**
 * @ai-summary Drop-in Next.js Link replacement that registers route loading state
 * on click, before navigation. Applies reduced opacity while the route is in-flight.
 * Use for all primary navigation links to get consistent loading feedback without
 * needing to wire up useRouterWithLoading manually.
 *
 * @ai-trap External links, hash-only links, and modifier-key clicks are passed
 * through without registering loading state. Same-page anchor links also skip
 * registration intentionally — no loading state for scroll-to-id.
 */
import React, { forwardRef, useCallback, useState } from 'react'
import Link, { type LinkProps } from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/infra/utils/ui'
import { loadingManager } from '../LoadingManager'
import { LOADING_KEYS } from '../keys'
import { resolveHrefToString, buildCurrentPath } from '../utils/resolveHref'
import { useLoadingState } from '../hooks/useLoadingState'

// @ai-summary next/link wrapper that registers ROUTE_TRANSITION loading at click time and dims the link while navigation is in progress. Skips external links, modifier-key clicks, and hash-only anchors.

interface SystemLinkProps extends LinkProps {
  children: React.ReactNode
  className?: string
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}

/**
 * Link component that registers route loading at trigger time
 * Shows local loading indication (reduced opacity) when clicked
 *
 * Use this for all navigation links to provide consistent loading feedback
 */
export const SystemLink = forwardRef<HTMLAnchorElement, SystemLinkProps>(function SystemLink(
  { href, onClick, children, className, ...props },
  ref,
) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [wasClicked, setWasClicked] = useState(false)
  const isRouteLoading = useLoadingState({ key: LOADING_KEYS.ROUTE_TRANSITION })

  // Show loading state if this link was clicked and route is loading
  const isLoading = wasClicked && isRouteLoading

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Call original onClick if provided
      onClick?.(e)

      // Don't handle if default was prevented or modifier keys
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) {
        return
      }

      // Don't handle external links
      const hrefStr = typeof href === 'string' ? href : href.pathname || ''
      if (
        hrefStr.startsWith('http://') ||
        hrefStr.startsWith('https://') ||
        hrefStr.startsWith('//')
      ) {
        return
      }

      // Don't handle hash-only links (same page anchor)
      if (hrefStr.startsWith('#') || (typeof href === 'object' && !href.pathname && href.hash)) {
        return
      }

      // Normalize both paths for reliable comparison (ignore hash - same-page anchor)
      const targetPath = resolveHrefToString(href, true)
      const currentPath = buildCurrentPath(pathname, searchParams)

      // Only register loading if actually navigating to different page
      if (currentPath !== targetPath) {
        setWasClicked(true)
        loadingManager.register(LOADING_KEYS.ROUTE_TRANSITION, 'route')
      }
    },
    [href, onClick, pathname, searchParams],
  )

  return (
    <Link
      ref={ref}
      href={href}
      onClick={handleClick}
      className={cn(
        className,
        isLoading && 'opacity-60 pointer-events-none',
        'transition-opacity duration-150',
      )}
      aria-disabled={isLoading}
      {...props}
    >
      {children}
    </Link>
  )
})
