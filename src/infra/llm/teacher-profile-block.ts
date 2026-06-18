/**
 * Teacher Profile Block Builder
 *
 * Builds the <teacher_profile> block that gets injected into the system prompt.
 * This defines the AI teacher's behavior and personality.
 *
 * @fileType ai-utility
 * @domain chat
 * @pattern server-only
 * @ai-summary The block format is consumed by the prompt template using a specific regex to extract the profile label and description. If you change the XML-like format here, the prompt template's extraction regex will break silently and the profile will not be injected correctly. Keep the format stable.
 */

import type { ResolvedTeacherProfile } from '@/server/services/teacher-profile-resolver'

/**
 * Builds the teacher profile block for system prompt injection
 *
 * Format:
 * ```
 * <teacher_profile>
 * Name: {label}
 * Description: {description}
 *
 * Behavior:
 * {systemPrompt.template text}
 * </teacher_profile>
 * ```
 *
 * @param profile - Resolved teacher profile
 * @returns Formatted teacher profile block string
 */
export function buildTeacherProfileBlock(profile: ResolvedTeacherProfile): string {
  const block = `<teacher_profile>
Name: ${profile.profileLabel}
Description: ${profile.profileDescription}

Behavior:
${profile.promptTemplate}
</teacher_profile>`

  return block
}
