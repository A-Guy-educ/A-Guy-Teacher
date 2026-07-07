/**
 * FloatingBugReportButton
 *
 * Mirrors the slot/positioning/styling of the (now-parked) FloatingAgentButton
 * so swapping the two doesn't disturb the layout or mobile chat-panel stacking.
 * Unlike its predecessor, this button renders for anonymous AND authenticated
 * users — bug reports must work for logged-out visitors too.
 *
 * Localization: the tooltip/aria-label is sourced from the `bugReport` i18n
 * namespace. Hebrew ("דווח תקלה") falls back to the key name when the
 * `bugReport` namespace is missing in the active messages file.
 *
 * @fileType component
 * @domain bug-report
 * @pattern floating-button
 */

'use client'

import { Bug } from 'lucide-react'

import { useTranslations } from '@/ui/web/providers/I18n'

interface FloatingBugReportButtonProps {
  onClick: () => void
}

export function FloatingBugReportButton({ onClick }: FloatingBugReportButtonProps) {
  const t = useTranslations('bugReport')
  const label = t('buttonLabel')
  const tooltip = t('tooltip')

  return (
    <button
      onClick={onClick}
      // Lift above the mobile chat panel when it's open. The
      // --mobile-chat-panel-h custom property is set by MobileChatFAB
      // (0px when closed, 60dvh when open) so this button always sits
      // 1.5rem above whichever bottom edge is current.
      style={{ bottom: 'calc(var(--mobile-chat-panel-h, 0px) + 1.5rem)' }}
      className="fixed right-6 z-[60] w-14 h-14 rounded-full bg-destructive text-destructive-foreground shadow-elevation-3 hover:scale-110 hover:bg-destructive/90 transition-all duration-normal flex items-center justify-center"
      aria-label={label}
      title={tooltip}
      data-testid="floating-bug-report-button"
    >
      <Bug className="w-6 h-6" />
    </button>
  )
}
