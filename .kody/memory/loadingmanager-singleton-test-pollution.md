---
name: loadingmanager-singleton-test-pollution
title: "Loadingmanager Singleton Test Pollution"
type: lesson
source: task:216
recorded_at: 2026-06-18T05:45:18.861Z
---
The exported `asyncAction` and `useAsyncAction` both call through to the process-wide `loadingManager` singleton. In unit/integration tests, any component that uses these will pollute the shared store across test cases. Pass a custom manager from `createLoadingManager()` to `createAsyncAction(manager)` to isolate each test.

**Why:** A future agent or developer writing a test for a component that uses `useAsyncAction` will get flaky tests if they don't know to inject a test manager — the singleton retains state from previous tests in the same process.

**Source task:** `216`
