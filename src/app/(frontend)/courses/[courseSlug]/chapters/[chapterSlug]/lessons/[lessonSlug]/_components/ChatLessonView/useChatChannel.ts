/**
 * @fileType hook
 * @domain lessons
 * @ai-summary Freeform chat channel for the Chat view. Posts to the streaming
 *             endpoint `/api/agent/chat/stream` and progressively grows the
 *             assistant bubble as chunks arrive over SSE, so wrong-answer
 *             corrections and student questions type out live instead of
 *             popping in after a 2-4s wait.
 *
 *             Why we wrap the message in `<exercise-context>` ourselves: the
 *             chat endpoint's `resolveContextKey` prefers `lessonId` over
 *             `exerciseId`, so the conversation is lesson-wide and cumulative.
 *             Without an explicit block telling the AI which section is
 *             "current", it grabs whatever exercise was most recently in
 *             history and answers about that. Injecting the current section's
 *             blocks on every send scopes the AI's attention to the section
 *             the student is actually on.
 */

'use client'

import { useCallback, useRef, useState } from 'react'
import { buildPromptWithExerciseContext } from '@/ui/web/chat/hooks/exercise-context-prompt'
import type { StreamEntry } from './types'

const STREAM_ENDPOINT = '/api/agent/chat/stream'

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
  /** Called to swap an entry in place by key — used for pending → assistant. */
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

      const wrappedMessage = buildPromptWithExerciseContext(message, currentExerciseContext)

      // Assistant entry key is minted on first chunk arrival; subsequent
      // chunks reuse it so the same bubble grows in place rather than
      // spawning one bubble per chunk.
      let assistantKey: string | null = null
      let accumulatedText = ''

      const finalizeError = (text: string) => {
        const targetKey = assistantKey ?? pendingKey
        replace(targetKey, { key: nextKey('e'), kind: 'chat-error', text })
      }

      try {
        const response = await fetch(STREAM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: wrappedMessage,
            acknowledgment,
            lessonId,
            exerciseId: currentExerciseId ?? undefined,
          }),
        })

        if (!response.ok || !response.body) {
          finalizeError(
            await resolveErrorText(response, {
              authRequiredMessage,
              quotaExceededMessage,
              errorMessage,
            }),
          )
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          // SSE frames are separated by a blank line (\n\n). Anything left
          // in `buffer` after the split is an in-progress frame — hold it
          // for the next read.
          const frames = buffer.split('\n\n')
          buffer = frames.pop() ?? ''

          for (const raw of frames) {
            const parsed = parseSseFrame(raw)
            if (!parsed) continue

            if (parsed.event === 'chunk' && typeof parsed.data.text === 'string') {
              accumulatedText += parsed.data.text
              if (assistantKey === null) {
                assistantKey = nextKey('a')
                replace(pendingKey, {
                  key: assistantKey,
                  kind: 'chat-assistant',
                  text: accumulatedText,
                  streaming: true,
                })
              } else {
                replace(assistantKey, {
                  key: assistantKey,
                  kind: 'chat-assistant',
                  text: accumulatedText,
                  streaming: true,
                })
              }
            } else if (parsed.event === 'error') {
              const text = typeof parsed.data.error === 'string' ? parsed.data.error : errorMessage
              finalizeError(text)
              return
            }
            // 'done' → nothing to do; the terminal replace below flips the
            // streaming flag once the reader loop exits.
          }
        }

        // Stream ended cleanly but we never got a chunk (rare — usually
        // means the model returned empty). Swap pending → generic error so
        // the UI doesn't leave the pending indicator hanging.
        if (assistantKey === null) {
          finalizeError(errorMessage)
          return
        }

        // Terminal replace: same key + text, streaming: false. TTS narration
        // gates on !streaming so this is the point at which the reply gets
        // spoken (once, on the whole text — not per chunk).
        replace(assistantKey, {
          key: assistantKey,
          kind: 'chat-assistant',
          text: accumulatedText,
          streaming: false,
        })
      } catch {
        finalizeError(errorMessage)
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

interface SseFrame {
  event: string
  data: Record<string, unknown>
}

/**
 * Parse one SSE frame ("event: X\ndata: {...}"). Returns null for malformed
 * frames rather than throwing — the loop skips them and continues, which
 * matches how the browser's own EventSource behaves.
 */
function parseSseFrame(raw: string): SseFrame | null {
  const lines = raw.split('\n')
  let event: string | null = null
  let dataRaw: string | null = null
  for (const line of lines) {
    if (line.startsWith('event: ')) event = line.slice('event: '.length).trim()
    else if (line.startsWith('data: ')) dataRaw = line.slice('data: '.length)
  }
  if (!event || dataRaw === null) return null
  try {
    const data = JSON.parse(dataRaw) as Record<string, unknown>
    return { event, data }
  } catch {
    return null
  }
}

/**
 * Translate a non-2xx response from the stream endpoint into a locale-aware
 * error string. Consumes the JSON body once; falls back to the generic
 * error message if the body isn't JSON or the status isn't specifically
 * handled.
 */
async function resolveErrorText(
  response: Response,
  labels: { authRequiredMessage: string; quotaExceededMessage: string; errorMessage: string },
): Promise<string> {
  if (response.status === 401) return labels.authRequiredMessage
  let body: { error?: string; quotaExceeded?: boolean } = {}
  try {
    body = (await response.json()) as typeof body
  } catch {
    // fall through to generic
  }
  if (response.status === 429 && body.quotaExceeded) return labels.quotaExceededMessage
  return body.error ?? labels.errorMessage
}
