/**
 * @fileType util
 * @domain frontend
 * @pattern pure-media-url-resolver
 * @ai-summary Pure client-safe extractor for a URL from a Media record or
 * string reference. Split out of `@/infra/utils/footer-data` so client
 * components can import it without pulling in that module's MongoDB deps
 * (loadFooterData → content-db → mongodb → net/tls in the client bundle).
 */
import type { Media } from '@/infra/types/content'

export function resolveMediaUrl(media: string | Media | null | undefined): string | null {
  if (!media) return null
  if (typeof media === 'string') return media
  if (typeof media === 'object') {
    if (typeof media.url === 'string' && media.url.length > 0) return media.url
    if (typeof media.externalUrl === 'string' && media.externalUrl.length > 0)
      return media.externalUrl
  }
  return null
}
