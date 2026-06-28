# Docs Drift for PR #158 — AI Services

## What I Did

Updated `docs/ai-services/README.md` to reconcile it with the current codebase after PR #158.

## What Was Wrong

The doc was significantly out of date relative to the actual `src/infra/llm/` code:

1. **Architecture diagram** showed `src/lib/ai/` paths that don't exist — actual path is `src/infra/llm/services/`
2. **Interactive Lesson Service** (`src/infra/llm/services/interactive-lesson/`) was entirely undocumented — this is the key feature PR #158 fixed
3. **All import examples** throughout the doc used `@/lib/ai/` instead of `@/infra/llm/`
4. **Model registry table** showed `gemini-2.0-flash-001` but actual current models are `gemini-3.1-pro`, `gemini-3.1-flash-lite`, `gemini-2.5-flash`
5. **Service registry table** was missing Interactive Lesson Service and Lesson Duplication Variation Service
6. **GEMINI_CONFIG** export from the interactive lesson service was not documented (the key export PR #158 made available)

## What I Changed

- Rewrote architecture diagram to show correct `src/infra/llm/` paths and all five services
- Added full Interactive Lesson Service section documenting the `callGeminiResiliently`, `parseResponse`, `validateLesson`, `prepareImage` helpers and the `GEMINI_CONFIG` export
- Added Lesson Duplication Variation Service summary
- Updated model registry table with current model names
- Fixed all import paths from `@/lib/ai/` to `@/infra/llm/`
- Updated last-updated date to 2026-06-11

## Verification

`pnpm ci:local` passed (typecheck + lint + tests).
