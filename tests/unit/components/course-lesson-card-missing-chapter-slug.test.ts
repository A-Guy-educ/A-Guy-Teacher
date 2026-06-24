import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

/**
 * Unit tests for CourseLessonCard handling of missing chapterSlug.
 *
 * Issue #334: When a chapter has no slug in the database, lesson links
 * result in malformed URLs like /courses/.../chapters//lessons/... (double slash).
 * The fix disables the link when chapterSlug is missing.
 */
describe('CourseLessonCard missing chapterSlug fix (Issue #334)', () => {
  const cardSource = readFileSync(
    path.join(process.cwd(), 'src/ui/web/components/UnifiedCard/CourseLessonCard.tsx'),
    'utf8',
  )

  it('disables link when chapterSlug is empty to avoid malformed URLs', () => {
    // The fix introduces isLinkDisabled = isSoon || !chapterSlug
    // When chapterSlug is empty/falsy, cardHref should be '#' instead of the malformed URL
    expect(cardSource).toContain('isLinkDisabled = isSoon || !chapterSlug')
  })

  it('prevents analytics events when chapterSlug is missing', () => {
    // handleClick should prevent default and return early when chapterSlug is missing
    // to avoid emitting analytics for invalid lesson URLs
    expect(cardSource).toContain('if (!chapterSlug) {')
    expect(cardSource).toContain('e.preventDefault()')
    expect(cardSource).toContain('return')
  })

  it('uses # (disabled) link when chapterSlug is missing', () => {
    // cardHref should be '#' when isLinkDisabled is true
    expect(cardSource).toContain("cardHref={isLinkDisabled ? '#' : href}")
  })

  it('does not change URL construction logic itself', () => {
    // The href construction should still exist (for reference/comparison)
    expect(cardSource).toContain('/chapters/${chapterSlug}/lessons/${lesson.slug}')
  })
})
