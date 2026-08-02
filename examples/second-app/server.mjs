/**
 * "App 2" — the smallest possible second app that shares A-Guy-Web's login.
 *
 * No dependencies, no build. It exists to demonstrate the whole contract:
 * it never reads the cookie, it just forwards it to A-Guy-Web and asks who
 * the user is.
 *
 *   node server.mjs
 *   open http://app2.lvh.me:3001
 */

import { createServer } from 'node:http'

const PORT = 3001
const AGUY = process.env.AGUY_URL ?? 'http://app.lvh.me:3000'
const SELF = `http://app2.lvh.me:${PORT}`

/**
 * Ask A-Guy-Web who the user is, by passing along the cookie the browser
 * already sent us. This is the entire integration.
 */
async function whoIs(request) {
  try {
    const response = await fetch(`${AGUY}/api/users/me`, {
      headers: { cookie: request.headers.cookie ?? '' },
    })

    if (response.status === 401) return { user: null }
    if (!response.ok) return { error: `A-Guy-Web answered ${response.status}` }

    return await response.json()
  } catch (error) {
    return { error: `Could not reach ${AGUY} — is it running? (${error.message})` }
  }
}

const loginUrl = `${AGUY}/login?returnTo=${encodeURIComponent(SELF)}`

function page(body) {
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>App 2 — shared login demo</title>
<style>
  :root { color-scheme: light dark; }
  body {
    font: 16px/1.6 system-ui, sans-serif;
    max-width: 34rem; margin: 12vh auto; padding: 0 1.5rem;
  }
  h1 { font-size: 1.4rem; margin-bottom: .25rem; }
  .sub { opacity: .6; font-size: .9rem; margin-top: 0; }
  .card { border: 1px solid color-mix(in oklab, currentColor 20%, transparent);
          border-radius: .75rem; padding: 1.25rem; margin: 1.5rem 0; }
  .in  { border-color: seagreen; }
  .out { border-color: darkorange; }
  .err { border-color: crimson; }
  code { background: color-mix(in oklab, currentColor 10%, transparent);
         padding: .1rem .35rem; border-radius: .25rem; font-size: .85em; }
  a.btn { display: inline-block; margin-top: .75rem; padding: .5rem 1rem;
          border-radius: .5rem; background: royalblue; color: white;
          text-decoration: none; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: .25rem 1rem; margin: .5rem 0 0; }
  dt { opacity: .6; }
</style>
<h1>App 2</h1>
<p class="sub">A separate app on <code>app2.lvh.me:3001</code>. It has no login of its own.</p>
${body}
<p class="sub">This page asks <code>${AGUY}/api/users/me</code>, forwarding your cookie. It never reads or verifies the cookie itself.</p>
`
}

function render(result) {
  if (result.error) {
    return page(
      `<div class="card err"><strong>Something went wrong</strong><p>${result.error}</p></div>`,
    )
  }

  if (!result.user) {
    return page(`<div class="card out">
      <strong>You are not signed in.</strong>
      <p>Sign in on A-Guy-Web and this page will know about it — no second login.</p>
      <a class="btn" href="${loginUrl}">Sign in on A-Guy-Web</a>
    </div>`)
  }

  const { id, email, name, role } = result.user
  return page(`<div class="card in">
    <strong>Signed in — and App 2 never asked you to log in.</strong>
    <dl>
      <dt>Name</dt><dd>${name ?? '—'}</dd>
      <dt>Email</dt><dd>${email ?? '—'}</dd>
      <dt>Role</dt><dd>${role ?? '—'}</dd>
      <dt>User id</dt><dd><code>${id}</code></dd>
    </dl>
    <a class="btn" href="/logout">Log out everywhere</a>
  </div>`)
}

const server = createServer(async (request, response) => {
  if (request.url === '/favicon.ico') {
    response.writeHead(204).end()
    return
  }

  // Logging out is A-Guy-Web's job too — we just forward the cookie.
  if (request.url === '/logout') {
    const result = await fetch(`${AGUY}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie: request.headers.cookie ?? '' },
    }).catch(() => null)

    const clear = result?.headers.getSetCookie?.() ?? []
    response.writeHead(302, { Location: '/', 'Set-Cookie': clear })
    response.end()
    return
  }

  const result = await whoIs(request)
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  response.end(render(result))
})

server.listen(PORT, () => {
  console.log(`App 2 running at ${SELF}`)
  console.log(`Asking ${AGUY} who you are.`)
})
