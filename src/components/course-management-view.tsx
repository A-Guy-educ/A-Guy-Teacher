import React from 'react'

import type { ManagedCourse } from '../types/courses'

type Locale = 'en' | 'he'

const COPY = {
  en: {
    eyebrow: 'Teacher workspace',
    title: 'Course management',
    description: 'Review every course and quickly open content that is already live.',
    courses: 'courses',
    published: 'Published',
    draft: 'Draft',
    archived: 'Archived',
    inactive: 'Inactive',
    access: 'Access',
    locale: 'Language',
    updated: 'Updated',
    view: 'View live course',
    unavailable: 'Not publicly available',
    empty: 'No courses were found.',
  },
  he: {
    eyebrow: 'סביבת עבודה למורים',
    title: 'ניהול קורסים',
    description: 'סקירת כל הקורסים וגישה מהירה לתוכן שכבר פורסם.',
    courses: 'קורסים',
    published: 'פורסם',
    draft: 'טיוטה',
    archived: 'בארכיון',
    inactive: 'לא פעיל',
    access: 'גישה',
    locale: 'שפה',
    updated: 'עודכן',
    view: 'צפייה בקורס',
    unavailable: 'לא זמין לציבור',
    empty: 'לא נמצאו קורסים.',
  },
} as const

function statusLabel(status: string | null | undefined, locale: Locale): string {
  const copy = COPY[locale]
  if (status === 'published') return copy.published
  if (status === 'archived') return copy.archived
  return copy.draft
}

function statusClass(status: string | null | undefined): string {
  if (status === 'published') return 'teacher-badge teacher-badge--published'
  if (status === 'archived') return 'teacher-badge teacher-badge--archived'
  return 'teacher-badge teacher-badge--draft'
}

function formattedDate(value: string | null | undefined, locale: Locale): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    dateStyle: 'medium',
  }).format(date)
}

export function CourseManagementView({
  courses,
  locale,
}: {
  courses: ManagedCourse[]
  locale: Locale
}) {
  const copy = COPY[locale]
  const published = courses.filter((course) => course.status === 'published').length
  const drafts = courses.filter(
    (course) => course.status !== 'published' && course.status !== 'archived',
  ).length
  const archived = courses.filter((course) => course.status === 'archived').length

  return (
    <div className="teacher-page">
      <header className="teacher-page__hero">
        <div>
          <p className="teacher-eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="teacher-page__description">{copy.description}</p>
        </div>
        <div className="teacher-total" aria-label={`${courses.length} ${copy.courses}`}>
          <strong>{courses.length}</strong>
          <span>{copy.courses}</span>
        </div>
      </header>

      <section className="teacher-summary" aria-label={copy.title}>
        <article>
          <strong>{published}</strong>
          <span>{copy.published}</span>
        </article>
        <article>
          <strong>{drafts}</strong>
          <span>{copy.draft}</span>
        </article>
        <article>
          <strong>{archived}</strong>
          <span>{copy.archived}</span>
        </article>
      </section>

      {courses.length === 0 ? (
        <p className="teacher-empty">{copy.empty}</p>
      ) : (
        <section className="teacher-course-grid">
          {courses.map((course) => {
            const isPublic =
              course.status === 'published' && course.isActive !== false && course.slug
            const updated = formattedDate(course.updatedAt, locale)

            return (
              <article className="teacher-course-card" key={course.id}>
                <div className="teacher-course-card__topline">
                  <span className={statusClass(course.status)}>
                    {statusLabel(course.status, locale)}
                  </span>
                  {course.isActive === false ? (
                    <span className="teacher-badge">{copy.inactive}</span>
                  ) : null}
                </div>
                <div>
                  {course.courseLabel ? (
                    <p className="teacher-course-label">{course.courseLabel}</p>
                  ) : null}
                  <h2>{course.title}</h2>
                  {course.description ? (
                    <p className="teacher-course-description">{course.description}</p>
                  ) : null}
                </div>
                <dl className="teacher-course-meta">
                  <div>
                    <dt>{copy.locale}</dt>
                    <dd>{course.locale?.toUpperCase() || '—'}</dd>
                  </div>
                  <div>
                    <dt>{copy.access}</dt>
                    <dd>{course.accessType || '—'}</dd>
                  </div>
                  {updated ? (
                    <div>
                      <dt>{copy.updated}</dt>
                      <dd>{updated}</dd>
                    </div>
                  ) : null}
                </dl>
                {isPublic ? (
                  <a
                    className="teacher-button"
                    href={`https://www.aguy.co.il/courses/${encodeURIComponent(course.slug as string)}`}
                  >
                    {copy.view}
                  </a>
                ) : (
                  <span className="teacher-course-unavailable">{copy.unavailable}</span>
                )}
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
