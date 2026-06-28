'use client'

import { useTranslations } from '@/ui/web/providers/I18n'

interface EmptyLessonPlaceholderProps {
  lessonTitle: string
}

/**
 * Empty lesson placeholder - shown when a lesson has no exercises
 * This provides the chat interface for AI tutoring without exercises
 */
export function EmptyLessonPlaceholder({ lessonTitle }: EmptyLessonPlaceholderProps) {
  const t = useTranslations('courses')

  return (
    <div className="flex flex-col items-center justify-center h-full gap-content-gap-lg p-card-padding-lg">
      <div className="text-center space-y-2">
        <h2 className="text-heading-lg font-bold text-foreground">{lessonTitle}</h2>
      </div>
      <p className="text-muted-foreground text-body-md">{t('noExercises')}</p>
    </div>
  )
}
