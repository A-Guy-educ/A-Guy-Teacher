'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Exercise, Media as MediaType } from '@/infra/types/content'
import { Button } from '@/ui/web/components/button'
import { Input } from '@/ui/web/components/input'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers,
  RotateCcw,
  Target,
} from 'lucide-react'
import { useTranslations } from '@/ui/web/providers/I18n'
import type { ExerciseContentData } from '@/ui/web/exerciserenderer/types'
import { Progress } from '@/ui/web/components/progress'
import { useExercisesPager } from './useExercisesPager'
import { ExerciseWorkspace } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace'
import { ChatInterface } from '@/ui/web/chat'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/infra/utils/ui'
import { Confetti } from '@/ui/web/components/confetti'

const pageTransition = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.2 },
}

interface ExercisesPagerProps {
  /** Exercises array (used when no blocks are provided) */
  exercises?: Exercise[]
  /** Ordered lesson blocks (exercises and content pages) — preferred over exercises prop */
  blocks?: import('@/server/repos/queries/lesson-blocks').ResolvedLessonBlock[]
  /** Pre-rendered content page bodies (keyed by content page ID) */
  contentPageBodies?: Record<string, React.ReactNode>
  lessonTitle: string
  backUrl: string
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  lessonId: string
  /** Grade bucket for progress storage — must be the lesson's course label, not the user's profile grade. */
  gradeLevel: string
  mediaMap?: Record<string, MediaType>
  /** Whether to show the chat panel (true when lesson has exercises or context text) */
  showChat?: boolean
  /** Formula sheet data (passed to ChatInterface) */
  formulaSheet?: import('@/infra/types/content').FormulaSheet | null
  /** Optional element rendered at the top of the primary pane (e.g. a dual-mode tab bar). */
  headerSlot?: React.ReactNode
  /** When true, forwards to ExerciseRenderer so `type: 'latex'` blocks are not rendered
   * inside individual exercises (used by the dual-mode lesson view where LaTeX lives
   * at the lesson level). */
  hideLatexBlocks?: boolean
  initialExerciseIndex?: number
  nextLesson?: { title?: string | null; slug?: string | null } | null
}

export function ExercisesPager({
  exercises,
  blocks,
  contentPageBodies,
  lessonTitle,
  backUrl,
  courseSlug,
  chapterSlug,
  lessonSlug,
  lessonId,
  gradeLevel,
  mediaMap,
  showChat,
  formulaSheet,
  headerSlot,
  hideLatexBlocks,
  initialExerciseIndex,
  nextLesson,
}: ExercisesPagerProps) {
  const t = useTranslations('courses')
  const {
    pageState,
    progressPercent,
    isNavigating,
    canGoNext,
    canGoPrev,
    handleNext,
    handlePrev,
    handleJumpToExercise,
    handleStart,
    getExerciseOrdinal,
    getContentPageOrdinal,
    totalExercises,
    totalContentPages,
  } = useExercisesPager({
    exercises: exercises ?? [],
    blocks,
    courseSlug,
    chapterSlug,
    lessonSlug,
    lessonId,
    gradeLevel,
    initialExerciseIndex,
  })

  const [showConfetti, setShowConfetti] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [jumpInputValue, setJumpInputValue] = useState<string>('')

  const contentRef = useRef<HTMLDivElement>(null)
  const minSwipeDistance = 50

  useEffect(() => {
    if (pageState.type === 'outro') {
      setShowConfetti(true)
    }
  }, [pageState.type])

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
    if (isLeftSwipe && canGoNext) handleNext()
    if (isRightSwipe && canGoPrev) handlePrev()
  }

  // Focus content area on page change
  useEffect(() => {
    if (pageState.type === 'exercise' && contentRef.current) {
      contentRef.current.focus()
    }
  }, [pageState.type])

  // Store per-exercise question results from ExerciseRenderer
  const exerciseResults = useRef<
    Record<string, { totalQuestions: number; checkedCount: number; correctCount: number }>
  >({})
  const trackedExercises = useRef(new Set<string>())
  const prevExerciseIndex = useRef<number | undefined>(undefined)
  const trackedLessonCompletion = useRef(false)

  // Track exercise when navigating away — only if student checked at least one answer
  useEffect(() => {
    if (
      prevExerciseIndex.current !== undefined &&
      prevExerciseIndex.current !== pageState.blockIndex
    ) {
      // Only process if previous block was an exercise (not a content page)
      const prevBlock = blocks?.[prevExerciseIndex.current]
      if (prevBlock?.type !== 'exercise') {
        prevExerciseIndex.current = pageState.blockIndex
        return
      }
      const prevExercise = prevBlock.data as Exercise
      if (!trackedExercises.current.has(prevExercise.id)) {
        const results = exerciseResults.current[prevExercise.id]
        const checkedCount = results?.checkedCount || 0

        // Only track if student actually attempted at least one question
        if (checkedCount > 0) {
          trackedExercises.current.add(prevExercise.id)
          const totalQuestions = results?.totalQuestions || 1
          const correctCount = results?.correctCount || 0
          const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
          fetch('/api/stats/track-activity', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventType: 'exercise_completed',
              exerciseId: prevExercise.id,
              exerciseTitle: prevExercise.title || '',
              lessonId,
              score,
              totalQuestions,
              correctCount,
            }),
          }).catch(() => {
            // fail silently
          })
        }
      }
    }
    prevExerciseIndex.current = pageState.blockIndex
  }, [pageState.blockIndex, blocks, lessonId])

  // Track lesson completion when reaching outro — only if student attempted exercises
  useEffect(() => {
    if (pageState.type === 'outro' && !trackedLessonCompletion.current) {
      // Only mark lesson complete if at least one exercise was actually attempted
      const hasAttemptedExercises = trackedExercises.current.size > 0
      if (hasAttemptedExercises) {
        trackedLessonCompletion.current = true
        fetch('/api/stats/track-activity', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'lesson_completed',
            lessonId,
            lessonTitle,
          }),
        }).catch(() => {
          // fail silently
        })
      }
    }
  }, [pageState.type, lessonId, lessonTitle])

  const exerciseOrdinal = getExerciseOrdinal()
  const contentPageOrdinal = getContentPageOrdinal()
  const currentBlock =
    pageState.blockIndex !== undefined ? blocks?.[pageState.blockIndex] : undefined

  useEffect(() => {
    if (exerciseOrdinal !== null) {
      setJumpInputValue(String(exerciseOrdinal))
    }
  }, [exerciseOrdinal])
  const currentExercise =
    pageState.type === 'exercise' && currentBlock?.type === 'exercise'
      ? (currentBlock.data as Exercise)
      : null
  const summaryResults = Object.values(exerciseResults.current)
  const solvedExerciseCount =
    summaryResults.filter((result) => result.checkedCount > 0).length || totalExercises
  const correctAnswerCount = summaryResults.reduce((sum, result) => sum + result.correctCount, 0)
  const totalQuestionCount = summaryResults.reduce((sum, result) => sum + result.totalQuestions, 0)
  const scorePercent =
    totalQuestionCount > 0 ? Math.round((correctAnswerCount / totalQuestionCount) * 100) : 100
  const correctAnswersLabel =
    totalQuestionCount > 0 ? `${correctAnswerCount} / ${totalQuestionCount}` : '—'
  const nextLessonUrl = nextLesson?.slug
    ? `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${nextLesson.slug}`
    : backUrl
  const primaryActionLabel = nextLesson?.slug
    ? t('lessonSummaryNextLesson')
    : t('lessonSummaryBackToCourse')

  const handleExerciseResultsChange = useCallback(
    (results: { totalQuestions: number; checkedCount: number; correctCount: number }) => {
      if (currentExercise) {
        exerciseResults.current[currentExercise.id] = results
      }
    },
    [currentExercise],
  )

  if (pageState.type === 'exercise' && currentExercise) {
    return (
      <ExerciseWorkspace
        exerciseTitle={currentExercise.title ?? ''}
        backUrl={backUrl}
        formulaSheet={formulaSheet}
        primaryContent={
          <div className="h-full flex flex-col">
            {headerSlot && <div className="exercise-header-tabs">{headerSlot}</div>}
            {/* Top progress line */}
            <Progress
              value={progressPercent}
              className="exercise-top-progress h-0.5 rounded-none"
            />

            <div
              ref={contentRef}
              tabIndex={-1}
              className="flex-1 overflow-y-auto min-h-0 pb-4 outline-none"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div className="w-full p-card-padding-sm md:p-card-padding space-y-4">
                {/* Breadcrumb step indicator */}
                <div className="exercise-breadcrumb flex items-center gap-content-gap-xs text-body-sm text-muted-foreground pt-3">
                  <span className="truncate max-w-[200px]">{lessonTitle}</span>
                  <ChevronRight className="w-3 h-3 shrink-0 rtl:rotate-180" />
                  <span className="text-foreground font-medium">
                    {exerciseOrdinal !== null
                      ? `${t('exercise')} ${exerciseOrdinal} ${t('of')} ${totalExercises}`
                      : ''}
                  </span>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={currentExercise.id} {...pageTransition} className="space-y-4">
                    <div className="hidden md:block bg-card rounded-2xl border border-border/60 shadow-elevation-1 overflow-hidden">
                      <div className="p-5 md:p-card-padding">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Layers className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <h2 className="text-body-lg font-medium text-foreground">
                              {currentExercise.title}
                            </h2>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="md:bg-card md:rounded-2xl md:p-card-padding md:border md:border-border/60 md:shadow-elevation-1">
                      <ExerciseRenderer
                        key={currentExercise.id}
                        content={currentExercise.content as unknown as ExerciseContentData}
                        mode="student"
                        showCheckAnswer={true}
                        mediaMap={mediaMap}
                        lessonId={lessonId}
                        exerciseId={currentExercise.id}
                        showExerciseNumber={currentExercise.showQuestionNumbering ?? false}
                        onResultsChange={handleExerciseResultsChange}
                        hideLatexBlocks={hideLatexBlocks}
                      />
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="exercise-bottom-nav sticky bottom-0 z-30 bg-card/80 backdrop-blur-xl border-t border-border/50 px-6 py-content-gap pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="max-w-3xl mx-auto flex items-center justify-center gap-content-gap-lg">
                <button
                  onClick={handlePrev}
                  disabled={!canGoPrev || isNavigating}
                  aria-label="Previous page"
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-normal cursor-pointer',
                    !canGoPrev || isNavigating
                      ? 'text-muted-foreground/40'
                      : 'bg-muted text-foreground hover:bg-muted/80',
                  )}
                >
                  <span className="text-heading-lg font-light">‹</span>
                </button>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={totalExercises}
                  value={jumpInputValue}
                  aria-label={t('exercisesPagerJumpToExercise')}
                  aria-valuemin={1}
                  aria-valuemax={totalExercises}
                  aria-valuenow={exerciseOrdinal ?? undefined}
                  className="w-16 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '')
                    setJumpInputValue(val)
                  }}
                  onFocus={(e) => {
                    e.target.select()
                  }}
                  onBlur={() => {
                    const parsed = parseInt(jumpInputValue, 10)
                    if (
                      !isNaN(parsed) &&
                      parsed >= 1 &&
                      parsed <= totalExercises &&
                      parsed !== exerciseOrdinal
                    ) {
                      handleJumpToExercise(parsed)
                    } else {
                      setJumpInputValue(exerciseOrdinal !== null ? String(exerciseOrdinal) : '')
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const parsed = parseInt(jumpInputValue, 10)
                      if (
                        !isNaN(parsed) &&
                        parsed >= 1 &&
                        parsed <= totalExercises &&
                        parsed !== exerciseOrdinal
                      ) {
                        handleJumpToExercise(parsed)
                      } else {
                        setJumpInputValue(exerciseOrdinal !== null ? String(exerciseOrdinal) : '')
                      }
                      ;(e.target as HTMLInputElement).blur()
                    }
                  }}
                />
                <button
                  onClick={handleNext}
                  disabled={!canGoNext || isNavigating}
                  aria-label="Next page"
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-normal cursor-pointer',
                    !canGoNext || isNavigating
                      ? 'text-muted-foreground/40'
                      : 'bg-muted text-foreground hover:bg-muted/80',
                  )}
                >
                  <span className="text-heading-lg font-light">›</span>
                </button>
              </div>
            </div>
          </div>
        }
        chatContent={
          showChat ? (
            <ChatInterface
              lessonId={lessonId}
              exerciseId={currentExercise.id}
              currentExercise={{
                id: currentExercise.id,
                title: currentExercise.title ?? '',
                content: {
                  blocks: (currentExercise.content as unknown as ExerciseContentData).blocks.map(
                    (block) => {
                      const { id, type, ...rest } = block
                      return { id, type, ...rest }
                    },
                  ),
                },
              }}
              mediaMap={
                mediaMap as Record<
                  string,
                  {
                    id: string
                    url?: string | null
                    filename?: string
                    mimeType?: string
                    altText?: string
                  }
                >
              }
              translationNamespace="courses"
              showMathTools={true}
              formulaSheet={formulaSheet}
            />
          ) : null
        }
      />
    )
  }

  // Render content page block
  if (pageState.type === 'contentPage' && currentBlock?.type === 'contentPage') {
    const contentPage = currentBlock.data as {
      id: string
      title?: string | null
      slug?: string | null
    }
    const bodyRendered = contentPageBodies?.[contentPage.id]

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {headerSlot}
        <Progress value={progressPercent} className="h-0.5 rounded-none" />

        <main
          ref={contentRef}
          tabIndex={-1}
          className="flex-1 overflow-y-auto pb-4 outline-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="container mx-auto px-4 sm:px-6 py-section-md md:py-section-lg max-w-5xl">
            <AnimatePresence mode="wait">
              <motion.div key={pageState.blockIndex} {...pageTransition} className="space-y-8">
                {/* Breadcrumb step indicator */}
                <div className="flex items-center gap-content-gap-xs text-body-sm text-muted-foreground">
                  <span className="truncate max-w-[200px]">{lessonTitle}</span>
                  <ChevronRight className="w-3 h-3 shrink-0 rtl:rotate-180" />
                  <span className="text-foreground font-medium">
                    {contentPageOrdinal !== null
                      ? `${t('contentPageLabel')} ${contentPageOrdinal} ${t('of')} ${totalContentPages}`
                      : ''}
                  </span>
                </div>

                <header className="text-center">
                  <span className="inline-block px-4 py-1.5 bg-muted text-muted-foreground rounded-full text-label tracking-[0.2em] uppercase mb-5 border border-border/40">
                    <FileText className="w-3 h-3 inline-block me-1" />
                    {contentPageOrdinal !== null
                      ? `${t('contentPageLabel')} ${contentPageOrdinal} ${t('of')} ${totalContentPages}`
                      : ''}
                  </span>
                  <h1 className="text-display-md md:text-display-lg font-medium leading-tight text-foreground mb-3">
                    {contentPage.title}
                  </h1>
                  <div className="w-20 h-1 bg-primary mx-auto rounded-full" />
                </header>

                <div className="bg-card rounded-3xl p-card-padding-lg md:p-10 border border-border/60 shadow-card-hover shadow-muted/50">
                  {bodyRendered ? (
                    <div className="prose prose-lg max-w-none dark:prose-invert leading-relaxed">
                      {bodyRendered}
                    </div>
                  ) : (
                    <div className="text-center py-section-md">
                      <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                        <FileText className="w-6 h-6 text-muted-foreground/50" />
                      </div>
                      <p className="text-body-sm font-medium text-muted-foreground">No content</p>
                      <p className="text-body-xs text-muted-foreground/60 mt-1">
                        This page has no content yet
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        <div className="sticky bottom-0 z-30 bg-card/80 backdrop-blur-xl border-t border-border/50 px-6 py-content-gap pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="max-w-3xl mx-auto flex items-center justify-center gap-content-gap-lg">
            <button
              onClick={handlePrev}
              disabled={!canGoPrev || isNavigating}
              aria-label="Previous page"
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-normal cursor-pointer',
                !canGoPrev || isNavigating
                  ? 'text-muted-foreground/40'
                  : 'bg-muted text-foreground hover:bg-muted/80',
              )}
            >
              <span className="text-heading-lg font-light">‹</span>
            </button>
            <button
              onClick={handleNext}
              disabled={!canGoNext || isNavigating}
              aria-label="Next page"
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-normal cursor-pointer',
                !canGoNext || isNavigating
                  ? 'text-muted-foreground/40'
                  : 'bg-muted text-foreground hover:bg-muted/80',
              )}
            >
              <span className="text-heading-lg font-light">›</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {headerSlot}
      <Confetti active={showConfetti} />
      <Progress value={progressPercent} className="h-0.5 rounded-none" />

      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 sm:px-6 py-section-md md:py-section-lg max-w-3xl">
          {pageState.type === 'outro' && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="mx-auto flex w-full max-w-3xl flex-col items-center gap-content-gap-lg text-center"
            >
              <header className="space-y-3">
                <span className="inline-flex items-center gap-content-gap-xs rounded-lg border border-border bg-muted px-4 py-2 text-label uppercase tracking-wider text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  {t('lessonSummaryEndTitle')}
                </span>
                <div className="space-y-2">
                  <h1 className="text-display-md font-medium leading-tight text-foreground md:text-display-lg">
                    {lessonTitle}
                  </h1>
                  {gradeLevel ? (
                    <p className="text-body-md text-muted-foreground">{gradeLevel}</p>
                  ) : null}
                </div>
              </header>

              <div className="grid w-full gap-content-gap-sm sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-card p-card-padding shadow-elevation-1">
                  <Layers className="mx-auto mb-3 h-5 w-5 text-primary" />
                  <p className="text-heading-xl font-medium text-foreground">
                    {solvedExerciseCount} / {totalExercises}
                  </p>
                  <p className="mt-1 text-body-sm text-muted-foreground">
                    {t('lessonSummarySolvedExercises')}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-card p-card-padding shadow-elevation-1">
                  <CheckCircle2 className="mx-auto mb-3 h-5 w-5 text-success" />
                  <p className="text-heading-xl font-medium text-foreground">
                    {correctAnswersLabel}
                  </p>
                  <p className="mt-1 text-body-sm text-muted-foreground">
                    {t('lessonSummaryCorrectAnswers')}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-card p-card-padding shadow-elevation-1">
                  <Target className="mx-auto mb-3 h-5 w-5 text-secondary" />
                  <p className="text-heading-xl font-medium text-foreground">{scorePercent}%</p>
                  <p className="mt-1 text-body-sm text-muted-foreground">
                    {t('lessonSummaryScore')}
                  </p>
                </div>
              </div>

              {nextLesson?.title ? (
                <p className="text-body-md text-muted-foreground">
                  {t('lessonLobbyNextLesson')}: {nextLesson.title}
                </p>
              ) : null}

              <div className="flex w-full flex-col gap-content-gap-sm sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="min-h-[48px] flex-1 transition-all duration-normal"
                >
                  <SystemLink href={nextLessonUrl}>
                    {primaryActionLabel}
                    <ChevronLeft className="ms-2 h-5 w-5 rtl:rotate-0 ltr:rotate-180" />
                  </SystemLink>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleStart}
                  disabled={isNavigating}
                  className="min-h-[48px] flex-1 transition-all duration-normal"
                >
                  <RotateCcw className="me-2 h-4 w-4" />
                  {t('lessonSummaryRetry')}
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  )
}
