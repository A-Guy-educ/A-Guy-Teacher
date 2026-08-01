# Integration Guide for New Apps

Hand this page to whoever builds a new app on `*.aguy.co.il` — link them straight to it:
<https://github.com/A-Guy-educ/A-Guy-Web/blob/dev/docs/architecture/SHARED-LOGIN-APP-GUIDE.md>

It is the whole contract.

> **Status: live.** The platform side shipped and `ROOT_DOMAIN` is set on production, so the shared cookie is already being issued on `aguy.co.il`. Everything below works today.
>
> Verified so far against a real database: the public reads, and that every protected endpoint refuses an anonymous caller. **Not yet verified end to end with a real second app** — you are the first, so treat the first login as the proof and say if it does not behave as written here.

---

## The rules

1. Your app **must** be served from a subdomain of `aguy.co.il`, over HTTPS.
2. You never create sessions, never hash passwords, never touch the users database.
3. You never read, copy, store, or forward the token anywhere except back to A-Guy-Web.

---

## The cookie

Name: `payload-token`. It is `HttpOnly`, so **your JavaScript cannot read it** — do not try. The browser attaches it to every request to any `aguy.co.il` subdomain, including yours. You do not set it, refresh it, or delete it.

Your only job is to pass it along when you ask "who is this user?".

---

## Who is the user? (server-side — preferred)

Forward the incoming `Cookie` header to A-Guy-Web:

```ts
const res = await fetch('https://www.aguy.co.il/api/users/me', {
  headers: { cookie: request.headers.get('cookie') ?? '' },
})

if (res.status === 401) {
  // not logged in -> send them to login (below)
}

const { user } = await res.json()
// user = { id, email, name, role, ... }
```

No CORS involved — this is server to server. Do this once per request and pass the result down; don't call it in a loop.

## Who is the user? (from the browser)

```ts
const res = await fetch('https://www.aguy.co.il/api/users/me', {
  credentials: 'include', // ← without this the cookie is not sent
})
```

Your app's origin must be on A-Guy-Web's CORS allowlist. Ask for it to be added; it is one config entry, not new code.

---

## Calling other A-Guy-Web APIs

Exactly the same. Every existing endpoint (`/api/courses`, `/api/progress`, …) already reads that cookie and resolves the user itself. There is nothing to build on either side:

- server-side: forward the `cookie` header
- browser: `credentials: 'include'`

If an endpoint you need doesn't exist yet, that's a normal feature request against A-Guy-Web — not an auth problem.

---

## Sending the user to log in

```
https://www.aguy.co.il/login?returnTo=https://yourapp.aguy.co.il/whatever
```

After they log in the cookie is set for the whole domain, and they come back already authenticated in your app.

Absolute return URLs are accepted for HTTPS siblings of the configured cookie domain — [oauth_sanitize.ts](../../src/infra/auth/oauth_sanitize.ts). Anything else falls back to `/`. For local HTTP dev, ask for your origin to be added to `AUTH_ALLOWED_RETURN_ORIGINS`.

Do not build your own login form, signup form, or Google button.

---

## Logging out

```ts
await fetch('https://www.aguy.co.il/api/auth/logout', {
  method: 'POST',
  credentials: 'include',
})
```

This logs the user out of **every** app, which is the intended behaviour. Don't offer a "log out of just this app" option — there is no such thing.

---

## Handling 401

A 401 from any A-Guy-Web endpoint means the session is gone or expired. Clear whatever local state you hold and redirect to the login URL above. Never retry, and never fall back to an anonymous-but-still-rendered logged-in view.

---

## What you must not do

| Don't | Why |
|---|---|
| Ask for `PAYLOAD_SECRET` or the Mongo URL | Then a bug in your app leaks every account |
| Verify the JWT yourself | You'd miss revoked sessions; the DB check is the real gate |
| Store the token in localStorage, a log, an analytics event, or a URL | It is a full session credential |
| Host user-uploaded HTML/JS on your subdomain | One XSS there compromises every account on the domain |
| Trust `role` for permissions without checking | Shared login is authentication, not authorization — enforce your own rules |

---

## Running it locally

Both apps must sit on one parent domain, and `localhost` cannot be one — `localhost:3000` and `localhost:3001` are the same host, and browsers reject a shared-domain cookie on it outright.

Use `lvh.me`, a public domain that resolves to `127.0.0.1`, so no host file editing is needed. A-Guy-Web runs at `http://app.lvh.me:3000`; run yours at `http://app2.lvh.me:3001`. Ask for your origin to be added to `AUTH_ALLOWED_RETURN_ORIGINS` and `API_ALLOWED_ORIGINS`, which exist because the automatic sibling rule requires HTTPS.

Set the same two on A-Guy-Web's local `.env`, alongside `ROOT_DOMAIN=lvh.me`. Browse A-Guy-Web at `app.lvh.me:3000`, not `localhost:3000` — a login on `localhost` is not part of the shared domain and will not carry over.

You cannot test against production from your machine: the real cookie only travels to `aguy.co.il` addresses.

---

## A working example

`examples/second-app/` in this repository is the whole contract as ~150 lines of dependency-free Node: it never reads the cookie, forwards it to `/api/users/me`, and shows who the user is.

```bash
node examples/second-app/server.mjs
# then open http://app2.lvh.me:3001
```

Copy it, or just read it — it is short enough to read in full.

---

## Checklist before you ship

- [ ] App is on `*.aguy.co.il` with HTTPS
- [ ] Your origin is on the CORS allowlist (if you call the API from the browser)
- [ ] Your return URL is on the `returnTo` allowlist
- [ ] Login in A-Guy-Web → refresh your app → you're already signed in
- [ ] Logout in your app → refresh A-Guy-Web → you're signed out there too
