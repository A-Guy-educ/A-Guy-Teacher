import { NextRequest, NextResponse } from 'next/server'
import {
  cookieName,
  defaultLocale,
  type Locale,
  locales,
  getLocaleFromSubdomain,
} from './i18n/config'
import { resolveAuthCookieDomain } from './infra/auth/oauth_constants'
import { contentSecurityPolicy } from './infra/security/content-security-policy.js'

/**
 * Check if a path is a protected learning route that requires authentication.
 */
function isProtectedLearningPath(pathname: string): boolean {
  const protectedPaths = ['/study', '/practice', '/test', '/ask']
  for (const protectedPath of protectedPaths) {
    if (pathname === protectedPath || pathname.startsWith(`${protectedPath}/`)) {
      return true
    }
  }

  return false
}

function isCourseCatalogPath(pathname: string): boolean {
  return pathname === '/courses'
}

function isCourseContentPath(pathname: string): boolean {
  return pathname.startsWith('/courses/')
}

/**
 * Check if the request has a valid Payload auth token.
 * Checks for the payload-token cookie.
 */
function hasAuthToken(request: NextRequest): boolean {
  const cookieStore = request.cookies
  return cookieStore.get('payload-token')?.value !== undefined
}

function isKodyFlyPreviewHost(host: string): boolean {
  const hostname = host.split(':')[0]?.toLowerCase() ?? ''
  return hostname.startsWith('kp-') && hostname.endsWith('.fly.dev')
}

function allowsPreviewAuthBypass(request: NextRequest): boolean {
  if (process.env.KODY_PREVIEW_AUTH_BYPASS !== 'true') return false

  const host = request.headers.get('host') || request.nextUrl.host
  return isKodyFlyPreviewHost(host)
}

function resolveCookieDomain(host: string): string | undefined {
  // If you're on *.vercel.app, sharing cookies across subdomains via Domain=.vercel.app
  // is typically blocked (public suffix). In that case, keep host-only cookie.
  if (host.endsWith('.vercel.app')) return undefined

  // Prefer explicit root domain if you set it (recommended)
  // e.g. ROOT_DOMAIN=example.com -> cookie domain ".example.com"
  const rootFromEnv = process.env.ROOT_DOMAIN?.trim()
  if (rootFromEnv) return `.${rootFromEnv.replace(/^\./, '')}`

  // Fallback: naive "apex" extraction (works for most .com/.net/.org cases)
  const parts = host.split(':')[0].split('.').filter(Boolean)
  if (parts.length < 2) return undefined
  const apex = parts.slice(-2).join('.')
  return `.${apex}`
}

/**
 * Echo-back origin for a cross-origin API caller, or `undefined` to deny.
 *
 * Sibling apps on the shared-login domain are trusted automatically — they
 * already receive the session cookie — plus any origin listed explicitly in
 * `API_ALLOWED_ORIGINS` (comma-separated, used for local dev over HTTP).
 *
 * The exact origin is echoed rather than `*` because `*` is invalid alongside
 * `Access-Control-Allow-Credentials`, and credentials are the whole point here.
 */
function resolveAllowedApiOrigin(originHeader: string | null): string | undefined {
  if (!originHeader) return undefined

  const explicit = (process.env.API_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().toLowerCase())
    .filter(Boolean)

  if (explicit.includes(originHeader.toLowerCase())) return originHeader

  const cookieDomain = resolveAuthCookieDomain()
  if (!cookieDomain) return undefined

  try {
    const url = new URL(originHeader)
    if (url.protocol !== 'https:') return undefined

    const host = url.hostname.toLowerCase()
    if (host === cookieDomain.slice(1) || host.endsWith(cookieDomain)) return originHeader
  } catch {
    return undefined
  }

  return undefined
}

const CORS_MAX_AGE_SECONDS = '600'

function applyCorsHeaders(headers: Headers, allowedOrigin: string): void {
  headers.set('Access-Control-Allow-Origin', allowedOrigin)
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.append('Vary', 'Origin')
}

// Media CDN redirects are handled by next.config.js redirects (baked in at build time).
// This avoids Edge middleware env var availability issues.

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') || ''
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  if (!pathname.startsWith('/api/pdfjs-viewer')) {
    response.headers.set('Content-Security-Policy', contentSecurityPolicy)
  }

  // Cross-origin API access for sibling apps that share the login cookie.
  // Without these headers the browser discards the response, even though the
  // cookie itself was sent (see docs/architecture/SHARED-LOGIN-APP-GUIDE.md).
  if (pathname.startsWith('/api')) {
    const allowedOrigin = resolveAllowedApiOrigin(request.headers.get('origin'))

    if (allowedOrigin) {
      if (request.method === 'OPTIONS') {
        const preflight = new NextResponse(null, { status: 204 })
        applyCorsHeaders(preflight.headers, allowedOrigin)
        preflight.headers.set(
          'Access-Control-Allow-Methods',
          'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        )
        preflight.headers.set(
          'Access-Control-Allow-Headers',
          request.headers.get('access-control-request-headers') ?? 'Content-Type, Authorization',
        )
        preflight.headers.set('Access-Control-Max-Age', CORS_MAX_AGE_SECONDS)
        return preflight
      }

      applyCorsHeaders(response.headers, allowedOrigin)
    }
  }

  // Exclude paths from locale handling (double safety, even though matcher already excludes many)
  const shouldExclude =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')

  if (shouldExclude) {
    return response
  }

  // Auth guard: redirect unauthenticated users to login for protected learning routes
  if (
    isProtectedLearningPath(pathname) &&
    !hasAuthToken(request) &&
    !allowsPreviewAuthBypass(request)
  ) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('returnTo', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }

  if (isCourseCatalogPath(pathname) && !hasAuthToken(request)) {
    const startUrl = new URL('/start', request.url)
    return NextResponse.redirect(startUrl)
  }

  if (isCourseContentPath(pathname) && !hasAuthToken(request)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('returnTo', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }

  let locale: Locale = defaultLocale
  let shouldSetCookie = false

  // Subdomain-based locale forcing
  const subdomainLocale = getLocaleFromSubdomain(host)
  if (subdomainLocale) {
    locale = subdomainLocale
    shouldSetCookie = true
  } else {
    // On primary domain, check cookie first
    const cookieLocale = request.cookies.get(cookieName)?.value as Locale | undefined

    if (cookieLocale && locales.includes(cookieLocale)) {
      locale = cookieLocale
    }
  }

  if (shouldSetCookie) {
    const cookieDomain = resolveCookieDomain(host)
    const isHttps = request.nextUrl.protocol === 'https:'
    const isProd = process.env.NODE_ENV === 'production'

    // CHIPS: when this request is being served INSIDE a cross-origin
    // iframe (the Kody dashboard's preview pane is the prime example),
    // SameSite=Lax cookies are not written by modern browsers and the
    // user's language choice silently vanishes. Detect the embedded
    // context via Sec-Fetch-Site (browsers set this on every fetch) and
    // emit a Partitioned + SameSite=None + Secure cookie so it sticks.
    const fetchSite = request.headers.get('sec-fetch-site')
    const isCrossSiteEmbed = fetchSite === 'cross-site' && (isHttps || isProd)

    response.cookies.set(cookieName, locale, {
      maxAge: 31536000,
      path: '/',
      sameSite: isCrossSiteEmbed ? 'none' : 'lax',
      secure: isCrossSiteEmbed || isHttps || isProd,
      ...(isCrossSiteEmbed ? { partitioned: true } : {}),
      // Only set domain when it's safe/valid (custom domain).
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    })
  }

  // Set locale header for next-intl (or your own resolver)
  response.headers.set('x-locale', locale)

  return response
}

export const config = {
  matcher: [
    // Security headers run broadly; locale handling still exits early for admin/api/assets.
    '/((?!api/pdfjs-viewer|_next|_static|.*\\..*).*)',
  ],
}
