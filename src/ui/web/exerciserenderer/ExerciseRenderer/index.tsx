/**
 * Exercise Renderer - Block-Based
 * Renders exercises with mixed content and question blocks
 * Each question block has its own answer UI
 */

'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/infra/utils/ui'
import { useTranslations, useLocale } from '@/ui/web/providers/I18n'
import { Button } from '@/ui/web/components/button'
import { Card } from '@/ui/web/components/card'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import type {
  ExerciseRendererProps,
  ContentBlock,
  QuestionBlock,
  QuestionSelectTrueFalseBlock,
  QuestionSelectMcqBlock,
  QuestionFreeResponseBlock,
  QuestionTableBlock,
  QuestionMatchingBlock,
  SvgBlock,
  MediaBlock,
  UserAnswer,
  CheckResult,
} from '../types'
import type { GeometrySpecV1, AxisSpecV1 } from '@/infra/contracts'
import type { DisplaySize } from '../blocks/AxisRenderer'
import { FadeIn } from '@/ui/web/components/motion'
import { Confetti } from '@/ui/web/components/confetti'
import { Progress } from '@/ui/web/components/progress'
import { Sparkles } from 'lucide-react'
import { HtmlBlockRenderer } from '../blocks/HtmlBlockRenderer'
import { RichTextRenderer } from '../blocks/RichTextRenderer'
import { SvgRenderer } from '../blocks/SvgRenderer'
import { GeometryRenderer } from '../blocks/GeometryRenderer'
import { AxisRenderer } from '../blocks/AxisRenderer'
import { GraphWithPrompt } from '../blocks/GraphWithPrompt'
import { LatexBlockRenderer } from '../blocks/LatexBlockRenderer'
import { MultiAxisRenderer } from '../blocks/MultiAxisRenderer'
import { TrueFalseQuestion } from '../questions/TrueFalseQuestion'
import { McqQuestion } from '../questions/McqQuestion'
import { FreeResponseQuestion } from '../questions/FreeResponseQuestion'
import { TableQuestion } from '../questions/TableQuestion'
import { MatchingQuestion } from '../questions/MatchingQuestion'
import { QuestionCard } from '../components/QuestionCard'
import { HelpSystem } from '../components/HelpSystem'
import { useHelpSystem } from '../hooks/useHelpSystem'
import {
  checkQuestionAnswer,
  getInitialAnswer,
  checkSvgAnswer,
  getInitialSvgAnswer,
  type AnswerErrorMessages,
} from '../utils/answerChecking'
import { MediaMapProvider } from '../context/MediaMapContext'
import { VideoPlayer } from '../components/VideoPlayer'
import { getMediaUrl } from '@/infra/utils/getMediaUrl'

/**
 * Hebrew letters for question numbering
 */
const HEBREW_LETTERS = [
  'א',
  'ב',
  'ג',
  'ד',
  'ה',
  'ו',
  'ז',
  'ח',
  'ט',
  'י',
  'כ',
  'ל',
  'מ',
  'נ',
  'ס',
  'ע',
  'פ',
  'צ',
  'ק',
  'ר',
  'ש',
  'ת',
]

/**
 * Get English letter for question index (a, b, c, ...)
 */
function getEnglishLetter(index: number): string {
  return String.fromCharCode('a'.charCodeAt(0) + (index - 1))
}

/**
 * Format student's answer as readable text for AI context
 */
function formatStudentAnswer(question: QuestionBlock, answer: UserAnswer): string {
  if (answer.type === 'true_false') {
    return answer.value === true ? 'True' : 'False'
  }
  if (answer.type === 'mcq' && question.type === 'question_select' && question.variant === 'mcq') {
    const selected = question.answer.options.filter((o) => answer.selectedIds.includes(o.id))
    return selected.map((o) => o.content.value).join(', ')
  }
  if (answer.type === 'free_response') {
    return answer.value
  }
  if (answer.type === 'table') {
    return Object.entries(answer.cellValues)
      .map(([key, val]) => `[${key}]: ${val}`)
      .join(', ')
  }
  if (answer.type === 'matching') {
    return answer.connections.map((c) => `${c.leftId} → ${c.rightId}`).join(', ')
  }
  return ''
}

/**
 * Main Exercise Renderer Component
 */
const EMPTY_MEDIA_MAP = {} as const

export function ExerciseRenderer({
  groups,
  mode: _mode = 'student',
  showCheckAnswer = true,
  className = '',
  mediaMap = EMPTY_MEDIA_MAP,
  exerciseNumber = 1,
  showExerciseNumber = false,
  lessonId = '',
  exerciseId = '',
  onResultsChange,
  hideLatexBlocks = true,
  batchCheckMode = false,
  hideBatchCheckButton = false,
  checkAllTrigger,
}: ExerciseRendererProps) {
  const t = useTranslations('courses')
  const locale = useLocale()

  const errorMessages: AnswerErrorMessages = useMemo(
    () => ({
      invalidAnswerType: t('invalidAnswerType'),
      selectTrueFalse: t('selectTrueFalse'),
      noCorrectAnswer: t('noCorrectAnswer'),
      selectAnAnswer: t('selectAnAnswer'),
      enterAnAnswer: t('enterAnAnswer'),
      unknownVariant: t('unknownVariant'),
      validationFailed: t('validationFailed'),
      validationError: t('validationError'),
      connectionError: t('connectionError'),
    }),
    [t],
  )

  // Track answers and check results for each question block
  const flatBlocks: ContentBlock[] = useMemo(
    () => groups.flatMap((group) => group.blocks),
    [groups],
  )
  const questionBlocks = useMemo(
    () =>
      flatBlocks.filter(
        (block) =>
          block.type === 'question_select' ||
          block.type === 'question_free_response' ||
          block.type === 'question_table' ||
          block.type === 'question_matching',
      ) as QuestionBlock[],
    [flatBlocks],
  )

  // Help system state (hint/guiding/solution per question)
  const { helpUsage, activeHelp, handleHintClick, handleGuidingClick, handleSolutionClick } =
    useHelpSystem({
      questionBlocks,
      lessonId,
      exerciseId,
      locale: locale ?? undefined,
    })

  // localStorage key for persisting answers per exercise
  const storageKey = exerciseId ? `a-guy:answers:${exerciseId}` : ''

  const [answers, setAnswers] = useState<Record<string, UserAnswer>>(() => {
    // Try to restore saved answers from localStorage
    if (storageKey && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, UserAnswer>
          // Merge saved answers with initial answers (in case new questions were added)
          const initial: Record<string, UserAnswer> = {}
          questionBlocks.forEach((q) => {
            initial[q.id] = parsed[q.id] ?? getInitialAnswer(q)
          })
          return initial
        }
      } catch {
        // Corrupted data — fall through to default
      }
    }
    const initial: Record<string, UserAnswer> = {}
    questionBlocks.forEach((q) => {
      initial[q.id] = getInitialAnswer(q)
    })
    return initial
  })

  // Persist answers to localStorage on every change
  const persistAnswers = useCallback(
    (updated: Record<string, UserAnswer>) => {
      if (!storageKey || typeof window === 'undefined') return
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated))
      } catch {
        // Storage full or unavailable — silent
      }
    },
    [storageKey],
  )

  const [checkResults, setCheckResults] = useState<Record<string, CheckResult>>({})
  const [hasChecked, setHasChecked] = useState<Record<string, boolean>>({})
  const [isChecking, setIsChecking] = useState<Record<string, boolean>>({})
  const [isBatchChecking, setIsBatchChecking] = useState(false)
  const chatTriggeredRef = useRef<Set<string>>(new Set())

  // Aggregate correctness tracking
  const totalQuestions = questionBlocks.length
  const correctCount = Object.values(checkResults).filter((r) => r.isCorrect).length
  const allQuestionsCorrect = totalQuestions > 0 && correctCount === totalQuestions
  const allCorrectFiredRef = useRef(false)
  const [showAllCorrectConfetti, setShowAllCorrectConfetti] = useState(false)

  // Report aggregate correctness to parent when check results change
  useEffect(() => {
    if (!onResultsChange) return
    const checkedCount = Object.keys(checkResults).length
    onResultsChange({ totalQuestions, checkedCount, correctCount })
  }, [checkResults, onResultsChange, totalQuestions, correctCount])

  // Fire all-correct celebration once
  useEffect(() => {
    if (allQuestionsCorrect && !allCorrectFiredRef.current) {
      allCorrectFiredRef.current = true
      setShowAllCorrectConfetti(true)
    }
  }, [allQuestionsCorrect])

  // SVG hotspot state (interactive SVGs are separate from QuestionBlock flow)
  const [svgAnswers, setSvgAnswers] = useState<Record<string, UserAnswer>>({})
  const [svgCheckResults, setSvgCheckResults] = useState<Record<string, CheckResult>>({})

  const handleSvgHotspotToggle = (blockId: string, hotspotId: string) => {
    setSvgAnswers((prev) => {
      const current = prev[blockId] ?? getInitialSvgAnswer()
      if (current.type !== 'svg') return prev
      const ids = current.selectedHotspotIds.includes(hotspotId)
        ? current.selectedHotspotIds.filter((id) => id !== hotspotId)
        : [...current.selectedHotspotIds, hotspotId]
      return { ...prev, [blockId]: { type: 'svg', selectedHotspotIds: ids } }
    })
  }

  const handleSvgCheck = (blockId: string, block: SvgBlock) => {
    const answer = svgAnswers[blockId] ?? getInitialSvgAnswer()
    if (answer.type !== 'svg') return
    const result = checkSvgAnswer(block, answer.selectedHotspotIds, errorMessages)
    setSvgCheckResults((prev) => ({ ...prev, [blockId]: result }))
  }

  const handleAnswerChange = async (questionId: string, answer: UserAnswer) => {
    setAnswers((prev) => {
      const updated = { ...prev, [questionId]: answer }
      persistAnswers(updated)
      return updated
    })

    // In batch check mode nothing is graded until the student clicks
    // "Check all" — we just store the answer and let batchCheck handle it.
    if (batchCheckMode) {
      return
    }

    // For true/false questions, check immediately on selection
    const question = questionBlocks.find((q) => q.id === questionId)
    if (
      question?.type === 'question_select' &&
      answer.type === 'true_false' &&
      answer.value !== null
    ) {
      const result = await checkQuestionAnswer(question, answer, errorMessages)
      setCheckResults((prev) => ({ ...prev, [questionId]: result }))
      setHasChecked((prev) => ({ ...prev, [questionId]: true }))
      if (!result.isCorrect && !chatTriggeredRef.current.has(questionId)) {
        chatTriggeredRef.current.add(questionId)
        window.dispatchEvent(
          new CustomEvent('exercise-incorrect-answer', {
            detail: {
              questionJson: JSON.stringify(question),
              studentAnswer: formatStudentAnswer(question, answer),
            },
          }),
        )
      }
    } else {
      // For other question types, clear the check result (chat trigger stays — one per question)
      setCheckResults((prev) => {
        const next = { ...prev }
        delete next[questionId]
        return next
      })
      setHasChecked((prev) => ({ ...prev, [questionId]: false }))
    }
  }

  /**
   * Run a check against the given answer (already-resolved object, not state).
   * Shared by `handleCheckAnswer` (explicit Check Answer button) and
   * `handleAutoCheckMcq` (button-click auto-check on 2-option MCQs). Sourcing
   * the answer from the parameter — rather than `answers[questionId]` — is
   * important for the auto-check path because React state hasn't flushed yet
   * inside the same click handler that just called `setAnswers`.
   */
  const runCheckWithAnswer = useCallback(
    async (questionId: string, ans: UserAnswer) => {
      const question = questionBlocks.find((q) => q.id === questionId)
      if (!question) return

      setIsChecking((prev) => ({ ...prev, [questionId]: true }))
      try {
        const result = await checkQuestionAnswer(question, ans, errorMessages)
        setCheckResults((prev) => ({ ...prev, [questionId]: result }))
        setHasChecked((prev) => ({ ...prev, [questionId]: true }))
        if (!result.isCorrect && !chatTriggeredRef.current.has(questionId)) {
          chatTriggeredRef.current.add(questionId)
          window.dispatchEvent(
            new CustomEvent('exercise-incorrect-answer', {
              detail: {
                questionJson: JSON.stringify(question),
                studentAnswer: formatStudentAnswer(question, ans),
              },
            }),
          )
        }
      } finally {
        setIsChecking((prev) => ({ ...prev, [questionId]: false }))
      }
    },
    [questionBlocks, errorMessages],
  )

  const handleCheckAnswer = useCallback(
    async (questionId: string) => {
      await runCheckWithAnswer(questionId, answers[questionId])
    },
    [runCheckWithAnswer, answers],
  )

  /**
   * Auto-check path for 2-option single-select MCQ buttons: the click already
   * resolved the new answer, so we update state + run the check against the
   * parameter directly (state has not flushed yet inside this handler).
   */
  const handleAutoCheckMcq = useCallback(
    async (questionId: string, ans: UserAnswer) => {
      setAnswers((prev) => {
        const updated = { ...prev, [questionId]: ans }
        persistAnswers(updated)
        return updated
      })
      await runCheckWithAnswer(questionId, ans)
    },
    [runCheckWithAnswer, persistAnswers],
  )

  const handleTableCheckResult = (questionId: string, isCorrect: boolean) => {
    setCheckResults((prev) => ({ ...prev, [questionId]: { isCorrect } }))
    setHasChecked((prev) => ({ ...prev, [questionId]: true }))
    if (!isCorrect && !chatTriggeredRef.current.has(questionId)) {
      chatTriggeredRef.current.add(questionId)
      const question = questionBlocks.find((q) => q.id === questionId)
      window.dispatchEvent(
        new CustomEvent('exercise-incorrect-answer', {
          detail: {
            questionJson: JSON.stringify(question),
            studentAnswer: formatStudentAnswer(question!, answers[questionId]),
          },
        }),
      )
    }
  }

  const handleBatchCheck = async () => {
    if (isBatchChecking) return
    setIsBatchChecking(true)
    try {
      const newResults: Record<string, CheckResult> = {}
      const newHasChecked: Record<string, boolean> = {}
      for (const question of questionBlocks) {
        const answer = answers[question.id] ?? getInitialAnswer(question)
        const result = await checkQuestionAnswer(question, answer, errorMessages)
        newResults[question.id] = result
        newHasChecked[question.id] = true
        if (!result.isCorrect && !chatTriggeredRef.current.has(question.id)) {
          chatTriggeredRef.current.add(question.id)
          window.dispatchEvent(
            new CustomEvent('exercise-incorrect-answer', {
              detail: {
                questionJson: JSON.stringify(question),
                studentAnswer: formatStudentAnswer(question, answer),
              },
            }),
          )
        }
      }
      setCheckResults((prev) => ({ ...prev, ...newResults }))
      setHasChecked((prev) => ({ ...prev, ...newHasChecked }))
    } finally {
      setIsBatchChecking(false)
    }
  }

  // Parent-driven "Check all" — a parent with multiple ExerciseRenderer
  // children can bump `checkAllTrigger` to grade every child from a single
  // button. We intentionally ignore the initial undefined/0 value so mounting
  // doesn't auto-grade.
  const triggerRef = useRef<number | undefined>(checkAllTrigger)
  useEffect(() => {
    if (!batchCheckMode) return
    if (checkAllTrigger === undefined || checkAllTrigger === 0) return
    if (triggerRef.current === checkAllTrigger) return
    triggerRef.current = checkAllTrigger
    handleBatchCheck()
    // handleBatchCheck is stable via closure; we intentionally only depend on
    // the trigger to avoid re-firing on unrelated re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkAllTrigger, batchCheckMode])

  /**
   * Render a single block, returning the node and the next question index
   * after incrementing for question blocks (table/select/free_response/
   * matching). Rich text, latex, html, svg, media, geometry, axis, and
   * multi-axis blocks leave the counter untouched so the letter sequence
   * stays aligned with the spec.
   */
  const renderBlock = (
    block: ContentBlock,
    questionIndex: number,
  ): { node: React.ReactNode; nextIndex: number } => {
    // Geometry/Axis — media-only display blocks (type not in ContentBlock union)
    const b = block as ContentBlock & {
      geometry?: unknown
      axis?: unknown
      layout?: string
      prompt?: unknown
    }
    if (b.type === ('question_geometry' as string)) {
      const geometryBlock = b as ContentBlock & { geometry?: GeometrySpecV1 }
      return {
        node: (
          <GraphWithPrompt
            key={b.id}
            blockId={b.id}
            layout={
              (b.layout as 'textAbove' | 'textBelow' | 'textLeft' | 'textRight') || 'textRight'
            }
            prompt={b.prompt as import('@/infra/types/exercise').InlineRichText | undefined}
          >
            <GeometryRenderer blockId={b.id} spec={geometryBlock.geometry as GeometrySpecV1} />
          </GraphWithPrompt>
        ),
        nextIndex: questionIndex,
      }
    }
    if (b.type === ('question_axis' as string)) {
      const axisBlock = b as ContentBlock & {
        axis?: AxisSpecV1
        displaySize?: DisplaySize
      }
      return {
        node: (
          <GraphWithPrompt
            key={b.id}
            blockId={b.id}
            layout={
              (b.layout as 'textAbove' | 'textBelow' | 'textLeft' | 'textRight') || 'textRight'
            }
            prompt={b.prompt as import('@/infra/types/exercise').InlineRichText | undefined}
          >
            <AxisRenderer
              blockId={b.id}
              spec={axisBlock.axis as AxisSpecV1}
              displaySize={axisBlock.displaySize}
            />
          </GraphWithPrompt>
        ),
        nextIndex: questionIndex,
      }
    }
    if (b.type === ('question_multi_axis' as string)) {
      const multiAxisBlock = b as unknown as {
        id: string
        graphs: Array<{ id: string; label: string; axis: AxisSpecV1; order: number }>
        prompt?: {
          type: 'rich_text'
          format: 'md-math-v1'
          value: string
          mediaIds?: string[]
        }
        textPosition?: 'above' | 'below'
        columnsPerRow?: 1 | 2 | 4
      }
      return {
        node: (
          <div key={multiAxisBlock.id}>
            <MultiAxisRenderer
              blockId={multiAxisBlock.id}
              graphs={multiAxisBlock.graphs}
              prompt={multiAxisBlock.prompt}
              textPosition={multiAxisBlock.textPosition ?? 'above'}
              columnsPerRow={multiAxisBlock.columnsPerRow}
            />
          </div>
        ),
        nextIndex: questionIndex,
      }
    }

    // Rich text block - just render content
    if (block.type === 'rich_text') {
      return {
        node: (
          <FadeIn key={block.id}>
            <div className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed">
              <RichTextRenderer block={block} />
            </div>
          </FadeIn>
        ),
        nextIndex: questionIndex,
      }
    }

    // LaTeX blocks: hidden by default in the viewer. They are kept in
    // exercise content as a source-of-truth reference (the script
    // converter inserts parsed structured blocks alongside them) but
    // students see only the parsed output. Callers that need to show
    // the raw LaTeX (admin previews, etc.) can pass
    // `hideLatexBlocks={false}`.
    if (block.type === 'latex') {
      if (hideLatexBlocks) return { node: null, nextIndex: questionIndex }
      return {
        node: (
          <FadeIn key={block.id}>
            <div className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed">
              <LatexBlockRenderer block={block} />
            </div>
          </FadeIn>
        ),
        nextIndex: questionIndex,
      }
    }

    // SVG block - static or interactive
    if (block.type === 'svg') {
      const svgBlock = block as SvgBlock
      if (svgBlock.interactive && svgBlock.hotspots?.length) {
        const svgAnswer = svgAnswers[svgBlock.id] ?? getInitialSvgAnswer()
        const svgResult = svgCheckResults[svgBlock.id] || null
        const svgDisabled = svgResult?.isCorrect
        return {
          node: (
            <QuestionCard
              key={svgBlock.id}
              showCheckButton={showCheckAnswer}
              onCheckAnswer={() => handleSvgCheck(svgBlock.id, svgBlock)}
              disabled={!!svgDisabled}
              loading={false}
              checked={!!svgResult}
              checkResult={svgResult}
              checkAnswerText={t('checkAnswer')}
              correctText={t('correct')}
              incorrectText={t('incorrect')}
            >
              <SvgRenderer
                block={svgBlock}
                selectedHotspotIds={svgAnswer.type === 'svg' ? svgAnswer.selectedHotspotIds : []}
                onHotspotToggle={(id) => handleSvgHotspotToggle(svgBlock.id, id)}
                disabled={!!svgDisabled}
                checkResult={svgResult}
                correctHotspotIds={svgBlock.correctHotspotIds}
              />
            </QuestionCard>
          ),
          nextIndex: questionIndex,
        }
      }
      return {
        node: (
          <div key={svgBlock.id}>
            <SvgRenderer block={svgBlock} />
          </div>
        ),
        nextIndex: questionIndex,
      }
    }

    // HTML block - render sanitized HTML
    if (block.type === 'html') {
      return {
        node: (
          <div
            key={block.id}
            className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed"
          >
            <HtmlBlockRenderer block={block} />
          </div>
        ),
        nextIndex: questionIndex,
      }
    }

    // Media block - render image or video from mediaMap
    if (block.type === 'media') {
      const mediaBlock = block as MediaBlock
      const media = mediaMap[mediaBlock.mediaId]

      if (!media) {
        return {
          node: (
            <div key={mediaBlock.id} className="my-4">
              <p className="text-body-sm text-muted-foreground">{t('videoUnavailable')}</p>
            </div>
          ),
          nextIndex: questionIndex,
        }
      }

      // Check if media is a video (type field or mimeType starts with 'video/')
      const isVideo = media.type === 'video' || media.mimeType?.startsWith('video/')

      if (isVideo) {
        return {
          node: (
            <div key={mediaBlock.id} className="my-4">
              <VideoPlayer src={media.url} mimeType={media.mimeType} />
            </div>
          ),
          nextIndex: questionIndex,
        }
      }

      // Otherwise render as image (using getMediaUrl for proper URL resolution)
      const imageSrc = getMediaUrl(media.url)
      return {
        node: (
          <div
            key={mediaBlock.id}
            className="my-4 rounded-xl overflow-hidden border border-border/60 bg-muted/30"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt={media.alt || media.filename || ''}
              className="w-full h-auto max-h-96 object-contain"
            />
          </div>
        ),
        nextIndex: questionIndex,
      }
    }

    // NOTE: We count question_table as a question so it gets its own section letter.
    // Rich text / latex blocks must NOT increment the counter.
    const nextIndex =
      block.type === 'question_select' ||
      block.type === 'question_free_response' ||
      block.type === 'question_table' ||
      block.type === 'question_matching'
        ? questionIndex + 1
        : questionIndex

    // Question blocks - render with answer UI
    const question = block as QuestionBlock

    // Compute question letter label
    const questionLabel = isHebrew
      ? HEBREW_LETTERS[nextIndex - 1] || String(nextIndex)
      : getEnglishLetter(nextIndex)

    const answer = answers[question.id] ?? getInitialAnswer(question)
    const checkResult = checkResults[question.id] || null
    const checked = hasChecked[question.id] || false
    const disabled = checked && checkResult?.isCorrect

    // True/False and Table questions don't use the generic check button.
    // In batch check mode the per-question check button is always hidden
    // — grading happens through the single "Check all" button instead.
    const showCheckButton =
      showCheckAnswer &&
      !batchCheckMode &&
      !(question.type === 'question_select' && question.variant === 'true_false') &&
      question.type !== 'question_table'

    // Help system for this question (always shown — AI fallback when no backend content).
    // In batch check mode the help system is hidden: the student should
    // attempt the test without hints/solutions.
    const helpSystemNode = batchCheckMode ? null : (
      <HelpSystem
        question={question}
        helpUsage={
          helpUsage[question.id] ?? {
            hintShown: false,
            guidingUsed: false,
            solutionUnlocked: false,
          }
        }
        activeHelp={activeHelp[question.id] ?? null}
        onHintClick={() => handleHintClick(question.id)}
        onGuidingClick={() => handleGuidingClick(question.id)}
        onSolutionClick={() => handleSolutionClick(question.id)}
        hintLabel={t('helpHint')}
        guidingLabel={t('helpGuidingQuestion')}
        solutionLabel={t('helpSolution')}
      />
    )

    return {
      node: (
        <QuestionCard
          key={question.id}
          showCheckButton={showCheckButton}
          onCheckAnswer={() => handleCheckAnswer(question.id)}
          disabled={!!disabled}
          loading={!!isChecking[question.id]}
          checked={checked}
          checkResult={checkResult}
          checkAnswerText={t('checkAnswer')}
          correctText={t('correct')}
          incorrectText={t('incorrect')}
          questionLabel={questionLabel}
          dir={dir}
          helpSystem={helpSystemNode}
          animationDelay={nextIndex * 0.08}
        >
          {/* Render appropriate question component based on type */}
          {question.type === 'question_select' && question.variant === 'true_false' && (
            <TrueFalseQuestion
              question={question as QuestionSelectTrueFalseBlock}
              answer={answer}
              onChange={(ans) => handleAnswerChange(question.id, ans)}
              disabled={!!disabled}
              checkResult={checkResult}
            />
          )}
          {question.type === 'question_select' && question.variant === 'mcq' && (
            <McqQuestion
              question={question as QuestionSelectMcqBlock}
              answer={answer}
              onChange={(ans) => handleAnswerChange(question.id, ans)}
              disabled={!!disabled}
              checkResult={checkResult}
              t={t}
              onAutoSubmit={
                batchCheckMode ? undefined : (ans) => handleAutoCheckMcq(question.id, ans)
              }
            />
          )}
          {question.type === 'question_free_response' && (
            <FreeResponseQuestion
              question={question as QuestionFreeResponseBlock}
              answer={answer}
              onChange={(ans) => handleAnswerChange(question.id, ans)}
              disabled={!!disabled}
              checkResult={checkResult}
              t={t}
            />
          )}
          {question.type === 'question_table' && (
            <TableQuestion
              question={question as QuestionTableBlock}
              answer={answer}
              onChange={(ans) => handleAnswerChange(question.id, ans)}
              disabled={!!disabled}
              checked={checked}
              allCorrect={!!disabled}
              onCheckResult={(correct) => handleTableCheckResult(question.id, correct)}
              t={t}
            />
          )}
          {question.type === 'question_matching' && (
            <MatchingQuestion
              question={question as QuestionMatchingBlock}
              answer={answer}
              onChange={(ans) => handleAnswerChange(question.id, ans)}
              disabled={!!disabled}
              checkResult={checkResult}
              t={t}
            />
          )}
        </QuestionCard>
      ),
      nextIndex,
    }
  }

  // Validate content structure
  if (!Array.isArray(groups)) {
    return (
      <div className={cn('w-full max-w-3xl mx-auto', className)}>
        <Card className="p-card-padding border-destructive bg-destructive/5">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-body-lg font-semibold text-destructive mb-1">
                Invalid Content Format
              </h3>
              <p className="text-body-sm text-muted-foreground">
                Expected: ExerciseBlockGroup[] from getExerciseBlockGroups()
              </p>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // Determine direction based on locale
  // NOTE: Section label language is determined ONLY by locale prefix.
  // Hebrew: א/ב/ג..., English: a/b/c... (lowercase).
  const isHebrew = locale?.toLowerCase().startsWith('he')
  const dir: 'ltr' | 'rtl' = isHebrew ? 'rtl' : 'ltr'

  return (
    <MediaMapProvider value={mediaMap}>
      <div className={cn('w-full max-w-3xl mx-auto', className)}>
        {/* Exercise Number Bubble - only shown when explicitly enabled (e.g. multiple exercises on one page) */}
        {/* NOTE: We intentionally avoid flex-row-reverse here because it inverts the bubble
             position depending on DOM order. Instead we pin the bubble via auto margins. */}
        {showExerciseNumber && (
          <div className="w-full flex items-center justify-between mb-6">
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center bg-muted border border-border shadow-elevation-1',
                isHebrew ? 'ml-auto' : 'mr-auto',
              )}
            >
              <span className="font-bold text-body-sm">{String(exerciseNumber)}</span>
            </div>
          </div>
        )}

        {/* Progress Bar — only when 2+ questions */}
        {totalQuestions >= 2 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-body-xs text-muted-foreground">
                {correctCount} / {totalQuestions} נכון
              </p>
              {/* Dot indicators — one per question */}
              <div className="flex items-center gap-1.5">
                {questionBlocks.map((q, i) => {
                  const result = checkResults[q.id]
                  const isCorrect = result?.isCorrect
                  const isChecked = !!result
                  const qLabel = isHebrew ? HEBREW_LETTERS[i] || String(i + 1) : String(i + 1)
                  return (
                    <div
                      key={q.id}
                      title={`שאלה ${qLabel}`}
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-slow',
                        !isChecked && 'bg-muted border border-border/40 text-muted-foreground',
                        isChecked &&
                          !isCorrect &&
                          'bg-destructive/15 border border-destructive/30 text-destructive',
                        isCorrect && 'bg-success/15 border border-success/30 text-success',
                      )}
                    >
                      {qLabel}
                    </div>
                  )
                })}
              </div>
            </div>
            <Progress
              value={totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0}
              className="h-1.5 rounded-full"
            />
          </div>
        )}

        {/* All-correct celebration */}
        <Confetti active={showAllCorrectConfetti} duration={3000} />
        {allQuestionsCorrect && (
          <FadeIn>
            <div className="rounded-2xl bg-gradient-to-r from-success/15 via-success/10 to-success/15 border-2 border-success/30 p-5 text-center flex flex-col items-center gap-content-gap-xs shadow-card">
              <div className="flex items-center gap-content-gap-xs">
                <Sparkles className="w-6 h-6 text-success" />
                <span className="text-heading-lg font-black text-success">{t('correct')}</span>
                <Sparkles className="w-6 h-6 text-success" />
              </div>
              <p className="text-body-sm text-success/70">כל התשובות נכונות</p>
            </div>
          </FadeIn>
        )}

        <div className="flex flex-col gap-content-gap-lg">
          {(() => {
            let questionIndex = 0
            const groupNodes: React.ReactNode[] = []
            groups.forEach((group, groupIdx) => {
              const blockNodes = group.blocks.map((block) => {
                const { node, nextIndex } = renderBlock(block, questionIndex)
                questionIndex = nextIndex
                return node
              })
              groupNodes.push(
                <React.Fragment key={`group-${groupIdx}`}>{blockNodes}</React.Fragment>,
              )
            })
            return groupNodes
          })()}

          {batchCheckMode && !hideBatchCheckButton && totalQuestions > 0 && (
            <div className="flex justify-center pt-2">
              <Button
                onClick={handleBatchCheck}
                disabled={isBatchChecking}
                size="lg"
                className="rounded-xl font-bold text-body-md text-white"
              >
                {isBatchChecking ? (
                  <>
                    <Loader2 className="w-5 h-5 me-2 animate-spin" />
                    {t('checkAnswer')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 me-2" />
                    {t('checkAllAnswers')}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </MediaMapProvider>
  )
}
