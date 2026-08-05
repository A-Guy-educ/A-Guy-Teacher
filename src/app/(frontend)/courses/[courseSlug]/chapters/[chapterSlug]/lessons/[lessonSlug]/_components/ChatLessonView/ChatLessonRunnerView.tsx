'use client'

import type { Exercise, Media } from '@/infra/types/content'
import { useTranslations } from '@/ui/web/providers/I18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatInputPanel } from './ChatInputPanel'
import { ChatLessonProgress } from './ChatLessonProgress'
import { ChatLessonStartCard } from './ChatLessonStartCard'
import { ContinueButton } from './bubbles/ContinueButton'
import { ExerciseBubble } from './bubbles/ExerciseBubble'
import { PendingBubble } from './bubbles/PendingBubble'
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

  // Narrate teacher-side bubbles as they appear. Two failure modes we have
  // to handle here:
  //   1. Walker.emitExercise appends [intro, exercise] in one synchronous
  //      batch — reading only entries[last] would see the exercise bubble
  //      and skip the intro. So we walk every entry that hasn't been
  //      narrated yet.
  //   2. Chat channel appends a `chat-pending` entry, then swaps it in place
  //      with a `chat-assistant` entry via replace(sameKey, ...). Deduping
  //      on key alone would suppress the assistant. So we key the dedupe
  //      cache by `key + kind` — a mutation of an existing key is treated
  //      as a fresh candidate for narration.
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
      return <PendingBubble />
    case 'chat-error':
      return <TeacherBubble text={entry.text} variant="correction" />
    case 'lesson-complete':
      return <TeacherBubble text={completeText} />
  }
}
