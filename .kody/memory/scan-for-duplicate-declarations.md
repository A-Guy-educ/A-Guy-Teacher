---
name: scan-for-duplicate-declarations
title: "Scan For Duplicate Declarations"
type: lesson
source: task:66
recorded_at: 2026-06-18T17:20:37.714Z
---
Before adding a new `const X` in a function or block scope, grep for existing `const X` in the same scope or parent scope to avoid TS2451 'Cannot redeclare block-scoped variable'. This is especially likely when editing a function that already had similar extraction logic.

Why: TypeScript treats two `const` declarations with the same name in the same scope as an error. The fix requires merging or renaming.

How to apply: When adding new extraction logic (e.g., toolCalls), search the function body for any prior declaration of the same variable name before committing the change.

**Why:** A prior session may have added the same variable name in the same scope for a different data source, and both exist in the diff without being visible together.

**Source task:** `66`
