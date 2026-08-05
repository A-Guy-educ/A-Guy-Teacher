'use client'

import type { Exercise, Media } from '@/infra/types/content'
import { useTranslations } from '@/ui/web/providers/I18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatInputPanel } from './ChatInputPanel'
import { ChatLessonProgress } from './ChatLessonProgress'
import { ChatLessonStartCard } from './ChatLessonStartCard'
import { ContinueButton } from './bubbles/ContinueButton'
import { ExerciseBubble } from './bubbles/ExerciseBubble'
import { StudentBubble } from './bubbles/StudentBubble'
import { TeacherBubble } from './bubbles/TeacherBubble'
import type { StreamEntry } from './types'
import { useBrowserTTS } from './useBrowserTTS'
import { useChatChannel } from './useChatChannel'
import { useExerciseWalker } from './useExerciseWalker'

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

  // ActiveChat is only mounted after Start so the walker's initial seed effect
  // (and its TTS narration) fire once, in a clean state, per lesson visit.
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
  const currentExercise = exercises[walker.currentIndex] ?? null

  const chat = useChatChannel({
    lessonId,
    currentExerciseId: currentExercise?.id ?? null,
    append,
    replace,
    acknowledgment: t('chatViewAcknowledgment'),
    errorMessage: t('chatViewChatError'),
    authRequiredMessage: t('chatViewAuthRequired'),
    quotaExceededMessage: t('chatViewQuotaExceeded'),
  })

  // Narrate teacher-side bubbles as they appear. Intros carry the exercise
  // title; assistant replies carry AI text. We narrate on entry-count change
  // so mid-stream additions get spoken exactly once.
  const lastNarratedKey = useRef<string | null>(null)
  useEffect(() => {
    const latest = entries[entries.length - 1]
    if (!latest || latest.key === lastNarratedKey.current) return
    lastNarratedKey.current = latest.key
    if (latest.kind === 'exercise-intro') {
      const line = latest.title
        ? `${t('chatViewIntroPrefix')} ${latest.ordinal}: ${latest.title}`
        : `${t('chatViewIntroPrefix')} ${latest.ordinal}`
      tts.speak(line)
    } else if (latest.kind === 'chat-assistant') {
      tts.speak(latest.text)
    }
  }, [entries, t, tts])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries.length])

  const handleReset = useCallback(() => {
    tts.cancel()
    onExit()
  }, [onExit, tts])

  const showContinueButton = !walker.isComplete && !chat.isSending && entries.length > 0

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
              introPrefix={t('chatViewIntroPrefix')}
              completeText={t('chatViewFinishTitle')}
            />
          ))}
          {showContinueButton && (
            <ContinueButton disabled={chat.isSending} isEnd={false} onClick={walker.advance} />
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
        stepIndex={walker.currentIndex}
        totalSteps={walker.totalExercises}
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
  introPrefix: string
  completeText: string
}

function StreamEntryView({
  entry,
  lessonId,
  mediaMap,
  tts,
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
    case 'exercise':
      return (
        <ExerciseBubble
          exercise={entry.exercise}
          ordinal={entry.ordinal}
          lessonId={lessonId}
          mediaMap={mediaMap}
        />
      )
    case 'chat-user':
      return <StudentBubble text={entry.text} />
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
      return <TeacherBubble text="…" variant="feedback" />
    case 'chat-error':
      return <TeacherBubble text={entry.text} variant="correction" />
    case 'lesson-complete':
      return <TeacherBubble text={completeText} />
  }
}
