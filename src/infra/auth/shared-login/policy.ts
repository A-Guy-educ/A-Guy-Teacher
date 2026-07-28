/**
 * Shared Login Policy — which other apps this deployment trusts
 *
 * @fileType model
 * @domain auth
 * @pattern shared-login
 * @ai-summary Pure value object and predicates describing the sibling apps that share this deployment's login. No environment access, no framework imports — safe to evaluate on the server, in edge middleware, and in the browser.
 */

/**
 * The trust boundary of a deployment, as a value.
 *
 * Passing this explicitly (rather than reading the environment where it is
 * needed) is what keeps the predicates below pure: they behave identically in
 * a Node route, in edge middleware, and in a unit test, and a client bundle
 * that receives an empty policy degrades safely instead of silently reading an
 * environment variable that does not exist in the browser.
 */
export type SharedLoginPolicy = {
  /** Cookie `Domain`, always dot-prefixed (`.a-guy.co.il`). Absent = host-only. */
  readonly cookieDomain?: string
  /** Extra origins accepted as post-login redirect targets. */
  readonly returnOrigins: readonly string[]
  /** Extra origins accepted as credentialed API callers. */
  readonly apiOrigins: readonly string[]
}

/** No sibling apps: cookies stay host-only and only relative redirects are allowed. */
export const SINGLE_APP_POLICY: SharedLoginPolicy = Object.freeze({
  returnOrigins: Object.freeze([]),
  apiOrigins: Object.freeze([]),
})

/**
 * Apexes shared between unrelated tenants. Browsers reject `Domain=` cookies
 * on Public Suffix List entries, and we would not want to hand a session to a
 * stranger's deployment even where they do not.
 */
const UNSHAREABLE_APEXES = ['vercel.app', 'fly.dev', 'netlify.app', 'pages.dev']

/**
 * Normalise a configured domain into a cookie `Domain` value.
 *
 * Returns `undefined` — meaning "keep the cookie host-only" — for anything a
 * browser would reject or that would over-share: single-label hosts such as
 * `localhost`, and the shared platform apexes above.
 */
export function toCookieDomain(rawDomain: string | undefined | null): string | undefined {
  const trimmed = rawDomain?.trim()
  if (!trimmed) return undefined

  const domain = trimmed.replace(/^\.+/, '').toLowerCase()
  if (!domain.includes('.')) return undefined
  if (UNSHAREABLE_APEXES.some((apex) => domain === apex || domain.endsWith(`.${apex}`))) {
    return undefined
  }

  return `.${domain}`
}

/**
 * True when `url` is served by an app that already receives our login cookie.
 *
 * Siblings are derived from the cookie domain rather than enumerated, so a new
 * subdomain inherits trust automatically — it can read the session cookie
 * regardless, so listing it would grant nothing extra. HTTPS is required
 * because the shared cookie is `Secure`.
 *
 * The leading dot in `cookieDomain` is load-bearing: it is what stops
 * `not-a-guy.co.il` from matching `a-guy.co.il`.
 */
export function isSiblingOrigin(url: URL, cookieDomain: string | undefined): boolean {
  if (!cookieDomain || url.protocol !== 'https:') return false

  const host = url.hostname.toLowerCase()
  return host === cookieDomain.slice(1) || host.endsWith(cookieDomain)
}

/**
 * True when `url` is either a sibling app or an explicitly listed origin.
 *
 * The explicit list exists for local development, where siblings speak plain
 * HTTP and so cannot satisfy `isSiblingOrigin`.
 */
export function isTrustedOrigin(
  url: URL,
  allowedOrigins: readonly string[],
  cookieDomain: string | undefined,
): boolean {
  if (allowedOrigins.includes(url.origin.toLowerCase())) return true
  return isSiblingOrigin(url, cookieDomain)
}

/** Parse `origin` into a URL, or `undefined` when it is absent or malformed. */
export function parseOrigin(origin: string | undefined | null): URL | undefined {
  if (!origin) return undefined
  try {
    return new URL(origin)
  } catch {
    return undefined
  }
}
