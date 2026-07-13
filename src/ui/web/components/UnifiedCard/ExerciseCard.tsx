'use client'

import type { Exercise } from '@/infra/types/content'
import { useTranslations } from '@/ui/web/providers/I18n'
import { UnifiedCard } from '@/ui/web/components/UnifiedCard'
import { Badge } from '@/ui/web/components/badge'
import type { ContentBlock } from '@/ui/web/exerciserenderer/types'
import { getExerciseBlocks } from '@/lib/exercises/getExerciseBlocks'

interface ExerciseCardProps {
  exercise: Exercise
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  index: number
}

function getQuestionTypes(exercise: Exercise): string[] {
  const blocks = getExerciseBlocks(exercise)
  const questionBlocks = blocks.filter(
    (block): block is ContentBlock =>
      block.type === 'question_select' || block.type === 'question_free_response',
  )

  const types = new Set(questionBlocks.map((block) => block.type))
  return Array.from(types)
}

function getQuestionTypeBadge(questionType: string, t: ReturnType<typeof useTranslations>) {
  const badges = {
    question_mcq: { label: t('mcqBadge'), variant: 'default' as const },
    question_select: { label: t('selectBadge'), variant: 'secondary' as const },
    question_free_response: { label: t('freeResponseBadge'), variant: 'outline' as const },
  }
  return (
    badges[questionType as keyof typeof badges] || {
      label: 'Question',
      variant: 'default' as const,
    }
  )
}

export function ExerciseCard({
  exercise,
  courseSlug,
  chapterSlug,
  lessonSlug,
  index,
}: ExerciseCardProps) {
  const t = useTranslations('courses')
  const href = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}/exercises/${exercise.id}`

  const questionTypes = getQuestionTypes(exercise)
  const firstBadge = questionTypes.length > 0 ? getQuestionTypeBadge(questionTypes[0], t) : null

  // Extract first block text as description
  let description: string | undefined
  const firstBlock = getExerciseBlocks(exercise)[0]
  if (firstBlock && 'value' in firstBlock && typeof firstBlock.value === 'string') {
    description = firstBlock.value
  }

  return (
    <UnifiedCard
      title={exercise.title || t('exercisesTitle')}
      description={description}
      label={`${t('exercise')} ${index + 1}`}
      buttonLabel={t('startExercise')}
      buttonHref={href}
      children={
        firstBadge ? (
          <Badge variant={firstBadge.variant} className="self-start">
            {firstBadge.label}
          </Badge>
        ) : null
      }
    />
  )
}
