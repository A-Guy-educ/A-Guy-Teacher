import { describe, expect, it } from 'vitest'

import {
  activeLessons,
  band,
  lessonStat,
  meanOf,
  questionKind,
  questionOutcome,
  questionScore,
} from '../src/lib/class-metrics'
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

  it("follows Web's lesson summary: a mistake counts as help", () => {
    expect(questionOutcome(q('solved'))).toBe('alone')
    expect(questionOutcome(q('solved', 1))).toBe('with-help')
    expect(questionOutcome(q('solved', 0, 1))).toBe('with-help')
    expect(questionOutcome(q('solved', 0, 0, 1))).toBe('with-help')
    expect(questionOutcome(q('unsolved', 2))).toBe('wrong')
    expect(questionOutcome(q('unseen'))).toBe('skipped')
  })

  const questions = [q('solved'), q('solved', 2), q('unsolved', 1), q('solved', 0, 1), q('unseen')]

  it('scores answered questions and counts independence over every section', () => {
    const stat = lessonStat({ status: 'completed', minutes: 12.4, questions })

    expect(stat).toMatchObject({
      score: 61, // (100 + 70 + 0 + 75) / 4
      independence: 20, // 1 alone of 5 sections, skipped ones included
      minutes: 12,
      sections: { alone: 1, 'with-help': 2, wrong: 1, skipped: 1, total: 5 },
      inProgress: false,
    })
  })

  it('counts skipped sections even when the lesson is marked in progress', () => {
    // The reported case: 4 correct alone, 2 wrong, 34 skipped -> Web's summary says 10%.
    const lesson = [
      ...Array.from({ length: 4 }, () => q('solved')),
      q('unsolved', 1),
      q('unsolved', 1),
      ...Array.from({ length: 34 }, () => q('unseen')),
    ]
    const stat = lessonStat({ status: 'in_progress', minutes: 2, questions: lesson })
    expect(stat?.independence).toBe(10)
  })

  it("uses Web's section outcomes when they are sent", () => {
    const stat = lessonStat({
      status: 'completed',
      minutes: 3,
      questions,
      sections: [
        { id: 's1', outcome: 'alone' },
        { id: 's2', outcome: 'alone' },
        { id: 's3', outcome: 'with-help' },
        { id: 's4', outcome: 'skipped' },
      ],
    })
    expect(stat?.independence).toBe(50)
    expect(stat?.sections).toEqual({ alone: 2, 'with-help': 1, wrong: 0, skipped: 1, total: 4 })
    expect(stat?.score).toBe(61) // the score still comes from the questions
  })

  it('treats a missing or unstarted lesson as not started', () => {
    expect(lessonStat(undefined)).toBeNull()
    expect(lessonStat({ status: 'not_started', minutes: 0, questions: [] })).toBeNull()
    expect(meanOf([null, null], 'score')).toBeNull()
  })

  it('counts a self-checked question as answered with help', () => {
    // Web reports self-checked answers as 'unseen'.
    const selfChecked = { ...q('unseen'), selfChecked: true }
    expect(questionKind(selfChecked)).toBe('withHelp')
    expect(questionOutcome(selfChecked)).toBe('with-help')
    expect(questionScore(selfChecked)).toBe(75)

    const stat = lessonStat({
      status: 'in_progress',
      minutes: 5,
      questions: [selfChecked, selfChecked, q('unseen')],
    })
    expect(stat).toMatchObject({ score: 75, independence: 0 })
  })

  it('has no score for a started lesson with nothing answered', () => {
    const stat = lessonStat({ status: 'in_progress', minutes: 4, questions: [q('unseen')] })
    expect(stat?.score).toBeNull()
    expect(meanOf([stat, null], 'score')).toBeNull()
    expect(
      meanOf(
        [stat, lessonStat({ status: 'completed', minutes: 1, questions: [q('solved')] })],
        'score',
      ),
    ).toBe(100)
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

  it('keeps only lessons some student started, numbered by course position', () => {
    const lesson = (status: 'not_started' | 'in_progress' | 'completed') => ({
      status,
      minutes: 1,
      questions: [],
    })
    const lessons = activeLessons({
      class: { id: 'c', name: 'C' },
      lessons: ['a', 'b', 'c', 'd'].map((id) => ({ id, title: id, questionCount: 1 })),
      students: [
        { id: 's1', name: 'One', lessons: { a: lesson('not_started'), c: lesson('in_progress') } },
        { id: 's2', name: 'Two', lessons: { d: lesson('completed') } },
      ],
    })
    expect(lessons.map((l) => [l.id, l.number])).toEqual([
      ['c', 3],
      ['d', 4],
    ])
  })
})
