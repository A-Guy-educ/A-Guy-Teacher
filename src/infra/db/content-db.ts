import { MongoClient, ObjectId, type Db } from 'mongodb'

type JsonObject = Record<string, unknown>

declare global {
  var __aguyMongoClientPromise: Promise<MongoClient> | undefined
  var __aguyPaymentIndexesPromise: Promise<void> | undefined
}

function getConnectionString(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is required')
  }
  return url
}

/** Mongo `IndexOptionsConflict`: an equivalent index exists under another name. */
const INDEX_OPTIONS_CONFLICT = 85

/**
 * Create an index, tolerating the case where an equivalent one already exists
 * under a different name. Some collections were indexed before these names were
 * introduced (e.g. `enrollments.user_1_course_1`); Mongo rejects the duplicate
 * with code 85. The constraint is already enforced by the existing index, so
 * the conflict is benign — and it must not fail the request that triggered it.
 */
async function ensureIndex(
  db: Db,
  collection: string,
  keys: Record<string, 1 | -1>,
  name: string,
): Promise<void> {
  try {
    await db.collection(collection).createIndex(keys, { name, unique: true })
  } catch (error) {
    if ((error as { code?: number })?.code === INDEX_OPTIONS_CONFLICT) return
    throw error
  }
}

async function ensurePaymentIndexes(db: Db): Promise<void> {
  if (!globalThis.__aguyPaymentIndexesPromise) {
    globalThis.__aguyPaymentIndexesPromise = Promise.all([
      ensureIndex(
        db,
        'user-entitlements',
        { user: 1, course: 1 },
        'user_entitlements_user_course_unique',
      ),
      ensureIndex(db, 'enrollments', { user: 1, course: 1 }, 'enrollments_user_course_unique'),
    ]).then(() => undefined)
  }

  try {
    await globalThis.__aguyPaymentIndexesPromise
  } catch (error) {
    // Never cache a rejection: a transient failure here would otherwise break
    // every getContentDb() caller for the lifetime of the process.
    globalThis.__aguyPaymentIndexesPromise = undefined
    throw error
  }
}

export async function getContentDb(): Promise<Db> {
  if (!globalThis.__aguyMongoClientPromise) {
    globalThis.__aguyMongoClientPromise = new MongoClient(getConnectionString()).connect()
  }

  const client = await globalThis.__aguyMongoClientPromise
  const db = client.db()
  await ensurePaymentIndexes(db)
  return db
}

export function objectIdFromString(id: string): ObjectId | string {
  return ObjectId.isValid(id) ? new ObjectId(id) : id
}

export function relationId(value: unknown): string | null {
  if (!value) return null
  if (value instanceof ObjectId) return value.toString()
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null) {
    const record = value as { id?: unknown; _id?: unknown }
    return relationId(record.id ?? record._id)
  }
  return null
}

export function serializeDoc<T = JsonObject>(doc: unknown): T {
  if (doc instanceof ObjectId) return doc.toString() as T
  if (doc instanceof Date) return doc.toISOString() as T
  if (Array.isArray(doc)) return doc.map((item) => serializeDoc(item)) as T
  if (!doc || typeof doc !== 'object') return doc as T

  const output: JsonObject = {}
  for (const [key, value] of Object.entries(doc as Record<string, unknown>)) {
    output[key === '_id' ? 'id' : key] = serializeDoc(value)
  }
  return output as T
}
