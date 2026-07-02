'use client'

import { GuidedExplanationV1Schema } from '@/infra/contracts/guided-explanation/v1'
import type { HtmlBlock } from '@/infra/types/exercise'
import { GuidedExplanationRunner } from '@/ui/web/GuidedExplanationRunner'
import { AdminHtmlWithMath } from '@/ui/web/shared/AdminHtmlWithMath'

interface HtmlBlockRendererProps {
  block: HtmlBlock
}

export function HtmlBlockRenderer({ block }: HtmlBlockRendererProps) {
  // When a guided explanation payload is present and valid, render the
  // trusted runner. safeParse guards against malformed data from DB
  // migrations or API bugs — falls back to static HTML on failure.
  if (block.guidedExplanation) {
    const parsed = GuidedExplanationV1Schema.safeParse(block.guidedExplanation)
    if (parsed.success) {
      return <GuidedExplanationRunner payload={parsed.data} />
    }
  }

  return <StaticHtmlRenderer html={block.html} />
}

function StaticHtmlRenderer({ html }: { html: string }) {
  return (
    <AdminHtmlWithMath
      html={html}
      className="html-block-content w-full overflow-x-auto px-3 py-section-xs text-body-lg leading-relaxed"
    />
  )
}
