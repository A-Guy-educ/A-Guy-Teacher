/**
 * Helpers for the deferred exercise-context prompt channel.
 *
 * When a student enters an exercise, the client stores the exercise context
 * in a ref and shows a local welcome bubble. The context is only sent to the
 * AI when the student sends their first message — as an invisible prefix
 * around the same turn. The displayed user bubble carries the raw message;
 * only the prompt sent to the model gets the prefix. On history reload, the
 * prefix is stripped from persisted user messages so the bubble stays clean.
 *
 * Mirrors the step-context module's write/strip pattern.
 */

export const EXERCISE_CONTEXT_BLOCK_REGEX = /^<exercise-context[\s\S]*?<\/exercise-context>\s*/

/**
 * Wrap the user's first-turn message with an invisible exercise-context block
 * the AI sees. Returns the raw message unchanged when no pending context.
 */
export function buildPromptWithExerciseContext(
  message: string,
  exerciseContext: string | null,
): string {
  if (!exerciseContext) return message
  return `<exercise-context>\n${exerciseContext}\n</exercise-context>\n\n${message}`
}

/** Remove the persisted exercise-context prefix from a user message for display. */
export function stripExerciseContext(content: string): string {
  return content.replace(EXERCISE_CONTEXT_BLOCK_REGEX, '')
}
