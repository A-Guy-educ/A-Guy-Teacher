import type { LessonProgress, QuestionProgress } from '../types/class-progress'

// Every question starts at 100. Wrong answers, hints and explanations cost points;
// an unsolved question scores 0. Weights live here so they can change without a Web release.
export const PENALTY = { mistake: 15, hint: 25, explanation: 25 } as const

export type Band = 'good' | 'mid' | 'bad'

export interface LessonStat {
  score: number
  independence: number
  minutes: number
  total: number
  answered: number
  alone: number
  afterMistakes: number
  withHelp: number
  unsolved: number
  inProgress: boolean
}

const usedHelp = (q: QuestionProgress) => q.hints > 0 || q.explanations > 0

export function questionScore(q: QuestionProgress): number {
  if (q.status !== 'solved') return 0
  return Math.max(
    0,
    100 -
      q.mistakes * PENALTY.mistake -
      q.hints * PENALTY.hint -
      q.explanations * PENALTY.explanation,
  )
}

export function questionKind(
  q: QuestionProgress,
): 'alone' | 'afterMistakes' | 'withHelp' | 'unsolved' | 'unseen' {
  if (q.status === 'unseen') return 'unseen'
  if (q.status === 'unsolved') return 'unsolved'
  if (usedHelp(q)) return 'withHelp'
  return q.mistakes > 0 ? 'afterMistakes' : 'alone'
}

const average = (values: number[]) =>
  values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : 0

export function lessonStat(
  lesson: LessonProgress | undefined,
  questionCount: number,
): LessonStat | null {
  if (!lesson || lesson.status === 'not_started') return null
  const answered = lesson.questions.filter((q) => q.status !== 'unseen')
  const kinds = answered.map(questionKind)
  const count = (kind: string) => kinds.filter((k) => k === kind).length

  return {
    score: average(answered.map(questionScore)),
    independence: answered.length
      ? Math.round(
          (answered.filter((q) => q.status === 'solved' && !usedHelp(q)).length / answered.length) *
            100,
        )
      : 0,
    minutes: Math.round(lesson.minutes),
    total: Math.max(questionCount, lesson.questions.length),
    answered: answered.length,
    alone: count('alone'),
    afterMistakes: count('afterMistakes'),
    withHelp: count('withHelp'),
    unsolved: count('unsolved'),
    inProgress: lesson.status === 'in_progress',
  }
}

/** Mean of a stat key over the started lessons, or null when none were started. */
export function meanOf(stats: (LessonStat | null)[], key: 'score' | 'independence' | 'minutes') {
  const started = stats.filter((s): s is LessonStat => s !== null)
  return started.length ? average(started.map((s) => s[key])) : null
}

export function band(value: number): Band {
  if (value >= 80) return 'good'
  if (value >= 60) return 'mid'
  return 'bad'
}
