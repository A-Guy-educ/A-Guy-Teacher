/**
 * Top lessons opened — sorted list backed by the `lesson-stats` counter
 * collection. Shows top 5 by default, expands to reveal up to 25 more.
 *
 * @fileType component
 * @domain dashboard
 * @pattern presentational
 * @ai-summary Top-N lessons ranked by open count with Show more toggle
 */

'use client'

import { useState } from 'react'

import { Button } from '@/ui/web/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import type { TopLesson } from '@/server/services/dashboard/metrics-types'

interface Props {
  lessons: TopLesson[]
}

const INITIAL_VISIBLE = 5

export function TopLessonsSection({ lessons }: Props) {
  const t = useTranslations('dashboard.engagement')
  const locale = useLocale()
  const [showAll, setShowAll] = useState(false)

  const max = lessons.reduce((m, row) => Math.max(m, row.openCount), 0)
  const visible = showAll ? lessons : lessons.slice(0, INITIAL_VISIBLE)
  const hasMore = lessons.length > INITIAL_VISIBLE

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-heading-md">{t('topLessons')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {lessons.length === 0 ? (
          <p className="text-body-sm text-muted-foreground py-section-xs">{t('noLessons')}</p>
        ) : (
          <>
            <ul className="space-y-2">
              {visible.map((row) => {
                const widthPct = max > 0 ? (row.openCount / max) * 100 : 0
                return (
                  <li key={row.lessonId} className="space-y-1">
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="truncate max-w-[70%]" title={row.lessonTitle}>
                        {row.lessonTitle}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {row.openCount.toLocaleString(locale)}{' '}
                        <span className="text-body-xs font-normal text-muted-foreground">
                          {t('opensSuffix')}
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${widthPct}%` }}
                        aria-hidden
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
            {hasMore && (
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll ? t('showLess') : t('showMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
