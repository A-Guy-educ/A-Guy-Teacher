import { NextRequest } from 'next/server'
import { z } from 'zod'

import { getWebUser } from '@/infra/web-api/mongo-payload'
import { recordStudyTime } from '@/server/services/dashboard-stats'
import {
  findUserProgress,
  getOrCreateUserStats,
  upsertUserProgress,
  type ProgressRecord,
} from '@/server/web-api/progress'

const BodySchema = z.object({
  seconds: z.number().min(1).max(120),
  lessonId: z.string().min(1).optional(),
})

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
  const totalTimeSpentSeconds = Number(stats?.totalTimeSpentSeconds || 0) + parsed.data.seconds
  await recordStudyTime(stats?._id, totalTimeSpentSeconds)

  if (parsed.data.lessonId) {
    const gradeLevel = 'default'
    const progress = await findUserProgress(user.id, gradeLevel)
    const records = [...(progress?.progressRecords ?? [])]
    const index = records.findIndex(
      (record) => record.recordType === 'lesson' && record.recordId === parsed.data.lessonId,
    )
    const now = new Date().toISOString()
    if (index >= 0) {
      records[index] = {
        ...records[index],
        timeSpentSeconds: (records[index].timeSpentSeconds || 0) + parsed.data.seconds,
        lastAccessedAt: now,
      }
    } else {
      records.push({
        recordType: 'lesson',
        recordId: parsed.data.lessonId,
        status: 'in_progress',
        completionPercentage: 0,
        timeSpentSeconds: parsed.data.seconds,
        lastAccessedAt: now,
      } satisfies ProgressRecord)
    }
    await upsertUserProgress(user.id, gradeLevel, { progressRecords: records })
  }

  return Response.json({ success: true, totalTimeSpentSeconds })
}
