/**
 * @fileType test
 * @domain frontend
 * @pattern lesson-navigation, exercise-pager, jump-to-exercise
 * @ai-summary Regression test for the visual order of the prev arrow,
 *   jump-to-exercise number input, and next arrow inside the lesson-context
 *   exercise view. The original QA pass for #314 (issue #704) could not
 *   verify the #310 jump-to-exercise input on dev, so we lock in the
 *   expected source-code order as a guard against future regressions.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGER_PATH = join(
  process.cwd(),
  'src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx',
)

const EN_I18N_PATH = join(process.cwd(), 'src/i18n/en.json')
const HE_I18N_PATH = join(process.cwd(), 'src/i18n/he.json')

describe('ExercisesPager jump-to-exercise visual order', () => {
  const source = readFileSync(PAGER_PATH, 'utf-8')

  it('contains the previous button with the right aria-label', () => {
    expect(source).toMatch(/aria-label="Previous page"/)
  })

  it('contains the next button with the right aria-label', () => {
    expect(source).toMatch(/aria-label="Next page"/)
  })

  it('contains a numeric Input for the jump-to-exercise control', () => {
    expect(source).toMatch(/<Input[\s\S]*?type="number"/)
  })

  it('contains both min and max bound attributes on the jump Input', () => {
    expect(source).toMatch(/<Input[\s\S]*?min=\{1\}[\s\S]*?max=\{totalExercises\}/)
  })

  it('places the previous button before the jump Input in source order', () => {
    const prevIndex = source.indexOf('aria-label="Previous page"')
    const inputIndex = source.indexOf('type="number"')
    expect(prevIndex).toBeGreaterThan(-1)
    expect(inputIndex).toBeGreaterThan(-1)
    expect(prevIndex).toBeLessThan(inputIndex)
  })

  it('places the jump Input before the next button in source order', () => {
    const inputIndex = source.indexOf('type="number"')
    const nextIndex = source.indexOf('aria-label="Next page"')
    expect(inputIndex).toBeGreaterThan(-1)
    expect(nextIndex).toBeGreaterThan(-1)
    expect(inputIndex).toBeLessThan(nextIndex)
  })

  it('uses the localized aria-label key for the jump Input', () => {
    expect(source).toMatch(/aria-label=\{t\('exercisesPagerJumpToExercise'\)\}/)
  })
})

describe('i18n: jump-to-exercise aria-label translations', () => {
  it('has an English translation', () => {
    const en = JSON.parse(readFileSync(EN_I18N_PATH, 'utf-8'))
    const label = en?.courses?.exercisesPagerJumpToExercise
    expect(typeof label).toBe('string')
    expect(label.length).toBeGreaterThan(0)
  })

  it('has a Hebrew translation', () => {
    const he = JSON.parse(readFileSync(HE_I18N_PATH, 'utf-8'))
    const label = he?.courses?.exercisesPagerJumpToExercise
    expect(typeof label).toBe('string')
    expect(label.length).toBeGreaterThan(0)
  })
})
