'use client'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import { cn } from '@/infra/utils/ui'
import type { FormulaSheet } from '@/infra/types/content'
import { FormulaSheetContent } from '@/ui/web/shared/FormulaSheetViewer/FormulaSheetContent'
import { type MobileExerciseViewMode, SplitPaneLayout } from '@/ui/web/components/split-pane-layout'
import { BookOpen, Minimize2, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import React, { useCallback, useState } from 'react'
import { ExerciseHeader } from '../ExerciseHeader'

interface ExerciseWorkspaceProps {
  exerciseTitle: string
  backUrl?: string
  primaryContent: React.ReactNode
  chatContent?: React.ReactNode
  formulaSheet?: FormulaSheet | null
}

export function ExerciseWorkspace({
  exerciseTitle,
  backUrl,
  primaryContent,
  chatContent,
  formulaSheet,
}: ExerciseWorkspaceProps) {
  const { user, isLoading: isAuthLoading } = useCurrentUser()
  const pathname = usePathname()
  const [mobileMode, setMobileMode] = useState<MobileExerciseViewMode>('exercise')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isFormulaOpen, setIsFormulaOpen] = useState(false)

  const handleMenuClick = () => {
    window.dispatchEvent(new CustomEvent('open-mobile-menu'))
  }

  const handleMobileModeChange = useCallback((mode: MobileExerciseViewMode) => {
    setMobileMode(mode)
  }, [])

  const handleFullscreenToggle = useCallback(() => {
    setIsFullscreen((value) => !value)
    setIsFormulaOpen(false)
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
        chatContent={chatContent}
        storageKey="exercise-split-size"
        className="flex-1"
        mobileMode={mobileMode}
        onMobileModeChange={handleMobileModeChange}
        isFullscreen={isFullscreen}
      />

      {formulaSheet && mobileMode !== 'chat' && !isFormulaOpen && (
        <button
          type="button"
          onClick={() => setIsFormulaOpen(true)}
          className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-6 z-[70] flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-primary shadow-elevation-2 transition-all duration-normal hover:bg-muted lg:hidden"
          aria-label="Open formula sheet"
        >
          <BookOpen className="w-5 h-5" />
        </button>
      )}

      {formulaSheet && isFormulaOpen && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-card-padding-sm backdrop-blur-sm lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={formulaSheet.title ?? 'Formula sheet'}
        >
          <div className="max-h-[82dvh] w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-modal">
            <div className="flex items-center justify-between border-b border-border p-card-padding-sm">
              <h2 className="text-body-lg font-semibold text-primary truncate">
                {formulaSheet.title}
              </h2>
              <button
                type="button"
                onClick={() => setIsFormulaOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors duration-normal hover:text-foreground"
                aria-label="Close formula sheet"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[calc(82dvh-73px)] overflow-y-auto p-card-padding-sm">
              <FormulaSheetContent sheet={formulaSheet} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
