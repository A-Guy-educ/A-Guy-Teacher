/**
 * Slug formatting utilities for Payload CMS collections.
 *
 * @fileType utility
 * @domain payload-fields
 */

import { toKebabCase } from '@/infra/utils/toKebabCase'

/**
 * Matches " - Copy" suffixes that Payload appends when duplicating documents.
 * Handles:
 * - " - Copy" (Payload default)
 * - " - Copy (2)", " - Copy (3)", etc. (subsequent duplicates)
 * - Repeated " - Copy - Copy" (multiple duplicates)
 */
const COPY_SUFFIX_REGEX = /\s*-\s*[Cc][Oo][Pp][Yy](?:\s*\(\d+\))?/gi

/**
 * Strip the " - Copy" suffix that Payload adds when duplicating a document.
 * Also strips lowercase "-copy" variants and numeric suffixes.
 *
 * Examples:
 * - "my-lesson - Copy" → "my-lesson"
 * - "my-lesson - Copy (2)" → "my-lesson"
 * - "my-lesson - Copy - Copy" → "my-lesson"
 * - "my-lesson-copy" → "my-lesson"
 * - "my-lesson-copy-2" → "my-lesson"
 */
export const stripCopySuffix = (slug: string): string => {
  return slug
    .replace(COPY_SUFFIX_REGEX, '')
    .replace(/-+$/, '') // trailing hyphens
    .trim()
}

/**
 * Generate a URL-safe slug from a title string.
 *
 * Uses toKebabCase which:
 * - Converts camelCase to kebab-case (e.g., "helloWorld" → "hello-world")
 * - Converts spaces to hyphens (e.g., "Hello World" → "hello-world")
 * - Converts to lowercase (e.g., "Hello" → "hello")
 * - Removes special characters (keeps only alphanumeric and hyphens)
 *
 * @param title - The title to convert to a slug
 * @param fallback - Fallback slug if title is empty/whitespace only
 * @returns URL-safe kebab-case slug
 */
export const formatSlug = (title: string, fallback?: string): string => {
  if (!title || title.trim().length === 0) {
    return fallback ?? `item-${Date.now().toString(36)}`
  }
  return toKebabCase(title.trim())
}

/**
 * Generate a slug for a duplicated lesson.
 * Strips " - Copy" suffixes and normalizes to URL-safe kebab-case.
 *
 * Used by the duplication pipeline to generate proper slugs for
 * duplicated lessons, preventing URL-encoded spaces from causing 404s.
 *
 * @param originalSlug - The original lesson slug
 * @param newTitle - The title for the new lesson (used to generate slug if original is invalid)
 * @returns URL-safe normalized slug
 */
export const formatDuplicateSlug = (originalSlug: string, newTitle: string): string => {
  // First strip any existing copy suffix
  const stripped = stripCopySuffix(originalSlug)
  // If the stripped slug is meaningful (not just dashes), use it
  if (stripped.length > 1 && !/^-+$/.test(stripped)) {
    return toKebabCase(stripped)
  }
  // Otherwise generate from title
  return formatSlug(newTitle)
}
