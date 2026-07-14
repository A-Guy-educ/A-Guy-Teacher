'use client'

import { Crosshair, RotateCcw } from 'lucide-react'
import { useTranslations } from '@/ui/web/providers/I18n'
import { formatMessage } from './formatMessage'
import { HeroProgressRing } from './HeroProgressRing'
import type { LessonRoadmapNode } from './lessonRoadmapTypes'

interface CourseLessonsHeroProps {
  completed: number
  total: number
  featured: LessonRoadmapNode | null
  accentColor: string
  onFocusNext: () => void
  onReset?: () => void
}

export function CourseLessonsHero({
  completed,
  total,
  featured,
  accentColor,
  onFocusNext,
  onReset,
}: CourseLessonsHeroProps) {
  const t = useTranslations('coursePage')
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  const allDone = total > 0 && completed >= total

  const heroTitle = allDone
    ? t('roadmapAllComplete')
    : featured
      ? `${formatMessage(t('roadmapNextLessonPrefix'), { num: featured.displayIndex })}: ${featured.lesson.title}`
      : t('roadmapStartNext')

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-card-padding-lg mb-content-gap-xl">
      <div
        className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-[0.06] pointer-events-none"
        style={{ background: accentColor }}
      />
      <div
        className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full blur-3xl opacity-[0.04] pointer-events-none"
        style={{ background: `hsl(var(--primary))` }}
      />

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-content-gap">
        <div className="flex items-center gap-content-gap-sm w-full md:w-auto">
          <HeroProgressRing percent={percent} accentColor={accentColor} />
          <div className="text-start">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground uppercase tracking-tracking-sm">
              {t('roadmapHeroBadge')}
            </span>
            <h3 className="text-body-lg font-bold text-foreground tracking-tight mt-1">
              {heroTitle}
            </h3>
            <p className="text-body-xs text-muted-foreground mt-0.5">{t('roadmapHeroHint')}</p>
          </div>
        </div>

        <div className="flex items-center gap-content-gap-xs w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={onFocusNext}
            disabled={!featured}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-content-gap-xs bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-body-xs px-5 py-3 rounded-xl shadow-elevation-3 transition-opacity duration-normal"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{t('roadmapFocusNext')}</span>
          </button>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              title={t('roadmapResetProgress')}
              aria-label={t('roadmapResetProgress')}
              className="bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground p-3 rounded-xl border border-border transition-colors duration-normal"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
