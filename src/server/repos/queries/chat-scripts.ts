/**
 * @fileType server-query
 * @domain chat-lessons
 * @ai-summary Fetches a single `chat-lessons` doc keyed by lesson + locale,
 *             scoped to the current tenant and to published/active docs only —
 *             matches the convention used by every other content query in
 *             this folder. Returns null when the collection or matching doc
 *             is missing, so this is safe to call before the admin repo ships
 *             the collection (Mongo just returns nothing).
 */

import { cache } from 'react'
import type { ContentLocale } from '@/infra/types/content'
import {
  andFilter,
  defaultTenantFilter,
  findOneSerialized,
  objectIdFromString,
  visibleContentFilter,
} from '../mongo'
import type { PayloadChatScriptDoc } from '@/lib/chat-lessons/payload-chat-script'

export const getChatScriptByLessonId = cache(
  async ({
    lessonId,
    locale,
  }: {
    lessonId: string
    locale: ContentLocale
  }): Promise<PayloadChatScriptDoc | null> => {
    const filter = andFilter(
      visibleContentFilter({ lesson: objectIdFromString(lessonId), locale }),
      await defaultTenantFilter(),
    )
    return findOneSerialized<PayloadChatScriptDoc>('chat-lessons', filter)
  },
)
