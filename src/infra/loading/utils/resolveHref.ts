/**
 * Next.js href normalization utilities
 *
 * @fileType utility
 * @domain ui
 * @pattern href-resolution
 * @ai-summary Normalizes Next.js href to string for comparison; hash is stripped so same-page anchors never trigger route loading
 */

import type { UrlObject } from 'url'

// @ai-summary Normalizes Next.js hrefs (string or UrlObject) for reliable route comparison: strips trailing slashes, normalizes query strings, and optionally ignores hash fragments.

/**
 * @ai-summary Normalizes Next.js href (string or UrlObject) into a comparable
 * string path. Strips trailing slashes, merges search params, and optionally strips
 * hash fragments for reliable same-page anchor detection.
 *
 * Handles edge cases: hash-only, trailing slashes, query strings
 *
 * @ai-trap ignoreHash must be explicitly set to true when using these functions
 * for route-transition detection — SystemLink and useRouterWithLoading pass true
 * for this reason. Without it, a link to the current page with a new hash would
 * be treated as a cross-page navigation.
 */
export function resolveHrefToString(href: string | UrlObject, ignoreHash = false): string {
  if (typeof href === 'string') {
    return normalizePathname(href, ignoreHash)
  }

  // UrlObject format
  const { pathname = '', search = '', hash = '' } = href
  const searchStr = search || ''
  const query = searchStr.startsWith('?') ? searchStr : searchStr ? `?${searchStr}` : ''
  const hashPart = ignoreHash ? '' : hash || ''

  return normalizePathname((pathname || '') + query + hashPart, ignoreHash)
}

/**
 * Normalize a pathname for comparison
 * - Removes trailing slashes (except root)
 * - Ensures consistent format
 * - Optionally strips hash (for route comparison)
 */
function normalizePathname(path: string, ignoreHash = false): string {
  // Handle empty/root
  if (!path || path === '/') return '/'

  // Strip hash if requested (before other processing)
  let processedPath = path
  if (ignoreHash) {
    const hashIndex = path.indexOf('#')
    if (hashIndex !== -1) {
      processedPath = path.slice(0, hashIndex)
    }
  }

  // Handle hash-only href (returns empty when ignoring hash)
  if (!processedPath || processedPath === '/') return '/'

  // Parse to extract pathname and query separately
  const [pathname, ...rest] = processedPath.split('?')
  const queryPart = rest.length > 0 ? '?' + rest.join('?') : ''

  // Remove trailing slash from pathname (unless root)
  const normalizedPathname =
    pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname

  return normalizedPathname + queryPart
}

/**
 * Build current path from Next.js hooks for comparison
 * Accepts any object with toString() (URLSearchParams, ReadonlyURLSearchParams, etc.)
 */
export function buildCurrentPath(pathname: string, searchParams: { toString(): string }): string {
  const search = searchParams.toString()
  const path = pathname + (search ? `?${search}` : '')
  return normalizePathname(path)
}
