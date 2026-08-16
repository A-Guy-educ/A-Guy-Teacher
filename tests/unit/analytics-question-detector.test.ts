/**
 * Unit tests for the chat-question detector used by the chat hook to fire
 * `chat_question` after `chat_message` (see #1072).
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'

import { looksLikeQuestion } from '@/lib/analytics/question-detector'

describe('looksLikeQuestion', () => {
  it('treats trailing "?" as a question', () => {
    expect(looksLikeQuestion('What is 2+2?')).toBe(true)
    expect(looksLikeQuestion('Really??')).toBe(true)
  })

  it('treats trailing whitespace before "?" as a question', () => {
    expect(looksLikeQuestion('What is 2+2?')).toBe(true)
    expect(looksLikeQuestion('Why  ')).toBe(false)
  })

  it('returns false on empty / whitespace-only input', () => {
    expect(looksLikeQuestion('')).toBe(false)
    expect(looksLikeQuestion('   ')).toBe(false)
  })

  it('returns false on a plain statement', () => {
    expect(looksLikeQuestion('The sky is blue')).toBe(false)
    expect(looksLikeQuestion('Show me the next lesson.')).toBe(false)
  })

  it('detects Hebrew question openers', () => {
    expect(looksLikeQuestion('מה המשמעות של נגזרת')).toBe(true)
    expect(looksLikeQuestion('איך פותרים את התרגיל')).toBe(true)
    expect(looksLikeQuestion('למה זה לא עובד')).toBe(true)
    expect(looksLikeQuestion('כמה זה עולה')).toBe(true)
    expect(looksLikeQuestion('האם יש פתרון אחר')).toBe(true)
    expect(looksLikeQuestion('מתי השיעור הבא')).toBe(true)
  })

  it('only fires when the Hebrew opener starts the message', () => {
    expect(looksLikeQuestion('תרגיל מה אתה מדבר עליו')).toBe(false)
  })
})
