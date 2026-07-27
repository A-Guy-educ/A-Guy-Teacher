import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  callGeminiResiliently,
  callGeminiWithSchema,
  parseResponse,
  validateLesson,
} from '@/infra/llm/services/interactive-lesson/interactive-lesson-generation-service'

const lessonPayload = {
  title: 'Triangles',
  geometry: {
    width: 400,
    height: 300,
    points: [{ label: 'A', x: 10, y: 20 }],
    segments: [],
    angles: [],
    labels: [],
  },
  graph: { xRange: [-10, 10], yRange: [-10, 10], plots: [], markers: [] },
  numberLine: { range: [-10, 10], marks: [], intervals: [] },
  steps: [
    {
      id: 1,
      title: 'Read',
      claim: 'A is given',
      reason: 'Image',
      narration: 'Read point A',
      explanation: 'Point A is visible',
      durationSeconds: 5,
      highlightSegments: [],
      highlightPoints: ['A'],
      highlightPlots: [],
      highlightMarkers: [],
      highlightMarks: [],
      highlightIntervals: [],
    },
  ],
}

const geminiResponse = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const request = {
  apiKey: 'test-key',
  prompt: 'Create a lesson',
  attachmentData: 'aW1hZ2U=',
  attachmentMimeType: 'image/png',
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('interactive lesson Gemini generation', () => {
  it('preserves a schema-shaped response through parsing and validation', () => {
    const lesson = validateLesson(parseResponse(JSON.stringify(lessonPayload)), 'en')

    expect(lesson.title).toBe('Triangles')
    expect(lesson.geometry.points).toEqual([{ label: 'A', x: 10, y: 20 }])
    expect(lesson.steps[0].highlightPoints).toEqual(['A'])
  })

  it('sends the response schema in Gemini generationConfig', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(JSON.stringify(lessonPayload)))
    vi.stubGlobal('fetch', fetchMock)

    await callGeminiWithSchema(request)

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(init.body))
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseSchema).toMatchObject({ type: 'object' })
  })

  it('retries a transient Gemini 500 and returns the next response', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('temporary failure', { status: 500 }))
      .mockResolvedValueOnce(geminiResponse(JSON.stringify(lessonPayload)))
    vi.stubGlobal('fetch', fetchMock)

    const resultPromise = callGeminiResiliently(request)
    await vi.runAllTimersAsync()

    await expect(resultPromise).resolves.toBe(JSON.stringify(lessonPayload))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
