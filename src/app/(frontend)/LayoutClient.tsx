/**
 * Frontend Layout Client Component
 *
 * Handles client-side concerns for the frontend layout.
 * Emits system events for other services to subscribe to.
 */

'use client'

import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { restoreAccent } from '@/ui/web/components/accent-picker'
import { useEffect, useState } from 'react'

// PARKED — Learning agent files (FloatingAgentButton, AgentChatWindow, useLearningAgentChat)
// and /api/agent/learning-chat are intentionally not mounted while the bottom-right
// slot is repurposed for the "Report a Bug" widget. They remain on disk so we can
// revive the AI chat later without re-deriving the integration.
// import { FloatingAgentButton } from '@/ui/web/learning-agent/FloatingAgentButton'
// import { AgentChatWindow } from '@/ui/web/learning-agent/AgentChatWindow'

import { FloatingBugReportButton } from '@/ui/web/bug-report/FloatingBugReportButton'
import { BugReportForm } from '@/ui/web/bug-report/BugReportForm'

export function LayoutClient() {
  const [isBugReportOpen, setIsBugReportOpen] = useState(false)

  // Emit SITE_INIT once on mount
  // Other services (like analytics) subscribe to this event
  useEffect(() => {
    systemEventBus.emit(SYSTEM_EVENTS.SITE_INIT, {})
  }, [])

  // Restore user's saved accent color preference
  useEffect(() => {
    restoreAccent()
  }, [])

  // Clear the old offline worker so stale pages cannot hide fresh server data.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        )
        .catch(() => {})
    }
  }, [])

  return (
    <>
      <FloatingBugReportButton onClick={() => setIsBugReportOpen(true)} />
      <BugReportForm isOpen={isBugReportOpen} onClose={() => setIsBugReportOpen(false)} />
    </>
  )
}
