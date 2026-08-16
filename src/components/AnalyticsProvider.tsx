/**
 * AnalyticsProvider — external-dashboard pipeline.
 *
 * Mounted once near the app root. When NEXT_PUBLIC_ANALYTICS_ENABLED is not
 * exactly "true" the provider renders no interval and emits no events.
 *
 * Behavior when enabled:
 *  - On first mount, fires session_start (executed exactly once per session;
 *    subsequent mounts in the same tab no-op via sessionStorage gate).
 *  - While document.visibilityState === 'visible', emits session_heartbeat
 *    every 30 seconds. The interval is paused while the tab is hidden so a
 *    backgrounded tab does not generate fake-active data.
 *  - On unmount, clears its interval so the heartbeat stops immediately.
 */

'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics/tracker'
import { getOrCreateSessionId } from '@/lib/analytics/session'

const HEARTBEAT_INTERVAL_MS = 30_000
const SESSION_STARTED_KEY = 'aguy_session_started'

interface AnalyticsProviderProps {
  children: React.ReactNode
}

function isEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true'
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isEnabled()) return

    const sessionId = getOrCreateSessionId()

    // session_start fires once per tab session.
    if (!sessionStorage.getItem(SESSION_STARTED_KEY)) {
      sessionStorage.setItem(SESSION_STARTED_KEY, '1')
      track('session_start', {
        properties: { session_id: sessionId },
      })
    }

    const heartbeat = () => {
      if (document.visibilityState !== 'visible') return
      track('session_heartbeat', {
        properties: { session_id: sessionId },
      })
    }

    const intervalId = window.setInterval(heartbeat, HEARTBEAT_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  return <>{children}</>
}
