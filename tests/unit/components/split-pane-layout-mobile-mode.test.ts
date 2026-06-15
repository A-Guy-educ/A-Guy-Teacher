import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

describe('SplitPaneLayout mobile exercise mode contract', () => {
  const splitPaneSource = readFileSync(
    path.join(process.cwd(), 'src/ui/web/components/split-pane-layout.tsx'),
    'utf8',
  )
  const fabSource = readFileSync(
    path.join(process.cwd(), 'src/ui/web/chat/MobileChatFAB/index.tsx'),
    'utf8',
  )

  it('keeps edge swipe thresholds explicit for chat switching', () => {
    expect(splitPaneSource).toContain('const EDGE_SWIPE_START_PX = 32')
    expect(splitPaneSource).toContain('const SWIPE_DISTANCE_PX = 60')
  })

  it('opens chat only through the shared mobile mode path', () => {
    expect(splitPaneSource).toContain("setActiveMobileMode('chat')")
    expect(splitPaneSource).toContain('panelMode="button-only"')
    expect(splitPaneSource).toContain("'exercise-incorrect-answer'")
  })

  it('supports full-screen chat without rendering the legacy bottom sheet', () => {
    expect(fabSource).toContain("panelMode?: 'sheet' | 'button-only'")
    expect(fabSource).toContain("panelMode === 'sheet' && isOpen")
  })
})
