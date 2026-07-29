/**
 * ESLint Rule: no-db-in-routes
 *
 * Keeps database access out of API route handlers. Routes translate HTTP to a
 * call and back; the query itself belongs in the service layer under
 * `src/server/`.
 *
 * Why this is enforced rather than merely documented: with two ways to reach
 * data, nobody can trust a pattern, so every file has to be read to find out
 * which kind it is. One rule — "data access lives in the service layer" — is
 * only useful if it is actually true everywhere.
 *
 * This rule ratchets. Files already doing it are listed in KNOWN_EXCEPTIONS and
 * are migrated over time; the list may shrink and must never grow. A new route
 * fails immediately.
 *
 * @example
 * // ❌ BAD — the query lives in the route
 * import { getContentDb } from '@/infra/db/content-db'
 * export async function GET() {
 *   const db = await getContentDb()
 *   const rows = await db.collection('users').find().toArray()
 * }
 *
 * // ✅ GOOD — the route asks, the service knows how
 * import { listUsers } from '@/server/services/users'
 * export async function GET() {
 *   return NextResponse.json(await listUsers())
 * }
 */

/**
 * Routes that predate this rule, as paths relative to `src/app/api/`.
 *
 * Shrink this list; never add to it. Removing an entry is the last step of
 * migrating that route. When it reaches zero, delete the list and this comment.
 */
const KNOWN_EXCEPTIONS = new Set([
  'account/transactions/[id]/route.ts',
  'admin/lessons/import-intro/route.ts',
  'agent/generate-interactive-lesson/route.ts',
  'blob/upload-token/route.ts',
  'chat-assets/finalize/route.ts',
  'conversations/by-context/route.ts',
  'diag/access-check/route.ts',
  'entitlements/check/route.ts',
  'entitlements/redeem/route.ts',
  'exercises/import/route.ts',
  'media/file/[filename]/route.ts',
  'media/route.ts',
  'payments/checkout/route.ts',
  'stats/dashboard/route.ts',
  'stats/heartbeat/route.ts',
  'stats/streak/route.ts',
  'stats/track-activity/route.ts',
  'teacher-profiles/route.ts',
  'user-settings/route.ts',
  'webhooks/paypal/route.ts',
])

/** Modules that mean "I am talking to the database directly". */
const DATABASE_MODULES = [/(^|\/)infra\/db\/content-db$/, /^mongodb$/]

const API_SEGMENT = '/src/app/api/'

function routePathOf(filename) {
  const index = filename.indexOf(API_SEGMENT)
  if (index === -1) return undefined
  return filename.slice(index + API_SEGMENT.length)
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep database access in the service layer, not in API routes',
      category: 'Architecture',
      recommended: true,
    },
    messages: {
      databaseInRoute:
        'API routes must not query the database directly (imported "{{source}}"). Move the query into a function under src/server/ and call that instead — see docs/architecture/DATA-ACCESS.md.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename ?? context.getFilename()
    const routePath = routePathOf(filename)

    if (routePath === undefined) return {}
    if (KNOWN_EXCEPTIONS.has(routePath)) return {}

    return {
      ImportDeclaration(node) {
        const source = node.source.value
        if (typeof source !== 'string') return
        if (!DATABASE_MODULES.some((pattern) => pattern.test(source))) return

        context.report({ node, messageId: 'databaseInRoute', data: { source } })
      },
    }
  },
}

export default rule
