import { cookieName, type Locale } from '@/i18n/config'

export const localeCookieMaxAge = 60 * 60 * 24 * 365

export function buildClientLocaleCookie(locale: Locale, isCrossSiteEmbed: boolean): string {
  const baseCookie = [
    `${cookieName}=${encodeURIComponent(locale)}`,
    'path=/',
    `max-age=${localeCookieMaxAge}`,
  ]

  if (!isCrossSiteEmbed) {
    return [...baseCookie, 'SameSite=Lax'].join('; ')
  }

  return [...baseCookie, 'SameSite=None', 'Secure', 'Partitioned'].join('; ')
}

export function isCrossOriginIframe(): boolean {
  try {
    if (window.self === window.top) return false
    return window.top?.location.origin !== window.location.origin
  } catch {
    return true
  }
}
