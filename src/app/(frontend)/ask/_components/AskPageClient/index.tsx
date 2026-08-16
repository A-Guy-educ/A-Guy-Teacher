'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import { PageTransition } from '@/ui/web/components/page-transition'
import { track } from '@/lib/analytics/tracker'
import { RequireCourseSelection } from '@/ui/web/guards/RequireCourseSelection'
import { AskConversationGrid } from '../AskConversationGrid'
import { AskContent } from '../AskContent'

function AskPageInner() {
  const searchParams = useSearchParams()
  const chatParam = searchParams.get('chat')
  const ctxParam = searchParams.get('ctx')

  useEffect(() => {
    track('lesson_open', {
      properties: { lesson_type: 'ask', conversation_context_key: ctxParam ?? null },
    })
  }, [ctxParam])

  if (chatParam) {
    // ctx param carries the contextKey — for both new and existing conversations
    return <AskContent conversationContextKey={ctxParam ?? undefined} />
  }

  return <AskConversationGrid />
}

export function AskPageClient() {
  return (
    <PageTransition>
      <RequireCourseSelection>
        <Suspense>
          <AskPageInner />
        </Suspense>
      </RequireCourseSelection>
    </PageTransition>
  )
}
