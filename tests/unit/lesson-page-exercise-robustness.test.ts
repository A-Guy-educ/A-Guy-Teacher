/**
 * @vitest-environment node
 * @fileType unit-test
 * @domain lessons
 * @pattern robustness
 *
 * Unit tests for LessonPage defensive behavior against malformed/missing exercises.
 * Issue #604: [Client Robustness] Prevent LessonPage crashes from malformed or missing exercises.
 */

import { describe, expect, it } from 'vitest'

/**
 * Copies the defensive hasBlocks logic from page.tsx so we can test it directly.
 * The actual page.tsx version is the source of truth — this copy mirrors it exactly.
 */
function hasBlocks(exercise: unknown): boolean {
  if (!exercise || typeof exercise !== 'object') return false

  const ex = exercise as { content?: unknown }
  if (Array.isArray(ex.content)) {
    return ex.content.length > 0
  }

  if (
    ex.content &&
    typeof ex.content === 'object' &&
    'blocks' in ex.content &&
    Array.isArray((ex.content as { blocks?: unknown }).blocks)
  ) {
    return (ex.content as { blocks: unknown[] }).blocks.length > 0
  }

  return false
}

/**
 * Mirrors the hasExerciseContent logic from LessonIntroPage/index.tsx.
 * The key defensive pattern: content must be checked as object before using `in`.
 */
function hasExerciseContent(exercises: unknown[]): boolean {
  return exercises.some((exercise) => {
    if (!exercise || typeof exercise !== 'object') return false
    const ex = exercise as { content?: unknown }
    if (Array.isArray(ex.content)) return ex.content.length > 0
    if (ex.content && typeof ex.content === 'object' && 'blocks' in ex.content) {
      return (
        Array.isArray((ex.content as { blocks?: unknown[] }).blocks) &&
        (ex.content as { blocks: unknown[] }).blocks.length > 0
      )
    }
    return false
  })
}

/**
 * Mirrors the exercise sanitization logic from page.tsx.
 */
function sanitizeExercises(exercises: unknown[]): Array<{ id: string; slug: string }> {
  return (exercises ?? []).filter(
    (ex): ex is { id: string; slug: string } =>
      Boolean(ex) &&
      typeof ex === 'object' &&
      Boolean((ex as { id?: unknown }).id) &&
      Boolean((ex as { slug?: unknown }).slug),
  )
}

describe('hasBlocks — defensive behavior', () => {
  it('returns false for null', () => {
    expect(hasBlocks(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(hasBlocks(undefined)).toBe(false)
  })

  it('returns false for a plain non-object value', () => {
    expect(hasBlocks('string' as unknown)).toBe(false)
    expect(hasBlocks(42 as unknown)).toBe(false)
  })

  it('returns false for an empty object', () => {
    expect(hasBlocks({})).toBe(false)
  })

  it('returns false for an object with no content', () => {
    expect(hasBlocks({ id: 'ex1', slug: 'ex-1' })).toBe(false)
  })

  it('returns false for an object with null content', () => {
    expect(hasBlocks({ id: 'ex1', slug: 'ex-1', content: null })).toBe(false)
  })

  it('returns false for an object with undefined content', () => {
    expect(hasBlocks({ id: 'ex1', slug: 'ex-1', content: undefined })).toBe(false)
  })

  it('returns false for an object with empty array content', () => {
    expect(hasBlocks({ id: 'ex1', slug: 'ex-1', content: [] })).toBe(false)
  })

  it('returns true for an object with non-empty array content', () => {
    expect(hasBlocks({ id: 'ex1', slug: 'ex-1', content: [{ type: 'block' }] })).toBe(true)
  })

  it('returns false for an object with content.blocks that is null', () => {
    expect(hasBlocks({ id: 'ex1', slug: 'ex-1', content: { blocks: null } })).toBe(false)
  })

  it('returns false for an object with content.blocks that is undefined', () => {
    expect(hasBlocks({ id: 'ex1', slug: 'ex-1', content: { blocks: undefined } })).toBe(false)
  })

  it('returns false for an object with content.blocks that is an empty array', () => {
    expect(hasBlocks({ id: 'ex1', slug: 'ex-1', content: { blocks: [] } })).toBe(false)
  })

  it('returns true for an object with non-empty content.blocks', () => {
    expect(hasBlocks({ id: 'ex1', slug: 'ex-1', content: { blocks: [{ type: 'block' }] } })).toBe(
      true,
    )
  })
})

describe('hasExerciseContent — defensive behavior', () => {
  it('returns false for an empty array', () => {
    expect(hasExerciseContent([])).toBe(false)
  })

  it('returns false when all exercises are null', () => {
    expect(hasExerciseContent([null, null])).toBe(false)
  })

  it('returns false when all exercises are undefined', () => {
    expect(hasExerciseContent([undefined, undefined])).toBe(false)
  })

  it('returns false when exercises contain null entries mixed with valid ones', () => {
    const exercises = [null, { id: 'ex1', slug: 'ex-1', content: [] }, undefined]
    expect(hasExerciseContent(exercises)).toBe(false)
  })

  it('returns true when at least one exercise has content blocks', () => {
    const exercises = [
      { id: 'ex1', slug: 'ex-1', content: [] },
      { id: 'ex2', slug: 'ex-2', content: [{ type: 'block' }] },
    ]
    expect(hasExerciseContent(exercises)).toBe(true)
  })

  it('returns false for all malformed exercises (no content)', () => {
    const exercises = [
      null,
      undefined,
      {},
      { id: 'ex1', slug: 'ex-1' },
      { id: 'ex2', slug: 'ex-2', content: null },
    ]
    expect(hasExerciseContent(exercises)).toBe(false)
  })
})

describe('Exercise sanitization — page.tsx', () => {
  it('filters out null entries', () => {
    const exercises = [null, { id: 'ex1', slug: 'ex-1' }, null]
    expect(sanitizeExercises(exercises)).toHaveLength(1)
  })

  it('filters out undefined entries', () => {
    const exercises = [undefined, { id: 'ex1', slug: 'ex-1' }]
    expect(sanitizeExercises(exercises)).toHaveLength(1)
  })

  it('filters out entries missing id', () => {
    const exercises = [{ slug: 'ex-1' }, { id: 'ex1', slug: 'ex-1' }]
    expect(sanitizeExercises(exercises)).toHaveLength(1)
  })

  it('filters out entries missing slug', () => {
    const exercises = [{ id: 'ex1' }, { id: 'ex1', slug: 'ex-1' }]
    expect(sanitizeExercises(exercises)).toHaveLength(1)
  })

  it('filters out entries with null id', () => {
    const exercises = [
      { id: null, slug: 'ex-1' },
      { id: 'ex1', slug: 'ex-1' },
    ]
    expect(sanitizeExercises(exercises)).toHaveLength(1)
  })

  it('filters out entries with null slug', () => {
    const exercises = [
      { id: 'ex1', slug: null },
      { id: 'ex1', slug: 'ex-1' },
    ]
    expect(sanitizeExercises(exercises)).toHaveLength(1)
  })

  it('keeps only entries with both valid id and slug', () => {
    const exercises = [
      null,
      undefined,
      {},
      { id: null, slug: null },
      { id: 'ex1', slug: 'ex-1' },
      { id: 'ex2', slug: 'ex-2' },
    ]
    expect(sanitizeExercises(exercises)).toHaveLength(2)
  })

  it('returns empty array when all entries are malformed', () => {
    const exercises = [null, undefined, {}, { id: null, slug: null }]
    expect(sanitizeExercises(exercises)).toHaveLength(0)
  })
})
