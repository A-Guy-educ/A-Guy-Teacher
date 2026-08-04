'use client'

import { cn } from '@/infra/utils/ui'
import { ArrowLeft, BookOpen, Sparkles } from 'lucide-react'
import type { LessonScript } from './types'

interface ChatLessonStartCardProps {
  script: LessonScript
  onStart: () => void
}

export function ChatLessonStartCard({ script, onStart }: ChatLessonStartCardProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-section-lg min-h-[60vh]">
      <div
        className={cn(
          'bg-card border border-border rounded-3xl shadow-card',
          'p-card-padding-lg md:p-10 max-w-md w-full text-center space-y-6',
        )}
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-2">
          {script.lessonNumber && (
            <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-body-xs font-bold rounded-md border border-primary/20">
              {script.lessonNumber}
            </span>
          )}
          <h2 className="text-heading-md font-bold text-foreground">{script.lessonName}</h2>
        </div>

        {script.highlights && (
          <div className="p-card-padding-sm bg-muted rounded-xl text-body-sm text-muted-foreground text-right leading-relaxed border border-border">
            <span className="text-primary font-bold">🎯 דגשי השיעור: </span>
            {script.highlights}
          </div>
        )}

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
          <span>התחל שיעור</span>
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
