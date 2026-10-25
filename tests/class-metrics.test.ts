import { describe, expect, it } from 'vitest'

import { band, lessonStat, meanOf, questionKind, questionScore } from '../src/lib/class-metrics'
import { classProgressResponseSchema } from '../src/types/class-progress'

const q = (
  status: 'unseen' | 'solved' | 'unsolved',
  mistakes = 0,
  hints = 0,
  explanations = 0,
) => ({
  id: `q-${status}-${mistakes}-${hints}-${explanations}`,
  status,
  mistakes,
  hints,
  explanations,
})

describe('class metrics', () => {
  it('scores a question from mistakes, hints and explanations', () => {
    expect(questionScore(q('solved'))).toBe(100)
    expect(questionScore(q('solved', 2))).toBe(70)
    expect(questionScore(q('solved', 1, 1))).toBe(60)
    expect(questionScore(q('solved', 0, 0, 1))).toBe(75)
    expect(questionScore(q('solved', 5, 2))).toBe(0)
    expect(questionScore(q('unsolved'))).toBe(0)
  })

  it('classifies how a question was solved', () => {
    expect(questionKind(q('solved'))).toBe('alone')
    expect(questionKind(q('solved', 1))).toBe('afterMistakes')
    expect(questionKind(q('solved', 1, 1))).toBe('withHelp')
    expect(questionKind(q('solved', 0, 0, 1))).toBe('withHelp')
    expect(questionKind(q('unsolved', 2))).toBe('unsolved')
    expect(questionKind(q('unseen'))).toBe('unseen')
  })

  it('averages the lesson over answered questions only', () => {
    const stat = lessonStat(
      {
        status: 'in_progress',
        minutes: 12.4,
        questions: [q('solved'), q('solved', 2), q('unsolved', 1), q('solved', 0, 1), q('unseen')],
      },
      5,
    )

    expect(stat).toMatchObject({
      score: 61, // (100 + 70 + 0 + 75) / 4
      independence: 50, // 2 of 4 solved without help
      minutes: 12,
      total: 5,
      answered: 4,
      alone: 1,
      afterMistakes: 1,
      withHelp: 1,
      unsolved: 1,
      inProgress: true,
    })
  })

  it('treats a missing or unstarted lesson as not started', () => {
    expect(lessonStat(undefined, 10)).toBeNull()
    expect(lessonStat({ status: 'not_started', minutes: 0, questions: [] }, 10)).toBeNull()
    expect(meanOf([null, null], 'score')).toBeNull()
  })

  it('bands scores at 80 and 60', () => {
    expect([band(80), band(79), band(60), band(59)]).toEqual(['good', 'mid', 'mid', 'bad'])
  })

  it('rejects progress responses with unknown question states', () => {
    expect(() =>
      classProgressResponseSchema.parse({
        class: { id: 'c1', name: 'Class' },
        lessons: [{ id: 'l1', title: 'Lesson', questionCount: 1 }],
        students: [
          {
            id: 's1',
            name: 'Dana',
            lessons: {
              l1: {
                status: 'completed',
                minutes: 3,
                questions: [{ ...q('solved'), status: 'skipped' }],
              },
            },
          },
        ],
      }),
    ).toThrow()
  })
})
