# Client-Side React Hooks

Entry point for all client-side React hooks used throughout the frontend application.

**Entry point:** Individual hook files — import directly by name (e.g., `useCurrentUser`)
**Gotcha:** All hooks in this folder are client-only (`'use client'`). Do not import them in Server Components without proper boundary serialization — hook props must be serializable.
