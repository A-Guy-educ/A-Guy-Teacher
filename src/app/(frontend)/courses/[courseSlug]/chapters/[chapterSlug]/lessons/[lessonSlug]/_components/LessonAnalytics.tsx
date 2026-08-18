'use client'

import { consumeLessonOpenTimestamp } from '@/infra/analytics/utils/lesson-load-timing'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { useSetCurrentLesson } from '@/client/providers/ActiveTimeProvider'
import { syncCurrentCourse } from '@/infra/analytics/utils/currentCourseSync'
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

      // Opening a lesson is a strong signal that the user is on this
      // course right now — refresh currentCourse (and lastLoginAt) on
      // Admin. Deliberately overwrites any prior server value: a live
      // lesson open is the freshest signal we have.
      syncCurrentCourse(courseId)
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
    // Session lifecycle is keyed on lessonId only. courseId / lessonTitle
    // / contentType are all derived from the same route params so they
    // never change independently in practice; including them would cause
    // spurious session teardown + restart if a parent re-render updated
    // one of them (see PR #1089 review). Values inside the effect are a
    // stale closure of the initial props, which is fine given the above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  return null
}
