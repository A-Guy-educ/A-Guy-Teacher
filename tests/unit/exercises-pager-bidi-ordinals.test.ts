// @vitest-environment jsdom

/**
 * @fileType test
 * @domain frontend
 * @pattern bidi-rtl, ordinal-display, exercises-pager
 * @ai-summary Verifies the BiDi fix in ExercisesPager: ordinal numbers like
 *             "1 / 10" are wrapped in <span dir="ltr"> so they render in the
 *             correct visual order in RTL (Hebrew) locales (Issue #757 P2).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const pagerPath = path.join(
  process.cwd(),
  'src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx',
)

describe('ExercisesPager BiDi ordinal display (Issue #757)', () => {
  it('wraps the exercise breadcrumb ordinal in <span dir="ltr">', () => {
    const source = readFileSync(pagerPath, 'utf-8')

    // Find the exercise breadcrumb block (the first breadcrumb in the exercise render branch)
    const breadcrumbMatch = source.match(
      /exercise-breadcrumb[\s\S]*?<span className="text-foreground font-medium">([\s\S]*?)<\/span>/,
    )

    expect(breadcrumbMatch, 'exercise breadcrumb block should exist').toBeTruthy()
    const inner = breadcrumbMatch?.[1] ?? ''

    // The numeric portion must be wrapped in dir="ltr" so it reads "1 / 10"
    // instead of being bidi-reversed to "10 / 1" in RTL locales.
    expect(inner).toContain('dir="ltr"')
    expect(inner).toMatch(
      /<span dir="ltr">\s*\{exerciseOrdinal\}\s*\{t\('of'\)\}\s*\{totalExercises\}/,
    )
  })

  it('wraps the content page breadcrumb ordinal in <span dir="ltr">', () => {
    const source = readFileSync(pagerPath, 'utf-8')

    // Find the contentPage breadcrumb block — there are two matching spans in
    // the content page branch (breadcrumb + header badge), both must use dir="ltr".
    const contentPageRenderMatch = source.match(
      /pageState\.type === 'contentPage'[\s\S]*?sticky bottom-0/,
    )

    expect(contentPageRenderMatch, 'content page render branch should exist').toBeTruthy()
    const inner = contentPageRenderMatch?.[0] ?? ''

    const dirLtrCount = (inner.match(/dir="ltr"/g) ?? []).length
    // Two ordinals: breadcrumb + header badge — each must be wrapped.
    expect(dirLtrCount).toBeGreaterThanOrEqual(2)
  })

  it('does not use the old template-string pattern that reorders numbers in RTL', () => {
    const source = readFileSync(pagerPath, 'utf-8')

    // The old broken pattern was a single template literal with the ordinal
    // and total glued together via ${t('of')} — the new code splits that into
    // an LTR-wrapped numeric span so digits don't get bidi-reversed.
    expect(source).not.toContain(
      "`${t('contentPageLabel')} ${contentPageOrdinal} ${t('of')} ${totalContentPages}`",
    )
    expect(source).not.toContain(
      "`${t('exercise')} ${exerciseOrdinal} ${t('of')} ${totalExercises}`",
    )
  })
})
