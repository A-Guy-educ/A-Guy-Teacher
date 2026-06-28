/**
 * Schema version constant for cached InteractiveLesson payloads
 *
 * @ai-summary Bump when the InteractiveLesson/InteractiveLessonStep shape changes in ways that break the client converter or renderer — older cached rows with mismatched versions are evicted on read and regenerated. Prompt template changes do NOT need a bump (tracked by promptId + updatedAt separately); neither do new optional fields the converter tolerates.
 */
export const INTERACTIVE_LESSON_CACHE_SCHEMA_VERSION = 'v1'
