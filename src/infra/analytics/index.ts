/**
 * @filetype index
 * @domain analytics
 * @ai-summary Analytics public API — the ONLY import path product code should use. Canonicalizes all event tracking through a single tracker that validates, enriches, and routes to GA4 and Mixpanel.
 *
 * Entry Point: `import { analytics } from '@/infra/analytics'` (aliased as `@/lib/analytics`)
 *
 * Gotcha: All product tracking must go through `analytics.track()` — no direct `window.gtag()` or `window.mixpanel` calls. This ensures every event is validated, enriched with session data, and correctly routed.
 *
 * Gotcha: `alias()` must be called BEFORE `identify()` during registration to merge anonymous history with the new account — the registration_completed handler in system-events-subscriber enforces this order.
 *
 * Gotcha: `reset()` clears user identity and cached properties but does not flush the adapter queue — events queued before reset may still fire under the old identity.
 */

// Core API
export { analytics, initializeAnalytics, getSessionId } from './core/tracker'

// Provider (for app initialization)
export { AnalyticsProvider } from './providers/AnalyticsProvider'

// Event constants
export { PRODUCT_EVENTS } from './contracts/events'
export type { ProductEvent } from './contracts/events'

// TypeScript types
export type {
  PageViewProperties,
  SessionStartedProperties,
  UserIdentifiedProperties,
  CourseEnteredProperties,
  LessonStartedProperties,
  LessonCompletedProperties,
  PdfViewedProperties,
  ChatMessageSentProperties,
  RegistrationPromptShownProperties,
  RegistrationCompletedProperties,
} from './contracts/schemas'

// Configuration (for internal use)
export { analyticsConfig } from './config'
