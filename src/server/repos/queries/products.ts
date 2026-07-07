import { ObjectId } from 'mongodb'
import { cache } from 'react'

import { getContentDb, relationId, serializeDoc } from '@/infra/db/content-db'
import { logger } from '@/infra/utils/logger/logger'
import {
  isPopulatedCourseRef,
  isPopulatedFeatureRef,
  type Product,
  type ProductContentBlock,
  type ProductCourseRef,
  type ProductFeatureRef,
} from '@/infra/types/content'
import { findManySerialized, findOneSerialized } from '../mongo'

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    title: product.title || product.name || '',
  }
}

/**
 * Filter for "active" storefront products — drives the big featured-card
 * section on /products. A product is active when:
 *   - status === 'active' (new, post-#718 shape), OR
 *   - status is unset/null AND isActive !== false (backward-compat with
 *     pre-#718 data where only isActive existed)
 *
 * The { $in: [true, null] } trick matches both `true` and missing fields,
 * since Mongo treats missing as null for `equals`/`in` comparisons.
 */
const activeProductFilter = {
  isActive: { $ne: false },
  status: { $in: ['active', null] },
}

/**
 * Filter for "soon" / "free" / inactive products — drives the compact
 * disabled-button grid on /products. Catches status='soon', status='free',
 * AND any product flagged isActive=false regardless of status.
 */
const soonProductFilter = {
  $or: [{ status: { $in: ['soon', 'free'] } }, { isActive: false }],
}

export const queryActiveProducts = cache(async (): Promise<Product[]> => {
  const products = await findManySerialized<Product>('products', activeProductFilter, {
    sort: { createdAt: 1 },
    limit: 100,
  })
  return products.map(normalizeProduct)
})

export const querySoonProducts = cache(async (): Promise<Product[]> => {
  const products = await findManySerialized<Product>('products', soonProductFilter, {
    sort: { createdAt: 1 },
    limit: 100,
  })
  return products.map(normalizeProduct)
})

/**
 * Walks a product's `contents` blocks, collects all referenced course + feature
 * IDs, fetches them in two batched queries, then re-attaches the populated
 * docs onto each block. Equivalent of Payload's depth=2 join — needed because
 * web reads Mongo directly without the Payload runtime.
 */
async function populateContents(
  contents: ProductContentBlock[] | null | undefined,
): Promise<ProductContentBlock[] | null> {
  if (!contents || contents.length === 0) return contents ?? null

  // Collect bare ids only — if a block is already populated upstream, skip it
  // both here (so we don't dispatch a wasted Mongo query) and below (so we
  // don't overwrite a richer object with our narrow projection). The
  // "is populated" predicate is shared with the client renderer via
  // src/infra/types/content.ts so they can never disagree.
  const courseIds: ObjectId[] = []
  const featureIds: ObjectId[] = []
  for (const block of contents) {
    if (block.blockType === 'courseBlock' && !isPopulatedCourseRef(block.course)) {
      const id = relationId(block.course)
      if (id && ObjectId.isValid(id)) courseIds.push(new ObjectId(id))
    } else if (block.blockType === 'featureBlock' && !isPopulatedFeatureRef(block.feature)) {
      const id = relationId(block.feature)
      if (id && ObjectId.isValid(id)) featureIds.push(new ObjectId(id))
    }
  }

  if (courseIds.length === 0 && featureIds.length === 0) return contents

  const db = await getContentDb()
  const [courseDocs, featureDocs] = await Promise.all([
    courseIds.length
      ? db
          .collection('courses')
          .find({ _id: { $in: courseIds } }, { projection: { title: 1, slug: 1 } })
          .toArray()
      : Promise.resolve([] as unknown[]),
    featureIds.length
      ? db
          .collection('features')
          .find(
            { _id: { $in: featureIds } },
            { projection: { key: 1, label: 1, type: 1, isSilent: 1 } },
          )
          .toArray()
      : Promise.resolve([] as unknown[]),
  ])

  const courseById = new Map<string, ProductCourseRef>()
  for (const doc of courseDocs as Array<{ _id: unknown; title?: string; slug?: string }>) {
    const id = relationId(doc._id)
    if (id) courseById.set(id, serializeDoc<ProductCourseRef>(doc))
  }

  const featureById = new Map<string, ProductFeatureRef>()
  for (const doc of featureDocs as Array<{
    _id: unknown
    key?: string
    label?: string
    type?: string
    isSilent?: boolean
  }>) {
    const id = relationId(doc._id)
    if (id) featureById.set(id, serializeDoc<ProductFeatureRef>(doc))
  }

  return contents.map((block) => {
    if (block.blockType === 'courseBlock') {
      // Already populated upstream (e.g. a future hook or a depth>0 fetch)?
      // Keep it as-is — overwriting with our narrow projection would strip
      // any extra fields the caller put there.
      if (isPopulatedCourseRef(block.course)) return block
      const id = relationId(block.course)
      const populated = id ? courseById.get(id) : null
      return populated ? { ...block, course: populated } : block
    }
    if (block.blockType === 'featureBlock') {
      if (isPopulatedFeatureRef(block.feature)) return block
      const id = relationId(block.feature)
      const populated = id ? featureById.get(id) : null
      return populated ? { ...block, feature: populated } : block
    }
    return block
  })
}

export const queryProductBySlug = cache(
  async ({ slug }: { slug: string }): Promise<Product | null> => {
    const product = await findOneSerialized<Product>('products', { slug, isActive: true })
    if (!product) return null
    const populatedContents = await populateContents(product.contents)
    return normalizeProduct({ ...product, contents: populatedContents })
  },
)

export const queryAllProductSlugs = cache(async (): Promise<{ slug: string }[]> => {
  const products = await findManySerialized<Product>(
    'products',
    { isActive: true },
    { projection: { slug: 1 }, limit: 1000 },
  )
  return products
    .filter((product) => product.slug)
    .map((product) => ({ slug: product.slug as string }))
})

/**
 * Reverse-lookup: given a courseId, find the slug of the cheapest active product
 * whose `contents` array contains a `courseBlock` granting that course. Drives
 * the locked-lesson paywall CTA — instead of always routing to /products, we
 * route to /products/<slug> so the user lands on the right buy page.
 *
 * Returns null when:
 *   - the course has no matching active product (caller should fall back to /products)
 *   - the Mongo query throws (e.g. invalid ObjectId, network error)
 *   - the resolved product has no slug field
 *
 * Multi-product tiebreaker: when more than one active product unlocks the same
 * course (e.g. "7th grade" standalone + a "grades 7–9" bundle), the product
 * with the lowest `price` wins. This is an assumption pending finalization with
 * Shai — see PR description for #770.
 *
 * Cache key is `courseId` so the same course across a single render (lesson
 * list + chapter page + study content) shares one DB round-trip via React's
 * request-scoped `cache()`.
 */
export const queryPurchaseHrefForCourse = cache(
  async ({ courseId }: { courseId: string }): Promise<string | null> => {
    try {
      if (!courseId || !ObjectId.isValid(courseId)) return null

      const db = await getContentDb()
      const product = await db.collection('products').findOne(
        {
          ...activeProductFilter,
          contents: {
            $elemMatch: {
              blockType: 'courseBlock',
              // `block.course` can be stored as either ObjectId or plain string
              // depending on how the product was created — populateContents above
              // normalizes via relationId() for the same reason. Match both so a
              // string-stored ref isn't silently missed.
              course: { $in: [new ObjectId(courseId), courseId] },
            },
          },
        },
        {
          projection: { slug: 1, price: 1 },
          sort: { price: 1 },
        },
      )

      if (!product) return null
      const slug = (product as { slug?: unknown }).slug
      return typeof slug === 'string' && slug.length > 0 ? slug : null
    } catch (error) {
      // Lookup must never block the click — fall back to /products at the
      // caller. But surface the cause so Vercel logs show the real failure
      // (bad DB connection, schema drift, etc.) instead of a silent null.
      logger.error(
        { err: error, courseId },
        'queryPurchaseHrefForCourse: reverse-lookup failed, falling back to /products',
      )
      return null
    }
  },
)
