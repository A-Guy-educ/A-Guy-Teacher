'use client'

import { useMemo, useState, type ReactNode } from 'react'

import { filterLessons, useLessonVisibility, type VisibilityFilter } from '../lib/lesson-visibility'
import type { ClassProgressResponse } from '../types/class-progress'

type Locale = 'en' | 'he'

const COPY = {
  en: {
    intro: (name: ReactNode) => <>Choose which lessons students in {name} can see</>,
    counter: (shown: number, total: number) => `${shown} of ${total} lessons shown`,
    filterLabel: 'Show',
    filter: { all: 'All', shown: 'Shown', hidden: 'Hidden' },
    search: 'Search lessons',
    lesson: 'Lesson',
    questions: (n: number) => (n === 1 ? '1 question' : `${n} questions`),
    shown: 'Shown to students',
    hidden: 'Hidden',
    toggle: (title: string) => `Show ${title} to students`,
    empty: 'No lessons match your search or filter.',
    noLessons: 'This class has no published lessons yet.',
    note: 'Preview: changes are not saved yet, and students still see every lesson.',
  },
  he: {
    intro: (name: ReactNode) => <>בחרו אילו שיעורים יוצגו לתלמידי {name}</>,
    counter: (shown: number, total: number) => `${shown} מתוך ${total} שיעורים מוצגים`,
    filterLabel: 'הצגה',
    filter: { all: 'הכל', shown: 'מוצגים', hidden: 'מוסתרים' },
    search: 'חיפוש שיעור',
    lesson: 'שיעור',
    questions: (n: number) => (n === 1 ? 'שאלה אחת' : `${n} שאלות`),
    shown: 'מוצג לתלמידים',
    hidden: 'מוסתר',
    toggle: (title: string) => `הצגת ${title} לתלמידים`,
    empty: 'אין שיעורים שמתאימים לחיפוש או לסינון.',
    noLessons: 'לכיתה הזו עוד אין שיעורים שפורסמו.',
    note: 'תצוגה מקדימה: השינויים עוד לא נשמרים, והתלמידים עדיין רואים את כל השיעורים.',
  },
} as const

export function LessonsView({
  locale,
  progress,
}: {
  locale: Locale
  progress: ClassProgressResponse
}) {
  const copy = COPY[locale]
  const lessons = useMemo(
    () => progress.lessons.map((lesson, i) => ({ ...lesson, number: i + 1 })),
    [progress.lessons],
  )
  const lessonIds = useMemo(() => lessons.map((l) => l.id), [lessons])
  const { isShown, toggle, shownCount } = useLessonVisibility(progress.class.id, lessonIds)

  const [filter, setFilter] = useState<VisibilityFilter>('all')
  const [query, setQuery] = useState('')
  const items = filterLessons(lessons, { filter, query }, isShown)

  return (
    <section className="cd-lv">
      <div className="cd-lv-head">
        {/* bdi keeps a Hebrew class name in the right order inside English text. */}
        <p>{copy.intro(<bdi>{progress.class.name}</bdi>)}</p>
        <span aria-live="polite" className="cd-lv-count">
          {copy.counter(shownCount, lessons.length)}
        </span>
      </div>

      <div className="cd-lv-panel">
        <div className="cd-lv-toolbar">
          <div aria-label={copy.filterLabel} className="cd-lv-filters" role="group">
            {(Object.keys(copy.filter) as VisibilityFilter[]).map((key) => (
              <button
                aria-pressed={filter === key}
                className="cd-lv-filter"
                key={key}
                onClick={() => setFilter(key)}
                type="button"
              >
                {copy.filter[key]}
              </button>
            ))}
          </div>
          <input
            aria-label={copy.search}
            className="cd-lv-search"
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.search}
            type="search"
            value={query}
          />
        </div>

        {lessons.length === 0 ? (
          <p className="cd-lv-empty">{copy.noLessons}</p>
        ) : items.length === 0 ? (
          <p className="cd-lv-empty">{copy.empty}</p>
        ) : (
          <ul className="cd-lv-list">
            {items.map((l) => {
              const on = isShown(l.id)
              const title = l.title || `${copy.lesson} ${l.number}`
              return (
                <li className="cd-lv-row" key={l.id}>
                  <span className="cd-lv-num">{l.number}</span>
                  <div className="cd-lv-main">
                    <h2>{title}</h2>
                    <span>{copy.questions(l.questionCount)}</span>
                  </div>
                  <div className="cd-lv-control">
                    <span className={on ? 'cd-lv-status cd-lv-status--on' : 'cd-lv-status'}>
                      {on ? copy.shown : copy.hidden}
                    </span>
                    <button
                      aria-checked={on}
                      aria-label={copy.toggle(title)}
                      className="cd-switch"
                      onClick={() => toggle(l.id)}
                      role="switch"
                      type="button"
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <p className="cd-lv-note">{copy.note}</p>
      </div>
    </section>
  )
}
