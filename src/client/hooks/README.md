# Client-Side React Hooks

Client-only React hooks shared across the frontend.

**Entry point:** Import individual hooks by file/name, for example `useCurrentUser`.
**Gotcha:** Hooks here run on the client. Do not import them into Server Components unless the boundary is explicit and all props crossing it are serializable.
