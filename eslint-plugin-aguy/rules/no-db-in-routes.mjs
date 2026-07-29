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
 * The rule shipped with an exceptions list for the twenty routes that predated
 * it. Every one has since been migrated, so the list is gone and the rule now
 * holds everywhere without qualification. Do not reintroduce it.
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
 * The imports that mean "I am about to query the database", by module.
 *
 * Named rather than whole modules on purpose. `content-db` also exports pure
 * helpers — `relationId`, `serializeDoc`, `objectIdFromString` — and `mongodb`
 * exports `ObjectId`. None of those touch a connection, and a route is welcome
 * to shape a value it was handed. Banning the whole module would only push
 * people into re-implementing those helpers locally, which is worse.
 */
const DATABASE_IMPORTS = [
  { module: /(^|\/)infra\/db\/content-db$/, names: ['getContentDb'] },
  { module: /^mongodb$/, names: ['MongoClient', 'Db', 'Collection'] },
]

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
        'API routes must not query the database directly (imported "{{name}}" from "{{source}}"). Move the query into a function under src/server/ and call that instead — see docs/architecture/DATA-ACCESS.md.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename ?? context.getFilename()
    if (routePathOf(filename) === undefined) return {}

    return {
      ImportDeclaration(node) {
        const source = node.source.value
        if (typeof source !== 'string') return

        const banned = DATABASE_IMPORTS.find((entry) => entry.module.test(source))
        if (!banned) return

        for (const specifier of node.specifiers) {
          const name = specifier.imported?.name ?? specifier.local?.name
          if (specifier.type === 'ImportSpecifier' && !banned.names.includes(name)) continue

          context.report({ node: specifier, messageId: 'databaseInRoute', data: { source, name } })
        }
      },
    }
  },
}

export default rule
