/**
 * Module-scope cache of the published `interactive_lesson` prompt (30s TTL)
 *
 * @ai-summary Short-TTL memoization avoids a DB round-trip on every cached-lesson read. Negative caching (null = no prompt) is also cached. The 30s TTL bounds staleness — each serverless instance has its own copy; edits on one instance don't auto-evict other instances' caches within the TTL window. invalidatePublishedInteractiveLessonPrompt() exists for manual use but has no hook wiring it.
 */

import type { Payload } from '@/infra/types/backend'

export interface PublishedInteractiveLessonPrompt {
  id: string
  template: string
  /** Source updatedAt as ISO string (normalized so date format is deterministic). */
  updatedAt: string
}

interface CacheEntry {
  /** null means "we looked and there is no published prompt" — cached as a negative. */
  prompt: PublishedInteractiveLessonPrompt | null
  fetchedAt: number
}

const CACHE_TTL_MS = 30_000

let cache: CacheEntry | null = null

/**
 * Look up the currently-published `interactive_lesson` prompt, with a
 * short TTL memoization. Returns null if no published prompt exists.
 */
export async function getPublishedInteractiveLessonPrompt(
  payload: Payload,
): Promise<PublishedInteractiveLessonPrompt | null> {
  const now = Date.now()
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.prompt
  }

  const result = await payload.find({
    collection: 'prompts',
    where: {
      and: [{ usage: { equals: 'interactive_lesson' } }, { status: { equals: 'published' } }],
    },
    limit: 1,
    overrideAccess: true,
  })

  const doc = result.docs[0]
  if (!doc) {
    cache = { prompt: null, fetchedAt: now }
    return null
  }

  const template = doc.template?.trim()
  if (!template) {
    cache = { prompt: null, fetchedAt: now }
    return null
  }

  cache = {
    prompt: {
      id: String(doc.id),
      template,
      updatedAt: normalizeIsoDate(doc.updatedAt),
    },
    fetchedAt: now,
  }
  return cache.prompt
}

/**
 * Drop the cached prompt. Exists for manual use — there is no hook that
 * automatically calls this; the 30s TTL is the only invalidation mechanism.
 * Safe to call when no entry is cached.
 */
export function invalidatePublishedInteractiveLessonPrompt(): void {
  cache = null
}

/**
 * Normalize a Payload-returned updatedAt to an ISO string. Payload may
 * return Date or ISO depending on driver/path; without normalizing, the
 * cache invalidation comparison flips to "evict on every read" the moment
 * the two sides disagree on format.
 */
export function normalizeIsoDate(value: unknown): string {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return d.toISOString()
  }
  return ''
}
