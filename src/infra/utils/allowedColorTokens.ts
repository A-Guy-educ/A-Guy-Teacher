/**
 * @fileType constants
 * @domain ui
 * @pattern shared-config
 * @ai-summary Whitelist of ::token{...} markdown tokens accepted by the remark plugin and the Lexical/HTML text renderers.
 *
 * Both renderers must stay in sync — this file is the single source of truth
 * so we can't accidentally accept a token in markdown but drop it in Lexical
 * (or vice versa).
 */

export const ALLOWED_COLOR_TOKENS = [
  'text-highlight-1',
  'text-highlight-2',
  'text-highlight-3',
  'text-highlight-4',
  'text-highlight-5',
  'text-highlight-6',
  'text-highlight-7',
  'text-highlight-8',
  'text-red',
  'text-orange',
  'text-yellow',
  'text-green',
  'text-blue',
  'text-purple',
  'text-pink',
  'text-gray',
  'text-black',
  'text-dark-red',
  'text-dark-orange',
  'text-dark-yellow',
  'text-dark-green',
  'text-dark-blue',
  'text-dark-purple',
  'text-dark-pink',
  'text-dark-gray',
  'text-wine-red',
  'text-size-xs',
  'text-size-small',
  'text-size-medium',
  'text-size-large',
  'text-size-xlarge',
  'text-size-xxlarge',
] as const

export type AllowedColorToken = (typeof ALLOWED_COLOR_TOKENS)[number]

const ALLOWED_SET: ReadonlySet<string> = new Set(ALLOWED_COLOR_TOKENS)

export function isAllowedColorToken(token: string): token is AllowedColorToken {
  return ALLOWED_SET.has(token)
}
