/**
 * URL builder utilities for course content navigation.
 *
 * Centralizes URL construction for lessons and exercises
 * based on the route structure:
 *   /courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]
 *   /courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]
 *
 * @fileType utility
 * @domain navigation
 * @pattern url-builder
 * @ai-summary Assumes all slug arguments are already sanitized and URL-safe; raw user input passed directly will produce malformed URLs.
 */

export function buildLessonUrl(
  courseSlug: string,
  chapterSlug: string,
  lessonSlug: string,
): string {
  return `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}`
}

export function buildExerciseUrl(
  courseSlug: string,
  chapterSlug: string,
  lessonSlug: string,
  exerciseSlug: string,
): string {
  return `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}/exercises/${exerciseSlug}`
}
