import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { geminiCall } = vi.hoisted(() => ({ geminiCall: vi.fn() }))

vi.mock('@/server/auth/api-auth', () => ({
  requireUser: vi.fn(async () => ({ ok: true, value: { id: 'user-1' } })),
  enforceUserChatQuota: vi.fn(async () => ({ ok: true })),
}))

vi.mock('@/infra/security/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ allowed: true })),
  rateLimitExceededResponse: vi.fn(),
}))

vi.mock('@/infra/db/content-db', () => ({
  objectIdFromString: (id: string) => id,
  getContentDb: vi.fn(async () => ({
    collection: () => ({
      findOne: vi.fn(async () => ({
        _id: 'media-1',
        url: 'https://media.test/problem.png',
        mimeType: 'image/png',
      })),
    }),
  })),
}))

vi.mock(
  '@/infra/llm/services/interactive-lesson/interactive-lesson-generation-service',
  async () => {
    const actual = await vi.importActual<
      typeof import('@/infra/llm/services/interactive-lesson/interactive-lesson-generation-service')
    >('@/infra/llm/services/interactive-lesson/interactive-lesson-generation-service')
    return {
      ...actual,
      callGeminiResiliently: geminiCall,
      prepareImage: vi.fn(async (buffer: Buffer) => ({
        attachmentData: buffer.toString('base64'),
        sizeBytes: buffer.length,
      })),
    }
  },
)

const generatedLesson = {
  title: 'Generated geometry lesson',
  geometry: { width: 400, height: 300, points: [], segments: [], angles: [], labels: [] },
  graph: { xRange: [-10, 10], yRange: [-10, 10], plots: [], markers: [] },
  numberLine: { range: [-10, 10], marks: [], intervals: [] },
  steps: [
    {
      id: 1,
      title: 'Generated step',
      claim: 'claim',
      reason: 'reason',
      narration: 'narration',
      explanation: 'explanation',
      durationSeconds: 5,
      highlightSegments: [],
      highlightPoints: [],
      highlightPlots: [],
      highlightMarkers: [],
      highlightMarks: [],
      highlightIntervals: [],
    },
  ],
}

function request() {
  return new NextRequest('http://localhost/api/agent/generate-interactive-lesson', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mediaId: 'media-1', locale: 'en' }),
  })
}

describe('POST /api/agent/generate-interactive-lesson', () => {
  beforeEach(() => {
    geminiCall.mockReset()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))),
    )
    process.env.GEMINI_API_KEY = 'test-key'
  })

  it('returns the validated Gemini lesson instead of the placeholder', async () => {
    geminiCall.mockResolvedValue(JSON.stringify(generatedLesson))
    const { POST } = await import('@/app/api/agent/generate-interactive-lesson/route')

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.title).toBe('Generated geometry lesson')
    expect(body.data.steps[0].title).toBe('Generated step')
  })

  it('returns the placeholder when Gemini ultimately fails', async () => {
    geminiCall.mockRejectedValue(new Error('Gemini unavailable'))
    const { POST } = await import('@/app/api/agent/generate-interactive-lesson/route')

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.title).toBe('Visual explanation')
    expect(body.metadata.model).toBe('gemini-2.5-flash')
  })
})
