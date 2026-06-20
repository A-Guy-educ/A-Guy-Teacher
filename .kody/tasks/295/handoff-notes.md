# PR #295 Fix Round — Handoff Notes

## What changed

**BLOCK fix** (`src/app/api/webhooks/paypal/route.ts`): `maybeSendReceipt` now throws when `sendPurchaseReceipt` returns `{ sent: false, reason: 'error' }` (Resend result-level error). Previously it returned normally, causing the webhook to return 200 to PayPal — PayPal would never retry and the email was permanently lost (though `emailSentAt` was correctly rolled back inside `sendPurchaseReceipt`). The throw causes the webhook handler to return 500, triggering PayPal's retry mechanism.

`missing_data` case: returns 200 (no retry needed — data is missing, not transient). `already_sent` and `no_adapter`: no-op acknowledge.

**Tests added** (`tests/unit/api/webhooks/paypal-route.spec.ts`):
- `handleCaptureCompleted` retry when `emailSentAt` is missing after prior rollback (mirrors existing `handleOrderApproved` retry test)
- `handleCaptureCompleted` returns 500 when `sendPurchaseReceipt` returns `{ sent: false, reason: 'error' }`

## Why the fix works

`sendPurchaseReceipt` already rolls back `emailSentAt` on Resend result-level errors (line 271). The gap was `maybeSendReceipt` silently acknowledging instead of throwing, so PayPal never retried. Throwing propagates to the webhook handler's catch block → 500 response → PayPal retries. On retry, `emailSentAt` is no longer set (rolled back), so `sendPurchaseReceipt` re-enters the send path successfully.

## Verification

`pnpm ci:local` passed (typecheck + lint + unit tests).
