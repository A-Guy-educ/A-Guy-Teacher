/**
 * @fileType api-route
 * @domain lessons
 * @pattern admin-content-import
 * @ai-summary Admin-only structured import for lesson introduction text and rich-text/LaTeX blocks.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { updateLessonIntro } from '@/server/services/lessons'
import { getWebUser } from '@/infra/web-api/mongo-payload'

const IntroBlockSchema = z.discriminatedUnion('type', [
  z
    .object({
      id: z.string().min(1),
      type: z.literal('rich_text'),
      format: z.literal('md-math-v1'),
      value: z.string().min(1),
      mediaIds: z.array(z.string()).default([]),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal('latex'),
      latex: z.string().min(1),
      renderMode: z.enum(['block', 'inline']).optional(),
    })
    .strict(),
])

const BodySchema = z
  .object({
    lessonId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .optional(),
    lessonSlug: z.string().min(1).optional(),
    lessonContextText: z.string().min(1).optional(),
    blocks: z.array(IntroBlockSchema).min(1).optional(),
  })
  .strict()
  .refine((data) => Boolean(data.lessonId) !== Boolean(data.lessonSlug), {
    message: 'Provide exactly one of lessonId or lessonSlug',
    path: ['lessonId'],
  })
  .refine((data) => data.lessonContextText !== undefined || data.blocks !== undefined, {
    message: 'Provide lessonContextText or blocks',
    path: ['lessonContextText'],
  })

export async function POST(request: NextRequest) {
  const user = await getWebUser(request.headers)
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin' && !user.roles?.includes('admin')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid lesson intro payload', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { lessonId, lessonSlug, lessonContextText, blocks } = parsed.data
  const update: Record<string, unknown> = {}
  if (lessonContextText !== undefined) update.lessonContextText = lessonContextText
  if (blocks !== undefined) update.blocks = blocks

  const result = await updateLessonIntro({ lessonId, lessonSlug }, update)

  if (!result) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

  return NextResponse.json({
    success: true,
    lesson: {
      id: String(result._id),
      slug: result.slug ?? null,
      lessonContextText: result.lessonContextText ?? null,
      blocks: result.blocks ?? null,
    },
  })
}
