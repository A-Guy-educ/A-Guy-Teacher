'use client'

import { useEffect, useMemo, useState } from 'react'

import {
  band,
  lessonStat,
  meanOf,
  PENALTY,
  questionKind,
  questionScore,
  type LessonStat,
} from '../lib/class-metrics'
import type { ClassProgressResponse, ClassStudent, TeacherClass } from '../types/class-progress'

type Locale = 'en' | 'he'
type SortKey = 'name' | 'high' | 'low' | 'independence' | 'last'

const WINDOW = 4

const COPY = {
  en: {
    title: 'Class snapshot',
    demo: 'Demo data',
    sortBy: 'Sort by',
    sort: {
      name: 'Name',
      high: 'Score, highest first',
      low: 'Score, lowest first',
      independence: 'Independence, lowest first',
      last: 'Last lesson, highest first',
    },
    classes: 'Classes',
    student: 'Student',
    score: 'Score',
    independence: 'Independence',
    average: 'average',
    lesson: 'Lesson',
    prev: 'Previous lesson',
    next: 'Next lesson',
    minutes: 'min',
    soFar: 'so far',
    notStarted: 'Not started',
    inProgress: 'In progress',
    classAverage: 'Class average',
    lessons: 'Lessons',
    started: 'started',
    time: 'Time',
    alone: 'Alone, first try',
    afterMistakes: 'Alone after a mistake',
    withHelp: 'With hint or explanation',
    unsolved: 'Not solved',
    unseen: 'Not reached yet',
    totalQuestions: 'Total questions',
    question: 'Question',
    mistakes: 'mistakes',
    hints: 'hints',
    explanations: 'explanations',
    pickCell: 'Click a lesson cell to see each question',
    notStartedLesson: 'Has not started this lesson yet',
    allLessons: 'All lessons',
    close: 'Close',
    scoreNote: `The small number is the question's score: 100, minus ${PENALTY.mistake} per mistake and ${PENALTY.hint} per hint or explanation`,
    legendCell: 'Cell colour:',
    legendGood: '80 and up',
    legendMid: '60 to 79',
    legendBad: 'Below 60',
    unnamed: 'No name',
    noLessons: 'This class has no published lessons yet.',
  },
  he: {
    title: 'תמונת הכיתה',
    demo: 'נתוני הדגמה',
    sortBy: 'מיון לפי',
    sort: {
      name: 'שם',
      high: 'ציון, מהגבוה',
      low: 'ציון, מהנמוך',
      independence: 'מדד עצמאות, מהנמוך',
      last: 'השיעור האחרון, מהגבוה',
    },
    classes: 'כיתות',
    student: 'תלמיד',
    score: 'ציון',
    independence: 'עצמאות',
    average: 'ממוצע',
    lesson: 'שיעור',
    prev: 'שיעור קודם',
    next: 'שיעור הבא',
    minutes: "דק'",
    soFar: 'עד עכשיו',
    notStarted: 'לא התחיל',
    inProgress: 'באמצע',
    classAverage: 'ממוצע הכיתה',
    lessons: 'שיעורים',
    started: 'התחילו',
    time: 'זמן',
    alone: 'לבד בניסיון ראשון',
    afterMistakes: 'לבד אחרי טעות',
    withHelp: 'עם רמז או הסבר',
    unsolved: 'לא נפתרו',
    unseen: 'עוד לא הגיע',
    totalQuestions: 'סה"כ שאלות',
    question: 'שאלה',
    mistakes: 'טעויות',
    hints: 'רמזים',
    explanations: 'הסברים',
    pickCell: 'לחצו על משבצת של שיעור כדי לראות כל שאלה',
    notStartedLesson: 'עוד לא התחיל את השיעור',
    allLessons: 'כל השיעורים',
    close: 'סגירה',
    scoreNote: `המספר הקטן הוא הניקוד של השאלה: 100, פחות ${PENALTY.mistake} על כל טעות ו-${PENALTY.hint} על כל רמז או הסבר`,
    legendCell: 'צבע המשבצת:',
    legendGood: '80 ומעלה',
    legendMid: '60 עד 79',
    legendBad: 'מתחת ל-60',
    unnamed: 'ללא שם',
    noLessons: 'לכיתה הזו עוד אין שיעורים שפורסמו.',
  },
} as const

type Copy = (typeof COPY)[Locale]

interface Tip {
  student: ClassStudent
  lessonIndex: number
  left: number
  top: number
}

const Chevron = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15 6l-6 6 6 6" />
  </svg>
)

export function ClassDashboard({
  classes,
  demo,
  locale,
  progress,
}: {
  classes: TeacherClass[]
  demo: boolean
  locale: Locale
  progress: ClassProgressResponse
}) {
  const copy = COPY[locale]
  const { lessons } = progress
  const students = useMemo(
    () => progress.students.map((s) => (s.name ? s : { ...s, name: copy.unnamed })),
    [progress.students, copy.unnamed],
  )
  const lastStart = Math.max(0, lessons.length - WINDOW)

  const [sort, setSort] = useState<SortKey>('name')
  const [offset, setOffset] = useState(lastStart)
  const [selected, setSelected] = useState<{ studentId: string; lessonIndex: number | null }>()
  const [tip, setTip] = useState<Tip>()

  useEffect(() => {
    const hideTip = () => setTip(undefined)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      hideTip()
      setSelected(undefined)
    }
    window.addEventListener('scroll', hideTip, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', hideTip, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const shown = lessons.slice(offset, offset + WINDOW).map((_, i) => offset + i)
  const lastShown = shown[shown.length - 1]

  // stats[studentId][lessonIndex]
  const stats = useMemo(
    () =>
      new Map(
        students.map((s) => [
          s.id,
          lessons.map((l) => lessonStat(s.lessons[l.id], l.questionCount)),
        ]),
      ),
    [students, lessons],
  )
  const windowStats = (s: ClassStudent) => shown.map((j) => stats.get(s.id)![j])

  const sorted = [...students].sort((a, b) => {
    const avg = (s: ClassStudent) => meanOf(windowStats(s), 'score')
    const ind = (s: ClassStudent) => meanOf(windowStats(s), 'independence')
    const last = (s: ClassStudent) => stats.get(s.id)![lastShown]?.score
    switch (sort) {
      case 'high':
        return (avg(b) ?? -1) - (avg(a) ?? -1)
      case 'low':
        return (avg(a) ?? 999) - (avg(b) ?? 999)
      case 'independence':
        return (ind(a) ?? 999) - (ind(b) ?? 999)
      case 'last':
        return (last(b) ?? -1) - (last(a) ?? -1)
      default:
        return a.name.localeCompare(b.name, locale)
    }
  })

  const selectedStudent = students.find((s) => s.id === selected?.studentId)

  function showTip(student: ClassStudent, lessonIndex: number, el: HTMLElement) {
    const rect = el.getBoundingClientRect()
    const half = 123
    setTip({
      student,
      lessonIndex,
      left: Math.max(half, Math.min(rect.left + rect.width / 2, window.innerWidth - half)),
      top: rect.bottom + 8,
    })
  }

  const top = (
    <>
      <header className="cd-header">
        <h1>{progress.class.name}</h1>
        <p>
          {copy.title}
          {demo ? <span className="cd-demo">{copy.demo}</span> : null}
        </p>
      </header>

      <div className="cd-bar">
        <label className="cd-sort">
          <span>{copy.sortBy}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {(Object.keys(copy.sort) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {copy.sort[key]}
              </option>
            ))}
          </select>
        </label>
        <nav className="cd-tabs" aria-label={copy.classes}>
          {classes.map((c) => (
            <a
              aria-current={c.id === progress.class.id ? 'page' : undefined}
              className="cd-tab"
              href={`?class=${encodeURIComponent(c.id)}`}
              key={c.id}
            >
              {c.name}
            </a>
          ))}
        </nav>
      </div>
    </>
  )

  if (lessons.length === 0) {
    return (
      <div className="cd-page">
        {top}
        <p className="cd-hint">{copy.noLessons}</p>
      </div>
    )
  }

  return (
    <div className="cd-page">
      {top}

      <div className={selectedStudent ? 'cd-layout cd-layout--open' : 'cd-layout'}>
        <div className="cd-tablebox">
          {/* Fixed layout: lesson columns share the width equally, so paging to a lesson
              with a longer title never moves the arrow buttons. */}
          <table className="cd-table">
            <colgroup>
              <col className="cd-col-student" />
              <col className="cd-col-avg" />
              <col className="cd-col-avg" />
              {shown.map((j) => (
                <col key={lessons[j].id} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{copy.student}</th>
                <th scope="col">
                  <b>{copy.score}</b>
                  {copy.average}
                </th>
                <th scope="col">
                  <b>{copy.independence}</b>
                  {copy.average}
                </th>
                {shown.map((j, idx) => (
                  <th scope="col" key={lessons[j].id}>
                    <div className="cd-lh">
                      {idx === 0 ? (
                        <button
                          aria-label={copy.prev}
                          className="cd-nav"
                          disabled={offset === 0}
                          onClick={() => setOffset((o) => Math.max(0, o - 1))}
                          title={copy.prev}
                          type="button"
                        >
                          <Chevron />
                        </button>
                      ) : null}
                      <span className="cd-lh-title" title={lessons[j].title}>
                        <b>
                          {copy.lesson} {j + 1}
                        </b>
                        <span className="cd-lh-name">{lessons[j].title}</span>
                      </span>
                      {idx === shown.length - 1 ? (
                        <button
                          aria-label={copy.next}
                          className="cd-nav cd-nav--next"
                          disabled={offset >= lastStart}
                          onClick={() => setOffset((o) => Math.min(lastStart, o + 1))}
                          title={copy.next}
                          type="button"
                        >
                          <Chevron />
                        </button>
                      ) : null}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => {
                const avg = meanOf(windowStats(s), 'score')
                const ind = meanOf(windowStats(s), 'independence')
                return (
                  <tr className={selected?.studentId === s.id ? 'cd-sel' : undefined} key={s.id}>
                    <td>
                      <button
                        className="cd-name"
                        onClick={() =>
                          setSelected(
                            selected?.studentId === s.id && selected.lessonIndex === null
                              ? undefined
                              : { studentId: s.id, lessonIndex: null },
                          )
                        }
                        type="button"
                      >
                        <span className="cd-avatar">{s.name[0]}</span>
                        <span className="cd-name-text">{s.name}</span>
                      </button>
                    </td>
                    <td>
                      <span className={avg === null ? 'cd-avg' : `cd-avg cd-ink--${band(avg)}`}>
                        {avg ?? '-'}
                      </span>
                    </td>
                    <td>
                      <span className="cd-avg cd-avg--ind">{ind === null ? '-' : `${ind}%`}</span>
                    </td>
                    {shown.map((j) => {
                      const x = stats.get(s.id)![j]
                      const on =
                        selected?.studentId === s.id && selected.lessonIndex === j
                          ? ' cd-cell--on'
                          : ''
                      return (
                        <td key={lessons[j].id}>
                          <button
                            aria-label={
                              x
                                ? `${s.name}, ${copy.lesson} ${j + 1}: ${copy.score} ${x.score}, ${copy.independence} ${x.independence}%, ${x.minutes} ${copy.minutes}`
                                : `${s.name}, ${copy.lesson} ${j + 1}: ${copy.notStarted}`
                            }
                            className={
                              x
                                ? `cd-cell cd-cell--${band(x.score)}${x.inProgress ? ' cd-cell--partial' : ''}${on}`
                                : `cd-cell cd-cell--none${on}`
                            }
                            data-partial={copy.inProgress}
                            onBlur={() => setTip(undefined)}
                            onClick={() => {
                              setTip(undefined)
                              setSelected({ studentId: s.id, lessonIndex: j })
                            }}
                            onFocus={(e) => showTip(s, j, e.currentTarget)}
                            onMouseEnter={(e) => showTip(s, j, e.currentTarget)}
                            onMouseLeave={() => setTip(undefined)}
                            type="button"
                          >
                            {x ? (
                              <>
                                <span className="cd-score">{x.score}</span>
                                <span className="cd-cap">
                                  {copy.independence} <b>{x.independence}%</b>
                                </span>
                                <span className="cd-cap">
                                  <b>{x.minutes}</b> {copy.minutes}
                                  {x.inProgress ? ` ${copy.soFar}` : ''}
                                </span>
                              </>
                            ) : (
                              copy.notStarted
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <ClassFooter
                copy={copy}
                shown={shown}
                stats={stats}
                students={students}
                windowStats={windowStats}
              />
            </tfoot>
          </table>
        </div>

        {selectedStudent ? (
          <StudentPanel
            copy={copy}
            lessonIndex={selected?.lessonIndex ?? null}
            onClose={() => setSelected(undefined)}
            progress={progress}
            stats={stats.get(selectedStudent.id)!}
            student={selectedStudent}
            windowStats={windowStats(selectedStudent)}
          />
        ) : null}
      </div>

      <div className="cd-legend">
        <span>{copy.legendCell}</span>
        <span>
          <i className="cd-swatch cd-swatch--good" />
          {copy.legendGood}
        </span>
        <span>
          <i className="cd-swatch cd-swatch--mid" />
          {copy.legendMid}
        </span>
        <span>
          <i className="cd-swatch cd-swatch--bad" />
          {copy.legendBad}
        </span>
        <span>
          <i className="cd-swatch cd-swatch--partial" />
          {copy.inProgress}
        </span>
        <span>
          <i className="cd-swatch cd-swatch--none" />
          {copy.notStarted}
        </span>
      </div>

      {tip ? <CellTip copy={copy} lessons={lessons} stats={stats} tip={tip} /> : null}
    </div>
  )
}

function ClassFooter({
  copy,
  shown,
  stats,
  students,
  windowStats,
}: {
  copy: Copy
  shown: number[]
  stats: Map<string, (LessonStat | null)[]>
  students: ClassStudent[]
  windowStats: (s: ClassStudent) => (LessonStat | null)[]
}) {
  const avgs = students.map((s) => meanOf(windowStats(s), 'score')).filter((v) => v !== null)
  const inds = students.map((s) => meanOf(windowStats(s), 'independence')).filter((v) => v !== null)
  const mean = (values: number[]) =>
    values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0
  const classAvg = mean(avgs)

  return (
    <tr>
      <td>
        <span className="cd-foot-label">{copy.classAverage}</span>
        <small>
          {copy.lessons} {shown[0] + 1}–{shown[shown.length - 1] + 1}
        </small>
      </td>
      <td>
        <b className={`cd-ink--${band(classAvg)}`}>{classAvg}</b>
      </td>
      <td>
        <b>{mean(inds)}%</b>
      </td>
      {shown.map((j) => {
        const column = students.map((s) => stats.get(s.id)![j])
        const score = meanOf(column, 'score') ?? 0
        return (
          <td key={j}>
            <b className={`cd-ink--${band(score)}`}>{score}</b>
            <span>
              {copy.independence} {meanOf(column, 'independence') ?? 0}% ·{' '}
              {meanOf(column, 'minutes') ?? 0} {copy.minutes}
            </span>
            <span>
              {column.filter(Boolean).length}/{students.length} {copy.started}
            </span>
          </td>
        )
      })}
    </tr>
  )
}

function CellTip({
  copy,
  lessons,
  stats,
  tip,
}: {
  copy: Copy
  lessons: ClassProgressResponse['lessons']
  stats: Map<string, (LessonStat | null)[]>
  tip: Tip
}) {
  const x = stats.get(tip.student.id)![tip.lessonIndex]
  const row = (label: string, value: string | number, swatch?: string) => (
    <div className="cd-tip-row">
      <span>
        {swatch ? <i className={`cd-q-swatch cd-q-swatch--${swatch}`} /> : null}
        {label}
      </span>
      <b>{value}</b>
    </div>
  )

  return (
    <div className="cd-tip" role="tooltip" style={{ left: tip.left, top: tip.top }}>
      <strong>
        {tip.student.name} · {copy.lesson} {tip.lessonIndex + 1}
      </strong>
      {x ? (
        <>
          {lessons[tip.lessonIndex]?.title ? (
            <div className="cd-tip-sub">{lessons[tip.lessonIndex].title}</div>
          ) : null}
          {row(copy.score, x.score)}
          {row(copy.independence, `${x.independence}%`)}
          {row(copy.time, `${x.minutes} ${copy.minutes}`)}
          {row(copy.alone, x.alone, 'alone')}
          {row(copy.afterMistakes, x.afterMistakes, 'afterMistakes')}
          {row(copy.withHelp, x.withHelp, 'withHelp')}
          {row(copy.unsolved, x.unsolved, 'unsolved')}
          {x.inProgress ? row(copy.unseen, x.total - x.answered, 'unseen') : null}
          <div className="cd-tip-total">{row(copy.totalQuestions, x.total)}</div>
        </>
      ) : (
        copy.notStartedLesson
      )}
    </div>
  )
}

function StudentPanel({
  copy,
  lessonIndex,
  onClose,
  progress,
  stats,
  student,
  windowStats,
}: {
  copy: Copy
  lessonIndex: number | null
  onClose: () => void
  progress: ClassProgressResponse
  stats: (LessonStat | null)[]
  student: ClassStudent
  windowStats: (LessonStat | null)[]
}) {
  const avg = meanOf(windowStats, 'score')
  const ind = meanOf(windowStats, 'independence')
  const lesson = lessonIndex === null ? null : progress.lessons[lessonIndex]
  const x = lessonIndex === null ? null : stats[lessonIndex]
  const questions = lesson ? (student.lessons[lesson.id]?.questions ?? []) : []
  const kindLabel = {
    alone: copy.alone,
    afterMistakes: copy.afterMistakes,
    withHelp: copy.withHelp,
    unsolved: copy.unsolved,
    unseen: copy.unseen,
  }

  return (
    <aside className="cd-panel">
      <div className="cd-panel-head">
        <div>
          <span className="cd-avatar cd-avatar--lg">{student.name[0]}</span>
          <div>
            <h2>{student.name}</h2>
            <p>
              {progress.class.name} · {copy.score} {avg ?? '-'} · {copy.independence}{' '}
              {ind === null ? '-' : `${ind}%`}
            </p>
          </div>
        </div>
        <button aria-label={copy.close} className="cd-close" onClick={onClose} type="button">
          ×
        </button>
      </div>

      {lesson && lessonIndex !== null ? (
        <div className="cd-box">
          <h3>
            {copy.lesson} {lessonIndex + 1}: {lesson.title}
            {x ? <span className={`cd-big cd-ink--${band(x.score)}`}>{x.score}</span> : null}
          </h3>
          {x ? (
            <>
              <p className="cd-hint">
                {copy.independence} {x.independence}% · {x.minutes} {copy.minutes}
              </p>
              <div className="cd-questions">
                {questions.map((q, i) => {
                  const kind = questionKind(q)
                  return (
                    <div
                      className={`cd-q cd-q--${kind}`}
                      key={q.id}
                      title={`${copy.question} ${i + 1}: ${kindLabel[kind]}${
                        kind === 'unseen'
                          ? ''
                          : ` · ${q.mistakes} ${copy.mistakes} · ${q.hints} ${copy.hints} · ${q.explanations} ${copy.explanations}`
                      }`}
                    >
                      {i + 1}
                      <small>{kind === 'unseen' ? '' : questionScore(q)}</small>
                    </div>
                  )
                })}
              </div>
              <p className="cd-hint">{copy.scoreNote}</p>
            </>
          ) : (
            <p className="cd-hint">{copy.notStartedLesson}</p>
          )}
        </div>
      ) : (
        <p className="cd-hint">{copy.pickCell}</p>
      )}

      <div className="cd-box">
        <h3>{copy.allLessons}</h3>
        <div className="cd-rows">
          {stats.map((s, j) => (
            <div className="cd-row" key={progress.lessons[j].id}>
              <span>
                {copy.lesson} {j + 1}
              </span>
              <span className="cd-track">
                {s ? (
                  <i className={`cd-fill--${band(s.score)}`} style={{ width: `${s.score}%` }} />
                ) : null}
              </span>
              <b>{s ? s.score : '-'}</b>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
