/**
 * Genkit LLM integration
 *
 * @ai-summary Entry point for Genkit-based LLM operations. Exposes `createGenkitUnifiedAdapter` which is the runtime adapter — all chat/completion calls go through it.
 *
 * @fileType index
 * @domain ai
 * @pattern abstraction, genkit, provider-abstraction
 */
import { createGenkitErrorAdapter, getErrorAdapter } from './adapters/error-adapter'
import { createGenkitUnifiedAdapter, isGenkitConfigured } from './adapters/unified-adapter'

export { createGenkitErrorAdapter, createGenkitUnifiedAdapter, getErrorAdapter, isGenkitConfigured }
