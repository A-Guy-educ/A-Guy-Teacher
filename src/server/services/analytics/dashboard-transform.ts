/**
 * Shape adapter for the external A-Guy Analytics dashboard.
 *
 * The dashboard's /api/track expects flat, camelCase events with `sessionId`
 * required, `ts` as unix ms, and known content fields (`courseId`,
 * `courseTitle`, `lessonType`) at the top level rather than nested inside
 * `properties` (see AguyDashboard/src/lib/events.ts). Our client tracker and
 * server helper both emit the older snake-case batch envelope Kody shipped,
 * so this transform is the single source of truth for translating between
 * the two shapes — used by /api/track (client batches) and by
 * trackServerEvent (server-side fires).
 *
 * If/when the dashboard schema is loosened to accept our native shape this
 * whole file becomes a no-op and can be deleted.
 */

import { randomUUID } from 'crypto'

export type InboundEvent = {
  event: string
  session_id?: string
  user_id?: string
  properties?: Record<string, unknown>
  occurred_at?: string
}

export type DashboardEvent = {
  event: string
  sessionId: string
  userId?: string
  source?: string
  courseId?: string
  courseTitle?: string
  lessonType?: string
  ts: number
  meta?: Record<string, unknown>
}

const PROMOTED_PROPERTY_KEYS = new Set([
  'course_id',
  'courseId',
  'course_title',
  'courseTitle',
  'lesson_type',
  'lessonType',
])

/**
 * Server-fired events (signup, course_enroll, oauth callback) have no
 * browser session but the dashboard schema requires sessionId. Group by
 * user when possible so a user's signup + enrollment share one "server"
 * session on the dashboard; otherwise fall back to a one-shot UUID.
 */
function synthesizeServerSessionId(userId?: string): string {
  return userId ? `server:${userId}` : `server:${randomUUID()}`
}

export function transformToDashboardEvent(
  event: InboundEvent,
  batchSessionId: string | undefined,
  batchSource: string | undefined,
): DashboardEvent {
  const props = event.properties ?? {}

  const readString = (key: string): string | undefined => {
    const value = props[key]
    return typeof value === 'string' && value.length > 0 ? value : undefined
  }

  const courseId = readString('courseId') ?? readString('course_id')
  const courseTitle = readString('courseTitle') ?? readString('course_title')
  const lessonType = readString('lessonType') ?? readString('lesson_type')

  const meta: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (PROMOTED_PROPERTY_KEYS.has(key)) continue
    meta[key] = value
  }

  const sessionId = event.session_id ?? batchSessionId ?? synthesizeServerSessionId(event.user_id)

  const tsCandidate = event.occurred_at ? Date.parse(event.occurred_at) : NaN
  const ts = Number.isFinite(tsCandidate) ? tsCandidate : Date.now()

  return {
    event: event.event,
    sessionId,
    ...(event.user_id ? { userId: event.user_id } : {}),
    ...(batchSource ? { source: batchSource } : {}),
    ...(courseId ? { courseId } : {}),
    ...(courseTitle ? { courseTitle } : {}),
    ...(lessonType ? { lessonType } : {}),
    ts,
    ...(Object.keys(meta).length > 0 ? { meta } : {}),
  }
}
