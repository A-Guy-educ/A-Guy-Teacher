'use client'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import { isRTL } from '@/i18n/config'
import { cn } from '@/infra/utils/ui'
import type { FormulaSheet } from '@/infra/types/content'
import { FormulaSheetContent } from '@/ui/web/shared/FormulaSheetViewer/FormulaSheetContent'
import { type MobileExerciseViewMode, SplitPaneLayout } from '@/ui/web/components/split-pane-layout'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Minimize2,
  PenLine,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import React, { useCallback, useState, type ReactElement } from 'react'
import { ExerciseHeader } from '../ExerciseHeader'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import { motion, AnimatePresence } from 'framer-motion'

type HelpTab = 'hint' | 'guiding' | 'chat' | 'formulas' | 'notes'

interface MobileChatPanelProps {
  chatContent: ReactElement
  displayMode?: 'full' | 'input-only'
  isMobile?: boolean
  viewMode?: 'PDF' | 'Chat'
  onModeToggle?: () => void
  onChatInteraction?: () => void
  onBackToExercise: () => void
}

function MobileChatPanel({
  chatContent,
  displayMode,
  isMobile,
  viewMode,
  onModeToggle,
  onChatInteraction,
  onBackToExercise,
}: MobileChatPanelProps) {
  const t = useTranslations('courses')
  const locale = useLocale()
  const rtl = isRTL(locale as 'en' | 'he')
  const ArrowIcon = rtl ? ArrowRight : ArrowLeft

  return (
    <div className="h-full flex flex-col">
      <div className="lg:hidden flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-card border-b border-border">
        <button
          type="button"
          onClick={onBackToExercise}
          aria-label={t('backToExercise')}
          className={cn(
            'flex items-center gap-2 p-2 -ms-2 rounded-md',
            'hover:bg-muted transition-colors duration-normal',
            'text-body-sm font-medium cursor-pointer text-foreground hover:text-primary',
          )}
        >
          <ArrowIcon className="w-5 h-5" />
          <span>{t('backToExercise')}</span>
        </button>
      </div>
      <div className="flex-1 min-h-0">
        {React.cloneElement(
          chatContent as React.ReactElement<{
            displayMode?: 'full' | 'input-only'
            isMobile?: boolean
            viewMode?: 'PDF' | 'Chat'
            onModeToggle?: () => void
            onChatInteraction?: () => void
          }>,
          {
            displayMode,
            isMobile,
            viewMode,
            onModeToggle,
            onChatInteraction,
          },
        )}
      </div>
    </div>
  )
}

interface ExerciseWorkspaceProps {
  exerciseTitle: string
  backUrl?: string
  primaryContent: React.ReactNode
  chatContent?: React.ReactNode
  formulaSheet?: FormulaSheet | null
  /** Custom note text to display inline */
  customNotes?: string
  /** Callback when notes are updated */
  onNotesChange?: (notes: string) => void
}

export function ExerciseWorkspace({
  exerciseTitle,
  backUrl,
  primaryContent,
  chatContent,
  formulaSheet,
  customNotes,
  onNotesChange,
}: ExerciseWorkspaceProps) {
  const { user, isLoading: isAuthLoading } = useCurrentUser()
  const pathname = usePathname()
  const [mobileMode, setMobileMode] = useState<MobileExerciseViewMode>('exercise')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isUnifiedHelpOpen, setIsUnifiedHelpOpen] = useState(false)
  const [activeHelpTab, setActiveHelpTab] = useState<HelpTab>('hint')
  const [notesValue, setNotesValue] = useState(customNotes || '')
  const t = useTranslations('courses')

  const handleMenuClick = () => {
    window.dispatchEvent(new CustomEvent('open-mobile-menu'))
  }

  const handleMobileModeChange = useCallback((mode: MobileExerciseViewMode) => {
    setMobileMode(mode)
  }, [])

  const handleFullscreenToggle = useCallback(() => {
    setIsFullscreen((value) => !value)
    setIsUnifiedHelpOpen(false)
  }, [])

  const handleNotesChange = useCallback(
    (value: string) => {
      setNotesValue(value)
      onNotesChange?.(value)
    },
    [onNotesChange],
  )

  const openUnifiedHelp = useCallback((tab: HelpTab) => {
    setActiveHelpTab(tab)
    setIsUnifiedHelpOpen(true)
  }, [])

  const closeUnifiedHelp = useCallback(() => {
    setIsUnifiedHelpOpen(false)
  }, [])

  return (
    <div
      className={cn(
        'fixed inset-0 bg-background z-[200] flex flex-col overflow-hidden',
        isFullscreen && 'bg-background',
      )}
      data-exercise-fullscreen={isFullscreen}
    >
      {!isFullscreen && (
        <ExerciseHeader
          exerciseTitle={exerciseTitle}
          backUrl={backUrl}
          onMenuClick={handleMenuClick}
          user={user}
          isAuthLoading={isAuthLoading}
          currentUrl={pathname}
          onFullscreenToggle={handleFullscreenToggle}
        />
      )}

      {isFullscreen && (
        <button
          type="button"
          onClick={handleFullscreenToggle}
          className="fixed top-4 right-4 z-[120] flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-dropdown backdrop-blur transition-colors duration-normal hover:bg-muted lg:hidden"
          aria-label="Collapse exercise view"
        >
          <Minimize2 className="w-5 h-5" />
        </button>
      )}

      <SplitPaneLayout
        primaryContent={primaryContent}
        chatContent={
          chatContent && React.isValidElement(chatContent) ? (
            <MobileChatPanel
              chatContent={chatContent}
              onBackToExercise={() => handleMobileModeChange('exercise')}
            />
          ) : (
            chatContent
          )
        }
        storageKey="exercise-split-size"
        className="flex-1"
        mobileMode={mobileMode}
        onMobileModeChange={handleMobileModeChange}
        isFullscreen={isFullscreen}
      />

      {/* Unified Help FAB - replaces separate formula and chat buttons on mobile */}
      {mobileMode !== 'chat' && !isUnifiedHelpOpen && (
        <button
          type="button"
          onClick={() => openUnifiedHelp('hint')}
          className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-6 z-[70] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevation-3 hover:scale-110 hover:bg-primary/90 transition-all duration-normal lg:hidden"
          aria-label="Get help"
        >
          <HelpCircle className="w-6 h-6" />
        </button>
      )}

      {/* Unified Help Panel - inline panel with tabs */}
      <AnimatePresence>
        {isUnifiedHelpOpen && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-[130] bg-card border-t border-border rounded-t-2xl shadow-modal lg:hidden"
            style={{ maxHeight: '70dvh' }}
          >
            {/* Header with tabs */}
            <div className="flex items-center justify-between border-b border-border p-4 pb-0">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setActiveHelpTab('hint')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-body-sm font-medium transition-colors',
                    activeHelpTab === 'hint'
                      ? 'bg-warning/15 text-warning border border-warning/30'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <Lightbulb className="w-4 h-4" />
                  <span>{t('helpHint')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHelpTab('guiding')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-body-sm font-medium transition-colors',
                    activeHelpTab === 'guiding'
                      ? 'bg-accent/15 text-accent border border-accent/30'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>{t('helpGuidingQuestion')}</span>
                </button>
                {chatContent && (
                  <button
                    type="button"
                    onClick={() => setActiveHelpTab('chat')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-body-sm font-medium transition-colors',
                      activeHelpTab === 'chat'
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{t('chat')}</span>
                  </button>
                )}
                {formulaSheet && (
                  <button
                    type="button"
                    onClick={() => setActiveHelpTab('formulas')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-body-sm font-medium transition-colors',
                      activeHelpTab === 'formulas'
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>{t('formulasTab')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveHelpTab('notes')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-body-sm font-medium transition-colors',
                    activeHelpTab === 'notes'
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <PenLine className="w-4 h-4" />
                  <span>{t('notesTab')}</span>
                </button>
              </div>
              <button
                type="button"
                onClick={closeUnifiedHelp}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Close help panel"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Content area */}
            <div className="max-h-[calc(70dvh-80px)] overflow-y-auto p-4">
              {activeHelpTab === 'hint' && (
                <div className="space-y-3">
                  <p className="text-body-sm text-muted-foreground">
                    {t('helpHintDescription') || 'Get a hint to help you solve the problem.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('exercise-help-action', {
                          detail: { type: 'hint', questionContent: '' },
                        }),
                      )
                      closeUnifiedHelp()
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-warning/10 border border-warning/30 text-warning font-medium hover:bg-warning/15 transition-colors"
                  >
                    {t('showHint') || 'Show Hint'}
                  </button>
                </div>
              )}

              {activeHelpTab === 'guiding' && (
                <div className="space-y-3">
                  <p className="text-body-sm text-muted-foreground">
                    {t('helpGuidingDescription') ||
                      'Get a guiding question to lead you to the answer.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('exercise-help-action', {
                          detail: { type: 'guiding', questionContent: '' },
                        }),
                      )
                      closeUnifiedHelp()
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-accent/10 border border-accent/30 text-accent font-medium hover:bg-accent/15 transition-colors"
                  >
                    {t('showGuiding') || 'Show Guiding Question'}
                  </button>
                </div>
              )}

              {activeHelpTab === 'chat' && chatContent && (
                <div className="h-full min-h-[300px]">{chatContent}</div>
              )}

              {activeHelpTab === 'formulas' && formulaSheet && (
                <div className="space-y-3">
                  <h3 className="text-body-lg font-semibold text-primary">{formulaSheet.title}</h3>
                  <div className="max-h-[40dvh] overflow-y-auto">
                    <FormulaSheetContent sheet={formulaSheet} />
                  </div>
                </div>
              )}

              {activeHelpTab === 'notes' && (
                <div className="space-y-3">
                  <h3 className="text-body-lg font-semibold text-primary">{t('notesSubtitle')}</h3>
                  <textarea
                    className="w-full h-48 border border-input bg-muted rounded-xl p-3 text-body-md resize-none focus:outline-none focus:border-primary transition-colors"
                    placeholder={t('notesPlaceholder')}
                    value={notesValue}
                    onChange={(e) => handleNotesChange(e.target.value)}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
