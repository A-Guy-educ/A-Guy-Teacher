# Auto Fix CI

Deterministic executable. `tick.sh` scans open non-draft PRs with settled failing CI, posts `@kody fix-ci` or stuck comments when not in dry-run mode, and emits the next duty state block.
