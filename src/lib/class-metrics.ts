import type {
  ClassLesson,
  ClassProgressResponse,
  LessonProgress,
  QuestionProgress,
  SectionOutcome,
} from '../types/class-progress'

// Every question starts at 100. Wrong answers, hints and explanations cost points;
// an unsolved question scores 0. Weights live here so they can change without a Web release.
export const PENALTY = { mistake: 15, hint: 25, explanation: 25 } as const

export type Band = 'good' | 'mid' | 'bad'

export interface LessonStat {
  score: number
  independence: number
  minutes: number
  sections: Record<SectionOutcome, number> & { total: number }
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

/**
 * The student's lesson summary rule (A-Guy-Web lessonSummary.ts), applied to one question:
 * a wrong attempt counts as help, just like a hint or explanation.
 */
export function questionOutcome(q: QuestionProgress): SectionOutcome {
  if (q.status === 'unseen') return 'skipped'
  if (q.status === 'unsolved') return 'wrong'
  return q.mistakes > 0 || usedHelp(q) ? 'with-help' : 'alone'
}

/** Web's section outcomes when it sends them; otherwise each question stands in for a section. */
export function sectionOutcomes(lesson: LessonProgress): SectionOutcome[] {
  return lesson.sections?.map((s) => s.outcome) ?? lesson.questions.map(questionOutcome)
}

export function lessonStat(lesson: LessonProgress | undefined): LessonStat | null {
  if (!lesson || lesson.status === 'not_started') return null
  const answered = lesson.questions.filter((q) => q.status !== 'unseen')
  const outcomes = sectionOutcomes(lesson)
  const count = (outcome: SectionOutcome) => outcomes.filter((o) => o === outcome).length
  const inProgress = lesson.status === 'in_progress'
  // Like Web's summary, independence is "alone" over every section, skipped ones included.
  // Web often reports a finished lesson with skipped sections as in progress, so the
  // status can't be used to leave skipped sections out.
  const counted = outcomes.length

  return {
    score: average(answered.map(questionScore)),
    independence: counted ? Math.round((count('alone') / counted) * 100) : 0,
    minutes: Math.round(lesson.minutes),
    sections: {
      alone: count('alone'),
      'with-help': count('with-help'),
      skipped: count('skipped'),
      wrong: count('wrong'),
      total: outcomes.length,
    },
    inProgress,
  }
}

/** Mean of a stat key over the started lessons, or null when none were started. */
export function meanOf(stats: (LessonStat | null)[], key: 'score' | 'independence' | 'minutes') {
  const started = stats.filter((s): s is LessonStat => s !== null)
  return started.length ? average(started.map((s) => s[key])) : null
}

export type NumberedLesson = ClassLesson & { number: number }

/** Lessons at least one student started, keeping their position in the course as `number`. */
export function activeLessons(progress: ClassProgressResponse): NumberedLesson[] {
  return progress.lessons
    .map((lesson, i) => ({ ...lesson, number: i + 1 }))
    .filter((lesson) =>
      progress.students.some((s) => {
        const status = s.lessons[lesson.id]?.status
        return status !== undefined && status !== 'not_started'
      }),
    )
}

export function band(value: number): Band {
  if (value >= 80) return 'good'
  if (value >= 60) return 'mid'
  return 'bad'
}
