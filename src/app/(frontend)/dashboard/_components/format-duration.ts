/**
 * Format a duration in seconds as a compact human string.
 *
 * Examples: 45 → "45s", 125 → "2m 5s", 3720 → "1h 2m"
 *
 * @fileType util
 * @domain dashboard
 * @pattern presentational
 * @ai-summary Seconds → compact "Xh Ym" / "Xm Ys" / "Xs" string for widgets
 */

export function formatDurationSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const s = Math.floor(seconds)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}
