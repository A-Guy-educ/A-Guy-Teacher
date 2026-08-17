import { ObjectId } from 'mongodb'

import { getContentDb, relationId } from '@/infra/db/content-db'
import { logger } from '@/infra/utils/logger/logger'

interface CourseBlock {
  blockType: 'courseBlock'
  course: unknown
}

type ProductContentBlock = CourseBlock | { blockType: string; [key: string]: unknown }

interface ProductDoc {
  _id: ObjectId
  tenant?: ObjectId | string | null
  contents?: ProductContentBlock[] | null
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  )
}

async function upsertEntitlement(
  collection: ReturnType<Awaited<ReturnType<typeof getContentDb>>['collection']>,
  filter: Record<string, unknown>,
  document: Record<string, unknown>,
): Promise<void> {
  try {
    await collection.updateOne(filter, { $setOnInsert: document }, { upsert: true })
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error
  }
}

function toObjectIdOrValue(id: string): ObjectId | string {
  return ObjectId.isValid(id) ? new ObjectId(id) : id
}

/**
 * Grants every course entitlement bundled in `productId` to `userId`, tied to
 * `transactionId`. Idempotent: replays for the same (user, course) pair no-op
 * rather than double-insert, so PayPal webhook retries can't issue a duplicate
 * purchase record.
 *
 * Walks `product.contents` and handles `courseBlock` blocks. Each grant
 * materialises two rows:
 *   - `user-entitlements` (the access-grant record, audited by the receipt &
 *     access-check paths)
 *   - `enrollments` (the active enrollment that drives the lesson/course
 *     progress UI)
 *
 * Per the #689 spec, non-`courseBlock` blocks are skipped. Feature-only
 * products (e.g. certificate entitlements) will be added in a follow-up.
 *
 * @throws when the product document is missing — caller should treat this as
 *   a transient failure so PayPal retries (we don't want to "succeed" an
 *   enrollment tied to a phantom product).
 */
export async function grantProductEntitlements(
  userId: string,
  productId: string,
  transactionId: string,
): Promise<void> {
  if (!userId || !productId || !transactionId) {
    logger.warn(
      { userId: !!userId, productId: !!productId, transactionId: !!transactionId },
      'grantProductEntitlements: missing required identifier — skipping',
    )
    return
  }

  const db = await getContentDb()
  const productFilter = ObjectId.isValid(productId)
    ? { _id: new ObjectId(productId) }
    : { _id: productId as unknown as ObjectId }

  const product = (await db.collection('products').findOne(productFilter)) as ProductDoc | null
  if (!product) {
    // Surface to caller so the webhook returns 500 and PayPal retries — never
    // "succeed" silently, since that would leave the buyer without access AND
    // mark the payment as done.
    throw new Error(`grantProductEntitlements: product not found: ${productId}`)
  }

  const contents = product.contents
  if (!Array.isArray(contents) || contents.length === 0) {
    return
  }

  const userValue = toObjectIdOrValue(userId)
  const transactionValue = toObjectIdOrValue(transactionId)
  const tenantValue =
    product.tenant != null && ObjectId.isValid(String(product.tenant))
      ? new ObjectId(String(product.tenant))
      : (product.tenant ?? null)

  const now = new Date()

  for (const block of contents) {
    if (!block || block.blockType !== 'courseBlock') continue
    const courseId = relationId((block as CourseBlock).course)
    if (!courseId) continue

    const courseValue = toObjectIdOrValue(courseId)
    const userMatch = { $in: [userValue] }
    const courseMatch = { $in: [courseValue] }

    await upsertEntitlement(
      db.collection('user-entitlements'),
      { user: userMatch, course: courseMatch },
      {
        tenant: tenantValue,
        user: userValue,
        contentType: 'course',
        course: courseValue,
        grantMethod: 'purchase',
        transaction: transactionValue,
        createdAt: now,
        updatedAt: now,
      },
    )

    // For enrollments we can't fully use $setOnInsert because we want to
    // re-activate a previously cancelled enrollment on a fresh purchase. The
    // unique (user, course) index still guarantees at most one enrollment
    // document per (user, course) pair, so concurrent granters are safe.
    const enrollments = db.collection('enrollments')
    const existingEnrollment = await enrollments.findOne({
      user: userMatch,
      course: courseMatch,
    })

    if (existingEnrollment) {
      if (existingEnrollment.status === 'cancelled') {
        await enrollments.updateOne(
          { _id: existingEnrollment._id },
          {
            $set: {
              status: 'active',
              grantMethod: 'purchase',
              source: 'self',
              enrolledAt: now,
              cancelledAt: null,
              'metadata.transactionId': transactionId,
              updatedAt: now,
            },
            $unset: { cancelledAt: '' },
          },
        )
        logger.info(
          { userId, courseId, transactionId },
          'grantProductEntitlements: re-activated previously cancelled enrollment',
        )
      } else {
        logger.info(
          { userId, courseId, transactionId },
          'grantProductEntitlements: already entitled — skipping insert',
        )
      }
      continue
    }

    try {
      await enrollments.insertOne({
        tenant: tenantValue,
        user: userValue,
        course: courseValue,
        status: 'active',
        grantMethod: 'purchase',
        source: 'self',
        enrolledAt: now,
        metadata: { transactionId },
        createdAt: now,
        updatedAt: now,
      })
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error
      logger.info(
        { userId, courseId, transactionId },
        'grantProductEntitlements: enrollment already exists (concurrent grant) — skipping',
      )
      continue
    }

    logger.info(
      { userId, productId, courseId, transactionId },
      'grantProductEntitlements: course entitlement granted',
    )
  }
}
