/**
 * Session + source resolution helpers for the external analytics pipeline.
 *
 * Source resolution order (per the integration spec):
 *   1. utm_source from the URL query (?utm_source=foo)
 *   2. document.referrer hostname — only when the referrer is on a known list
 *      (google, facebook, instagram, twitter, t.co, youtube, bing, reddit,
 *      whatsapp, telegram, linkedin, tiktok)
 *   3. Hard-coded "direct" when nothing above matched
 *
 * The very first resolved source is persisted to localStorage['aguy_src']
 * and reused on every subsequent page-load so a signup captures the original
 * acquisition channel even though the UTM params were parsed an hour ago.
 *
 * sessionId is a UUID stored in sessionStorage['aguy_sid'] so it is stable
 * within a tab and rotates per tab (sessionStorage semantics). New tabs and
 * new windows get a fresh ID.
 */

const SESSION_STORAGE_KEY = 'aguy_sid'
const SOURCE_STORAGE_KEY = 'aguy_src'

const KNOWN_REFERRER_HOSTNAMES = new Set([
  'google.com',
  'www.google.com',
  'facebook.com',
  'www.facebook.com',
  'instagram.com',
  'www.instagram.com',
  'twitter.com',
  'www.twitter.com',
  't.co',
  'youtube.com',
  'www.youtube.com',
  'bing.com',
  'www.bing.com',
  'reddit.com',
  'www.reddit.com',
  'whatsapp.com',
  'www.whatsapp.com',
  't.me',
  'telegram.org',
  'linkedin.com',
  'www.linkedin.com',
  'tiktok.com',
  'www.tiktok.com',
])

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // Fallback for environments where crypto.randomUUID is unavailable.
  // RFC4122 v4 compatible.
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex: string[] = []
  for (let i = 0; i < bytes.length; i++) {
    const v = bytes[i] ?? 0
    hex.push(v.toString(16).padStart(2, '0'))
  }
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (existing && isUuid(existing)) return existing
  const fresh = generateUuid()
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, fresh)
  return fresh
}

export function resolveSource(): string {
  if (typeof window === 'undefined') return 'direct'

  // 1. UTM override (always wins on first hit)
  const params = new URLSearchParams(window.location.search)
  const utm = params.get('utm_source')
  if (utm && utm.trim().length > 0) {
    persistSource(utm.trim().toLowerCase())
    return utm.trim().toLowerCase()
  }

  // 2. localStorage fallback — once captured, always reused
  const stored = window.localStorage.getItem(SOURCE_STORAGE_KEY)
  if (stored) return stored

  // 3. Known referrer hostname
  const ref = document.referrer
  if (ref) {
    try {
      const hostname = new URL(ref).hostname.toLowerCase()
      if (KNOWN_REFERRER_HOSTNAMES.has(hostname)) {
        persistSource(hostname)
        return hostname
      }
    } catch {
      // Malformed referrer → fall through
    }
  }

  persistSource('direct')
  return 'direct'
}

function persistSource(value: string): void {
  try {
    window.localStorage.setItem(SOURCE_STORAGE_KEY, value)
  } catch {
    // localStorage may be disabled (Safari private mode, etc.) — silently drop
  }
}

/**
 * Test-only / admin helper. Clears the session + source for the current tab so
 * tests and ops tooling can start from a clean slate.
 */
export function _resetSessionForTesting(): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
  window.localStorage.removeItem(SOURCE_STORAGE_KEY)
}

export const __test__ = { generateUuid, isUuid }
