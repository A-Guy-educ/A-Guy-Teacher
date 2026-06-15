'use client'

import { useMediaQuery } from '@/client/hooks/useMediaQuery'
import { cn } from '@/infra/utils/ui'
import { MobileChatFAB } from '@/ui/web/chat/MobileChatFAB'
import { ResizablePane } from '@/ui/web/components/resizable-pane'
import React, { useCallback, useEffect, useRef, useState } from 'react'

export type MobileExerciseViewMode = 'exercise' | 'chat' | 'split'

interface SplitPaneLayoutProps {
  primaryContent: React.ReactNode
  chatContent?: React.ReactNode
  className?: string
  storageKey?: string
  defaultSize?: number
  minSize?: number
  maxSize?: number
  mobileMode?: MobileExerciseViewMode
  onMobileModeChange?: (mode: MobileExerciseViewMode) => void
  isFullscreen?: boolean
}

type ChatCloneProps = {
  onChatInteraction?: () => void
  displayMode?: 'full' | 'input-only'
  isMobile?: boolean
  viewMode?: 'PDF' | 'Chat'
  onModeToggle?: () => void
}

const EDGE_SWIPE_START_PX = 32
const SWIPE_DISTANCE_PX = 60

function getInitialViewMode(): MobileExerciseViewMode {
  if (typeof window === 'undefined') return 'exercise'

  const saved = localStorage.getItem('view-mode')
  if (saved === 'PDF') return 'exercise'
  if (saved === 'CHAT') return 'chat'
  if (saved === 'exercise' || saved === 'chat' || saved === 'split') return saved

  return 'exercise'
}

export function SplitPaneLayout({
  primaryContent,
  chatContent,
  className,
  storageKey = 'split-pane-size',
  defaultSize = 70,
  minSize = 20,
  maxSize = 80,
  mobileMode,
  onMobileModeChange,
  isFullscreen = false,
}: SplitPaneLayoutProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [internalMobileMode, setInternalMobileMode] =
    useState<MobileExerciseViewMode>(getInitialViewMode)
  const [pdfHeightPercent, setPdfHeightPercent] = useState(defaultSize)
  const [isDragging, setIsDragging] = useState(false)
  const [transitionDirection, setTransitionDirection] = useState<'to-chat' | 'to-exercise'>(
    'to-chat',
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const swipeStartRef = useRef<{ x: number; y: number; mode: MobileExerciseViewMode } | null>(null)

  const activeMobileMode = mobileMode ?? internalMobileMode

  const setActiveMobileMode = useCallback(
    (mode: MobileExerciseViewMode) => {
      if (onMobileModeChange) {
        onMobileModeChange(mode)
      } else {
        setInternalMobileMode(mode)
      }
    },
    [onMobileModeChange],
  )

  const openChat = useCallback(() => {
    if (!chatContent) return
    setTransitionDirection('to-chat')
    setActiveMobileMode('chat')
  }, [chatContent, setActiveMobileMode])

  const returnToExercise = useCallback(() => {
    setTransitionDirection('to-exercise')
    setActiveMobileMode('exercise')
  }, [setActiveMobileMode])

  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = parseFloat(saved)
        if (!isNaN(parsed) && parsed >= minSize && parsed <= maxSize) {
          setPdfHeightPercent(parsed)
        }
      }
    }
  }, [storageKey, minSize, maxSize])

  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, pdfHeightPercent.toString())
    }
  }, [pdfHeightPercent, storageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const legacyMode = activeMobileMode === 'chat' ? 'CHAT' : 'PDF'
    localStorage.setItem('view-mode', legacyMode)
  }, [activeMobileMode])

  useEffect(() => {
    if (isDesktop || !chatContent) return undefined

    const handleIncorrectAnswer = () => {
      if (activeMobileMode === 'exercise') {
        openChat()
      }
    }

    window.addEventListener('exercise-incorrect-answer', handleIncorrectAnswer)
    return () => window.removeEventListener('exercise-incorrect-answer', handleIncorrectAnswer)
  }, [activeMobileMode, chatContent, isDesktop, openChat])

  useEffect(() => {
    if (isDesktop || activeMobileMode !== 'chat') return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        returnToExercise()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeMobileMode, isDesktop, returnToExercise])

  const handleMouseDown = () => {
    setIsDragging(true)
    document.body.style.userSelect = 'none'
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    document.body.style.userSelect = 'auto'
  }

  const handleMouseMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const percentage = ((clientY - rect.top) / rect.height) * 100

    if (percentage >= minSize && percentage <= maxSize) {
      setPdfHeightPercent(percentage)
    }
  }

  useEffect(() => {
    if (!isDragging) return undefined

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchend', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchend', handleMouseUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging])

  const renderMobileChat = useCallback(
    (extraProps: ChatCloneProps = {}) => {
      if (!chatContent || !React.isValidElement(chatContent)) return null

      return React.cloneElement(chatContent as React.ReactElement<ChatCloneProps>, {
        displayMode: 'full',
        isMobile: true,
        viewMode: activeMobileMode === 'chat' ? 'Chat' : 'PDF',
        onModeToggle: activeMobileMode === 'chat' ? returnToExercise : openChat,
        ...extraProps,
      })
    },
    [activeMobileMode, chatContent, openChat, returnToExercise],
  )

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!chatContent || isDesktop) return

    const touch = e.touches[0]
    if (!touch) return

    const shouldTrack =
      activeMobileMode === 'chat' ||
      (activeMobileMode === 'exercise' && touch.clientX <= EDGE_SWIPE_START_PX)

    swipeStartRef.current = shouldTrack
      ? { x: touch.clientX, y: touch.clientY, mode: activeMobileMode }
      : null
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current
    swipeStartRef.current = null

    if (!start) return

    const touch = e.changedTouches[0]
    if (!touch) return

    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY) * 1.2

    if (!isHorizontalSwipe) return

    if (start.mode === 'exercise' && deltaX >= SWIPE_DISTANCE_PX) {
      openChat()
    }

    if (start.mode === 'chat' && deltaX <= -SWIPE_DISTANCE_PX) {
      returnToExercise()
    }
  }

  if (isDesktop) {
    if (!chatContent) {
      return (
        <div className={cn('flex flex-col overflow-hidden', className)}>
          <div className="flex-1 h-full overflow-hidden min-h-0">{primaryContent}</div>
        </div>
      )
    }

    return (
      <div className={cn('flex flex-col overflow-hidden', className)}>
        <ResizablePane
          orientation="horizontal"
          defaultSize={defaultSize}
          minSize={minSize}
          maxSize={maxSize}
          storageKey={storageKey}
          className="flex-1"
        >
          <div className="h-full overflow-hidden min-h-0">{primaryContent}</div>
          <div className="bg-background flex flex-col overflow-hidden h-full">{chatContent}</div>
        </ResizablePane>
      </div>
    )
  }

  if (!chatContent) {
    return (
      <div className={cn('flex-1 overflow-hidden flex flex-col', className)}>
        <div className="flex-1 overflow-hidden relative">{primaryContent}</div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex-1 overflow-hidden bg-muted/40',
        isFullscreen && '[&_.exercise-bottom-nav]:hidden',
        isFullscreen && '[&_.exercise-header-tabs]:hidden',
        isFullscreen && '[&_.exercise-top-progress]:hidden',
        isFullscreen && '[&_.exercise-breadcrumb]:hidden',
        className,
      )}
      data-mobile-mode={activeMobileMode}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {activeMobileMode === 'split' ? (
        <div className="h-full overflow-hidden flex flex-col">
          <div className="overflow-hidden relative" style={{ flex: `0 0 ${pdfHeightPercent}%` }}>
            {primaryContent}
            {isDragging && <div className="absolute inset-0 z-10" />}
          </div>

          <div
            className={cn(
              'h-4 cursor-ns-resize border-y border-border bg-muted flex items-center justify-center shrink-0 z-20 transition-colors duration-normal',
              isDragging && 'bg-primary/10',
            )}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
            role="separator"
            aria-valuenow={pdfHeightPercent}
            aria-valuemin={minSize}
            aria-valuemax={maxSize}
            aria-label="Resize panels"
          >
            <div
              className={cn(
                'w-10 h-1 bg-muted-foreground/30 rounded-full transition-all duration-normal',
                isDragging && 'bg-primary',
                !isDragging && 'hover:bg-primary hover:scale-110',
              )}
            />
          </div>

          <div className="flex-1 overflow-hidden relative bg-background min-h-0">
            {renderMobileChat()}
            {isDragging && <div className="absolute inset-0 z-10" />}
          </div>
        </div>
      ) : (
        <div className="relative h-full overflow-hidden">
          {activeMobileMode === 'exercise' && (
            <div
              key="exercise"
              className={cn(
                'absolute inset-0 overflow-hidden',
                transitionDirection === 'to-exercise' &&
                  'animate-in slide-in-from-right-8 duration-slow',
              )}
            >
              {primaryContent}
            </div>
          )}

          {activeMobileMode === 'chat' && (
            <div
              key="chat"
              className="absolute inset-0 overflow-hidden bg-background animate-in slide-in-from-left-8 duration-slow"
              role="region"
              aria-label="Chat"
            >
              {renderMobileChat({
                onChatInteraction: openChat,
              })}
            </div>
          )}

          {activeMobileMode === 'exercise' && (
            <MobileChatFAB
              isOpen={false}
              onOpen={openChat}
              onClose={returnToExercise}
              panelMode="button-only"
            >
              {renderMobileChat()}
            </MobileChatFAB>
          )}
        </div>
      )}
    </div>
  )
}
