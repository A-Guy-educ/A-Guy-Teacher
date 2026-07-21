import { NextRequest } from 'next/server'
import { z } from 'zod'

import { enforceUserChatQuota, requireUser } from '@/server/auth/api-auth'

const BodySchema = z.object({
  questionId: z.string().min(1),
  questionText: z.string().min(1),
  acceptedAnswers: z.array(z.string().min(1)).min(1),
  studentAnswer: z.string(),
  questionType: z.string().optional(),
  questionVariant: z.string().optional(),
})

function normalize(input: string) {
  return input.toLowerCase().trim().replace(/\s+/g, ' ')
}

function numeric(input: string) {
  const stripped = input.replace(/[,%\s]/g, '').trim()
  if (!stripped) return null
  const value = Number(stripped)
  return Number.isFinite(value) ? value : null
}

function localMatch(studentAnswer: string, acceptedAnswers: string[]) {
  const studentNorm = normalize(studentAnswer)
  const studentNum = numeric(studentAnswer)

  for (const accepted of acceptedAnswers) {
    if (studentNorm === normalize(accepted)) return { matched: true, matchType: 'exact' }

    const acceptedNum = numeric(accepted)
    if (
      studentNum !== null &&
      acceptedNum !== null &&
      Math.abs(studentNum - acceptedNum) < 0.0001
    ) {
      return { matched: true, matchType: 'numeric' }
    }
  }

  return { matched: false }
}

async function semanticMatch(input: z.infer<typeof BodySchema>) {
  if (!process.env.GEMINI_API_KEY) return null

  const prompt = [
    'Return strict JSON: {"isCorrect": boolean, "reasoning": string}.',
    'Decide whether the student answer is semantically equivalent to one accepted answer.',
    `Question: ${input.questionText}`,
    `Accepted answers: ${JSON.stringify(input.acceptedAnswers)}`,
    `Student answer: ${input.studentAnswer}`,
  ].join('\n')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
        },
      }),
    },
  )

  if (!response.ok) return null
  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text =
    json.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join('') ?? ''
  if (!text) return null
  const parsed = JSON.parse(text) as { isCorrect?: unknown; reasoning?: unknown }
  return { isCorrect: Boolean(parsed.isCorrect), reasoning: String(parsed.reasoning ?? '') }
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ success: false, error: 'Validation failed' }, { status: 400 })
  }

  const quota = await enforceUserChatQuota(auth.value.id)
  if (!quota.ok) return quota.response

  const exact = localMatch(parsed.data.studentAnswer, parsed.data.acceptedAnswers)
  if (exact.matched) {
    return Response.json({
      success: true,
      data: { isCorrect: true, matchType: exact.matchType },
    })
  }

  const semantic = await semanticMatch(parsed.data).catch(() => null)
  return Response.json({
    success: true,
    data: {
      isCorrect: semantic?.isCorrect ?? false,
      matchType: semantic ? 'semantic' : 'none',
      reasoning: semantic?.reasoning,
    },
  })
}
