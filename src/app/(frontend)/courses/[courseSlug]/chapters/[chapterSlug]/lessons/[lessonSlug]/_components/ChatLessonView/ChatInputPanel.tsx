'use client'

import { cn } from '@/infra/utils/ui'
import { Loader2, Send } from 'lucide-react'
import { useState } from 'react'

interface ChatInputPanelProps {
  disabled?: boolean
  isSending: boolean
  placeholder: string
  sendLabel: string
  onSubmit: (text: string) => void
}

export function ChatInputPanel({
  disabled,
  isSending,
  placeholder,
  sendLabel,
  onSubmit,
}: ChatInputPanelProps) {
  const [value, setValue] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || disabled || isSending) return
    onSubmit(trimmed)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-border bg-card px-4 py-3 print:hidden">
      <div className="max-w-2xl mx-auto flex items-center gap-content-gap-xs" dir="rtl">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || isSending}
          dir="rtl"
          className={cn(
            'flex-1 rounded-xl border border-input bg-background px-4 py-2.5',
            'text-body-md text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:border-primary transition-colors',
            'disabled:opacity-60 disabled:cursor-not-allowed',
          )}
        />
        <button
          type="submit"
          disabled={disabled || isSending || !value.trim()}
          aria-label={sendLabel}
          className={cn(
            'px-3.5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold',
            'flex items-center gap-content-gap-xs hover:bg-primary/90 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span className="hidden sm:inline">{sendLabel}</span>
        </button>
      </div>
    </form>
  )
}
