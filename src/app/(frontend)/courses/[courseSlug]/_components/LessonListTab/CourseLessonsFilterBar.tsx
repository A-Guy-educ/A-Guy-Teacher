/**
 * @fileType component
 * @domain frontend
 * @pattern lesson-roadmap-filter
 * @ai-summary Segmented filter switch above the chapter accordions. Three mutually-exclusive modes: `all` (default), `focus` (only the chapter with the featured lesson), `uncompleted` (hides completed lessons in every chapter). Purely presentational — parent owns the state.
 */

'use client'

import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'
import type { FilterMode } from './lessonRoadmapTypes'

interface CourseLessonsFilterBarProps {
  mode: FilterMode
  onChange: (mode: FilterMode) => void
}

const OPTIONS: Array<{ key: FilterMode; label: string }> = [
  { key: 'all', label: 'roadmapFilterAll' },
  { key: 'focus', label: 'roadmapFilterFocus' },
  { key: 'uncompleted', label: 'roadmapFilterHideCompleted' },
]

export function CourseLessonsFilterBar({ mode, onChange }: CourseLessonsFilterBarProps) {
  const t = useTranslations('coursePage')
  return (
    <div className="flex flex-wrap items-center justify-between gap-content-gap-xs mb-content-gap px-2">
      <div className="flex items-center gap-content-gap-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
        <span className="text-body-xs font-semibold tracking-tracking-sm text-muted-foreground uppercase">
          {t('roadmapFilterGroupLabel')}
        </span>
      </div>
      <div
        role="group"
        aria-label={t('roadmapFilterGroupLabel')}
        className="flex gap-1 bg-muted p-1 rounded-xl border border-border"
      >
        {OPTIONS.map((opt) => {
          const isActive = mode === opt.key
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              aria-pressed={isActive}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-body-xs font-semibold transition-all duration-normal',
                isActive
                  ? 'bg-card text-foreground border border-border shadow-elevation-1'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(opt.label)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
