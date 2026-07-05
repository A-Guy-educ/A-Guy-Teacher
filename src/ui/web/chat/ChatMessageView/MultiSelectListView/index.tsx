'use client'

import { cn } from '@/infra/utils/ui'
import { Checkbox } from '@/ui/web/components/checkbox'
import { useState } from 'react'
import { Button } from '@/ui/web/components/button'
import type { MultiSelectListView as MultiSelectListPayload } from '../parseView'

interface MultiSelectListViewProps {
  view: MultiSelectListPayload
  onChoice: (text: string) => void
  disabled?: boolean
}

/**
 * Multi-choice list renderer. Lets the user select zero or more items and
 * posts the chosen set (joined labels) as the user's next message.
 * Mirrors `views/renderers/multi-select-list.json`.
 */
export function MultiSelectListView({
  view,
  onChoice,
  disabled = false,
}: MultiSelectListViewProps) {
  const { data } = view
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function submit() {
    const chosen = data.items.filter((item) => selected.has(item.id)).map((item) => item.label)
    onChoice(chosen.join(', '))
  }

  const hasSelection = selected.size > 0

  return (
    <div
      data-testid="chat-view-multi-select-list"
      dir="auto"
      className="my-1 rounded-lg border border-border bg-card text-card-foreground p-card-padding-sm shadow-elevation-1"
    >
      {data.title && (
        <div
          data-testid="chat-view-multi-select-list-title"
          className="text-body-md font-semibold leading-snug mb-1.5 text-start"
        >
          {data.title}
        </div>
      )}
      {data.body && (
        <div
          data-testid="chat-view-multi-select-list-body"
          className="text-body-sm text-muted-foreground leading-relaxed mb-3 text-start whitespace-pre-wrap break-words"
        >
          {data.body}
        </div>
      )}
      <ul className="flex flex-col gap-1.5">
        {data.items.map((item) => {
          const checked = selected.has(item.id)
          return (
            <li key={item.id}>
              <label
                data-testid={`chat-view-multi-select-list-item-${item.id}`}
                data-item-id={item.id}
                className={cn(
                  'flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 cursor-pointer',
                  'transition-all duration-normal',
                  'hover:border-primary hover:bg-primary/5',
                  checked && 'border-primary bg-primary/5',
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={() => toggle(item.id)}
                  aria-label={item.label}
                  className="mt-0.5"
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
              </label>
            </li>
          )
        })}
      </ul>
      <div className="flex justify-start mt-3">
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={disabled || !hasSelection}
          onClick={submit}
          data-testid="chat-view-multi-select-list-submit"
        >
          {hasSelection ? `Submit (${selected.size})` : 'Select items'}
        </Button>
      </div>
    </div>
  )
}
