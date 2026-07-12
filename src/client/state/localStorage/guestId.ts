/**
 * Stable anonymous guest ID kept in localStorage.
 *
 * We generate an opaque UUID the first time any code needs to attribute
 * an event to an anonymous visitor and reuse it forever until the user
 * clears storage. This is intentionally separate from the user-profile
 * module: the ID has to survive `clearUserProfile()` / `removeCourseSelection()`
 * so telemetry stays joinable across a single browser's lifetime even
 * when the user drops their course selection.
 */

const GUEST_ID_STORAGE_KEY = 'a-guy:guest-id'

function generateGuestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for older browsers / non-secure contexts. Not cryptographic,
  // just unique enough for a telemetry correlation ID.
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Get the stable anonymous guest ID, creating and persisting one if
 * this browser has never had one before. SSR-safe: returns `null` on
 * the server so callers can skip attribution rather than crash.
 */
export const getOrCreateGuestId = (): string | null => {
  if (typeof window === 'undefined') return null
  try {
    const existing = localStorage.getItem(GUEST_ID_STORAGE_KEY)
    if (existing) return existing
    const fresh = generateGuestId()
    localStorage.setItem(GUEST_ID_STORAGE_KEY, fresh)
    return fresh
  } catch {
    // localStorage disabled / quota exceeded — attribution just degrades.
    return null
  }
}
