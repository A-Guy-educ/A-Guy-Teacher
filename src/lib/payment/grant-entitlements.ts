import { Document, ObjectId } from 'mongodb'

import { getContentDb, relationId } from '@/infra/db/content-db'
import { logger } from '@/infra/utils/logger/logger'

interface ProductItemsCollection {
  type?: 'lesson' | 'feature' | string
  lesson?: ObjectId | string | { id?: string; _id?: unknown }
  featureKey?: string | null
}

interface ResolvedProductItem {
  type: 'lesson' | 'feature'
  lessonId?: string
  featureKey?: string
}

/**
 * Resolve the product's legacy `items` join into concrete lesson IDs and feature
 * keys. Walks the `product-items` collection so feature keys come back as
 * strings (not ObjectIds) and lesson refs come back as canonical string IDs —
 * same shape used by `resolveProductItems` in the checkout route, kept local
 * here to avoid pulling in HTTP-only deps into webhook handlers.
 */
async function resolveProductItems(itemRefs: unknown[]): Promise<ResolvedProductItem[]> {
  const ids = itemRefs.map(relationId).filter((id): id is string => Boolean(id))
  if (!ids.length) return []

  const db = await getContentDb()
  const docs = (await db
    .collection('product-items')
    .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } })
    .toArray()) as ProductItemsCollection[]

  const resolved: ResolvedProductItem[] = []
  for (const doc of docs) {
    if (doc.type === 'lesson') {
      const lessonId = relationId(doc.lesson)
      if (lessonId) resolved.push({ type: 'lesson', lessonId })
    } else if (doc.type === 'feature') {
      const featureKey =
        typeof doc.featureKey === 'string' && doc.featureKey.length > 0 ? doc.featureKey : null
      if (featureKey) resolved.push({ type: 'feature', featureKey })
    }
  }
  return resolved
}

/**
 * Grants course + feature entitlements to a user after a successful payment.
 *
 * Resolves the product's `items` (legacy `product-items` join) and pushes:
 *   - one `courseEntitlements` row per lesson item (grantMethod='payment')
 *   - one `featureEntitlements` row per feature item
 *
 * Idempotent: each entitlement is keyed by its own identity (course for
 * lessons, key for features) inside the user's existing array. The handler
 * relies on this so a replayed webhook with the same transactionId does
 * not produce duplicate rows — the second pass would either push a second
 * entry for a different course, or no-op via Mongo's `$ne` guard.
 *
 * Throws when the product can't be found — callers (webhook handlers) treat
 * that as a transient error and return 500 so the provider retries.
 */
export async function grantProductEntitlements(
  userId: string,
  productId: string,
  transactionId: string,
): Promise<void> {
  if (!userId || !productId || !transactionId) {
    throw new Error('grantProductEntitlements: missing userId/productId/transactionId')
  }

  const db = await getContentDb()
  const productObjectId = ObjectId.isValid(productId) ? new ObjectId(productId) : null
  if (!productObjectId) {
    throw new Error(`grantProductEntitlements: invalid productId ${productId}`)
  }

  const product = (await db.collection('products').findOne({ _id: productObjectId })) as {
    _id: ObjectId
    items?: unknown[] | null
  } | null

  if (!product) {
    throw new Error(`grantProductEntitlements: product ${productId} not found`)
  }

  const items = await resolveProductItems(Array.isArray(product.items) ? product.items : [])

  if (items.length === 0) {
    logger.warn(
      { userId, productId, transactionId },
      'grantProductEntitlements: product has no resolvable items — nothing to grant',
    )
    return
  }

  const userObjectId = ObjectId.isValid(userId) ? new ObjectId(userId) : null
  if (!userObjectId) {
    throw new Error(`grantProductEntitlements: invalid userId ${userId}`)
  }
  const usersCollection = db.collection('users')
  const coursePushes: Record<string, unknown>[] = []
  const featurePushes: Record<string, unknown>[] = []
  const now = new Date()

  for (const item of items) {
    if (item.type === 'lesson' && item.lessonId) {
      coursePushes.push({
        course: ObjectId.isValid(item.lessonId) ? new ObjectId(item.lessonId) : item.lessonId,
        grantMethod: 'payment',
        transactionId,
        grantedAt: now,
      })
    } else if (item.type === 'feature' && item.featureKey) {
      featurePushes.push({
        key: item.featureKey,
        transactionId,
        grantedAt: now,
      })
    }
  }

  // Guard the push with a $ne filter so a concurrent replay (same user +
  // transaction) cannot append the same entitlement twice. The filter matches
  // when the array does NOT already contain a row with this transactionId —
  // the first call passes, every replay short-circuits with modifiedCount: 0.
  const baseUserFilter = { _id: userObjectId }

  if (coursePushes.length > 0) {
    for (const entry of coursePushes) {
      const result = await usersCollection.updateOne(
        {
          ...baseUserFilter,
          courseEntitlements: {
            $not: {
              $elemMatch: { transactionId: entry.transactionId, course: entry.course },
            },
          },
        },
        { $push: { courseEntitlements: entry } } as Document,
      )
      if (result.matchedCount === 0) {
        logger.warn(
          { userId, course: relationId(entry.course), transactionId },
          'grantProductEntitlements: user not found or course entitlement already present',
        )
      }
    }
  }

  if (featurePushes.length > 0) {
    for (const entry of featurePushes) {
      const result = await usersCollection.updateOne(
        {
          ...baseUserFilter,
          featureEntitlements: {
            $not: {
              $elemMatch: { transactionId: entry.transactionId, key: entry.key },
            },
          },
        },
        { $push: { featureEntitlements: entry } } as Document,
      )
      if (result.matchedCount === 0) {
        logger.warn(
          { userId, key: entry.key, transactionId },
          'grantProductEntitlements: user not found or feature entitlement already present',
        )
      }
    }
  }

  logger.info(
    {
      userId,
      productId,
      transactionId,
      courses: coursePushes.map((entry) => relationId(entry.course)),
      features: featurePushes.map((entry) => entry.key),
    },
    'grantProductEntitlements: successfully granted entitlements',
  )
}
