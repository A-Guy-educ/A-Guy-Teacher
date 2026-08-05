/**
 * @fileType hook
 * @domain lessons
 * @ai-summary Freeform chat channel for the Chat view. When the student types
 *             a question, we append their bubble + a pending indicator, then
 *             hit the existing /api/agent/chat endpoint with the current
 *             exercise's context (same channel the Interactive-tab chat uses).
 *             The assistant reply replaces the pending indicator in place.
 *
 *             Only the current exerciseId is passed as context — no extra
 *             injection here, because the /api/agent/chat handler already
 *             resolves lessonId/courseId/exerciseId server-side and formats
 *             the exercise context for the model.
 */

'use client'

import { useCallback, useRef, useState } from 'react'
import { apiService } from '@/server/services/api/api-service'
import type { StreamEntry } from './types'

interface UseChatChannelArgs {
  lessonId: string
  currentExerciseId: string | null
  /** Called to add a new entry to the shared stream. */
  append: (entry: StreamEntry) => void
  /** Called to swap the pending entry for a real assistant/error entry. */
  replace: (key: string, entry: StreamEntry) => void
  acknowledgment: string
  errorMessage: string
  authRequiredMessage: string
  quotaExceededMessage: string
}

export function useChatChannel({
  lessonId,
  currentExerciseId,
  append,
  replace,
  acknowledgment,
  errorMessage,
  authRequiredMessage,
  quotaExceededMessage,
}: UseChatChannelArgs) {
  const [isSending, setIsSending] = useState(false)
  const idCounter = useRef(0)
  const nextKey = (prefix: string) => `${prefix}-${Date.now()}-${++idCounter.current}`

  const send = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()
      if (!text || isSending) return

      append({ key: nextKey('u'), kind: 'chat-user', text })
      const pendingKey = nextKey('p')
      append({ key: pendingKey, kind: 'chat-pending' })
      setIsSending(true)

      try {
        const response = await apiService.chat(text, acknowledgment, {
          lessonId,
          exerciseId: currentExerciseId ?? undefined,
        })

        if (response.success && response.message) {
          replace(pendingKey, {
            key: pendingKey,
            kind: 'chat-assistant',
            text: response.message,
          })
          return
        }

        const message = response.authRequired
          ? authRequiredMessage
          : response.quotaExceeded
            ? quotaExceededMessage
            : (response.error ?? errorMessage)
        replace(pendingKey, { key: pendingKey, kind: 'chat-error', text: message })
      } catch {
        replace(pendingKey, { key: pendingKey, kind: 'chat-error', text: errorMessage })
      } finally {
        setIsSending(false)
      }
    },
    [
      acknowledgment,
      append,
      authRequiredMessage,
      currentExerciseId,
      errorMessage,
      isSending,
      lessonId,
      quotaExceededMessage,
      replace,
    ],
  )

  return { send, isSending }
}
