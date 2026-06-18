---
name: ts-nocheck-files-documented
title: "Ts Nocheck Files Documented"
type: decision
source: task:63
recorded_at: 2026-06-18T17:20:37.714Z
---
For files with @ts-nocheck (media-validation.ts, support-generation-prompt-builder.ts, lesson-duplication-variation-service.ts), the @ai-summary explicitly calls out the @ts-nocheck status and what the developer must keep in sync manually.

Why: @ts-nocheck means TypeScript will not catch shape mismatches at compile time. Changes to shared types can silently break @ts-nocheck files without any warning.

How to apply: When adding @ai-summary to a @ts-nocheck file, include a sentence like '// @ts-nocheck — if you change X shape, search for all usages to update manually since TS won't catch breaks here.'

**Why:** Preventing silent type contract breaks in files that opt out of the type system's safety net.

**Source task:** `63`
