# Preview health

Scheduled CTO duty for open pull-request health.

## Policy

- Scan open non-draft PRs every 15 minutes.
- Pick at most one repair per PR, in this order: `resolve`, `fix-ci`, `sync`.
- `resolve` auto-runs for merge conflicts.
- `fix-ci` and `sync` auto-run only when the CTO trust ledger marks that verb `auto`.
- Otherwise, post an inert recommendation for `fix-ci` or `sync`.
- Never post a runnable `@kody ...` command or `kody-cmd` marker in recommendation comments.

## State

The executable persists dedupe state in this duty's sidecar state file:
`.kody/duties/preview-health.state.json`.

State entries are keyed by PR number and fingerprinted as `<verb>|<headRefOid>`,
so the same repair is not repeated for the same PR commit.
