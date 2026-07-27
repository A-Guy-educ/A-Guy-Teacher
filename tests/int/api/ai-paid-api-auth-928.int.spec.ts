/**
 * Integration tests: Auth gating on AI / paid-API routes (issue #928)
 *
 * The issue called out these routes as unauthenticated / unthrottled:
 *  - /api/tts/synthesize (Google Cloud TTS)
 *  - /api/exercises/validate-answer (Gemini)
 *  - /api/agent/generate-interactive-lesson (Gemini + image)
 *  - /api/course-search (embedding/search)
 *  - /api/agent/chat-quota (fake-quota endpoint)
 *
 * Acceptance criterion: anonymous calls to all listed routes are rejected
 * (401) or capped by a real guest quota. This file covers the 401 path
 * for the routes that must require auth. Guest-quota coverage for the
 * guest-allowed routes (chat/chat-stream/learning-chat) lives in their
 * existing /api/bug-report-style tests.
 *
 * Mirrors the route-import pattern in tests/int/api/bug-report.int.spec.ts:
 * mock external services, hit the route handlers directly with NextRequest.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

// Mock the AI service before importing the route so the route picks up the
// stubbed module.
vi.mock('@/infra/llm/services/interactive-lesson/interactive-lesson-generation-service', () => ({
  callGeminiResiliently: vi.fn(async () => null),
  GEMINI_CONFIG: { modelName: 'mock-gemini' },
  parseResponse: vi.fn(() => null),
  prepareImage: vi.fn(async (buffer: Buffer) => ({
    attachmentData: buffer.toString('base64'),
    sizeBytes: buffer.length,
  })),
  validateLesson: vi.fn(() => ({
    title: 'mock',
    locale: 'he',
    geometry: { width: 0, height: 0, points: [], segments: [], angles: [], labels: [] },
    graph: { xRange: [0, 0], yRange: [0, 0], plots: [], markers: [] },
    numberLine: { range: [0, 0], marks: [], intervals: [] },
    steps: [],
  })),
}))

vi.mock('@/server/web-api/chat', () => ({
  appendMessage: vi.fn(async () => undefined),
  generateAssistantReply: vi.fn(async () => 'mock-reply'),
  getOrCreateConversation: vi.fn(async () => ({ id: 'mock-conv', messages: [] })),
  resolveContextKey: vi.fn(() => 'lessons:mock'),
  toSse: vi.fn(
    (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  ),
}))

// Stub getPayload so api-auth.ts can call it without booting Payload/the
// mongo container — the route should reject with 401 before any DB access.
vi.mock('@/infra/types/backend', async () => {
  const actual =
    await vi.importActual<typeof import('@/infra/types/backend')>('@/infra/types/backend')
  return {
    ...actual,
    getPayload: vi.fn(async () => ({ db: { collections: {} } })),
  }
})

function makeRequest(url: string, init: RequestInit = {}): NextRequest {
  return new NextRequest(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers as Record<string, string>) },
  })
}

describe('AI / paid-API routes — anonymous → 401 (issue #928)', () => {
  it('/api/tts/synthesize rejects anonymous', async () => {
    const { POST } = await import('@/app/api/tts/synthesize/route')
    const res = await POST(
      makeRequest('http://localhost/api/tts/synthesize', {
        method: 'POST',
        body: JSON.stringify({ text: 'hello', locale: 'en' }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('/api/exercises/validate-answer rejects anonymous', async () => {
    const { POST } = await import('@/app/api/exercises/validate-answer/route')
    const res = await POST(
      makeRequest('http://localhost/api/exercises/validate-answer', {
        method: 'POST',
        body: JSON.stringify({
          questionId: 'q1',
          questionText: '2+2?',
          acceptedAnswers: ['4'],
          studentAnswer: '4',
        }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('/api/agent/generate-interactive-lesson rejects anonymous', async () => {
    const { POST } = await import('@/app/api/agent/generate-interactive-lesson/route')
    const res = await POST(
      makeRequest('http://localhost/api/agent/generate-interactive-lesson', {
        method: 'POST',
        body: JSON.stringify({ mediaId: 'm1', locale: 'he' }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('/api/course-search rejects anonymous', async () => {
    const { GET } = await import('@/app/api/course-search/route')
    const res = await GET(makeRequest('http://localhost/api/course-search?q=test'))
    expect(res.status).toBe(401)
  })

  it('/api/agent/chat-quota rejects anonymous', async () => {
    const { GET } = await import('@/app/api/agent/chat-quota/route')
    const res = await GET(makeRequest('http://localhost/api/agent/chat-quota'))
    expect(res.status).toBe(401)
  })
})
