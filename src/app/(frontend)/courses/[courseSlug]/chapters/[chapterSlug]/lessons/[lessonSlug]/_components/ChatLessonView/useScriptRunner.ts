/**
 * @fileType hook
 * @domain lessons
 * @ai-summary State machine driving a scripted chat lesson. Owns history,
 *             advances via `next` IDs, and grades MC + text answers locally
 *             against the JSON — zero AI calls in this loop.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { HistoryEntry, LessonScript, ScriptOption, ScriptStep } from './types'

const CORRECTION_DELAY_MS = 4000
const FEEDBACK_DELAY_MS = 1200

interface UseScriptRunnerArgs {
  script: LessonScript
  /** Called when a new teacher entry is added — consumer decides whether to speak it. */
  onTeacherText?: (text: string) => void
}

export function useScriptRunner({ script, onTeacherText }: UseScriptRunnerArgs) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [currentStepId, setCurrentStepId] = useState<string>(script.steps[0]?.id ?? '')
  const [locked, setLocked] = useState(false)
  const pendingTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  // Store onTeacherText in a ref so the step-transition effect below doesn't
  // re-fire (and re-trigger TTS) every render when the caller passes a fresh
  // callback identity. Without this, useBrowserTTS's re-rendering flips
  // `speaking` state on every utterance, which recreates the callback, which
  // fires the effect, which cancels + re-queues speech — infinite loop.
  const onTeacherTextRef = useRef(onTeacherText)
  useEffect(() => {
    onTeacherTextRef.current = onTeacherText
  })

  // Track the last step id we spoke so React 18 strict-mode double-invocation
  // (mount → cleanup → mount) doesn't narrate the same bubble twice.
  const lastSpokenStepId = useRef<string | null>(null)

  const stepIndex = script.steps.findIndex((s) => s.id === currentStepId)
  const currentStep: ScriptStep | undefined = stepIndex === -1 ? undefined : script.steps[stepIndex]

  useEffect(() => {
    return () => {
      pendingTimers.current.forEach(clearTimeout)
      pendingTimers.current = []
    }
  }, [])

  useEffect(() => {
    if (!currentStep) return
    setHistory((prev) => {
      if (prev.some((h) => h.role === 'teacher' && h.refId === currentStep.id)) return prev
      return [
        ...prev,
        {
          key: `t-${currentStep.id}`,
          role: 'teacher',
          refId: currentStep.id,
          text: currentStep.text,
          content: currentStep.content,
          options: currentStep.options,
          stepType: currentStep.type,
          expected: currentStep.expected,
          isEnd: currentStep.isEnd,
        },
      ]
    })
    if (lastSpokenStepId.current !== currentStep.id) {
      lastSpokenStepId.current = currentStep.id
      onTeacherTextRef.current?.(currentStep.text)
    }
  }, [currentStep])

  const goTo = useCallback(
    (nextId: string | undefined) => {
      if (!nextId) return
      const nextIdx = script.steps.findIndex((s) => s.id === nextId)
      if (nextIdx === -1) return
      setCurrentStepId(nextId)
      setLocked(false)
    },
    [script.steps],
  )

  const pushFeedback = useCallback((text: string, variant: 'feedback' | 'correction') => {
    setHistory((prev) => [
      ...prev,
      {
        key: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'teacher',
        refId: `feedback-${prev.length}`,
        text,
        variant,
      },
    ])
    onTeacherTextRef.current?.(text)
  }, [])

  const pushStudent = useCallback((text: string, isCorrect?: boolean) => {
    setHistory((prev) => [
      ...prev,
      {
        key: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'student',
        refId: `answer-${prev.length}`,
        text,
        isCorrect,
      },
    ])
  }, [])

  const scheduleAdvance = useCallback(
    (nextId: string | undefined, delay: number) => {
      const timer = setTimeout(() => {
        goTo(nextId)
      }, delay)
      pendingTimers.current.push(timer)
    },
    [goTo],
  )

  const submitOption = useCallback(
    (option: ScriptOption) => {
      if (!currentStep || locked) return
      setLocked(true)
      pushStudent(option.text, option.isCorrect)

      const isWrong = option.isCorrect === false
      if (isWrong && currentStep.correction) {
        pushFeedback(currentStep.correction.text, 'correction')
      } else if (option.feedback) {
        pushFeedback(option.feedback, 'feedback')
      }

      const nextId = option.next ?? currentStep.next
      const delay = isWrong && currentStep.correction ? CORRECTION_DELAY_MS : FEEDBACK_DELAY_MS
      scheduleAdvance(nextId, delay)
    },
    [currentStep, locked, pushFeedback, pushStudent, scheduleAdvance],
  )

  const submitTextAnswer = useCallback(
    (value: string) => {
      if (!currentStep || locked || currentStep.type !== 'text_answer') return
      setLocked(true)
      const normalize = (s: string) => s.trim().replace(/\s+/g, '').toLowerCase()
      const isCorrect = normalize(value) === normalize(currentStep.expected ?? '')
      pushStudent(value, isCorrect)

      if (isCorrect && currentStep.correctFeedback) {
        pushFeedback(currentStep.correctFeedback, 'feedback')
      } else if (!isCorrect && currentStep.correction) {
        pushFeedback(currentStep.correction.text, 'correction')
      }

      const delay = isCorrect ? FEEDBACK_DELAY_MS : CORRECTION_DELAY_MS
      scheduleAdvance(currentStep.next, delay)
    },
    [currentStep, locked, pushFeedback, pushStudent, scheduleAdvance],
  )

  const continueStep = useCallback(() => {
    if (!currentStep || locked) return
    goTo(currentStep.next)
  }, [currentStep, goTo, locked])

  return {
    history,
    currentStep,
    stepIndex,
    totalSteps: script.steps.length,
    locked,
    submitOption,
    submitTextAnswer,
    continueStep,
  }
}
