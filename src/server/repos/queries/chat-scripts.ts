/**
 * @fileType server-query
 * @domain chat-lessons
 * @ai-summary Fetches a single `chat-lessons` doc keyed by lesson + locale.
 *             Returns null when the collection or doc is missing — safe to
 *             call even before the admin repo ships the collection (Mongo
 *             just returns nothing).
 */

import { cache } from 'react'
import type { ContentLocale } from '@/infra/types/content'
import { findOneSerialized, objectIdFromString } from '../mongo'
import type { PayloadChatScriptDoc } from '@/lib/chat-lessons/payload-chat-script'

export const getChatScriptByLessonId = cache(
  async ({
    lessonId,
    locale,
  }: {
    lessonId: string
    locale: ContentLocale
  }): Promise<PayloadChatScriptDoc | null> => {
    return findOneSerialized<PayloadChatScriptDoc>('chat-lessons', {
      lesson: objectIdFromString(lessonId),
      locale,
    })
  },
)
