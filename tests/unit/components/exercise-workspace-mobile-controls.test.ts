import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

describe('ExerciseWorkspace mobile controls contract', () => {
  const workspaceSource = readFileSync(
    path.join(
      process.cwd(),
      'src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace/index.tsx',
    ),
    'utf8',
  )
  const pagerSource = readFileSync(
    path.join(
      process.cwd(),
      'src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx',
    ),
    'utf8',
  )
  const splitPaneSource = readFileSync(
    path.join(process.cwd(), 'src/ui/web/components/split-pane-layout.tsx'),
    'utf8',
  )

  it('keeps the current repo mobile menu event', () => {
    expect(workspaceSource).toContain("new CustomEvent('open-mobile-menu')")
  })

  it('passes formula sheet data into the mobile exercise workspace', () => {
    expect(pagerSource).toContain('formulaSheet={formulaSheet}')
    expect(workspaceSource).toContain('<FormulaSheetContent sheet={formulaSheet} />')
  })

  it('marks bottom navigation so fullscreen can hide it', () => {
    expect(pagerSource).toContain('exercise-bottom-nav')
    expect(pagerSource).toContain('exercise-header-tabs')
    expect(pagerSource).toContain('exercise-top-progress')
    expect(pagerSource).toContain('exercise-breadcrumb')
    expect(splitPaneSource).toContain("isFullscreen && '[&_.exercise-bottom-nav]:hidden'")
    expect(splitPaneSource).toContain("isFullscreen && '[&_.exercise-header-tabs]:hidden'")
    expect(splitPaneSource).toContain("isFullscreen && '[&_.exercise-top-progress]:hidden'")
    expect(splitPaneSource).toContain("isFullscreen && '[&_.exercise-breadcrumb]:hidden'")
  })
})
