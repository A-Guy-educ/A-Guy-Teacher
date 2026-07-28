/**
 * OAuth Cookie Helpers
 *
 * @fileType utility
 * @domain auth
 * @pattern oauth
 * @ai-summary Read/write/delete helpers for the short-lived cookies of the OAuth handshake (state nonce, returnTo). The session cookie itself is owned by `shared-login/auth-cookie`.
 */

import type { NextRequest, NextResponse } from 'next/server'

/** CSRF state and returnTo live only for the duration of the handshake. */
export const STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 10,
}

export function readCookie(req: NextRequest, name: string): string | undefined {
  return req.cookies.get(name)?.value
}

export function deleteCookie(res: NextResponse, name: string): void {
  // Cookie deletion is "set with empty value + Max-Age=0". To remove a
  // Partitioned cookie the deletion MUST also carry Partitioned (and the
  // matching SameSite=None + Secure) — otherwise the browser treats the
  // deletion as a new unpartitioned cookie and the real partitioned one
  // sits in the iframe's cookie jar untouched. That was the logout bug
  // in the Kody dashboard preview iframe.
  const isProd = process.env.NODE_ENV === 'production'
  // Mirror the deletion across both jars: unpartitioned (top-level path)
  // and partitioned (cross-origin embed path) so whichever the original
  // write used gets cleared.
  res.cookies.set(name, '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  })
  if (isProd) {
    res.headers.append(
      'Set-Cookie',
      [
        `${name}=`,
        'Path=/',
        'Max-Age=0',
        'HttpOnly',
        'Secure',
        'SameSite=None',
        'Partitioned',
      ].join('; '),
    )
  }
}

export function setShortLivedCookie(res: NextResponse, name: string, value: string): void {
  res.cookies.set(name, value, STATE_COOKIE_OPTIONS)
}
