/**
 * @fileType hook
 * @domain frontend
 * @ai-summary Responsive breakpoint hook — returns false on first render (SSR-safe), then the actual match state once the client hydrates.
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
