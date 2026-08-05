/**
 * @fileType hook
 * @domain lessons
 * @ai-summary Freeform chat channel for the Chat view. When the student types
 *             a question, we append their bubble + a pending indicator, then
 *             hit the existing /api/agent/chat endpoint with the current
 *             section's context wrapped around the message. The assistant
 *             reply replaces the pending indicator in place.
 *
 *             Why we wrap the message in `<exercise-context>` ourselves: the
 *             /api/agent/chat endpoint resolves its context key as
 *             `lessons:${lessonId}` when both lessonId + exerciseId are
 *             present (see `resolveContextKey`), so the conversation is
 *             lesson-wide and cumulative. Without an explicit block telling
 *             the AI which section is "current", it grabs whatever exercise
 *             was most recently in history and answers about that. Injecting
 *             the current section's blocks on every send scopes the AI's
 *             attention to the section the student is actually on.
 */

'use client'

import { useCallback, useRef, useState } from 'react'
import { buildPromptWithExerciseContext } from '@/ui/web/chat/hooks/exercise-context-prompt'
import { apiService } from '@/server/services/api/api-service'
import type { StreamEntry } from './types'

interface UseChatChannelArgs {
  lessonId: string
  currentExerciseId: string | null
  /**
   * Pre-formatted `<exercise-context>` payload for the current section. When
   * provided, we wrap every outgoing message with it via
   * buildPromptWithExerciseContext so the AI knows exactly which section is
   * in play, regardless of what the lesson-wide conversation history looks
   * like. Null when no section is active (start card / lesson-complete).
   */
  currentExerciseContext: string | null
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
  currentExerciseContext,
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

  // The visible `isSending` state drives the input button's disabled prop,
  // but a second synchronous invocation of `send` (e.g. two Enter presses
  // dispatched before React reconciles) would still pass an `isSending`
  // guard because the closure captures the stale render-time value. Guard
  // synchronously via a ref, then mirror to state for the UI.
  const sendingRef = useRef(false)

  const runRequest = useCallback(
    async (message: string, showUserBubble: boolean) => {
      if (sendingRef.current) return
      sendingRef.current = true
      setIsSending(true)

      if (showUserBubble) {
        append({ key: nextKey('u'), kind: 'chat-user', text: message })
      }
      const pendingKey = nextKey('p')
      append({ key: pendingKey, kind: 'chat-pending' })

      // Give the assistant reply a distinct key from the pending indicator
      // so downstream effects (e.g. TTS narration) treat it as a fresh
      // entry rather than the same key being mutated. The pending entry is
      // removed in the same replace call.
      const finalize = (entry: Extract<StreamEntry, { kind: 'chat-assistant' | 'chat-error' }>) => {
        replace(pendingKey, entry)
      }

      const wrappedMessage = buildPromptWithExerciseContext(message, currentExerciseContext)

      try {
        const response = await apiService.chat(wrappedMessage, acknowledgment, {
          lessonId,
          exerciseId: currentExerciseId ?? undefined,
        })

        if (response.success && response.message) {
          finalize({ key: nextKey('a'), kind: 'chat-assistant', text: response.message })
          return
        }

        const errorText = response.authRequired
          ? authRequiredMessage
          : response.quotaExceeded
            ? quotaExceededMessage
            : (response.error ?? errorMessage)
        finalize({ key: nextKey('e'), kind: 'chat-error', text: errorText })
      } catch {
        finalize({ key: nextKey('e'), kind: 'chat-error', text: errorMessage })
      } finally {
        sendingRef.current = false
        setIsSending(false)
      }
    },
    [
      acknowledgment,
      append,
      authRequiredMessage,
      currentExerciseContext,
      currentExerciseId,
      errorMessage,
      lessonId,
      quotaExceededMessage,
      replace,
    ],
  )

  /** Freeform student question — shows their bubble + AI reply. */
  const send = useCallback(
    (rawText: string) => {
      const text = rawText.trim()
      if (!text) return
      void runRequest(text, true)
    },
    [runRequest],
  )

  /**
   * Auto-correction triggered when the student answers a section incorrectly.
   * The canned prompt is invisible to the student — only the pending
   * indicator + assistant reply land in the stream so it reads like the
   * teacher volunteered an explanation.
   */
  const requestCorrection = useCallback(
    (prompt: string) => {
      const text = prompt.trim()
      if (!text) return
      void runRequest(text, false)
    },
    [runRequest],
  )

  return { send, requestCorrection, isSending }
}
