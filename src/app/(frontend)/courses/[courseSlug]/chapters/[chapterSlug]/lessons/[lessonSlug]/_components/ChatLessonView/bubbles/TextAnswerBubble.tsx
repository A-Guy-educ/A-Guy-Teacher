'use client'

import { cn } from '@/infra/utils/ui'
import { Send } from 'lucide-react'
import { useState } from 'react'

interface TextAnswerBubbleProps {
  disabled?: boolean
  onSubmit: (value: string) => void
}

export function TextAnswerBubble({ disabled, onSubmit }: TextAnswerBubbleProps) {
  const [value, setValue] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-content-gap-xs">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="הקלד את התשובה כאן…"
        disabled={disabled}
        dir="rtl"
        className={cn(
          'flex-1 rounded-xl border-2 border-primary/20 bg-background px-4 py-3',
          'text-body-md font-medium text-foreground',
          'focus:outline-none focus:border-primary transition-colors',
          'disabled:opacity-60 disabled:cursor-not-allowed',
        )}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className={cn(
          'px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold',
          'flex items-center gap-content-gap-xs hover:bg-primary/90 transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        <span className="hidden sm:inline">שלח</span>
        <Send className="w-4 h-4" />
      </button>
    </form>
  )
}
