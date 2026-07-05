'use client'

import { cn } from '@/infra/utils/ui'
import { Check } from 'lucide-react'
import type { SelectionListView as SelectionListPayload } from '../parseView'

interface SelectionListViewProps {
  view: SelectionListPayload
  onChoice: (text: string) => void
  disabled?: boolean
}

/**
 * Single-choice list renderer. The user picks exactly one item and that
 * item's `label` is posted as the user's next message. Mirrors
 * `views/renderers/selection-list.json`.
 */
export function SelectionListView({ view, onChoice, disabled = false }: SelectionListViewProps) {
  const { data } = view
  return (
    <div
      data-testid="chat-view-selection-list"
      dir="auto"
      className="my-1 rounded-lg border border-border bg-card text-card-foreground p-card-padding-sm shadow-elevation-1"
    >
      {data.title && (
        <div
          data-testid="chat-view-selection-list-title"
          className="text-body-md font-semibold leading-snug mb-1.5 text-start"
        >
          {data.title}
        </div>
      )}
      {data.body && (
        <div
          data-testid="chat-view-selection-list-body"
          className="text-body-sm text-muted-foreground leading-relaxed mb-3 text-start whitespace-pre-wrap break-words"
        >
          {data.body}
        </div>
      )}
      <ul className="flex flex-col gap-1.5" role="radiogroup">
        {data.items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              role="radio"
              aria-checked="false"
              disabled={disabled}
              onClick={() => onChoice(item.label)}
              data-testid={`chat-view-selection-list-item-${item.id}`}
              data-item-id={item.id}
              className={cn(
                'w-full text-start rounded-md border border-border bg-background px-3 py-2',
                'transition-all duration-normal',
                'hover:border-primary hover:bg-primary/5',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:opacity-disabled disabled:cursor-not-allowed',
              )}
            >
              <span className="flex items-center gap-2">
                <Check
                  aria-hidden
                  className="w-4 h-4 text-primary opacity-0 transition-opacity duration-normal peer-checked:opacity-100"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-body-sm font-medium text-foreground">
                    {item.label}
                  </span>
                  {item.description && (
                    <span className="block text-body-xs text-muted-foreground mt-0.5">
                      {item.description}
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
