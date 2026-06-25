/**
 * LLM Service Errors
 *
 * @ai-summary VariationGenerationError is thrown by the lesson duplication service only — it carries exerciseId so callers can report which specific exercise failed in a batch. This is NOT a general LLM error; most services use the LLMError from providers/shared/errors instead.
 */

export class VariationGenerationError extends Error {
  constructor(
    public readonly exerciseId: string,
    public readonly reason: string,
  ) {
    super(`Variation generation failed for exercise ${exerciseId}: ${reason}`)
    this.name = 'VariationGenerationError'
    if (Error.captureStackTrace) Error.captureStackTrace(this, VariationGenerationError)
  }
}
