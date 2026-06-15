---
name: payload-package-not-in-node-modules
title: Payload Package Not In Node Modules
type: lesson
source: task:30
recorded_at: 2026-06-11T15:32:26Z
---

The `payload` package is not installed as a regular npm/pnpm dependency — it is resolved via pnpm workspace from the monorepo root. Integration tests that import `from 'payload'` will fail to load in environments where the monorepo workspace is not active. The test infrastructure (vitest) runs but fails to import the module.

Why: `pnpm` workspace resolution means `payload` is linked from the monorepo root, not nested in `node_modules`.
How to apply: When adding integration tests that use Payload CMS, be aware they may fail to load in environments without monorepo workspace resolution. The tests themselves are correct; the environment limitation is a pre-existing issue.

**Why:** Integration tests importing `from 'payload'` fail with 'Cannot find package payload' in this execution environment because pnpm workspace linking is not active.

**Source task:** `30`
