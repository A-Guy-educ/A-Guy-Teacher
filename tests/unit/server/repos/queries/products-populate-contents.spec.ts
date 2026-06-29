/**
 * Unit tests for queryProductBySlug — focused on populating the new
 * product.contents blocks with course + feature relationships (the equivalent
 * of Payload's depth=2 join, but via direct Mongo lookups).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'

// vi.mock() is hoisted above all top-level code, so any state the factory
// closes over has to be hoisted too — otherwise we get a temporal-dead-zone
// "cannot access X before initialization" error.
//
// We expose SEPARATE toArray mocks per collection (courses vs features) so a
// product with both courseBlock + featureBlock can be tested without conflating
// the two responses through a single shared mock.
const { findOneSerializedMock, coursesToArrayMock, featuresToArrayMock } = vi.hoisted(() => ({
  findOneSerializedMock: vi.fn(),
  coursesToArrayMock: vi.fn(),
  featuresToArrayMock: vi.fn(),
}))

vi.mock('@/server/repos/mongo', () => ({
  findOneSerialized: findOneSerializedMock,
  findManySerialized: vi.fn(),
}))

vi.mock('@/infra/db/content-db', async () => {
  const actual =
    await vi.importActual<typeof import('@/infra/db/content-db')>('@/infra/db/content-db')
  return {
    ...actual,
    getContentDb: vi.fn(async () => ({
      // Route based on collection name so each branch (courses / features)
      // is exercised independently — important for the mixed-blocks test.
      collection: (name: string) => ({
        find: () => ({
          toArray: name === 'courses' ? coursesToArrayMock : featuresToArrayMock,
        }),
      }),
    })),
  }
})

import { queryProductBySlug } from '@/server/repos/queries/products'

const PRODUCT_ID = '507f1f77bcf86cd799439011'
const COURSE_ID = '507f191e810c19729de860ea'
const FEATURE_ID = '507f191e810c19729de860eb'

describe('queryProductBySlug — populated contents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    coursesToArrayMock.mockResolvedValue([])
    featuresToArrayMock.mockResolvedValue([])
  })

  it('returns null when no product matches the slug', async () => {
    findOneSerializedMock.mockResolvedValueOnce(null)
    const result = await queryProductBySlug({ slug: 'nope' })
    expect(result).toBeNull()
    expect(coursesToArrayMock).not.toHaveBeenCalled()
    expect(featuresToArrayMock).not.toHaveBeenCalled()
  })

  it('returns the product unchanged when contents is empty', async () => {
    findOneSerializedMock.mockResolvedValueOnce({
      id: PRODUCT_ID,
      slug: 'simple',
      title: 'Simple',
      contents: [],
    })

    const result = await queryProductBySlug({ slug: 'simple' })

    expect(result?.contents).toEqual([])
    expect(coursesToArrayMock).not.toHaveBeenCalled()
    expect(featuresToArrayMock).not.toHaveBeenCalled()
  })

  it('populates the `course` relation on courseBlock entries', async () => {
    findOneSerializedMock.mockResolvedValueOnce({
      id: PRODUCT_ID,
      slug: 'with-course',
      title: 'With Course',
      contents: [{ blockType: 'courseBlock', course: COURSE_ID }],
    })
    coursesToArrayMock.mockResolvedValueOnce([
      { _id: new ObjectId(COURSE_ID), title: '7th Grade Prep', slug: '7th-grade-prep' },
    ])

    const result = await queryProductBySlug({ slug: 'with-course' })

    const block = result?.contents?.[0]
    expect(block?.blockType).toBe('courseBlock')
    if (block?.blockType === 'courseBlock' && typeof block.course === 'object') {
      expect(block.course.title).toBe('7th Grade Prep')
      expect(block.course.slug).toBe('7th-grade-prep')
    } else {
      throw new Error('expected populated course')
    }
    // Features collection should NOT have been queried when there's only a courseBlock.
    expect(featuresToArrayMock).not.toHaveBeenCalled()
  })

  it('populates the `feature` relation on featureBlock entries, preserving limit + period', async () => {
    findOneSerializedMock.mockResolvedValueOnce({
      id: PRODUCT_ID,
      slug: 'with-feature',
      title: 'With Feature',
      contents: [{ blockType: 'featureBlock', feature: FEATURE_ID, limit: 5, period: 'day' }],
    })
    featuresToArrayMock.mockResolvedValueOnce([
      {
        _id: new ObjectId(FEATURE_ID),
        key: 'ai-questions',
        label: 'שאלות AI',
        type: 'numeric',
        isSilent: false,
      },
    ])

    const result = await queryProductBySlug({ slug: 'with-feature' })

    const block = result?.contents?.[0]
    expect(block?.blockType).toBe('featureBlock')
    if (block?.blockType === 'featureBlock' && typeof block.feature === 'object') {
      expect(block.feature.key).toBe('ai-questions')
      expect(block.feature.label).toBe('שאלות AI')
      expect(block.feature.isSilent).toBe(false)
      expect(block.limit).toBe(5)
      expect(block.period).toBe('day')
    } else {
      throw new Error('expected populated feature')
    }
    expect(coursesToArrayMock).not.toHaveBeenCalled()
  })

  it('populates BOTH course and feature when contents has a mix of block types (the realistic storefront case)', async () => {
    findOneSerializedMock.mockResolvedValueOnce({
      id: PRODUCT_ID,
      slug: 'mixed',
      title: 'Mixed Bundle',
      contents: [
        { blockType: 'courseBlock', course: COURSE_ID, lessonTypes: ['learning'] },
        { blockType: 'featureBlock', feature: FEATURE_ID, limit: 5, period: 'day' },
      ],
    })
    coursesToArrayMock.mockResolvedValueOnce([
      { _id: new ObjectId(COURSE_ID), title: 'Course Title', slug: 'course-slug' },
    ])
    featuresToArrayMock.mockResolvedValueOnce([
      {
        _id: new ObjectId(FEATURE_ID),
        key: 'ai-questions',
        label: 'AI questions',
        type: 'numeric',
        isSilent: false,
      },
    ])

    const result = await queryProductBySlug({ slug: 'mixed' })

    expect(result?.contents).toHaveLength(2)
    const courseBlock = result?.contents?.[0]
    const featureBlock = result?.contents?.[1]
    if (courseBlock?.blockType !== 'courseBlock') throw new Error('expected courseBlock first')
    if (featureBlock?.blockType !== 'featureBlock') throw new Error('expected featureBlock second')
    if (typeof courseBlock.course !== 'object') throw new Error('course not populated')
    if (typeof featureBlock.feature !== 'object') throw new Error('feature not populated')

    expect(courseBlock.course.title).toBe('Course Title')
    expect(courseBlock.lessonTypes).toEqual(['learning']) // block-level field preserved
    expect(featureBlock.feature.label).toBe('AI questions')
    expect(featureBlock.limit).toBe(5)

    // Both lookups should have run exactly once.
    expect(coursesToArrayMock).toHaveBeenCalledTimes(1)
    expect(featuresToArrayMock).toHaveBeenCalledTimes(1)
  })

  it('leaves the relation as a bare id string when no matching doc exists (graceful for stale refs)', async () => {
    findOneSerializedMock.mockResolvedValueOnce({
      id: PRODUCT_ID,
      slug: 'broken-ref',
      title: 'Broken Ref',
      contents: [{ blockType: 'courseBlock', course: COURSE_ID }],
    })
    coursesToArrayMock.mockResolvedValueOnce([]) // no match

    const result = await queryProductBySlug({ slug: 'broken-ref' })

    const block = result?.contents?.[0]
    if (block?.blockType !== 'courseBlock') throw new Error('wrong block type')
    expect(block.course).toBe(COURSE_ID)
  })

  it('treats a course populated with just { id, slug } as already-populated (no re-fetch, no overwrite)', async () => {
    // Pins the unified "is populated" predicate: any object with an `id`
    // counts as populated, regardless of which other fields the upstream
    // projection happened to include. The server-side helper used to check
    // for 'title' specifically — that would have re-fetched this block and
    // potentially stripped fields the upstream caller intended to surface.
    findOneSerializedMock.mockResolvedValueOnce({
      id: PRODUCT_ID,
      slug: 'narrow-projection',
      title: 'Narrow Projection',
      contents: [
        {
          blockType: 'courseBlock',
          // No `title` — only id + slug, e.g. from a projection like { id, slug }
          course: { id: COURSE_ID, slug: 'already' },
        },
      ],
    })

    const result = await queryProductBySlug({ slug: 'narrow-projection' })

    const block = result?.contents?.[0]
    if (block?.blockType !== 'courseBlock') throw new Error('wrong block type')
    if (typeof block.course !== 'object') throw new Error('course should still be object')
    // Slug should be preserved untouched; the populator must NOT have re-fetched.
    expect(block.course.slug).toBe('already')
    expect(coursesToArrayMock).not.toHaveBeenCalled()
  })

  it('does NOT overwrite an already-populated course relation (preserves richer upstream shape)', async () => {
    // Simulates a future hooked write or a depth>0 fetch where the block
    // arrives with `course` already as a populated object. The narrow
    // projection we'd otherwise apply would strip any extra fields.
    findOneSerializedMock.mockResolvedValueOnce({
      id: PRODUCT_ID,
      slug: 'pre-populated',
      title: 'Pre-Populated',
      contents: [
        {
          blockType: 'courseBlock',
          course: {
            id: COURSE_ID,
            title: 'Already Populated',
            slug: 'already',
            extra: 'value-from-upstream',
          },
        },
      ],
    })

    const result = await queryProductBySlug({ slug: 'pre-populated' })

    const block = result?.contents?.[0]
    if (block?.blockType !== 'courseBlock') throw new Error('wrong block type')
    if (typeof block.course !== 'object') throw new Error('course should still be object')
    expect((block.course as unknown as Record<string, unknown>).extra).toBe('value-from-upstream')
    // courses collection should NOT have been queried at all.
    expect(coursesToArrayMock).not.toHaveBeenCalled()
  })
})
