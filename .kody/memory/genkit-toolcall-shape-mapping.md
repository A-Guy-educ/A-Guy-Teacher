---
name: genkit-toolcall-shape-mapping
title: "Genkit Toolcall Shape Mapping"
type: lesson
source: task:66
recorded_at: 2026-06-18T17:20:37.714Z
---
When extracting tool calls from Genkit's GenerateResponse, Genkit uses `{ toolName: string; arguments?: any }[]` while UnifiedLLMProvider expects `{ name: string; args: Record<string, unknown> }[]`. A mapping is required — not a direct assignment.

Why: The shape mismatch means directly assigning `result.toolCalls` would cause type errors and wrong field names at runtime.

How to apply: When editing generateChatCompletionWithTools or any code that bridges Genkit tool calls to the UnifiedLLMProvider interface, always map `toolName → name` and `arguments → args`.

**Why:** Without this mapping, tool call extraction would silently produce wrong field names, causing tool executors to receive empty args.

**Source task:** `66`
