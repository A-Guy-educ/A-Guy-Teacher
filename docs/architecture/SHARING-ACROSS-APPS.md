# What We Share Across Apps

We are moving from one web app to several on `*.aguy.co.il`. This records what is shared between them and what is deliberately copied, so the answer does not get re-litigated per app.

**Rule of thumb: share what users can see is inconsistent, and what is dangerous to get wrong. Copy everything else.**

---

## Share

### The design system

Colours, spacing, typography, and the component library — currently [tailwind.tokens.mjs](https://github.com/A-Guy-educ/A-Guy-Web/blob/dev/tailwind.tokens.mjs), [globals.css](https://github.com/A-Guy-educ/A-Guy-Web/blob/dev/src/app/%28frontend%29/globals.css), and [src/ui/web/components/](https://github.com/A-Guy-educ/A-Guy-Web/tree/dev/src/ui/web/components).

Why this one: it is roughly 850 lines of tokens plus ~48 components, so re-implementing it per app is real duplicated work — and unlike most duplication, the drift is visible to users the moment they cross between two of our apps.

### The auth client

About thirty lines: who is this user, where do I send them to log in, how do I log them out. See [SHARED-LOGIN-APP-GUIDE.md](https://github.com/A-Guy-educ/A-Guy-Web/blob/dev/docs/architecture/SHARED-LOGIN-APP-GUIDE.md).

Why this one: it is the only shared surface where a mistake is a security bug rather than a cosmetic one. One correct copy beats four hand-rolled ones.

---

## Never share

| Not shared | Because |
|---|---|
| `PAYLOAD_SECRET` | A bug in any app that holds it leaks every account |
| Database credentials | Same, plus it couples every app to our schema |
| The shared-login policy code | It reads server-only configuration; see [the client boundary](https://github.com/A-Guy-educ/A-Guy-Web/blob/dev/docs/architecture/SHARED-LOGIN-SUBDOMAINS.md) |
| Business logic, routes, data models | Each app owns its own domain; coupling them is how you get a distributed monolith |

Sibling apps ask `/api/users/me` who the user is. They do not verify tokens themselves.

---

## Copy, don't share

Architecture — folder layout, naming, error handling, testing conventions — travels as a **starter template and these docs**, not as a dependency.

A shared `core` package that every app imports sounds tidy and becomes a bottleneck: every change needs a coordinated release across every app, and the package accumulates whatever did not fit anywhere else. Conventions that diverge slightly are cheaper than that.

---

## When to build the package

Not yet. For the second app, copy the thirty lines of auth client and point at the design system by hand.

Extract a real package at the **third** app, when the duplication is proven rather than predicted. Extracting earlier means designing an API for consumers that do not exist.

---

## Related

- [SHARED-LOGIN-SUBDOMAINS.md](https://github.com/A-Guy-educ/A-Guy-Web/blob/dev/docs/architecture/SHARED-LOGIN-SUBDOMAINS.md) — how one login works across the apps (platform side)
- [SHARED-LOGIN-APP-GUIDE.md](https://github.com/A-Guy-educ/A-Guy-Web/blob/dev/docs/architecture/SHARED-LOGIN-APP-GUIDE.md) — hand this to whoever builds the next app
- [MULTI-BRAND.md](https://github.com/A-Guy-educ/A-Guy-Web/blob/dev/docs/architecture/MULTI-BRAND.md) — separate decision: one database per brand
