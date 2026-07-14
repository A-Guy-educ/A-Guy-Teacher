/**
 * @fileType utility
 * @domain frontend
 * @pattern icu-lite
 * @ai-summary Tiny `{token}` interpolator. Needed because the project's custom I18n provider (src/ui/web/providers/I18n/index.tsx) exposes only `t(key) => string` and does NOT do parameter substitution — unlike next-intl. Swap for `t(key, params)` once/if the provider is upgraded.
 */

export function formatMessage(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in params ? String(params[key]) : `{${key}}`,
  )
}
