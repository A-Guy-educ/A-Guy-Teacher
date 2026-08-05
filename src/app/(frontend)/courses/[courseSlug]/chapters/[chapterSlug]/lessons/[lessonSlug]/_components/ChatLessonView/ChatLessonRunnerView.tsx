'use client'

import type { Exercise, Media } from '@/infra/types/content'
import { formatExerciseContextMessage } from '@/infra/llm/exercise-context'
import { useTranslations } from '@/ui/web/providers/I18n'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChatInputPanel } from './ChatInputPanel'
import { ChatLessonProgress } from './ChatLessonProgress'
import { ChatLessonStartCard } from './ChatLessonStartCard'
import { ContinueButton } from './bubbles/ContinueButton'
import { ExerciseSectionBubble } from './bubbles/ExerciseSectionBubble'
import { PendingBubble } from './bubbles/PendingBubble'
import { StudentBubble } from './bubbles/StudentBubble'
import { TeacherBubble } from './bubbles/TeacherBubble'
import type { SectionOutcome, StreamEntry } from './types'
import { useBrowserTTS } from './useBrowserTTS'
import { useChatChannel } from './useChatChannel'
import { useExerciseWalker } from './useExerciseWalker'
import { pickWellDone } from './wellDoneMessages'

const CELEBRATION_ADVANCE_MS = 1500

/** א, ב, ג, ... — matches the ExerciseRenderer's question-card labeling. */
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

interface ChatLessonRunnerViewProps {
  lessonTitle: string
  lessonId: string
  exercises: Exercise[]
  mediaMap?: Record<string, Media>
}

export function ChatLessonRunnerView(props: ChatLessonRunnerViewProps) {
  const [hasStarted, setHasStarted] = useState(false)
  const t = useTranslations('courses')

  if (!hasStarted) {
    return (
      <div className="flex-1 overflow-y-auto bg-muted">
        <ChatLessonStartCard
          lessonTitle={props.lessonTitle}
          exerciseCount={props.exercises.length}
          startLabel={t('chatViewStart')}
          exercisesCountLabel={t('chatViewExercisesCount')}
          onStart={() => setHasStarted(true)}
        />
      </div>
    )
  }

  return <ActiveChat {...props} onExit={() => setHasStarted(false)} />
}

interface ActiveChatProps extends ChatLessonRunnerViewProps {
  onExit: () => void
}

function ActiveChat({
  lessonTitle: _lessonTitle,
  lessonId,
  exercises,
  mediaMap,
  onExit,
}: ActiveChatProps) {
  const t = useTranslations('courses')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const tts = useBrowserTTS()

  const [entries, setEntries] = useState<StreamEntry[]>([])
  const append = useCallback((entry: StreamEntry) => {
    setEntries((prev) => [...prev, entry])
  }, [])
  const replace = useCallback((key: string, entry: StreamEntry) => {
    setEntries((prev) => prev.map((e) => (e.key === key ? entry : e)))
  }, [])

  const walker = useExerciseWalker({ exercises, append })
  const currentStep = walker.currentStep
  const currentExercise = currentStep?.exercise ?? null

  // Scope the AI's attention to the current section (not the whole exercise
  // or, worse, whatever exercise the shared lesson-conversation was last
  // talking about). Passing just the current group's blocks + a section-
  // annotated title keeps every chat request grounded in the section the
  // student is actually on.
  const currentExerciseContext = useMemo(() => {
    if (!currentStep) return null
    const { exercise, group, groupIndex } = currentStep
    const baseTitle = exercise.title?.trim() ?? ''
    const sectionLetter =
      group.sectionIndex !== null ? (HEBREW_LETTERS[groupIndex] ?? String(groupIndex + 1)) : null
    const title = sectionLetter ? `${baseTitle} — סעיף ${sectionLetter}`.trim() : baseTitle
    // Cast: our lesson-fetched Media has `filename: string | null | undefined`
    // where the formatter's MediaItem expects `string | undefined`. The
    // formatter only ever falsy-checks filename, so a runtime null is fine.
    return formatExerciseContextMessage(
      title,
      group.blocks as Array<{ id: string; type: string; [key: string]: unknown }>,
      mediaMap as unknown as Parameters<typeof formatExerciseContextMessage>[2],
    )
  }, [currentStep, mediaMap])

  const chat = useChatChannel({
    lessonId,
    currentExerciseId: currentExercise?.id ?? null,
    currentExerciseContext,
    append,
    replace,
    acknowledgment: t('chatViewAcknowledgment'),
    errorMessage: t('chatViewChatError'),
    authRequiredMessage: t('chatViewAuthRequired'),
    quotaExceededMessage: t('chatViewQuotaExceeded'),
  })

  // Cancel any pending auto-advance timer whenever the student navigates or
  // resets — otherwise a leftover timer would fire after unmount.
  const pendingAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelPendingAdvance = useCallback(() => {
    if (pendingAdvanceRef.current !== null) {
      clearTimeout(pendingAdvanceRef.current)
      pendingAdvanceRef.current = null
    }
  }, [])
  useEffect(() => () => cancelPendingAdvance(), [cancelPendingAdvance])

  const advanceNow = useCallback(() => {
    cancelPendingAdvance()
    walker.advance()
  }, [cancelPendingAdvance, walker])

  const correctionPrompt = t('chatViewCorrectionPrompt')
  const correctAnswerLabel = t('chatViewCorrectAnswerLabel')
  const handleOutcome = useCallback(
    (outcome: SectionOutcome) => {
      if (outcome.kind === 'correct') {
        append({
          key: `celebrate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: 'chat-assistant',
          text: pickWellDone(),
        })
        cancelPendingAdvance()
        pendingAdvanceRef.current = setTimeout(() => {
          pendingAdvanceRef.current = null
          walker.advance()
        }, CELEBRATION_ADVANCE_MS)
      } else {
        // Post the correct-answer bubble immediately (from block data — no
        // model roundtrip), THEN kick off the AI explanation. Anchors the
        // student on the answer while the fuller correction is being
        // generated.
        if (outcome.correctAnswerText) {
          append({
            key: `ans-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            kind: 'chat-assistant',
            text: `${correctAnswerLabel}: ${outcome.correctAnswerText}`,
          })
        }
        chat.requestCorrection(correctionPrompt)
      }
    },
    [append, cancelPendingAdvance, chat, correctAnswerLabel, correctionPrompt, walker],
  )

  const handleQuestionSubmit = useCallback(
    (text: string, isCorrect: boolean) => {
      // Echo the student's answer as a right-side bubble; color is derived
      // from isCorrect so the "chose the correct option" and "chose wrong"
      // states are immediately visible even before the section outcome
      // fires the celebration or correction below.
      append({
        key: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: 'chat-user',
        text,
        isCorrect,
      })
    },
    [append],
  )

  // Narrate new teacher-side bubbles as they appear. Dedupe on `key + kind`
  // so entries replaced in place (chat-pending → chat-assistant) still
  // trigger narration when they mutate.
  const narratedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const entry of entries) {
      const token = `${entry.key}:${entry.kind}`
      if (narratedRef.current.has(token)) continue
      narratedRef.current.add(token)
      if (entry.kind === 'exercise-intro') {
        const line = entry.title
          ? `${t('chatViewIntroPrefix')} ${entry.ordinal}: ${entry.title}`
          : `${t('chatViewIntroPrefix')} ${entry.ordinal}`
        tts.speak(line)
      } else if (entry.kind === 'chat-assistant') {
        tts.speak(entry.text)
      }
    }
  }, [entries, t, tts])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries.length])

  const handleReset = useCallback(() => {
    cancelPendingAdvance()
    tts.cancel()
    onExit()
  }, [cancelPendingAdvance, onExit, tts])

  const showContinueButton = !walker.isComplete && entries.length > 0

  return (
    <>
      <main className="flex-1 overflow-y-auto bg-muted px-4 py-section-sm md:px-6 md:py-section-md">
        <div className="max-w-2xl mx-auto flex flex-col gap-content-gap" dir="rtl">
          {entries.map((entry) => (
            <StreamEntryView
              key={entry.key}
              entry={entry}
              lessonId={lessonId}
              mediaMap={mediaMap}
              tts={tts}
              onOutcome={handleOutcome}
              onQuestionSubmit={handleQuestionSubmit}
              introPrefix={t('chatViewIntroPrefix')}
              completeText={t('chatViewFinishTitle')}
            />
          ))}
          {showContinueButton && (
            <ContinueButton disabled={chat.isSending} isEnd={false} onClick={advanceNow} />
          )}
          <div ref={scrollRef} className="h-4" />
        </div>
      </main>

      <ChatInputPanel
        isSending={chat.isSending}
        placeholder={t('chatViewInputPlaceholder')}
        sendLabel={t('chatViewSendLabel')}
        onSubmit={chat.send}
      />

      <ChatLessonProgress
        stepIndex={walker.stepCursor}
        totalSteps={walker.totalSteps}
        currentExerciseOrdinal={walker.currentExerciseOrdinal}
        totalExercises={walker.totalExercises}
        currentSectionOrdinal={walker.currentSectionOrdinal}
        currentExerciseSections={walker.currentExerciseSections}
        exerciseLabel={t('chatViewProgressExercise')}
        sectionLabel={t('chatViewProgressSection')}
        onReset={handleReset}
        onToggleMute={tts.toggleMuted}
        muted={tts.muted}
        ttsSupported={tts.supported}
      />
    </>
  )
}

interface StreamEntryViewProps {
  entry: StreamEntry
  lessonId: string
  mediaMap?: Record<string, Media>
  tts: ReturnType<typeof useBrowserTTS>
  onOutcome: (outcome: SectionOutcome) => void
  onQuestionSubmit: (text: string, isCorrect: boolean) => void
  introPrefix: string
  completeText: string
}

function StreamEntryView({
  entry,
  lessonId,
  mediaMap,
  tts,
  onOutcome,
  onQuestionSubmit,
  introPrefix,
  completeText,
}: StreamEntryViewProps) {
  switch (entry.kind) {
    case 'exercise-intro': {
      const label = entry.title
        ? `${introPrefix} ${entry.ordinal}: ${entry.title}`
        : `${introPrefix} ${entry.ordinal}`
      return (
        <TeacherBubble
          text={label}
          onSpeak={() => tts.speak(label)}
          speaking={tts.speaking}
          muted={tts.muted}
          ttsSupported={tts.supported}
        />
      )
    }
    case 'exercise-section':
      return (
        <ExerciseSectionBubble
          exercise={entry.exercise}
          ordinal={entry.ordinal}
          group={entry.group}
          questionCount={entry.questionCount}
          lessonId={lessonId}
          mediaMap={mediaMap}
          speaking={tts.speaking}
          muted={tts.muted}
          ttsSupported={tts.supported}
          onOutcome={onOutcome}
          onQuestionSubmit={onQuestionSubmit}
        />
      )
    case 'chat-user':
      return <StudentBubble text={entry.text} isCorrect={entry.isCorrect} />
    case 'chat-assistant':
      return (
        <TeacherBubble
          text={entry.text}
          onSpeak={() => tts.speak(entry.text)}
          speaking={tts.speaking}
          muted={tts.muted}
          ttsSupported={tts.supported}
        />
      )
    case 'chat-pending':
      return <PendingBubble />
    case 'chat-error':
      return <TeacherBubble text={entry.text} variant="correction" />
    case 'lesson-complete':
      return <TeacherBubble text={completeText} />
  }
}
