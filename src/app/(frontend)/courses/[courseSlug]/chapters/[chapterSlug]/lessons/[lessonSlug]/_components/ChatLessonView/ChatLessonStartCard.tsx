'use client'

import { cn } from '@/infra/utils/ui'
import { ArrowLeft, BookOpen, MessageCircle } from 'lucide-react'

interface ChatLessonStartCardProps {
  lessonTitle: string
  exerciseCount: number
  startLabel: string
  exercisesCountLabel: string
  onStart: () => void
}

export function ChatLessonStartCard({
  lessonTitle,
  exerciseCount,
  startLabel,
  exercisesCountLabel,
  onStart,
}: ChatLessonStartCardProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-section-lg min-h-[60vh]">
      <div
        className={cn(
          'bg-card border border-border rounded-3xl shadow-card',
          'p-card-padding-lg md:p-10 max-w-md w-full text-center space-y-6',
        )}
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
          <MessageCircle className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h2 className="text-heading-md font-bold text-foreground">{lessonTitle}</h2>
          {exerciseCount > 0 && (
            <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-body-xs font-bold rounded-md border border-primary/20">
              {exercisesCountLabel} · {exerciseCount}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onStart}
          className={cn(
            'w-full py-3.5 rounded-2xl bg-primary text-primary-foreground',
            'font-bold text-body-lg shadow-elevation-1 hover:bg-primary/90 transition-colors',
            'flex items-center justify-center gap-content-gap-xs',
          )}
        >
          <BookOpen className="w-5 h-5" />
          <span>{startLabel}</span>
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
