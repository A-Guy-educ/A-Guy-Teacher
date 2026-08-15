import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('@/infra/db/content-db', () => ({
  getContentDb: vi.fn(),
  objectIdFromString: (id: string) => id,
  serializeDoc: (doc: unknown) => doc,
}))

vi.mock('@/infra/config/storage', () => ({
  resolveMediaFilePath: (filename: string) => `/tmp/${filename}`,
}))

import { getContentDb } from '@/infra/db/content-db'
import { buildGeminiUserParts, generateAssistantReply } from '@/server/web-api/chat'

const getContentDbMock = getContentDb as Mock

function collection(name: string) {
  return {
    findOne: vi.fn(async () => {
      if (name === 'lessons') {
        return { lessonContextText: 'A right triangle has one 90-degree angle.' }
      }
      return null
    }),
    find: vi.fn(() => ({
      toArray: vi.fn(async () => {
        if (name === 'chat-assets') {
          return [
            {
              _id: '65f000000000000000000001',
              originalFilename: 'triangle.png',
              mimeType: 'image/png',
              filesize: 68,
              url: 'https://blob.example/triangle.png',
            },
          ]
        }

        return []
      }),
    })),
  }
}

describe('web chat vision attachments', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.GEMINI_API_KEY = 'test-key'
    process.env.LLM_MODEL_OVERRIDE_EXERCISE_CHAT = 'gemini-test'
    getContentDbMock.mockResolvedValue({ collection })
  })

  it('puts inline image data into the Gemini request', async () => {
    const imageBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
    const imageBuffer = Buffer.from(imageBase64, 'base64')
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === 'https://blob.example/triangle.png') {
        return new Response(imageBuffer, { headers: { 'Content-Type': 'image/png' } })
      }

      const body = JSON.parse(String(init?.body)) as {
        contents: Array<{
          parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>
        }>
      }
      expect(body.contents[0]?.parts[0]?.inlineData).toEqual({
        mimeType: 'image/png',
        data: imageBase64,
      })
      expect(body.contents[0]?.parts.at(-1)?.text).toContain('Attached file: triangle.png')

      return Response.json({
        candidates: [{ content: { parts: [{ text: 'I can see the triangle.' }] } }],
      })
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      generateAssistantReply({
        message: 'What is in the image?',
        chatAssetIds: ['65f000000000000000000001'],
      }),
    ).resolves.toBe('I can see the triangle.')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps text-only prompts text-only', () => {
    expect(buildGeminiUserParts('hello', [])).toEqual([{ text: 'hello' }])
  })

  it('includes extracted lesson context in the Gemini prompt', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        contents: Array<{ parts: Array<{ text?: string }> }>
      }
      expect(body.contents[0]?.parts.at(-1)?.text).toContain(
        'A right triangle has one 90-degree angle.',
      )

      return Response.json({
        candidates: [{ content: { parts: [{ text: 'The lesson says it is a right triangle.' }] } }],
      })
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      generateAssistantReply({
        message: 'What does this lesson explain?',
        lessonId: '65f000000000000000000002',
      }),
    ).resolves.toBe('The lesson says it is a right triangle.')
  })
})
