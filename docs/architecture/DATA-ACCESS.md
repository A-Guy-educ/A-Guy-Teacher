# Data Access

**One rule: API routes never touch the database. Queries live in the service layer under `src/server/`.**

A route's job is to translate HTTP into a call and the result back into a response — read the request, check who is asking, call one function, return JSON. Everything else belongs below it.

This is enforced by the `aguy/no-db-in-routes` lint rule, not left to memory.

---

## Why it is enforced

Today the codebase does it both ways: about a third of routes call a service, another third query MongoDB inline. That is the expensive kind of inconsistency — you cannot trust a pattern, so every file has to be opened to find out which kind it is, and every new route copies whichever neighbour it happened to look at.

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

## The rule ratchets

`eslint-plugin-aguy/rules/no-db-in-routes.mjs` holds a list of routes that predate it. They still lint clean; everything else fails immediately.

**The list may shrink. It must never grow.** Adding an entry to make a new route pass defeats the point — if a route seems to need its own query, the query needs a home in `src/server/`, not an exemption.

Removing an entry is the last step of migrating that route.

---

## Migrating a route safely

Roughly 116 query call sites across 20 routes. There is no deadline and no big-bang branch: migrate a route when you are already editing it.

Per route, in order:

1. **Pin the current behaviour first.** Write a test that calls the route and asserts its response, before changing anything. If it is hard to test as-is, that is the finding — note it and stop, rather than refactoring blind.
2. **Move the query, unchanged.** Copy it into a function under `src/server/`, taking plain arguments. Do not "improve" it in the same step; a behaviour change hidden inside a move is how this kind of work breaks things.
3. **Call it from the route.** The route keeps its auth check, status codes and error shape exactly as they were.
4. **Re-run the test.** It must pass without being edited. If the test needed changing, behaviour changed — that is a bug, not progress.
5. **Remove the route from the exceptions list**, so it can never regress.

Leave `payments/`, `webhooks/` and `entitlements/` until last. Money and access rights are where a silent behaviour change costs the most, and by then the pattern will be well worn.

---

## For coding agents

- Never add an entry to `KNOWN_EXCEPTIONS`. If the rule fires, move the query — that is the fix.
- Never import `@/infra/db/content-db` or `mongodb` from anywhere under `src/app/api/`.
- When editing a route that is on the exceptions list, migrating it is in scope and welcome. Follow the five steps above, including writing the test first.
