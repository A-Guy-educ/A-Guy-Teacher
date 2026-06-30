'use client'

/**
 * MediaTabContent
 *
 * Renders the lesson's attached media files (PDFs, videos, etc.) as the
 * "Media" tab inside the three-tab lesson view. Keeps the same ExerciseWorkspace
 * chrome (back button, title, optional chat panel) but shows the raw media
 * directly without the paging intro/outro of PdfLessonPager.
 *
 * When multiple files are present, shows one file at a time with prev/next navigation.
 * Supports URL deep-linking via ?file=N query parameter (1-indexed).
 */

import React, { useState, useCallback, useEffect } from 'react'
import type { FormulaSheet, Media } from '@/infra/types/content'
import { ChatInterface } from '@/ui/web/chat'
import { Media as MediaComponent } from '@/ui/web/media'
import { ExerciseWorkspace } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/infra/utils/ui'

interface MediaTabContentProps {
  lessonTitle: string
  backUrl: string
  lessonId: string
  validFiles: Media[]
  courseSlug: string
  headerSlot?: React.ReactNode
  showChat?: boolean
  chatLessonId?: string
  formulaSheet?: FormulaSheet | null
}

export function MediaTabContent({
  lessonTitle,
  backUrl,
  lessonId,
  validFiles,
  courseSlug,
  headerSlot,
  showChat,
  chatLessonId,
  formulaSheet,
}: MediaTabContentProps) {
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  // Deep-link detection: read ?file=N from URL on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const fileParam = params.get('file')
    if (fileParam !== null) {
      const fileIndex = parseInt(fileParam, 10) - 1
      if (!isNaN(fileIndex) && fileIndex >= 0 && fileIndex < validFiles.length) {
        setCurrentFileIndex(fileIndex)
      }
    }
  }, [validFiles.length])

  // Sync URL when currentFileIndex changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (validFiles.length <= 1) return

    const params = new URLSearchParams(window.location.search)
    const expectedFile = currentFileIndex + 1
    const currentFile = params.get('file')

    if (String(expectedFile) !== currentFile) {
      if (expectedFile > 1) {
        params.set('file', String(expectedFile))
      } else {
        params.delete('file')
      }
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
      window.history.replaceState(null, '', newUrl)
    }
  }, [currentFileIndex, validFiles.length])

  const hasMultipleFiles = validFiles.length > 1
  const canGoPrev = currentFileIndex > 0
  const canGoNext = currentFileIndex < validFiles.length - 1
  const minSwipeDistance = 50

  const handleFilePrev = useCallback(() => {
    setCurrentFileIndex((prev) => Math.max(0, prev - 1))
  }, [])

  const handleFileNext = useCallback(() => {
    setCurrentFileIndex((prev) => Math.min(validFiles.length - 1, prev + 1))
  }, [validFiles.length])

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    if (isLeftSwipe && canGoNext) handleFileNext()
    if (isRightSwipe && canGoPrev) handleFilePrev()
  }

  const currentFile = validFiles[currentFileIndex]

  return (
    <ExerciseWorkspace
      exerciseTitle={lessonTitle}
      backUrl={backUrl}
      primaryContent={
        <div className="flex h-full flex-col min-h-0">
          {headerSlot}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div
              className="w-full p-card-padding-sm md:p-card-padding flex flex-col gap-content-gap"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {currentFile && (
                <div className="w-full h-[calc(100vh-120px)]">
                  <div className="border rounded-lg overflow-hidden bg-card shadow-card h-full flex flex-col">
                    {hasMultipleFiles && (
                      <div className="flex items-center justify-center gap-2 py-2 px-4 bg-muted/50 border-b border-border/50 text-body-sm text-muted-foreground shrink-0">
                        <span>
                          {currentFileIndex + 1} / {validFiles.length}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-h-0">
                      <MediaComponent
                        resource={currentFile}
                        className="w-full h-full max-w-full"
                        htmlElement={null}
                        lessonId={lessonId}
                        courseId={courseSlug}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {hasMultipleFiles && (
            <div className="shrink-0 border-t border-border bg-card/80 backdrop-blur-xl px-6 py-3">
              <div className="max-w-3xl mx-auto flex items-center justify-between">
                <button
                  onClick={handleFilePrev}
                  disabled={!canGoPrev}
                  aria-label="Previous file"
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-normal cursor-pointer',
                    !canGoPrev
                      ? 'text-muted-foreground/40'
                      : 'bg-muted text-foreground hover:bg-muted/80',
                  )}
                >
                  <ChevronRight className="w-5 h-5 rtl:rotate-0 ltr:rotate-180" />
                </button>
                <span className="text-body-xs text-muted-foreground">
                  {currentFileIndex + 1} / {validFiles.length}
                </span>
                <button
                  onClick={handleFileNext}
                  disabled={!canGoNext}
                  aria-label="Next file"
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-normal cursor-pointer',
                    !canGoNext
                      ? 'text-muted-foreground/40'
                      : 'bg-muted text-foreground hover:bg-muted/80',
                  )}
                >
                  <ChevronLeft className="w-5 h-5 rtl:rotate-0 ltr:rotate-180" />
                </button>
              </div>
            </div>
          )}
        </div>
      }
      chatContent={
        showChat ? (
          <ChatInterface
            lessonId={chatLessonId ?? lessonId}
            translationNamespace="courses"
            showMathTools={true}
            formulaSheet={formulaSheet}
          />
        ) : null
      }
    />
  )
}
