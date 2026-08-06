'use client'

import { cn } from '@/infra/utils/ui'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import { Sparkles, Volume2, VolumeX } from 'lucide-react'
import type { ReactNode } from 'react'

interface TeacherBubbleProps {
  /** Teacher line rendered as MathMarkdown. Omit for bubbles whose whole
   *  content lives in `children` (e.g. an exercise-section bubble that
   *  wants the header + speak affordance but no top prose). */
  text?: string
  variant?: 'default' | 'correction' | 'feedback'
  onSpeak?: () => void
  speaking?: boolean
  muted?: boolean
  ttsSupported?: boolean
  children?: ReactNode
}

export function TeacherBubble({
  text,
  variant = 'default',
  onSpeak,
  speaking,
  muted,
  ttsSupported,
  children,
}: TeacherBubbleProps) {
  const isCorrection = variant === 'correction'
  const hasText = typeof text === 'string' && text.trim().length > 0
  return (
    <div className="flex justify-start">
      <div
        className={cn(
          'max-w-[92%] w-full rounded-2xl rounded-tr-none p-5 md:p-card-padding shadow-elevation-1 border',
          isCorrection ? 'bg-warning/10 border-warning/30' : 'bg-card border-border',
        )}
      >
        <div className={cn('flex items-center justify-between', (hasText || children) && 'mb-3')}>
          <span className="inline-flex items-center gap-1.5 text-body-xs font-semibold text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            {isCorrection ? 'הסבר ותיקון' : 'A-Guy — המורה הפרטי'}
          </span>
          {ttsSupported && onSpeak && (
            <button
              type="button"
              onClick={onSpeak}
              className={cn(
                'p-1.5 rounded-full transition-colors',
                muted ? 'text-muted-foreground' : 'text-primary hover:bg-primary/10',
              )}
              aria-label={muted ? 'השמעה מושתקת' : speaking ? 'מדבר…' : 'השמע'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}
        </div>

        {hasText && (
          <div className="text-body-md font-medium text-foreground leading-relaxed">
            <MathMarkdown content={text!} />
          </div>
        )}

        {children ? <div className={hasText ? 'mt-4' : undefined}>{children}</div> : null}
      </div>
    </div>
  )
}
