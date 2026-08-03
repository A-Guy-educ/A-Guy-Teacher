/**
 * @fileType utility
 * @domain ui
 * @pattern module-cache
 * @ai-summary Fetches, normalises, and sanitises an SVG for inline rendering. Dedupes concurrent requests and caches results per URL across component instances.
 */

import { sanitizeSvg } from '@/ui/web/exerciserenderer/utils/svgSanitize'
import { ensureSvgViewBox } from './ensureSvgViewBox'

// Session-lifetime retention is intentional. The set of SVGs a user can
// reach is bounded by the courses/exercises they browse — not by activity —
// so unbounded growth is not a realistic concern here. If this component is
// ever placed behind infinite scroll or another unbounded surface, wrap
// `cache` in a small LRU (drop oldest when size exceeds ~50).
const cache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

/**
 * Fetch an SVG, ensure it has a viewBox, sanitise it, and return the markup
 * ready to feed into `dangerouslySetInnerHTML`.
 *
 * Two levels of memoisation to keep this cheap on pages with many SVG media
 * items (e.g. exercise thumbnails, math diagrams):
 *
 *  - **Result cache** — successful responses are stored per URL so identical
 *    URLs rendered by multiple `SVGMedia` instances only pay the fetch and
 *    DOMPurify cost once for the session.
 *  - **In-flight dedupe** — while one request is outstanding, concurrent
 *    callers for the same URL await the same promise instead of firing
 *    parallel requests that would each independently parse and sanitise.
 *
 * Failures are not cached — the next caller retries. This is deliberate:
 * transient network errors should not permanently blank a diagram, and the
 * volume of SVG media requests is low enough that retry storms are not a
 * concern.
 */
export async function fetchInlineSvg(url: string): Promise<string> {
  const cached = cache.get(url)
  if (cached !== undefined) return cached

  const existing = inflight.get(url)
  if (existing) return existing

  const promise = (async () => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`SVG fetch failed: ${res.status}`)
    const raw = await res.text()
    const sanitised = sanitizeSvg(ensureSvgViewBox(raw))
    cache.set(url, sanitised)
    return sanitised
  })().finally(() => {
    inflight.delete(url)
  })

  inflight.set(url, promise)
  return promise
}

/** Test-only: clear the module-level caches between test cases. */
export function __resetInlineSvgCache(): void {
  cache.clear()
  inflight.clear()
}
