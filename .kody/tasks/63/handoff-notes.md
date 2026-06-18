Added @ai-summary headers to 40 TypeScript files across src/infra/llm/ and subdirectories that lacked them. No behavioral changes — purely additive JSDoc.

Key conventions applied (documented in memory-recs):
- @ai-summary captures WHY the module exists and the critical GOTCHA — never restates what the code plainly says
- @ts-nocheck files (media-validation.ts, support-generation-prompt-builder.ts, lesson-duplication-variation-service.ts) explicitly call out the manual sync requirement in their @ai-summary
- Prompt files (prompts/) describe the contract: exact output format, what must not change, and error behavior

Quality gates: pnpm ci:local passes (typecheck + lint green).

Two followups flagged:
1. unified-adapter.ts was not read — still needs @ai-summary
2. genkit-tools.ts @ai-summary should be audited for quality (was pre-existing)
