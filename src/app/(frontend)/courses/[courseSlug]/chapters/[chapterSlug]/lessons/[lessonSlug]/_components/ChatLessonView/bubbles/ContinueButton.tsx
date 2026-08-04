'use client'

import { cn } from '@/infra/utils/ui'
import { ArrowLeft, PartyPopper } from 'lucide-react'

interface ContinueButtonProps {
  disabled?: boolean
  isEnd?: boolean
  onClick: () => void
}

export function ContinueButton({ disabled, isEnd, onClick }: ContinueButtonProps) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || isEnd}
        className={cn(
          'inline-flex items-center gap-content-gap-xs px-5 py-2.5 rounded-xl font-semibold',
          'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
          'disabled:opacity-60 disabled:cursor-not-allowed',
        )}
      >
        {isEnd ? (
          <>
            <PartyPopper className="w-4 h-4" />
            <span>סיימת!</span>
          </>
        ) : (
          <>
            <span>המשך</span>
            <ArrowLeft className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  )
}
