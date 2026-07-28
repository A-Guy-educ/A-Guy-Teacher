/**
 * Request headers accessor for auth writers
 *
 * @fileType utility
 * @domain auth
 * @pattern oauth
 * @ai-summary Safely reads the incoming request headers inside server actions so cookie flags can be tailored per request context.
 */

import { headers } from 'next/headers'

type ReadableHeaders = { get(name: string): string | null }

/**
 * Incoming request headers, or `undefined` outside a request scope.
 *
 * Server actions need these so `setAuthCookie` can tell a top-level form post
 * from one issued inside the Kody preview iframe. Unit tests call the actions
 * directly with no request context, where `headers()` throws — falling back to
 * `undefined` keeps the default (top-level) cookie flags.
 */
export async function getRequestHeadersSafe(): Promise<ReadableHeaders | undefined> {
  try {
    return await headers()
  } catch {
    return undefined
  }
}
