'use client'

import { consumeLessonOpenTimestamp } from '@/infra/analytics/utils/lesson-load-timing'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { useSetCurrentLesson } from '@/client/providers/ActiveTimeProvider'
import { useEffect, useRef } from 'react'

export type LessonContentType = 'pdf' | 'exercises' | 'blocks'

interface LessonAnalyticsProps {
  lessonId: string
  courseId: string
  lessonTitle: string
  contentType: LessonContentType
}

export function LessonAnalytics({
  lessonId,
  courseId,
  lessonTitle,
  contentType,
}: LessonAnalyticsProps) {
  const startTimeRef = useRef<number>(Date.now())
  const hasEmittedEndedRef = useRef<boolean>(false)

  // Register current lesson for per-lesson time tracking
  useSetCurrentLesson(lessonId)

  useEffect(() => {
    // Track lesson started
    startTimeRef.current = Date.now()
    hasEmittedEndedRef.current = false

    systemEventBus.emit(SYSTEM_EVENTS.LESSON_STARTED, {
      lesson_id: lessonId,
      course_id: courseId,
      lesson_title: lessonTitle,
    })

    // Persist the open for the admin dashboard's "top lessons opened"
    // widget. Fire-and-forget — never block the lesson render on this.
    //
    // sessionStorage dedupes per-tab so React Strict Mode double-invoke,
    // rapid client-side navigations back to the same lesson, and stale
    // effect re-runs don't inflate the count. sessionStorage is per-tab,
    // so a genuine new tab still counts (which matches the intent).
    const openedKey = `lesson-open-tracked:${lessonId}`
    if (typeof window !== 'undefined' && !window.sessionStorage.getItem(openedKey)) {
      try {
        window.sessionStorage.setItem(openedKey, '1')
      } catch {
        // Safari private mode etc. — proceed with the POST anyway.
      }
      void fetch('/api/stats/track-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'lesson_opened', lessonId }),
        credentials: 'include',
        keepalive: true,
      }).catch(() => {})
    }

    // Track lesson load success — calculate time since user clicked the link
    const clickTimestamp = consumeLessonOpenTimestamp(lessonId)
    const loadTimeMs = clickTimestamp ? Date.now() - clickTimestamp : 0

    systemEventBus.emit(SYSTEM_EVENTS.LESSON_LOAD_SUCCESS, {
      lesson_id: lessonId,
      content_type: contentType,
      load_time_ms: loadTimeMs,
      course_id: courseId,
    })

    // Track lesson ended on unmount (when user navigates away)
    return () => {
      // Prevent double emission in Strict Mode or rapid re-renders
      if (hasEmittedEndedRef.current) {
        return
      }
      hasEmittedEndedRef.current = true

      const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000)
      systemEventBus.emit(SYSTEM_EVENTS.LESSON_ENDED, {
        lesson_id: lessonId,
        course_id: courseId,
        duration_seconds: durationSeconds,
      })

      // Persist the session duration for the admin dashboard's
      // "avg time per lesson" + "session time by lesson type" widgets.
      // Only fire if the session was long enough to be meaningful —
      // Strict Mode double mount/unmount usually completes in ms.
      // Fire-and-forget, keepalive so it survives fast navigation.
      if (durationSeconds >= 1) {
        void fetch('/api/stats/track-activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'lesson_session_ended',
            lessonId,
            durationSeconds,
          }),
          credentials: 'include',
          keepalive: true,
        }).catch(() => {})
      }
    }
  }, [lessonId, courseId, lessonTitle, contentType])

  return null
}
