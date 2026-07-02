// @vitest-environment jsdom
/**
 * Issue #651 — Acceptance criterion: "Added validation to ensure the AI Tutor
 * chatbot does not break if a text-based explanation includes inline images."
 *
 * The learning-agent chat renders messages as plain text
 * (`whitespace-pre-wrap`), so markdown image syntax in the streamed assistant
 * reply must be tolerated without throwing. This test streams a chunk that
 * includes `![alt](https://example/x.svg)` and verifies the hook finishes
 * the stream, the message is recorded, and no error toast fires.
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLearningAgentChat } from '@/ui/web/learning-agent/hooks/useLearningAgentChat'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

// jsdom's `fetch` exists but returns undefined; the hook will read
// `response.body.getReader()` which only works on a real ReadableStream.
// Replace the body field with our own stream factory.
function buildStreamingResponse(
  chunks: Array<{ type: string; text?: string; conversationId?: string }>,
) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
      }
      controller.close()
    },
  })
  return {
    ok: true,
    status: 200,
    body,
  } as unknown as Response
}

describe('useLearningAgentChat — inline-image resilience (issue #651)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not throw and records the streamed text when the assistant reply embeds markdown image syntax', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildStreamingResponse([
        { type: 'chunk', text: 'Here is a diagram: ' },
        { type: 'chunk', text: '![alt text](https://example.com/diagram.svg)' },
        { type: 'chunk', text: ' and another reference: ' },
        { type: 'chunk', text: 'mediaIds: ["abc"]' },
        { type: 'done', conversationId: 'conv-1' },
      ]),
    )

    const { result } = renderHook(() => useLearningAgentChat({ gradeLevel: '7', locale: 'en' }))

    // No toast should have fired on the initial render.
    expect(toast.error).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.sendMessage('Show me a diagram')
    })

    await waitFor(
      () => {
        // The streamed reply is the LAST assistant message (welcome is first).
        const assistants = result.current.messages.filter((m) => m.role === 'assistant')
        const reply = assistants[assistants.length - 1]
        expect(reply.content).toContain('![alt text](https://example.com/diagram.svg)')
        expect(reply.content).toContain('mediaIds: ["abc"]')
      },
      { timeout: 5000 },
    )

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
    expect(result.current.conversationId).toBe('conv-1')
  })

  it('still completes the stream when the assistant reply is plain text with no images', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildStreamingResponse([
        { type: 'chunk', text: 'A ' },
        { type: 'chunk', text: 'plain ' },
        { type: 'chunk', text: 'reply.' },
        { type: 'done' },
      ]),
    )

    const { result } = renderHook(() => useLearningAgentChat({ gradeLevel: '7', locale: 'en' }))

    await act(async () => {
      await result.current.sendMessage('hello')
    })

    await waitFor(
      () => {
        const assistants = result.current.messages.filter((m) => m.role === 'assistant')
        const reply = assistants[assistants.length - 1]
        expect(reply.content).toBe('A plain reply.')
      },
      { timeout: 5000 },
    )

    expect(toast.error).not.toHaveBeenCalled()
  })
})
