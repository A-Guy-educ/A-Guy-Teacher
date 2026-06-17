# Issue #82: `generateChatCompletionWithTools` always returns `toolCalls: []`

## What was changed

**File**: `src/infra/llm/genkit/adapters/unified-adapter.ts`

The `generateChatCompletionWithTools` method was hardcoding `toolCalls: []` in its return value, ignoring any tool calls that Genkit actually made. The fix extracts tool calls from `result.messages` by iterating through message content parts and finding `toolRequest` entries.

**Test file**: `tests/int/llm/genkit-adapter-messages.int.spec.ts`

Added two tests to the `generateChatCompletionWithTools` describe block:
- `extracts tool calls from response messages` — verifies tool calls are correctly parsed from Genkit's `result.messages`
- `returns empty toolCalls when no tools are called` — verifies the happy path returns an empty array when no tools are invoked

## How tool calls are extracted

Genkit stores tool requests in `result.messages` as content parts with a `toolRequest` property. Each `toolRequest` has `name` and `input` fields. The extraction iterates through all messages and their content parts, collecting any `toolRequest` entries into the returned `toolCalls` array.
