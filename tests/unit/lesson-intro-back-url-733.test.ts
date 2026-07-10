/**
 * @fileType test
 * @domain frontend
 * @pattern lesson-navigation, url-routing
 * @ai-summary Issue #733: lesson intro page back button must navigate to the
 *   course page (`/courses/{courseSlug}`), not the chapter page.
 */
import { describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Issue #733 — lesson intro back button goes to course page', () => {
  const lessonPagePath = path.join(
    process.cwd(),
    'src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx',
  )

  it('lesson page backUrl should point to the course page, not the chapter page', () => {
    const content = fs.readFileSync(lessonPagePath, 'utf-8')

    expect(content).toContain('const backUrl = `/courses/${courseSlug}`')
    expect(content).not.toContain(
      'const backUrl = `/courses/${courseSlug}/chapters/${chapterSlug}`',
    )
  })

  it('LessonIntroPage back button should render BackToCourses, not BackToChapter', () => {
    const introPagePath = path.join(
      process.cwd(),
      'src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/LessonIntroPage/index.tsx',
    )
    const content = fs.readFileSync(introPagePath, 'utf-8')

    expect(content).toContain('import { BackToCourses }')
    expect(content).not.toContain('import { BackToChapter }')
    expect(content).toContain('<BackToCourses href={backUrl} />')
    expect(content).not.toContain('<BackToChapter href={backUrl} />')
  })

  it('BackToCourses component should accept an optional href prop', () => {
    const backToCoursesPath = path.join(
      process.cwd(),
      'src/app/(frontend)/courses/_components/BackToCourses/index.tsx',
    )
    const content = fs.readFileSync(backToCoursesPath, 'utf-8')

    expect(content).toContain('href?: string')
    expect(content).toMatch(/<SystemLink href=\{href\}>/)
  })

  it('backToCourses translation should be "חזרה לקורס" (Hebrew) and "back to course" (English)', () => {
    const hePath = path.join(process.cwd(), 'src/i18n/he.json')
    const enPath = path.join(process.cwd(), 'src/i18n/en.json')

    const heContent = fs.readFileSync(hePath, 'utf-8')
    const enContent = fs.readFileSync(enPath, 'utf-8')

    expect(heContent).toContain('"backToCourses": "חזרה לקורס"')
    expect(enContent).toContain('"backToCourses": "back to course"')
  })
})
