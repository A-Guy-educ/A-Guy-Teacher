/**
 * Pins the deferred exercise-context prompt round-trip. The client prepends
 * the pending context to the student's first outgoing message so the AI sees
 * it, and strips the same wrapper on history reload so the bubble stays
 * clean. If either half drifts, the student either loses context or sees
 * raw wrapper markup in chat.
 */
import { describe, expect, it } from 'vitest'

import {
  buildPromptWithExerciseContext,
  stripExerciseContext,
} from '@/ui/web/chat/hooks/exercise-context-prompt'
import {
  buildPromptWithStepContext,
  stripStepContext,
  type ChatStepContext,
} from '@/ui/web/chat/hooks/step-context'

const sampleContext = `The student is now viewing the following exercise. Use this context to help them if they ask questions.

[EXERCISE CONTEXT]
Exercise: "Fractions Quiz"

Content Blocks:
1. [Question: FreeResponse] What is 1/2 + 1/3?

[END EXERCISE CONTEXT]`

describe('buildPromptWithExerciseContext', () => {
  it('returns the message unchanged when there is no pending context', () => {
    expect(buildPromptWithExerciseContext('Why?', null)).toBe('Why?')
  })

  it('wraps the message with an invisible exercise-context block and preserves the body', () => {
    const out = buildPromptWithExerciseContext('Help me with #1', sampleContext)
    expect(out.startsWith('<exercise-context>\n')).toBe(true)
    expect(out).toContain(sampleContext)
    expect(out).toContain('</exercise-context>\n\nHelp me with #1')
  })
})

describe('stripExerciseContext', () => {
  it('removes the system-emitted prefix from a persisted message', () => {
    const persisted = buildPromptWithExerciseContext('Why did they add?', sampleContext)
    expect(stripExerciseContext(persisted)).toBe('Why did they add?')
  })

  it('is a no-op when there is no prefix', () => {
    expect(stripExerciseContext('plain user text')).toBe('plain user text')
  })

  it('is non-greedy: a user message body that mentions </exercise-context> is preserved intact', () => {
    const userBody = 'Q: what does the </exercise-context> tag mean?'
    const persisted = buildPromptWithExerciseContext(userBody, sampleContext)
    expect(stripExerciseContext(persisted)).toBe(userBody)
  })
})

describe('composed strip with step-context', () => {
  // Pins the write/read order: useNotebookChat wraps exercise-context INSIDE
  // step-context on the write side, so the read side must peel step-context
  // first for the anchored ^<exercise-context regex to match on the next
  // pass. If someone flips the composition order in loadConversationHistory,
  // this test catches the resulting XML leak into the chat bubble.
  const step: ChatStepContext = {
    currentStepId: 2,
    totalSteps: 4,
    stepTitle: 'Apply SAS',
    stepNarration: 'The two triangles are congruent by SAS.',
  }

  it('round-trips a message wrapped with both step-context and exercise-context', () => {
    const raw = 'Why did they add?'
    const persisted = buildPromptWithStepContext(
      buildPromptWithExerciseContext(raw, sampleContext),
      step,
    )
    // step-context is outermost on the write side; peel it first, then exercise-context.
    expect(stripExerciseContext(stripStepContext(persisted))).toBe(raw)
  })

  it('reversing the strip order leaves raw exercise-context XML in the message', () => {
    // Locks in WHY the order matters — if a future refactor swaps the two
    // strippers, this assertion documents the failure mode.
    const raw = 'Why did they add?'
    const persisted = buildPromptWithStepContext(
      buildPromptWithExerciseContext(raw, sampleContext),
      step,
    )
    const wrong = stripStepContext(stripExerciseContext(persisted))
    expect(wrong).toContain('<exercise-context>')
    expect(wrong).not.toBe(raw)
  })
})
