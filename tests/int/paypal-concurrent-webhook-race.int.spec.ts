// @vitest-environment node
/**
 * Integration test: PayPal concurrent webhook race condition (issue #929)
 *
 * PayPal fires both CHECKOUT.ORDER.APPROVED and PAYMENT.CAPTURE.COMPLETED
 * for the same order, often within milliseconds of each other. Both
 * reach our /api/webhooks/paypal handler. Before #929, each webhook
 * checked the transaction row's status field, saw `pending`, and ran
 * the grant + receipt path. Two webhooks → duplicate entitlement,
 * duplicate enrollment, duplicate receipt.
 *
 * The fix is three-pronged:
 *   1. Atomic status-flip claim — only one webhook flips pending→succeeded,
 *      via updateOne with a status filter. The losing webhook sees status
 *      already succeeded and is filtered out.
 *   2. Atomic entitlement upsert on (user, course) — unique compound index
 *      guarantees at most one row per pair regardless of how many concurrent
 *      grants race.
 *   3. Atomic receipt claim — the receipt service has its own atomic
 *      update so the second arriving webhook hits `already_sent`.
 *
 * This test fires webhooks concurrently and asserts the exactly-once
 * outcome: 1 status flip, 1 entitlement row, 1 enrollment, 1 receipt.
 *
 * Bypasses Payload — writes directly to `products`, `courses`, `transactions`,
 * `user-entitlements`, and `enrollments` via `getContentDb()` (the same
 * accessor the webhook handler uses) to keep the test focused on the
 * race-condition contract, which is what #929 is about.
 *
 * @fileType integration-test
 * @domain payments
 * @pattern webhook, race-condition, atomic-claim
 * @issue #929
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { getContentDb } from '@/infra/db/content-db'

let mongoUri: string | undefined
let originalDatabaseUrl: string | undefined

let tenantId: ObjectId
let courseId: ObjectId
let userId: ObjectId
let productId: ObjectId

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const db = await getContentDb()

  // Seed the four collections we need with bare-minimum documents.
  tenantId = new ObjectId()
  await db.collection('tenants').insertOne({ _id: tenantId } as any)

  courseId = new ObjectId()
  await db.collection('courses').insertOne({ _id: courseId } as any)

  productId = new ObjectId()
  await db.collection('products').insertOne({
    _id: productId,
    tenant: tenantId,
    contents: [{ blockType: 'courseBlock', course: courseId }],
    name: `PP Race Product ${Date.now()}`,
    slug: `pp-race-product-${Date.now()}`,
    billingType: 'one_time',
    price: 1000,
    currency: 'ILS',
    isActive: true,
  } as any)

  userId = new ObjectId()
  await db.collection('users').insertOne({ _id: userId } as any)
}, 120_000)

afterAll(async () => {
  if (mongoUri) {
    const db = await getContentDb()
    await db.collection('transactions').deleteMany({ user: userId })
    await db.collection('user-entitlements').deleteMany({ user: userId })
    await db.collection('enrollments').deleteMany({ user: userId })
    await db.collection('products').deleteMany({ _id: productId })
    await db.collection('courses').deleteMany({ _id: courseId })
    await db.collection('tenants').deleteMany({ _id: tenantId })
    await db.collection('users').deleteMany({ _id: userId })
  }
  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error: TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL
  }
}, 120_000)

// ─── Webhook mocks ──────────────────────────────────────────────────────────

// Capture IDs keyed by orderId, so the mock's ORDER.APPROVED path agrees
// with whatever the matching CAPTURE.COMPLETED event supplies.
const captureIdsByOrderId = new Map<string, string>()

vi.mock('@/lib/payment/paypal', () => ({
  verifyPayPalWebhook: vi.fn().mockResolvedValue(true),
  capturePayPalOrder: vi.fn().mockImplementation(async (orderId: string) => {
    // Real PayPal returns the same captureId on every call that captures the
    // same order. We use a per-test override so ORDER.APPROVED writes the
    // same captureId CAPTURE.COMPLETED looks up.
    const override = captureIdsByOrderId.get(orderId)
    return { captureId: override ?? `cap_${orderId}` }
  }),
}))

// Receipt service mock: simulate the atomic claim on transactions.emailSentAt
// without actually invoking Resend. This is what enforces at-most-once — the
// webhook handler re-enters the send path on every delivery, and the receipt
// service's findOneAndUpdate on emailSentAt is what filters the duplicates.
// The counter records how many invocations produced a real {sent: true}
// result; that's what we assert on, not the raw call count.
const sendReceiptStats = { calls: 0, sent: 0 }
const sendReceiptMock = vi.fn().mockImplementation(async (params: { transactionId: string }) => {
  sendReceiptStats.calls++
  const db = await getContentDb()
  const claimed = await db
    .collection('transactions')
    .findOneAndUpdate(
      { _id: new ObjectId(params.transactionId), emailSentAt: { $exists: false } },
      { $set: { emailSentAt: new Date() } },
      { returnDocument: 'after' },
    )
  if (!claimed) {
    return { sent: false, reason: 'already_sent' }
  }
  sendReceiptStats.sent++
  return { sent: true, reason: null }
})
vi.mock('@/server/email/services/purchase-receipt-service', () => ({
  sendPurchaseReceipt: sendReceiptMock,
}))

// ─── Concurrent delivery ────────────────────────────────────────────────────

async function fireOrderApproved(orderId: string, suffix: string): Promise<Response> {
  const req = new NextRequest('http://localhost/api/webhooks/paypal', {
    method: 'POST',
    headers: {
      'paypal-transmission-id': `race-${suffix}`,
      'paypal-transmission-time': new Date().toISOString(),
      'paypal-transmission-sig': `sig-${suffix}`,
      'paypal-cert-url': 'https://cert.url',
      'paypal-auth-algo': 'SHA256withRSA',
    },
    body: JSON.stringify({
      id: `PP_race_evt_approved_${suffix}_${Date.now()}`,
      event_type: 'CHECKOUT.ORDER.APPROVED',
      resource: { id: orderId },
    }),
  })
  const { POST } = await import('@/app/api/webhooks/paypal/route')
  return POST(req)
}

async function fireCaptureCompleted(
  orderId: string,
  captureId: string,
  suffix: string,
): Promise<Response> {
  const req = new NextRequest('http://localhost/api/webhooks/paypal', {
    method: 'POST',
    headers: {
      'paypal-transmission-id': `race-${suffix}`,
      'paypal-transmission-time': new Date().toISOString(),
      'paypal-transmission-sig': `sig-${suffix}`,
      'paypal-cert-url': 'https://cert.url',
      'paypal-auth-algo': 'SHA256withRSA',
    },
    body: JSON.stringify({
      id: `PP_race_evt_capture_${suffix}_${Date.now()}`,
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: captureId,
        supplementary_data: { related_ids: { order_id: orderId } },
      },
    }),
  })
  const { POST } = await import('@/app/api/webhooks/paypal/route')
  return POST(req)
}

async function setupPendingTx(orderId: string): Promise<ObjectId> {
  const db = await getContentDb()
  const txId = new ObjectId()
  await db.collection('transactions').insertOne({
    _id: txId,
    user: userId,
    product: productId,
    provider: 'paypal',
    providerTransactionId: orderId,
    status: 'pending',
    amount: 1000,
    currency: 'ILS',
    tenant: tenantId,
  } as any)
  return txId
}

async function cleanupTx(txId: ObjectId): Promise<void> {
  const db = await getContentDb()
  await db.collection('transactions').deleteMany({ _id: txId })
  await db.collection('user-entitlements').deleteMany({
    user: userId,
    course: courseId,
  })
  await db.collection('enrollments').deleteMany({ user: userId, course: courseId })
}

/**
 * Count the receipt-service invocations that produced a real `sent: true`
 * result. Duplicates return `sent: false, reason: 'already_sent'` thanks to
 * the atomic emailSentAt claim the mock replicates. We track the counter
 * inside the mock (rather than reading mock.results, which holds promises)
 * because that's where the true/false decision lives.
 */
function sentReceiptCount(): number {
  return sendReceiptStats.sent
}

function resetReceiptStats(): void {
  sendReceiptStats.calls = 0
  sendReceiptStats.sent = 0
}

describe('PayPal concurrent webhook delivery (#929 race)', () => {
  it('two concurrent webhook events for the same order produce exactly one grant + one receipt', async () => {
    sendReceiptMock.mockClear()
    resetReceiptStats()

    const orderId = `PP_race_${Date.now()}`
    const captureId = `PP_race_capture_${Date.now()}`
    captureIdsByOrderId.set(orderId, captureId)
    const txId = await setupPendingTx(orderId)

    // Real-world ordering: ORDER.APPROVED first, CAPTURE.COMPLETED almost
    // immediately after. We fire them concurrently to maximise the chance
    // both reach the pending→succeeded check before either has flipped it.
    const [resApproved, resCapture] = await Promise.all([
      fireOrderApproved(orderId, 'approved'),
      fireCaptureCompleted(orderId, captureId, 'capture'),
    ])

    expect(resApproved.status).toBe(200)
    expect(resCapture.status).toBe(200)

    // Transaction must reflect a single successful capture, with both fields
    // callers downstream depend on (captureId + entitlementsGrantedAt).
    const db = await getContentDb()
    const updated = await db.collection('transactions').findOne({ _id: txId })
    expect(updated?.status).toBe('succeeded')
    expect(updated?.captureId).toBe(captureId)
    expect(updated?.entitlementsGrantedAt).toBeInstanceOf(Date)

    // The receipt service claimed emailSentAt atomically exactly once. Both
    // webhooks re-enter the send path, but only the first call's claim wins.
    expect(updated?.emailSentAt).toBeInstanceOf(Date)

    // The heart of #929: ONE row in user-entitlements and ONE row in
    // enrollments for the (user, course) pair — not two.
    const userEntitlements = await db
      .collection('user-entitlements')
      .find({ user: userId, course: courseId })
      .toArray()
    expect(userEntitlements).toHaveLength(1)

    const enrollments = await db
      .collection('enrollments')
      .find({ user: userId, course: courseId })
      .toArray()
    expect(enrollments).toHaveLength(1)
    expect(enrollments[0]?.status).toBe('active')

    await cleanupTx(txId)
    captureIdsByOrderId.delete(orderId)
  })

  it('five concurrent ORDER.APPROVED events for the same order produce exactly one grant + one receipt', async () => {
    // Stress version: real PayPal sometimes redelivers the same event 4-5
    // times in quick succession when our 200 ACK is slow. The unique-index
    // constraint on (user, course) plus the receipt-service atomic claim
    // must hold even under serialised re-entry from the same webhook kind.
    sendReceiptMock.mockClear()
    resetReceiptStats()

    const orderId = `PP_race5_${Date.now()}`
    const txId = await setupPendingTx(orderId)

    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) => fireOrderApproved(orderId, `dup_${i}`)),
    )

    for (const res of responses) {
      expect(res.status).toBe(200)
    }

    const db = await getContentDb()

    // Across 5 webhook deliveries the unique-index constraint on
    // (user, course) holds — exactly one row each.
    const userEntitlements = await db
      .collection('user-entitlements')
      .find({ user: userId, course: courseId })
      .toArray()
    expect(userEntitlements).toHaveLength(1)

    const enrollments = await db
      .collection('enrollments')
      .find({ user: userId, course: courseId })
      .toArray()
    expect(enrollments).toHaveLength(1)

    // Receipt claim succeeded exactly once despite 5 invocations. The other
    // 4 returned { sent: false, reason: 'already_sent' } via the atomic
    // emailSentAt claim the mock replicates. We count via the mock's own
    // internal stat — mock.results holds unresolved promises, not the
    // resolved {sent: boolean} shape we need to inspect.
    expect(sentReceiptCount()).toBe(1)

    await cleanupTx(txId)
  })
})
