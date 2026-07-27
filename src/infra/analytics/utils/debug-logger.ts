/**
 * @filetype utility
 * @domain analytics
 * @ai-summary Debug logger for analytics module — logs are gated on `NODE_ENV !== 'production'`, with an opt-in runtime escape hatch via the `?debug` URL query parameter for production diagnostics. In production without the URL flag, all calls become no-ops and get dead-code-eliminated by Next.js's production minifier on the NODE_ENV branch.
 *
 * Trap: `console.log` is allowed to ship in this file only. Every other file under `src/` must go through this helper — the ESLint `no-console` rule enforces it. Use `console.warn`/`console.error` for legitimate error reporting (they remain allowed everywhere).
 */

const DEBUG_QUERY_PARAM = 'debug'

let cachedUrlDebugFlag: boolean | null = null

/**
 * Runtime override for production debugging — reading `?debug=anything` from
 * the URL re-enables the logger even in production. The flag is captured
 * once on first call so URL changes mid-session don't toggle logging.
 */
function hasUrlDebugFlag(): boolean {
  if (cachedUrlDebugFlag !== null) return cachedUrlDebugFlag
  if (typeof window === 'undefined') {
    cachedUrlDebugFlag = false
    return false
  }
  try {
    const params = new URLSearchParams(window.location.search)
    cachedUrlDebugFlag = params.has(DEBUG_QUERY_PARAM)
  } catch {
    cachedUrlDebugFlag = false
  }
  return cachedUrlDebugFlag
}

/**
 * `true` when the logger should emit. In production with no URL flag this
 * collapses to `false` (a static literal the bundler can fold).
 */
function isEnabled(): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  return hasUrlDebugFlag()
}

export interface AnalyticsDebugLogger {
  log: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
}

/**
 * Create a namespaced debug logger. The namespace is prepended to every message
 * so logs from different modules are easy to distinguish in DevTools.
 */
export function createDebugLogger(namespace: string): AnalyticsDebugLogger {
  const prefix = `[${namespace}]`
  return {
    log(...args: unknown[]): void {
      if (!isEnabled()) return
      // eslint-disable-next-line no-console
      console.log(prefix, ...args)
    },
    warn(...args: unknown[]): void {
      if (!isEnabled()) return
      console.warn(prefix, ...args)
    },
  }
}

/**
 * Default analytics logger used by module-level code.
 */
export const analyticsDebugLog = createDebugLogger('Analytics')

/**
 * For tests only: clear the cached URL flag so the next call re-evaluates.
 */
export function _resetDebugLoggerForTests(): void {
  cachedUrlDebugFlag = null
}
