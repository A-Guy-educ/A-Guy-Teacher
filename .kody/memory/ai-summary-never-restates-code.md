---
name: ai-summary-never-restates-code
title: "Ai Summary Never Restates Code"
type: preference
source: task:63
recorded_at: 2026-06-18T17:20:37.714Z
---
@ai-summary must document the non-obvious: why the module exists, what can go wrong, and what assumptions callers must not break. It should NEVER restate what the code obvious says (e.g. 'retries with exponential backoff' for a file named retry.ts). Use the @ai-summary to surface gotchas that grepping across files won't reveal.

Why: A coding agent reading a cold file needs to understand the trap, not the mechanic. Restating mechanics wastes the tag and trains agents to ignore it.

How to apply: When adding @ai-summary, ask 'what would a developer mis-understand or mis-configure here?' and put that in the summary.

**Why:** Without this convention, @ai-summary devolves into restating the obvious, providing no value over reading the code.

**Source task:** `63`
