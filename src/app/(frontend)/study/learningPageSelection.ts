import { isValidContentLocale, type ContentLocale } from '@/infra/types/content'

export type LearningPageSearchParams = {
  courseId?: string | string[]
  grade?: string | string[]
  locale?: string | string[]
}

export interface LearningPageSelectionInput {
  cookieCourseId?: string
  cookieGrade?: string
  searchParams?: LearningPageSearchParams
  systemLocale: string
}

export interface LearningPageSelection {
  contentLocale?: ContentLocale
  courseId?: string
  grade?: string
}

export interface LearningCourseSummary {
  courseLabel?: string | null
  id: string
  order?: number | null
}

function firstParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  return trimmed || undefined
}

export function resolveLearningPageSelection({
  cookieCourseId,
  cookieGrade,
  searchParams,
  systemLocale,
}: LearningPageSelectionInput): LearningPageSelection {
  const queryGrade = firstParam(searchParams?.grade)
  const queryCourseId = firstParam(searchParams?.courseId)
  const queryLocale = firstParam(searchParams?.locale)
  const locale =
    queryLocale && isValidContentLocale(queryLocale)
      ? queryLocale
      : isValidContentLocale(systemLocale)
        ? systemLocale
        : undefined

  return {
    contentLocale: locale,
    courseId: queryCourseId ?? cookieCourseId,
    grade: queryGrade ?? cookieGrade,
  }
}

export function isEmbeddedLearningRequest(headersList: Pick<Headers, 'get'>): boolean {
  return headersList.get('sec-fetch-dest')?.toLowerCase() === 'iframe'
}

export function shouldUseEmbeddedLearningFallback({
  headersList,
  selection,
}: {
  headersList: Pick<Headers, 'get'>
  selection: LearningPageSelection
}): boolean {
  if (!isEmbeddedLearningRequest(headersList)) return false
  return !selection.grade && !selection.courseId
}

function isStructuredCourseLabel(label: string | null | undefined): boolean {
  return Boolean(label?.trim().match(/^\d+$/))
}

export function orderLearningFallbackCourses<T extends LearningCourseSummary>(courses: T[]): T[] {
  return [...courses].sort((a, b) => {
    const aStructured = isStructuredCourseLabel(a.courseLabel)
    const bStructured = isStructuredCourseLabel(b.courseLabel)
    if (aStructured !== bStructured) return aStructured ? -1 : 1
    return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
  })
}
