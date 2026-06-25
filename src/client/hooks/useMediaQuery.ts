/**
 * @fileType hook
 * @domain utility
 * @pattern media-query
 * @ai-summary Subscribes to a CSS media query and returns whether it matches. Returns `false` on the server and during hydration before the media query is evaluated.
 *
 * Gotcha: Initial render returns `null` (treated as `false`), then updates on the client after `window.matchMedia` runs. This can cause a hydration mismatch in SSR frameworks — wrap in a client-only boundary or accept the initial `false`.
 */

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
