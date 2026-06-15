/**
 * Server Services
 *
 * Business logic services used by API routes, hooks, and server-side code.
 * Entry point for service imports — re-exports commonly used services.
 *
 * @fileType index
 * @domain services
 * @ai-summary Business logic services: chat, auth, courses, lessons, exercises, AI, and study plans
 *
 * Key services:
 * - Chat: conversation-service, chat-quota, rate-limit, user-learning-context
 * - Auth: guest-session, guest-session-upgrade, entitlement_check
 * - Courses: course-search-service, course-list-service, course-tree-isolation
 * - Exercises: exercise-conversion (v2/v3), lesson-duplication, lesson-export
 * - AI: agent-behavior-prompt-resolver, teacher-profile-resolver
 * - Utils: pdf-fetcher, diff
 *
 * Gotchas:
 * - Many services require Payload instance — pass `req.payload` in hooks for transaction safety
 * - In-memory services (rate-limit) do not work across serverless instances
 * - Tiered resolution services (teacher, agent behavior) fall back to hardcoded defaults if DB lookups fail
 */

export { hasEntitlement } from './entitlement_check'
export { checkAndIncrementChatQuota, getChatQuotaStatus } from './chat-quota'
export { checkRateLimit, checkAuthenticatedRateLimit } from './rate-limit'
export { fetchUserLearningContext, buildUserContextBlock } from './user-learning-context'
