/**
 * @fileType hook
 * @domain utility
 * @pattern media-query
 * @ai-summary Responsive breakpoint hook — tracks `window.matchMedia` reactively; returns null on first render (SSR-safe), then the actual match state once the client hydrates.
 *
 * Gotcha: Initial render returns `null` (treated as `false`), then updates on the client after `window.matchMedia` runs. This can cause a hydration mismatch in SSR frameworks — wrap in a client-only boundary or accept the initial `false`.
 */

'use client'

import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean | null>(null)

  useEffect(() => {
    const media = window.matchMedia(query)
    setMatches(media.matches)

    const listener = () => setMatches(media.matches)
    media.addEventListener('change', listener)

    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches ?? false
}
