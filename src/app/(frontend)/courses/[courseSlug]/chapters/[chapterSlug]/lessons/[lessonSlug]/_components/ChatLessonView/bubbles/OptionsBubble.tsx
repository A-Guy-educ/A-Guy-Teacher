'use client'

import { cn } from '@/infra/utils/ui'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import { ArrowLeft } from 'lucide-react'
import type { ScriptOption } from '../types'

interface OptionsBubbleProps {
  options: ScriptOption[]
  disabled?: boolean
  onSelect: (option: ScriptOption) => void
}

export function OptionsBubble({ options, disabled, onSelect }: OptionsBubbleProps) {
  return (
    <div className="grid grid-cols-1 gap-content-gap-xs">
      {options.map((option, idx) => (
        <button
          key={`${option.text}-${idx}`}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(option)}
          className={cn(
            'w-full text-right p-3.5 rounded-xl border-2 flex items-center justify-between gap-3',
            'border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40',
            'font-semibold text-body-md text-foreground transition-colors',
            'disabled:opacity-60 disabled:cursor-not-allowed',
          )}
        >
          <span className="flex-1 text-right">
            <MathMarkdown content={option.text} />
          </span>
          <ArrowLeft className="w-4 h-4 text-primary shrink-0" />
        </button>
      ))}
    </div>
  )
}
