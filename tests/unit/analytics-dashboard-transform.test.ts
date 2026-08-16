/**
 * Unit tests for the shape adapter that translates Kody's snake_case batch
 * envelope into the flat, camelCase per-event shape the external dashboard's
 * /api/track requires.
 */

import { describe, expect, it } from 'vitest'

import { transformToDashboardEvent } from '@/server/services/analytics/dashboard-transform'

describe('transformToDashboardEvent', () => {
  it('renames snake_case fields and converts ISO occurred_at to unix ms', () => {
    const out = transformToDashboardEvent(
      {
        event: 'chat_message',
        session_id: 'sess-1',
        user_id: 'u1',
        occurred_at: '2025-01-01T00:00:00Z',
      },
      undefined,
      undefined,
    )

    expect(out).toEqual({
      event: 'chat_message',
      sessionId: 'sess-1',
      userId: 'u1',
      ts: Date.parse('2025-01-01T00:00:00Z'),
    })
  })

  it('promotes known content fields to top-level and puts the rest in meta', () => {
    const out = transformToDashboardEvent(
      {
        event: 'lesson_open',
        session_id: 'sess-1',
        properties: {
          course_id: 'c1',
          course_title: 'Algebra',
          lesson_type: 'practice',
          extra: 'anything',
          count: 42,
        },
        occurred_at: '2025-01-01T00:00:00Z',
      },
      undefined,
      undefined,
    )

    expect(out.courseId).toBe('c1')
    expect(out.courseTitle).toBe('Algebra')
    expect(out.lessonType).toBe('practice')
    expect(out.meta).toEqual({ extra: 'anything', count: 42 })
  })

  it('accepts already-camelCase property keys in addition to snake_case', () => {
    const out = transformToDashboardEvent(
      {
        event: 'lesson_open',
        session_id: 'sess-1',
        properties: { courseId: 'c2', lessonType: 'exam' },
      },
      undefined,
      undefined,
    )

    expect(out.courseId).toBe('c2')
    expect(out.lessonType).toBe('exam')
    expect(out.meta).toBeUndefined()
  })

  it('falls back to the batch envelope sessionId and source when per-event lacks them', () => {
    const out = transformToDashboardEvent({ event: 'chat_message' }, 'batch-session', 'google')

    expect(out.sessionId).toBe('batch-session')
    expect(out.source).toBe('google')
  })

  it('synthesizes a stable server sessionId from user_id when no session context exists', () => {
    const a = transformToDashboardEvent({ event: 'signup', user_id: 'u1' }, undefined, undefined)
    const b = transformToDashboardEvent(
      { event: 'course_enroll', user_id: 'u1' },
      undefined,
      undefined,
    )

    // Same user's server events share one "server:<userId>" session so the
    // dashboard groups them under one row rather than fabricating two.
    expect(a.sessionId).toBe('server:u1')
    expect(b.sessionId).toBe('server:u1')
  })

  it('synthesizes a one-shot server sessionId when there is neither session nor user', () => {
    const out = transformToDashboardEvent({ event: 'signup' }, undefined, undefined)
    expect(out.sessionId).toMatch(/^server:/)
    expect(out.sessionId.length).toBeGreaterThan('server:'.length + 8)
  })

  it('falls back to Date.now() when occurred_at is missing or unparseable', () => {
    const before = Date.now()
    const out = transformToDashboardEvent(
      { event: 'session_start', session_id: 'sess-1', occurred_at: 'not-a-date' },
      undefined,
      undefined,
    )
    const after = Date.now()

    expect(out.ts).toBeGreaterThanOrEqual(before)
    expect(out.ts).toBeLessThanOrEqual(after)
  })

  it('omits optional fields when they are not present', () => {
    const out = transformToDashboardEvent(
      { event: 'session_heartbeat', session_id: 'sess-1' },
      undefined,
      undefined,
    )

    expect(out).toEqual({
      event: 'session_heartbeat',
      sessionId: 'sess-1',
      ts: expect.any(Number),
    })
    // Sanity: no stray keys
    expect(Object.keys(out).sort()).toEqual(['event', 'sessionId', 'ts'])
  })
})
