'use client'

import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'
import { MessageSquare, X } from 'lucide-react'
import React, { useCallback, useEffect } from 'react'

interface MobileChatFABProps {
  /** Whether the chat surface controlled by this FAB is currently open. */
  isOpen: boolean
  /** Called when the chat surface should open. */
  onOpen: () => void
  /** Called when the chat surface should close. */
  onClose: () => void
  /** ChatInterface component rendered inside the default sheet panel. */
  children: React.ReactNode
  /** Use button-only when a parent renders its own full-screen chat transition. */
  panelMode?: 'sheet' | 'button-only'
}

/**
 * Mobile Chat FAB (Floating Action Button).
 *
 * Default behavior opens a bottom sheet. In exercise view, `button-only` lets the
 * same button trigger the full-screen swipe-to-chat transition owned upstream.
 */
export function MobileChatFAB({
  isOpen,
  onOpen,
  onClose,
  children,
  panelMode = 'sheet',
}: MobileChatFABProps) {
  const t = useTranslations('courses')

  useEffect(() => {
    if (!isOpen) return undefined

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    const handleFocusChatInput = () => onOpen()

    window.addEventListener('focus-chat-input', handleFocusChatInput)
    return () => window.removeEventListener('focus-chat-input', handleFocusChatInput)
  }, [onOpen])

  useEffect(() => {
    if (panelMode === 'button-only') return undefined

    const root = document.documentElement
    if (isOpen) {
      root.style.setProperty('--mobile-chat-panel-h', '60dvh')
    } else {
      root.style.removeProperty('--mobile-chat-panel-h')
    }

    return () => {
      root.style.removeProperty('--mobile-chat-panel-h')
    }
  }, [isOpen, panelMode])

  const handleToggle = useCallback(() => {
    if (isOpen) {
      onClose()
      return
    }

    onOpen()
  }, [isOpen, onClose, onOpen])

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        style={{ bottom: 'calc(var(--mobile-chat-panel-h, 0px) + 1.5rem)' }}
        className={cn(
          'fixed left-6 z-[70]',
          'w-14 h-14',
          'bg-primary text-primary-foreground rounded-full',
          'shadow-elevation-3 hover:scale-110 hover:bg-primary/90',
          'transition-all duration-normal flex items-center justify-center',
          'lg:hidden',
        )}
        aria-label={isOpen ? t('closeChat') : t('openChat')}
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>

      {panelMode === 'sheet' && isOpen && (
        <div
          className={cn(
            'fixed left-0 right-0 bottom-0 z-[60]',
            'bg-card border-t border-border',
            'h-[60dvh]',
            'flex flex-col overflow-hidden',
            'animate-in slide-in-from-bottom-0 duration-slow',
            'lg:hidden',
          )}
          role="dialog"
          aria-modal="false"
          aria-label={t('chatPanelTitle')}
        >
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
        </div>
      )}
    </>
  )
}
