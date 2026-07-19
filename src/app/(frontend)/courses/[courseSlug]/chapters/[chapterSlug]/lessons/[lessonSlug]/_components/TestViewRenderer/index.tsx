/**
 * @fileType component
 * @domain lessons
 * @pattern test-view
 * @ai-summary Renders every exercise of a lesson as a single scrollable
 *             "test" page. Each exercise keeps a small header (number / title)
 *             matching the Scroll view's card cadence, and the question UI is
 *             delegated to ExerciseRenderer with `batchCheckMode` enabled so
 *             hints/solutions/per-question check buttons are hidden. A single
 *             "Check all" button pinned at the bottom bumps a shared trigger
 *             so every ExerciseRenderer on the page grades in one click.
 */

'use client'

import React, { useState } from 'react'
import type { Exercise, FormulaSheet, Media as MediaType } from '@/infra/types/content'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer'
import { ExerciseWorkspace } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace'
import { ChatInterface } from '@/ui/web/chat'
import { getExerciseBlockGroups } from '@/lib/exercises/getExerciseBlocks'
import { Button } from '@/ui/web/components/button'
import { CheckCircle2 } from 'lucide-react'
import { useTranslations } from '@/ui/web/providers/I18n'

interface TestViewRendererProps {
  lessonTitle: string
  backUrl: string
  courseSlug?: string
  chapterSlug?: string
  lessonSlug?: string
  lessonId: string
  exercises: Exercise[]
  mediaMap?: Record<string, MediaType>
  showChat?: boolean
  formulaSheet?: FormulaSheet | null
  /** Optional element rendered at the top of the primary pane (e.g. tab bar). */
  headerSlot?: React.ReactNode
  /** When true, forwards to ExerciseRenderer so `type: 'latex'` blocks are not rendered. */
  hideLatexBlocks?: boolean
  nextLesson?: { title?: string | null; slug?: string | null } | null
}

export function TestViewRenderer({
  lessonTitle,
  backUrl,
  courseSlug: _courseSlug,
  chapterSlug: _chapterSlug,
  lessonSlug: _lessonSlug,
  lessonId,
  exercises,
  mediaMap,
  showChat,
  formulaSheet,
  headerSlot,
  hideLatexBlocks,
  nextLesson: _nextLesson,
}: TestViewRendererProps) {
  const t = useTranslations('courses')

  // Only render exercises that have blocks. Mirrors BlocksDocumentLessonView's
  // filter so empty exercises don't leave gaps in the test page.
  const renderable = exercises
    .map((exercise) => ({ exercise, groups: getExerciseBlockGroups(exercise) }))
    .filter((entry) => entry.groups.some((group) => group.blocks.length > 0))

  // Bumping this counter tells every ExerciseRenderer on the page to run its
  // batch check. Each child ignores the initial 0 and only reacts to changes.
  const [checkAllTrigger, setCheckAllTrigger] = useState(0)

  const chatContent = showChat ? (
    <ChatInterface
      lessonId={lessonId}
      translationNamespace="courses"
      showMathTools={true}
      formulaSheet={formulaSheet}
    />
  ) : null

  return (
    <ExerciseWorkspace
      exerciseTitle={lessonTitle}
      backUrl={backUrl}
      formulaSheet={formulaSheet}
      primaryContent={
        <div className="flex h-full flex-col">
          {headerSlot}
          <div className="flex-1 overflow-auto bg-muted print:bg-background">
            <div className="mx-auto w-full max-w-3xl px-4 py-section-md">
              {lessonTitle && (
                <h1 className="mb-section-sm text-heading-xl font-bold text-foreground">
                  {lessonTitle}
                </h1>
              )}
              <div className="flex flex-col gap-section-sm">
                {renderable.map(({ exercise, groups }, exerciseIdx) => (
                  <section
                    key={exercise.id}
                    className="rounded-xl border border-border bg-card shadow-elevation-1 overflow-hidden"
                    data-testid={`test-exercise-${exerciseIdx + 1}`}
                  >
                    <header
                      className={
                        'flex items-center gap-content-gap-sm border-b border-border/60 bg-muted/50 px-4 py-3'
                      }
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-body-sm font-bold text-primary">
                        {exerciseIdx + 1}
                      </span>
                      {exercise.title ? (
                        <h2 className="text-heading-sm font-semibold text-foreground">
                          {exercise.title}
                        </h2>
                      ) : null}
                    </header>
                    <div className="px-4 py-content-gap">
                      <ExerciseRenderer
                        groups={groups}
                        mediaMap={mediaMap}
                        exerciseNumber={exerciseIdx + 1}
                        showExerciseNumber={false}
                        lessonId={lessonId}
                        exerciseId={exercise.id}
                        hideLatexBlocks={hideLatexBlocks}
                        batchCheckMode
                        hideBatchCheckButton
                        checkAllTrigger={checkAllTrigger}
                      />
                    </div>
                  </section>
                ))}
              </div>

              {renderable.length > 0 && (
                <div className="mt-section-sm flex justify-center">
                  <Button
                    onClick={() => setCheckAllTrigger((n) => n + 1)}
                    size="lg"
                    className="rounded-xl font-bold text-body-md text-white"
                    data-testid="test-view-check-all"
                  >
                    <CheckCircle2 className="w-5 h-5 me-2" />
                    {t('checkAllAnswers')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      }
      chatContent={chatContent}
    />
  )
}
