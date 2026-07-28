import { NextRequest, NextResponse } from 'next/server'
import {
  cookieName,
  defaultLocale,
  type Locale,
  locales,
  getLocaleFromSubdomain,
} from './i18n/config'
import { AUTH_COOKIE_NAME } from './infra/auth/shared-login/auth-cookie'
import { toCookieDomain } from './infra/auth/shared-login/policy'
import { getSharedLoginPolicy } from './infra/auth/shared-login/policy.env'
import { contentSecurityPolicy } from './infra/security/content-security-policy.js'
import {
  applyCorsHeaders,
  applyPreflightHeaders,
  resolveAllowedApiOrigin,
} from './infra/security/cors'

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
  return request.cookies.get(AUTH_COOKIE_NAME)?.value !== undefined
}

/**
 * Attach CORS headers for sibling apps, and answer their preflight.
 *
 * Returns a response only for a preflight, which must not fall through to the
 * route. Otherwise the headers are added to `response` and the request
 * continues normally.
 */
function handleApiCors(request: NextRequest, response: NextResponse): NextResponse | undefined {
  const allowedOrigin = resolveAllowedApiOrigin(
    request.headers.get('origin'),
    getSharedLoginPolicy(),
  )
  if (!allowedOrigin) return undefined

  if (request.method === 'OPTIONS') {
    const preflight = new NextResponse(null, { status: 204 })
    applyCorsHeaders(preflight.headers, allowedOrigin)
    applyPreflightHeaders(preflight.headers, request.headers.get('access-control-request-headers'))
    return preflight
  }

  applyCorsHeaders(response.headers, allowedOrigin)
  return undefined
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

/**
 * Cookie `Domain` for the locale cookie.
 *
 * Prefers the configured root domain — the same value that scopes the auth
 * cookie — and otherwise guesses the apex from the host. The guess is safe
 * enough for a language preference but deliberately not reused for the session
 * cookie, where a wrong guess would leak a login: `toCookieDomain` only ever
 * honours explicit configuration.
 */
function resolveLocaleCookieDomain(host: string): string | undefined {
  const configured = toCookieDomain(process.env.ROOT_DOMAIN)
  if (configured) return configured

  const hostname = host.split(':')[0]
  if (!toCookieDomain(hostname)) return undefined

  const parts = hostname.split('.').filter(Boolean)
  if (parts.length < 2) return undefined

  return `.${parts.slice(-2).join('.')}`
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
    const corsResponse = handleApiCors(request, response)
    if (corsResponse) return corsResponse
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
    const cookieDomain = resolveLocaleCookieDomain(host)
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
