/**
 * @fileType unit-test
 * @domain i18n
 * @pattern translation-keys
 * @ai-summary Tests for the Test view translation keys added for the batch
 *             answer checking lesson renderer (#884).
 */
import { describe, expect, it } from 'vitest'
import enMessages from '../../../src/i18n/en.json'
import heMessages from '../../../src/i18n/he.json'

describe('testView translations', () => {
  describe('English translations (en.json)', () => {
    it('contains courses.lessonViewModeTest key with "Test" value', () => {
      expect(enMessages.courses).toBeDefined()
      expect((enMessages.courses as Record<string, unknown>).lessonViewModeTest).toBe('Test')
    })

    it('contains courses.checkAllAnswers key with "Check all answers" value', () => {
      expect(enMessages.courses).toBeDefined()
      expect((enMessages.courses as Record<string, unknown>).checkAllAnswers).toBe(
        'Check all answers',
      )
    })
  })

  describe('Hebrew translations (he.json)', () => {
    it('contains courses.lessonViewModeTest key with Hebrew "מבחן" value', () => {
      expect(heMessages.courses).toBeDefined()
      expect((heMessages.courses as Record<string, unknown>).lessonViewModeTest).toBe('מבחן')
    })

    it('contains courses.checkAllAnswers key with Hebrew "בדוק את כל התשובות" value', () => {
      expect(heMessages.courses).toBeDefined()
      expect((heMessages.courses as Record<string, unknown>).checkAllAnswers).toBe(
        'בדוק את כל התשובות',
      )
    })
  })
})
