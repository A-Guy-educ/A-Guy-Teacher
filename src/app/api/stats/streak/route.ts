import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getContentDb } from '@/infra/db/content-db'
import { getWebUser } from '@/infra/web-api/mongo-payload'
import { getOrCreateUserStats } from '@/server/web-api/progress'

const SearchParamsSchema = z.object({
  timeZone: z
    .string()
    .min(1)
    .refine(
      (timeZone) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone }).format()
          return true
        } catch {
          return false
        }
      },
      { message: 'Invalid IANA timezone' },
    ),
})

function ymdInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function previousYmd(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  const previous = new Date(Date.UTC(year, month - 1, day - 1))
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(
    2,
    '0',
  )}-${String(previous.getUTCDate()).padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  const user = await getWebUser(request.headers)
  if (!user?.id) return NextResponse.json({ streak: 0 })
  const stats = await getOrCreateUserStats(user.id)
  return NextResponse.json({
    streak: Number(stats?.currentStreak || 0),
    currentStreak: Number(stats?.currentStreak || 0),
    longestStreak: Number(stats?.longestStreak || 0),
  })
}

export async function POST(request: NextRequest) {
  const user = await getWebUser(request.headers)
  if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = SearchParamsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid parameters', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const today = ymdInTimeZone(new Date(), parsed.data.timeZone)
  const yesterday = previousYmd(today)
  const stats = await getOrCreateUserStats(user.id)

  if (stats?.lastActiveDate === today) {
    return Response.json({
      success: true,
      currentStreak: Number(stats.currentStreak || 0),
      longestStreak: Number(stats.longestStreak || 0),
    })
  }

  const currentStreak =
    stats?.lastActiveDate === yesterday ? Number(stats.currentStreak || 0) + 1 : 1
  const longestStreak = Math.max(Number(stats?.longestStreak || 0), currentStreak)
  const db = await getContentDb()
  await db.collection('user-stats').updateOne(
    { _id: stats?._id },
    {
      $set: {
        currentStreak,
        longestStreak,
        lastActiveDate: today,
        updatedAt: new Date(),
      },
    },
  )

  return Response.json({ success: true, currentStreak, longestStreak })
}
