/**
 * Transactions Service
 *
 * @fileType service
 * @domain payments
 * @pattern repository
 * @ai-summary Reads payment transaction records. Ownership is checked by the caller, which decides how to answer when it does not match.
 */

import { ObjectId, type Document } from 'mongodb'

import { getContentDb } from '@/infra/db/content-db'

/** One transaction by id, or `null`. */
export async function findTransactionById(id: string): Promise<Document | null> {
  const db = await getContentDb()
  return db.collection('transactions').findOne({ _id: new ObjectId(id) })
}
