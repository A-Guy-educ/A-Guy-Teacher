'use client'

import { Button } from '@/ui/web/components/button'
import { cn } from '@/infra/utils/ui'
import type { ApprovalCardView as ApprovalCardPayload } from '../parseView'

interface ApprovalCardViewProps {
  view: ApprovalCardPayload
  onChoice: (response: string) => void
  disabled?: boolean
}

/**
 * Approval card renderer. Renders a structured card with a title, an
 * optional body, and a row of action buttons. Clicking an action posts
 * that action's `response` as the user's next message.
 *
 * Mirrors `views/renderers/approval-card.json`.
 */
export function ApprovalCardView({ view, onChoice, disabled = false }: ApprovalCardViewProps) {
  const { data } = view
  return (
    <div
      data-testid="chat-view-approval-card"
      dir="auto"
      className="my-1 rounded-lg border border-border bg-card text-card-foreground p-card-padding-sm shadow-elevation-1"
    >
      {data.title && (
        <div
          data-testid="chat-view-approval-card-title"
          className="text-body-md font-semibold leading-snug mb-1.5 text-start"
        >
          {data.title}
        </div>
      )}
      {data.body && (
        <div
          data-testid="chat-view-approval-card-body"
          className="text-body-sm text-muted-foreground leading-relaxed mb-3 text-start whitespace-pre-wrap break-words"
        >
          {data.body}
        </div>
      )}
      <div className="flex flex-wrap gap-2 justify-start">
        {data.actions.map((action) => (
          <Button
            key={action.id}
            type="button"
            variant={variantFor(action.variant)}
            size="sm"
            disabled={disabled}
            onClick={() => onChoice(action.response)}
            data-testid={`chat-view-approval-card-action-${action.id}`}
            data-action-id={action.id}
            className={cn('min-w-0')}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

function variantFor(variant: ApprovalCardPayload['data']['actions'][number]['variant']) {
  switch (variant) {
    case 'danger':
      return 'destructive'
    case 'secondary':
      return 'secondary'
    default:
      return 'default'
  }
}
