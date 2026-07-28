# Shared Login Across Apps (Subdomain SSO)

**Goal:** run several web apps (`app2.a-guy.co.il`, `labs.a-guy.co.il`, …) where logging into one logs you into all of them.

**Approach:** one login cookie scoped to the parent domain, one user database, one JWT secret. No new auth server, no OAuth dance between apps.

**Hard requirement:** every app must live on a subdomain of the same registrable domain. Cookies cannot be shared across `a-guy.co.il` and `something-else.com` — see "If apps must live on different domains" at the end.

Building the second app? Hand its author [SHARED-LOGIN-APP-GUIDE.md](./SHARED-LOGIN-APP-GUIDE.md) — this page is the platform side.

---

## Status

Implemented in A-Guy-Web and **off by default**. With `ROOT_DOMAIN` unset, every cookie stays host-only and behaviour is identical to before. Setting it is what turns SSO on.

---

## How it works

- Login cookie: `payload-token` — [web-auth.ts](../../src/infra/auth/web-auth.ts)
- It holds a JWT (HS256) signed with a key derived from `PAYLOAD_SECRET`
- Verifying a request = verify the JWT **and** confirm the session id (`sid`) is still present and unexpired in the user's `sessions` array in Mongo

A second app authenticates a user by (a) receiving the cookie — automatic once the domain is shared — and (b) asking A-Guy-Web to verify it.

---

## Enabling it

```bash
ROOT_DOMAIN=a-guy.co.il           # the only switch; already used by the locale cookie
API_ALLOWED_ORIGINS=...           # only for browser-side callers in dev
AUTH_ALLOWED_RETURN_ORIGINS=...   # only for non-HTTPS dev siblings
```

Shared login deliberately adds **no setting of its own** — `ROOT_DOMAIN` already existed for the locale cookie, so turning SSO on is one variable, not a new concept.

Siblings of `ROOT_DOMAIN` are trusted automatically for both CORS and post-login redirects, so a new subdomain needs no config — it can read the cookie regardless, so listing it would grant nothing extra.

Ignored (deliberately) for `*.vercel.app`, `*.fly.dev`, `*.netlify.app`, `*.pages.dev` — those apexes are shared with strangers and browsers reject `Domain=` cookies on them. Also ignored for single-label hosts, since Chromium rejects `Domain=.localhost`.

**Local development:** use `lvh.me`, which resolves to `127.0.0.1`:

```bash
ROOT_DOMAIN=lvh.me
API_ALLOWED_ORIGINS=http://app2.lvh.me:3001
AUTH_ALLOWED_RETURN_ORIGINS=http://app2.lvh.me:3001
```

Then browse `app.lvh.me:3000` and `app2.lvh.me:3001`. The two `*_ALLOWED_*` vars are needed because the automatic sibling rule requires HTTPS.

---

## What changed

### Cookie domain

`resolveAuthCookieDomain()` in [oauth_constants.ts](../../src/infra/auth/oauth_constants.ts) is the single source of truth; every writer and both clear paths use it.

### The `Partitioned` trap

Password login and signup previously wrote `SameSite=None` + `Partitioned` in production. `Partitioned` (CHIPS) keys a cookie to the *embedding top-level site*, so such a cookie **can never be shared across subdomains**, `Domain` attribute or not — it would have silently defeated the whole design.

That flag exists for the Kody preview iframe, so it could not simply be deleted. Instead:

- login and signup now pass the request headers to `setAuthCookie`, so flags are chosen per request
- `isEmbeddedOAuthContext()` additionally treats a cross-site `fetch` as embedded — that is what a server action posted from inside the preview iframe looks like — while still treating a cross-site *top-level navigation* as non-embedded, which keeps the Google OAuth redirect on `SameSite=Lax` (issue #783)
- `Domain` is attached only to the non-embedded variant

Net effect: normal logins are shareable; preview-iframe sessions stay app-local by design.

### Logout

Two bugs, both harmless with one app and not with several:

1. A `Set-Cookie` without `Domain` cannot delete a cookie that has one, so logout would have left the shared cookie intact. Both clear paths now emit the domain-scoped variant.
2. Logout only cleared the cookie; the session stayed valid in the database, so a copied token kept working. `revokeSession()` now `$pull`s the `sid`.

### `returnTo`

`sanitizeReturnTo()` rejected every absolute URL. It now accepts HTTPS siblings of the cookie domain, plus explicitly listed origins, and still rejects everything else — including lookalikes such as `not-a-guy.co.il`.

### CORS

`middleware.ts` answers `/api/*` requests from allowed origins with `Access-Control-Allow-Origin` (echoing the exact origin — `*` is invalid with credentials) plus `Allow-Credentials`, and handles the preflight. Server-to-server callers need none of this.

---

## Security notes

- **Any subdomain can read the cookie.** Never host untrusted or user-controlled content on a subdomain of `a-guy.co.il`. One XSS anywhere on the domain compromises every account.
- Keep `HttpOnly` and `Secure`. `SameSite=Lax` survives top-level navigation between apps, which is all that is needed.
- State-changing endpoints must be POST/PUT/DELETE, since `Lax` sends the cookie on cross-site top-level GETs.
- Prefer having sibling apps call `/api/users/me` over handing them `PAYLOAD_SECRET` and database credentials.
- Shared login is authentication, not authorization — each app still enforces its own rules.

---

## If apps must live on different domains

Cookies cannot cross registrable domains. You would make A-Guy-Web a small identity provider: the app redirects to `/authorize`, A-Guy-Web (already holding the user's cookie) redirects back with a one-time code, the app exchanges it server-side for its own session cookie on its own domain. That is standard OIDC and meaningfully more work — prefer subdomains unless a separate domain is a business requirement.
