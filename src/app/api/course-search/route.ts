import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { rateLimit, rateLimitExceededResponse } from '@/infra/security/rate-limit'
import { enforceUserChatQuota, requireUser } from '@/server/auth/api-auth'
import { getCourseSearchResults } from '@/server/services/course-search-service'

const searchParamsSchema = z.object({
  q: z.string().min(2).max(200),
  courseSlug: z.string().min(1).optional(),
})

const COURSE_SEARCH_RATE_LIMIT_MAX = 30
const COURSE_SEARCH_RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute

export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  const rate = await rateLimit({
    key: `user:${auth.value.id}:course-search`,
    limit: COURSE_SEARCH_RATE_LIMIT_MAX,
    windowMs: COURSE_SEARCH_RATE_LIMIT_WINDOW_MS,
  })
  if (!rate.allowed) return rateLimitExceededResponse(rate)

  const parsed = searchParamsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const quota = await enforceUserChatQuota(auth.value.id)
  if (!quota.ok) return quota.response

  const { q: query, courseSlug } = parsed.data
  const results = await getCourseSearchResults({ query, courseSlug })
  if (!results) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  return NextResponse.json(results)
}
