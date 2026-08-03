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
