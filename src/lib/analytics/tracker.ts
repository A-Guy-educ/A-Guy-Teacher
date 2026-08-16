/**
 * Client-side analytics tracker for the external dashboard pipeline.
 *
 * - Buffers events in memory and flushes when 50 events accumulate OR after
 *   a 5-second window, whichever comes first.
 * - On `visibilitychange → hidden`, the buffer is sent via
 *   navigator.sendBeacon so the page can navigate away / close without losing
 *   events. Falls back to fetch keepalive when sendBeacon rejects the body.
 * - When the kill-switch is off, every entry point (`track`, `flush`,
 *   sendBeacon fallback) is a no-op — no queue, no fetch, no sendBeacon.
 * - Every error from the network is swallowed.
 */

import { getOrCreateSessionId, resolveSource } from './session'

export type AnalyticsEvent = {
  event: string
  user_id?: string
  properties?: Record<string, unknown>
  occurred_at: string
}

export type AnalyticsBatch = {
  session_id: string
  source: string
  sent_at: string
  events: AnalyticsEvent[]
}

const MAX_BATCH_SIZE = 50
const FLUSH_INTERVAL_MS = 5_000
const TRACK_ENDPOINT = '/api/track'

let buffer: AnalyticsEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushListenersAttached = false
let resolvedSource: string | null = null

function isEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true'
}

function nowIso(): string {
  return new Date().toISOString()
}

function captureContext(): { session_id: string; source: string } {
  if (resolvedSource === null) {
    resolvedSource = resolveSource()
  }
  return { session_id: getOrCreateSessionId(), source: resolvedSource }
}

async function sendBatch(batch: AnalyticsBatch): Promise<void> {
  if (typeof window === 'undefined') return

  const body = JSON.stringify(batch)
  const blob = new Blob([body], { type: 'application/json' })

  // Prefer sendBeacon (survives page unload). It returns false when the
  // browser refuses the body — fall back to fetch with keepalive so the
  // event still goes out.
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const beaconOk = navigator.sendBeacon(TRACK_ENDPOINT, blob)
    if (beaconOk) return
  }

  try {
    await fetch(TRACK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'include',
      cache: 'no-store',
    })
  } catch {
    // Swallowed — analytics must not break the user flow.
  }
}

function scheduleFlush(): void {
  if (flushTimer !== null) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flush()
  }, FLUSH_INTERVAL_MS)
}

function attachFlushListeners(): void {
  if (flushListenersAttached || typeof window === 'undefined') return
  flushListenersAttached = true

  const handler = () => {
    if (document.visibilityState === 'hidden') {
      void flush()
    }
  }
  document.addEventListener('visibilitychange', handler)

  window.addEventListener('pagehide', () => {
    void flush()
  })
}

export async function flush(): Promise<void> {
  if (!isEnabled()) {
    buffer = []
    if (flushTimer !== null) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    return
  }

  if (buffer.length === 0) return

  const events = buffer
  buffer = []
  if (flushTimer !== null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }

  const ctx = captureContext()
  await sendBatch({
    session_id: ctx.session_id,
    source: ctx.source,
    sent_at: nowIso(),
    events,
  })
}

export function track(
  event: string,
  options?: { user_id?: string; properties?: Record<string, unknown> },
): void {
  if (!isEnabled()) return
  attachFlushListeners()

  const entry: AnalyticsEvent = {
    event,
    occurred_at: nowIso(),
    user_id: options?.user_id,
    properties: options?.properties,
  }
  buffer.push(entry)

  if (buffer.length >= MAX_BATCH_SIZE) {
    void flush()
  } else {
    scheduleFlush()
  }
}

/**
 * Test-only / admin helper. Forcibly clears the in-memory buffer.
 */
export function _resetTrackerForTesting(): void {
  buffer = []
  resolvedSource = null
  if (flushTimer !== null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
}

export const __test__ = { MAX_BATCH_SIZE, FLUSH_INTERVAL_MS }
