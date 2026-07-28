# Integration Guide for New Apps

Hand this page to whoever builds a new app on `*.a-guy.co.il`. It is the whole contract.

> **Status:** the platform side is implemented. It stays dormant until `ROOT_DOMAIN` is set on the A-Guy-Web deployment — without it the cookie is host-only and nothing below works.

---

## The rules

1. Your app **must** be served from a subdomain of `a-guy.co.il`, over HTTPS.
2. You never create sessions, never hash passwords, never touch the users database.
3. You never read, copy, store, or forward the token anywhere except back to A-Guy-Web.

---

## The cookie

Name: `payload-token`. It is `HttpOnly`, so **your JavaScript cannot read it** — do not try. The browser attaches it to every request to any `a-guy.co.il` subdomain, including yours. You do not set it, refresh it, or delete it.

Your only job is to pass it along when you ask "who is this user?".

---

## Who is the user? (server-side — preferred)

Forward the incoming `Cookie` header to A-Guy-Web:

```ts
const res = await fetch('https://www.a-guy.co.il/api/users/me', {
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
const res = await fetch('https://www.a-guy.co.il/api/users/me', {
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
https://www.a-guy.co.il/login?returnTo=https://yourapp.a-guy.co.il/whatever
```

After they log in the cookie is set for the whole domain, and they come back already authenticated in your app.

Absolute return URLs are accepted for HTTPS siblings of the configured cookie domain — [oauth_sanitize.ts](../../src/infra/auth/oauth_sanitize.ts). Anything else falls back to `/`. For local HTTP dev, ask for your origin to be added to `AUTH_ALLOWED_RETURN_ORIGINS`.

Do not build your own login form, signup form, or Google button.

---

## Logging out

```ts
await fetch('https://www.a-guy.co.il/api/auth/logout', {
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

## Checklist before you ship

- [ ] App is on `*.a-guy.co.il` with HTTPS
- [ ] Your origin is on the CORS allowlist (if you call the API from the browser)
- [ ] Your return URL is on the `returnTo` allowlist
- [ ] Login in A-Guy-Web → refresh your app → you're already signed in
- [ ] Logout in your app → refresh A-Guy-Web → you're signed out there too
