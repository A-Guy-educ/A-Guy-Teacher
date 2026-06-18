/**
 * LLM Provider Types
 * Centralized type definitions for LLM providers
 * Used by both factory.ts and models.ts to avoid circular dependencies
 *
 * @fileType types
 * @domain ai
 * @ai-summary Only two providers: GEMINI and OPENAI_COMPATIBLE. The string values match the LLM_PROVIDER env var — do not change them without updating the env var convention.
 */

// Provider types - matches LLM_PROVIDER env var values
export const LLMProviderType = {
  GEMINI: 'gemini',
  OPENAI_COMPATIBLE: 'openai-compatible',
} as const

export type LLMProviderType = (typeof LLMProviderType)[keyof typeof LLMProviderType]
