import { NextRequest } from 'next/server'
import { z } from 'zod'

import { getWebUser } from '@/infra/web-api/mongo-payload'
import { pushActivity } from '@/server/services/dashboard-stats'
import {
  findUserProgress,
  getOrCreateUserStats,
  upsertUserProgress,
  type ProgressRecord,
} from '@/server/web-api/progress'

const BodySchema = z.discriminatedUnion('eventType', [
  z.object({
    eventType: z.literal('lesson_completed'),
    lessonId: z.string().min(1),
    lessonTitle: z.string().optional(),
  }),
  z.object({
    eventType: z.literal('exercise_completed'),
    exerciseId: z.string().min(1),
    exerciseTitle: z.string().optional(),
    lessonId: z.string().optional(),
    score: z.number().min(0).max(100),
    totalQuestions: z.number().min(1),
    correctCount: z.number().min(0),
  }),
  z.object({
    eventType: z.literal('exercise_attempted'),
    exerciseId: z.string().min(1),
    exerciseTitle: z.string().optional(),
    lessonId: z.string().optional(),
  }),
])

function activityFor(data: z.infer<typeof BodySchema>) {
  const timestamp = new Date().toISOString()
  if (data.eventType === 'lesson_completed') {
    return {
      actionType: 'lesson_completed',
      label: data.lessonTitle || `Lesson ${data.lessonId}`,
      targetId: data.lessonId,
      targetCollection: 'lessons',
      timestamp,
    }
  }
  return {
    actionType: data.eventType,
    label: data.exerciseTitle || `Exercise ${'score' in data ? `(${data.score}%)` : ''}`.trim(),
    targetId: data.exerciseId,
    targetCollection: 'exercises',
    timestamp,
  }
}

function progressRecord(data: z.infer<typeof BodySchema>): ProgressRecord {
  if (data.eventType === 'lesson_completed') {
    return {
      recordType: 'lesson',
      recordId: data.lessonId,
      status: 'completed',
      completionPercentage: 100,
      lastAccessedAt: new Date().toISOString(),
    }
  }
  const score =
    data.eventType === 'exercise_completed'
      ? Math.round((data.correctCount / data.totalQuestions) * 100)
      : undefined
  return {
    recordType: 'exercise',
    recordId: data.exerciseId,
    status: data.eventType === 'exercise_completed' ? 'completed' : 'in_progress',
    completionPercentage: data.eventType === 'exercise_completed' ? 100 : 0,
    ...(score !== undefined ? { score } : {}),
    lastAccessedAt: new Date().toISOString(),
  }
}

export async function POST(request: NextRequest) {
  const user = await getWebUser(request.headers)
  if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const stats = await getOrCreateUserStats(user.id)
  await pushActivity(stats?._id, activityFor(parsed.data))

  const gradeLevel = 'default'
  const progress = await findUserProgress(user.id, gradeLevel)
  const records = [...(progress?.progressRecords ?? [])]
  const next = progressRecord(parsed.data)
  const index = records.findIndex(
    (record) => record.recordType === next.recordType && record.recordId === next.recordId,
  )
  if (index >= 0) {
    const existing = records[index]
    const shouldUpdate = existing.status !== 'completed' || next.status === 'completed'
    records[index] = shouldUpdate
      ? { ...existing, ...next }
      : { ...existing, lastAccessedAt: next.lastAccessedAt }
  } else {
    records.push(next)
  }

  await upsertUserProgress(user.id, gradeLevel, { progressRecords: records })
  return Response.json({ success: true })
}
