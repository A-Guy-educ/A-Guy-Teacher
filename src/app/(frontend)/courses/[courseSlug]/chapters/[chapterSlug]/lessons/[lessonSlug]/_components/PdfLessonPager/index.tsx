'use client'

import { ExerciseWorkspace } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import type { Media } from '@/infra/types/content'
import { ChatInterface } from '@/ui/web/chat'
import { Button } from '@/ui/web/components/button'
import { Progress } from '@/ui/web/components/progress'
import { Media as MediaComponent } from '@/ui/web/media'
import { useTranslations } from '@/ui/web/providers/I18n'
import { BookOpen, ChevronLeft, ChevronRight, FileText, Loader2, Sparkles } from 'lucide-react'
import { usePdfLessonPager } from './usePdfLessonPager'
import { useState, useCallback } from 'react'
import { cn } from '@/infra/utils/ui'

interface PdfLessonPagerProps {
  validFiles: Media[]
  lessonTitle: string
  backUrl: string
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  lessonId: string
  /** Grade bucket for progress storage — must be the lesson's course label, not the user's profile grade. */
  gradeLevel: string
  chatLessonId: string
  /** Whether to show the chat panel (true when lesson has exercises or context text) */
  showChat?: boolean
  /** Formula sheet data (passed to ChatInterface) */
  formulaSheet?: import('@/infra/types/content').FormulaSheet | null
  /** When provided, overrides URL-based state initialization — used when PdfLessonPager
   *  is rendered as a child after LessonIntroPage (skip the intro page). */
  initialPageState?: { type: 'intro' | 'pdf' | 'outro'; pageNumber: number }
}

export function PdfLessonPager({
  validFiles,
  lessonTitle,
  backUrl,
  courseSlug,
  chapterSlug,
  lessonSlug,
  lessonId,
  gradeLevel,
  chatLessonId,
  showChat,
  formulaSheet,
  initialPageState,
}: PdfLessonPagerProps) {
  const t = useTranslations('courses')
  const {
    pageState,
    progressPercent,
    isNavigating,
    canGoNext,
    canGoPrev,
    handleNext,
    handlePrev,
    handleStart,
    totalFiles,
  } = usePdfLessonPager({
    fileCount: validFiles.length,
    courseSlug,
    chapterSlug,
    lessonSlug,
    lessonId,
    gradeLevel,
    initialPageState,
  })

  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  const hasMultipleFiles = validFiles.length > 1
  const canGoFilePrev = currentFileIndex > 0
  const canGoFileNext = currentFileIndex < validFiles.length - 1
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
    if (isLeftSwipe && canGoFileNext) handleFileNext()
    if (isRightSwipe && canGoFilePrev) handleFilePrev()
  }

  if (pageState.type === 'pdf') {
    const currentFile = validFiles[currentFileIndex]

    return (
      <ExerciseWorkspace
        exerciseTitle={lessonTitle}
        backUrl={backUrl}
        primaryContent={
          <div className="h-full flex flex-col min-h-0">
            <div
              className="flex-1 overflow-y-auto min-h-0"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div className="w-full p-card-padding-sm md:p-card-padding">
                {currentFile && (
                  <div className="w-full h-[calc(100vh-120px)]">
                    <div className="border rounded-lg overflow-hidden bg-card shadow-card h-full flex flex-col">
                      {hasMultipleFiles && (
                        <div className="flex items-center justify-center gap-2 py-2 px-4 bg-muted/50 border-b border-border/50 text-body-sm text-muted-foreground shrink-0">
                          <FileText className="w-4 h-4" />
                          <span>
                            {currentFileIndex + 1} / {validFiles.length}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-h-0">
                        <MediaComponent
                          resource={currentFile}
                          className="w-full h-full"
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

            <div className="shrink-0 border-t border-border bg-card/80 backdrop-blur-xl px-4 py-3">
              <div className="flex justify-between items-center">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={!canGoPrev || isNavigating}
                  className="text-muted-foreground text-body-sm hover:text-foreground gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                  {t('exercisesPagerPrev')}
                </Button>

                {hasMultipleFiles && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleFilePrev}
                      disabled={!canGoFilePrev}
                      aria-label="Previous file"
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-normal cursor-pointer',
                        !canGoFilePrev
                          ? 'text-muted-foreground/40'
                          : 'bg-muted text-foreground hover:bg-muted/80',
                      )}
                    >
                      <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                    </button>
                    <span className="text-body-xs text-muted-foreground min-w-[3ch] text-center">
                      {currentFileIndex + 1}/{validFiles.length}
                    </span>
                    <button
                      onClick={handleFileNext}
                      disabled={!canGoFileNext}
                      aria-label="Next file"
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-normal cursor-pointer',
                        !canGoFileNext
                          ? 'text-muted-foreground/40'
                          : 'bg-muted text-foreground hover:bg-muted/80',
                      )}
                    >
                      <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                    </button>
                  </div>
                )}

                <Button
                  variant="default"
                  onClick={handleNext}
                  disabled={!canGoNext || isNavigating}
                  className="px-6 py-2 rounded-xl text-body-sm cursor-pointer"
                >
                  {isNavigating ? (
                    <>
                      <Loader2 className="w-4 h-4 me-2 animate-spin" />
                      {t('exercisesPagerNext')}
                    </>
                  ) : (
                    t('exercisesPagerNext')
                  )}
                </Button>
              </div>
            </div>
          </div>
        }
        chatContent={
          showChat ? (
            <ChatInterface
              lessonId={chatLessonId}
              translationNamespace="courses"
              showMathTools={true}
              formulaSheet={formulaSheet}
            />
          ) : null
        }
      />
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Progress value={progressPercent} className="h-1.5 rounded-none" />

      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 sm:px-6 py-section-md md:py-section-lg max-w-7xl">
          {pageState.type === 'intro' && (
            <div className="space-y-8">
              <header className="text-center">
                <span className="inline-block px-4 py-1.5 bg-muted text-muted-foreground rounded-full text-label tracking-[0.2em] uppercase mb-5 border border-border/40">
                  {t('exercisesPagerIntro')}
                </span>
                <h1 className="text-display-md md:text-display-lg font-medium leading-tight text-foreground mb-3">
                  {lessonTitle}
                </h1>
                <div className="w-20 h-1 bg-primary mx-auto rounded-full" />
              </header>

              <div className="bg-card rounded-3xl p-card-padding-lg md:p-10 border border-border/60 shadow-card-hover shadow-muted/50 text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-card shadow-primary/10 border border-primary/20">
                  <BookOpen className="w-9 h-9 text-primary" />
                </div>

                <h2 className="text-display-xl font-medium mb-4 text-foreground">
                  {t('exercisesPagerWelcome')}
                </h2>
                <p className="text-muted-foreground mb-10 text-body-md leading-relaxed max-w-2xl mx-auto">
                  {t('pdfLessonPagerIntroDescriptionPart1')} {totalFiles}{' '}
                  {t('pdfLessonPagerIntroDescriptionPart2')}
                </p>

                <div className="inline-flex items-center gap-3 px-5 py-3 bg-muted rounded-2xl border border-border/60 mb-10">
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="text-primary text-heading-xl font-medium">{totalFiles}</span>
                  <span className="text-label text-muted-foreground uppercase tracking-wider">
                    {t('pdfLessonPagerDocuments')}
                  </span>
                </div>

                <Button
                  onClick={handleStart}
                  size="lg"
                  className="w-full py-section-sm rounded-2xl text-body-lg shadow-card shadow-primary/20 hover:shadow-card-hover hover:shadow-primary/30 transition-all duration-slow cursor-pointer"
                >
                  {t('exercisesPagerStart')}{' '}
                  <ChevronLeft className="w-5 h-5 ms-2 rtl:rotate-0 ltr:rotate-180" />
                </Button>
              </div>
            </div>
          )}

          {pageState.type === 'outro' && (
            <div className="space-y-8">
              <header className="text-center">
                <span className="inline-block px-4 py-1.5 bg-secondary/10 text-secondary rounded-full text-label tracking-[0.2em] uppercase mb-5 border border-secondary/20">
                  {t('exercisesPagerCompleted')}
                </span>
                <h1 className="text-display-md md:text-display-lg font-medium leading-tight text-foreground mb-3">
                  {t('exercisesPagerCompletedTitle')}
                </h1>
                <div className="w-20 h-1 bg-secondary mx-auto rounded-full" />
              </header>

              <div className="bg-card rounded-3xl p-card-padding-lg md:p-10 border border-border/60 shadow-card-hover shadow-muted/50 text-center">
                <div className="w-20 h-20 bg-secondary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-card shadow-secondary/10 border border-secondary/20">
                  <Sparkles className="w-9 h-9 text-secondary" />
                </div>

                <h2 className="text-display-xl font-medium mb-4 text-foreground">
                  {t('exercisesPagerCompletedTitle')}
                </h2>
                <p className="text-muted-foreground mb-10 text-body-md leading-relaxed max-w-2xl mx-auto">
                  {t('pdfLessonPagerCompletedDescription')}
                </p>

                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="w-full py-section-sm rounded-2xl text-body-lg shadow-card shadow-secondary/20 hover:shadow-card-hover hover:shadow-secondary/30 transition-all duration-slow"
                >
                  <SystemLink href={backUrl}>
                    <Sparkles className="w-5 h-5 me-2" />
                    {t('exercisesPagerComplete')}
                  </SystemLink>
                </Button>
              </div>

              <div className="flex justify-center pt-4">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={isNavigating}
                  className="text-muted-foreground text-body-sm hover:text-foreground transition-colors duration-slow gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                  {t('exercisesPagerPrev')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
