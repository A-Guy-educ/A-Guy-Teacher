Resolved 10 merge conflicts between PR #233 (230-doc-coverage-srcinfraloading-loading-state-managem) and origin/dev.

All conflicts were symmetric JSDoc header conflicts: HEAD had minimal `@ai-summary` tags while origin/dev had richer headers with `@fileType`, `@domain`, `@pattern`, and enhanced `@ai-summary`. Resolution: took origin/dev's JSDoc format throughout since it follows project conventions and the PR is本身就是 about doc coverage.

README.md required actual content merging: HEAD had a "Core Concept" section, origin/dev had an "Entry Point" section — kept both, along with origin/dev's improved architecture diagram, Core Concepts, Gotchas, and Related Documentation sections.

All typecheck, lint, and format checks pass with no new issues.
