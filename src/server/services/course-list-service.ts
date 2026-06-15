/**
 * Course List Service
 *
 * Returns all published courses for public catalog display.
 *
 * @fileType service
 * @domain courses
 * @pattern repository-wrappers
 * @ai-summary Thin wrapper around queryPublishedCourses repo — no business logic
 */
import { queryPublishedCourses } from '@/server/repos/queries/courses'

export async function getPublishedCourseList() {
  return queryPublishedCourses()
}
