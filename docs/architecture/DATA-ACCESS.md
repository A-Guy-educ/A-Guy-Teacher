# Data Access

**One rule: API routes never touch the database. Queries live in the service layer under `src/server/`.**

A route's job is to translate HTTP into a call and the result back into a response — read the request, check who is asking, call one function, return JSON. Everything else belongs below it.

This is enforced by the `aguy/no-db-in-routes` lint rule, not left to memory.

The rule bans the imports that open a connection — `getContentDb`, and `MongoClient` / `Db` / `Collection` — not the modules they live in. Pure helpers from the same files (`relationId`, `serializeDoc`, `objectIdFromString`, `ObjectId`) stay available: shaping a value you were handed is not a query, and banning them would only push people into re-implementing them locally.

---

## Why it is enforced

The codebase used to do it both ways: about a third of routes called a service, another third queried MongoDB inline. That is the expensive kind of inconsistency — you cannot trust a pattern, so every file has to be opened to find out which kind it is, and every new route copies whichever neighbour it happened to look at.

A rule is only useful if it is actually true everywhere, so it is checked rather than documented.

The secondary benefit: if a separate API service is ever justified, it becomes a move rather than a rewrite. That is a side effect, not the reason.

---

## What this looks like

```ts
// ❌ The query lives in the route
import { getContentDb } from '@/infra/db/content-db'

export async function GET(request: NextRequest) {
  const { user } = await requireUser(request)
  const db = await getContentDb()
  const settings = await db.collection('user_settings').findOne({ userId: user.id })
  return NextResponse.json(settings ?? {})
}
```

```ts
// ✅ The route asks; the service knows how
import { getUserSettings } from '@/server/services/user-settings'

export async function GET(request: NextRequest) {
  const { user } = await requireUser(request)
  return NextResponse.json(await getUserSettings(user.id))
}
```

The service function takes plain arguments and returns plain data. It does not receive a `NextRequest`, does not set status codes, and does not know HTTP exists — which is what makes it testable without a server and reusable from a server action, a script, or a cron job.

---

## No exceptions

The rule shipped with a list of twenty grandfathered routes. All twenty have been migrated, the list is gone, and the rule now applies everywhere without qualification.

**Do not reintroduce it.** If a route seems to need its own query, the query needs a home in `src/server/`.

---

## Adding or changing a route

1. **Pin the current behaviour first** if you are moving existing code. Write a test that calls the route and asserts its response, before changing anything.
2. **Move the query, unchanged.** Copy it into a function under `src/server/`, taking plain arguments. Do not "improve" it in the same step; a behaviour change hidden inside a move is how this kind of work breaks things.
3. **Call it from the route.** The route keeps its auth check, status codes and error shape exactly as they were.
4. **Re-run the test.** It must pass without being edited. If the test needed changing, behaviour changed — that is a bug, not progress.

Step four is not ceremony. During the migration it caught a service that converted an identifier to text and back, which the database had not asked for, and it caught a completed exercise being scored on the wrong field.

`tests/unit/api/helpers/fake-content-db.ts` is an in-memory stand-in for the database that makes these tests cheap to write. It supports only the operators the routes actually use, deliberately.

---

## For coding agents

- Never add an exceptions list back to the rule. If it fires, move the query — that is the fix.
- Never import `getContentDb` from anywhere under `src/app/api/`. Pure helpers from the same module are fine.
- New service functions take plain arguments and return plain data. They do not receive a `NextRequest`, do not set status codes, and do not know HTTP exists.
