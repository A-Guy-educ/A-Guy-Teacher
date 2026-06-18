CI typecheck failure on PR #282 — fixed and verified.

Root cause: TS2769 at lines 127 and 130 of purchase-receipt-service.ts. The ternary
`ObjectId.isValid(userId) ? new ObjectId(userId) : (userId as unknown as ObjectId)`
produces type `string | ObjectId` (TypeScript can't narrow through a ternary whose
branches aren't directly ObjectId literals). MongoDB's `Filter<Document>` expects
`Condition<ObjectId>` for `_id`, which doesn't accept `string | ObjectId`.

Fix: wrap each ternary in parentheses and add `as ObjectId`:
  _id: (ObjectId.isValid(userId) ? new ObjectId(userId) : userId) as ObjectId

Same pattern applied for both userId (line 174) and productId (line 182).

Also ran `pnpm install` to materialize the `resend` v6.12.4 lockfile entry.

Verify: `pnpm typecheck` now passes cleanly.
