import React from 'react'
import { Container } from '@/ui/web/shared/Layout/Container'

interface ContentPageRendererProps {
  title: string
  bodyRendered: React.ReactNode
}

export function ContentPageRenderer({ title, bodyRendered }: ContentPageRendererProps) {
  return (
    <Container className="p-card-padding-sm md:p-card-padding">
      <div className="bg-card rounded-2xl p-5 md:p-card-padding border border-border/60 shadow-elevation-1">
        <h2 className="text-heading-lg font-medium text-foreground mb-4">{title}</h2>
        <div className="prose prose-lg max-w-none dark:prose-invert">{bodyRendered}</div>
      </div>
    </Container>
  )
}
