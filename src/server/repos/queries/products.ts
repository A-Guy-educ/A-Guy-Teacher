import { ObjectId } from 'mongodb'
import { cache } from 'react'

import { getContentDb, relationId, serializeDoc } from '@/infra/db/content-db'
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

export const queryActiveProducts = cache(async (): Promise<Product[]> => {
  const products = await findManySerialized<Product>(
    'products',
    { isActive: true },
    { sort: { createdAt: 1 }, limit: 100 },
  )
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
