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
const { findOneSerializedMock, findToArrayMock, collectionFactory } = vi.hoisted(() => ({
  findOneSerializedMock: vi.fn(),
  findToArrayMock: vi.fn(),
  collectionFactory: vi.fn((_name: string) => ({
    find: () => ({ toArray: vi.fn() }),
  })),
}))

vi.mock('@/server/repos/mongo', () => ({
  findOneSerialized: findOneSerializedMock,
  findManySerialized: vi.fn(),
}))

vi.mock('@/infra/db/content-db', async () => {
  const actual =
    await vi.importActual<typeof import('@/infra/db/content-db')>('@/infra/db/content-db')
  // Rebind collectionFactory's implementation so it returns a find() that
  // exposes the shared toArray mock — needed because vi.hoisted() ran before
  // findToArrayMock was given its mockImplementation.
  collectionFactory.mockImplementation((_name: string) => ({
    find: () => ({ toArray: findToArrayMock }),
  }))
  return {
    ...actual,
    getContentDb: vi.fn(async () => ({ collection: collectionFactory })),
  }
})

import { queryProductBySlug } from '@/server/repos/queries/products'

const PRODUCT_ID = '507f1f77bcf86cd799439011'
const COURSE_ID = '507f191e810c19729de860ea'
const FEATURE_ID = '507f191e810c19729de860eb'

describe('queryProductBySlug — populated contents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no product matches the slug', async () => {
    findOneSerializedMock.mockResolvedValueOnce(null)
    const result = await queryProductBySlug({ slug: 'nope' })
    expect(result).toBeNull()
    expect(collectionFactory).not.toHaveBeenCalled()
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
    expect(collectionFactory).not.toHaveBeenCalled()
  })

  it('populates the `course` relation on courseBlock entries', async () => {
    findOneSerializedMock.mockResolvedValueOnce({
      id: PRODUCT_ID,
      slug: 'with-course',
      title: 'With Course',
      contents: [
        // course is stored as a plain ObjectId-shaped string before populate
        { blockType: 'courseBlock', course: COURSE_ID },
      ],
    })
    findToArrayMock.mockImplementation(async () => {
      // First call: courses lookup (the only collection asked for in this test)
      return [{ _id: new ObjectId(COURSE_ID), title: '7th Grade Prep', slug: '7th-grade-prep' }]
    })

    const result = await queryProductBySlug({ slug: 'with-course' })

    const block = result?.contents?.[0]
    expect(block?.blockType).toBe('courseBlock')
    if (block?.blockType === 'courseBlock' && typeof block.course === 'object') {
      expect(block.course.title).toBe('7th Grade Prep')
      expect(block.course.slug).toBe('7th-grade-prep')
    } else {
      throw new Error('expected populated course')
    }
  })

  it('populates the `feature` relation on featureBlock entries, preserving limit + period', async () => {
    findOneSerializedMock.mockResolvedValueOnce({
      id: PRODUCT_ID,
      slug: 'with-feature',
      title: 'With Feature',
      contents: [
        {
          blockType: 'featureBlock',
          feature: FEATURE_ID,
          limit: 5,
          period: 'day',
        },
      ],
    })
    // Only featureBlock → no course lookup is dispatched at all, so the
    // features find().toArray() is the ONLY consumer of findToArrayMock.
    findToArrayMock.mockResolvedValueOnce([
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
      // Block-level values should be preserved untouched.
      expect(block.limit).toBe(5)
      expect(block.period).toBe('day')
    } else {
      throw new Error('expected populated feature')
    }
  })

  it('leaves the relation as a bare id string when no matching doc exists (graceful for stale refs)', async () => {
    findOneSerializedMock.mockResolvedValueOnce({
      id: PRODUCT_ID,
      slug: 'broken-ref',
      title: 'Broken Ref',
      contents: [{ blockType: 'courseBlock', course: COURSE_ID }],
    })
    findToArrayMock.mockImplementation(async () => []) // course collection returns nothing

    const result = await queryProductBySlug({ slug: 'broken-ref' })

    const block = result?.contents?.[0]
    if (block?.blockType !== 'courseBlock') throw new Error('wrong block type')
    expect(block.course).toBe(COURSE_ID)
  })
})
