import { cache } from 'react'

import { inferMediaType } from '@/infra/media/inferMediaType'
import type { Media } from '@/infra/types/content'
import { findManySerialized, objectIdFromString } from '../mongo'

function normalizeMedia(media: Media): Media {
  return {
    ...media,
    mediaType:
      media.mediaType ||
      (media.type as Media['mediaType']) ||
      inferMediaType(media.mimeType, media.filename),
    type:
      media.type ||
      (media.mediaType as string | null | undefined) ||
      inferMediaType(media.mimeType, media.filename),
    url: media.url || (media.filename ? `/api/media/file/${media.filename}` : undefined),
  }
}

export const queryMediaByIds = cache(async (ids: string[]): Promise<Record<string, Media>> => {
  if (ids.length === 0) return {}

  const docs = await findManySerialized<Media>(
    'media',
    { _id: { $in: ids.map(objectIdFromString) } },
    { limit: ids.length },
  )

  const map: Record<string, Media> = {}
  for (const doc of docs) {
    map[doc.id] = normalizeMedia(doc)
  }
  return map
})
