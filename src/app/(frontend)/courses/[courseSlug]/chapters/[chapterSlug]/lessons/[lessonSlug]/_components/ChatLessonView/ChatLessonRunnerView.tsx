'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatLessonProgress } from './ChatLessonProgress'
import { ChatLessonStartCard } from './ChatLessonStartCard'
import { ContinueButton } from './bubbles/ContinueButton'
import { OptionsBubble } from './bubbles/OptionsBubble'
import { RichContentBubble } from './bubbles/RichContentBubble'
import { StudentBubble } from './bubbles/StudentBubble'
import { TeacherBubble } from './bubbles/TeacherBubble'
import { TextAnswerBubble } from './bubbles/TextAnswerBubble'
import type { HistoryEntry, LessonScript } from './types'
import { useBrowserTTS } from './useBrowserTTS'
import { useScriptRunner } from './useScriptRunner'

interface ChatLessonRunnerViewProps {
  script: LessonScript
}

export function ChatLessonRunnerView({ script }: ChatLessonRunnerViewProps) {
  const [hasStarted, setHasStarted] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const tts = useBrowserTTS()

  const handleTeacherText = useCallback(
    (text: string) => {
      tts.speak(text)
    },
    [tts],
  )

  const {
    history,
    stepIndex,
    totalSteps,
    locked,
    submitOption,
    submitTextAnswer,
    continueStep,
    reset,
  } = useScriptRunner({
    script,
    onTeacherText: hasStarted ? handleTeacherText : undefined,
  })

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [history.length])

  const handleReset = useCallback(() => {
    tts.cancel()
    reset()
    setHasStarted(false)
  }, [reset, tts])

  if (!hasStarted) {
    return (
      <div className="flex-1 overflow-y-auto bg-muted">
        <ChatLessonStartCard script={script} onStart={() => setHasStarted(true)} />
      </div>
    )
  }

  const latestIdx = history.length - 1

  return (
    <>
      <main className="flex-1 overflow-y-auto bg-muted px-4 py-section-sm md:px-6 md:py-section-md">
        <div className="max-w-2xl mx-auto flex flex-col gap-content-gap" dir="rtl">
          {history.map((entry, idx) =>
            renderEntry({
              entry,
              isLatest: idx === latestIdx,
              locked,
              tts,
              onSelectOption: submitOption,
              onSubmitText: submitTextAnswer,
              onContinue: continueStep,
            }),
          )}
          <div ref={scrollRef} className="h-4" />
        </div>
      </main>

      <ChatLessonProgress
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        onReset={handleReset}
        onToggleMute={tts.toggleMuted}
        muted={tts.muted}
        ttsSupported={tts.supported}
      />
    </>
  )
}

interface RenderArgs {
  entry: HistoryEntry
  isLatest: boolean
  locked: boolean
  tts: ReturnType<typeof useBrowserTTS>
  onSelectOption: (option: import('./types').ScriptOption) => void
  onSubmitText: (value: string) => void
  onContinue: () => void
}

function renderEntry(args: RenderArgs) {
  const { entry, isLatest, locked, tts, onSelectOption, onSubmitText, onContinue } = args

  if (entry.role === 'student') {
    return <StudentBubble key={entry.key} text={entry.text} isCorrect={entry.isCorrect} />
  }

  const canInteract = isLatest && !locked
  const showContinue = canInteract && entry.stepType === 'rich_text' && !entry.variant

  return (
    <TeacherBubble
      key={entry.key}
      text={entry.text}
      variant={entry.variant}
      onSpeak={() => tts.speak(entry.text)}
      speaking={tts.speaking}
      muted={tts.muted}
      ttsSupported={tts.supported}
    >
      {entry.content ? <RichContentBubble html={entry.content} /> : null}

      {entry.options && canInteract && (
        <div className="mt-4">
          <OptionsBubble options={entry.options} disabled={locked} onSelect={onSelectOption} />
        </div>
      )}

      {entry.stepType === 'text_answer' && canInteract && (
        <div className="mt-4">
          <TextAnswerBubble disabled={locked} onSubmit={onSubmitText} />
        </div>
      )}

      {showContinue && (
        <div className="mt-4">
          <ContinueButton disabled={locked} isEnd={entry.isEnd} onClick={onContinue} />
        </div>
      )}
    </TeacherBubble>
  )
}
