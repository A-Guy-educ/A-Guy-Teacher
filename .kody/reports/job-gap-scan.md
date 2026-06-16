# Job Gap Scan

_Cadence: daily - one proposed duty per cycle, advisory only._

_Last updated: 2026-06-16T03:23:20.107Z_

## Current proposal

**sentry-digest** - Daily digest loudest unresolved Sentry errors so production noise becomes triage list, not chase.

### Why now

repo already ships Sentry. Errors visible only in Sentry UI invisible kody - turning issues closes loop.

### Scoring

| # | Item | Risk | Effort | Value | ROI |
|---|------|------|--------|-------|-----|
| 1 | Sentry top-errors digest | low | low | high | 95 |

### Draft duty markdown

If approved, operator (or executor) would commit following `.kody/duties/sentry-digest.md`. This starting point, not final spec.

````markdown
---
every: 24h
staff: kody
---
# sentry-digest

## Job

Once day, fetch 10 unresolved Sentry errors ranked by `events x users_affected` open one GitHub issue per recurring error no open tracking issue yet.

## Tick procedure REQUIRED

Fully scripted. Add `.kody/executables/sentry-digest/tick.sh` before enabling it.
````

### Verdict path

Approve -> create duty markdown above. Reject -> permanent - CEO will not surface slug again. Dismiss -> cooling-off 30 days, then eligible re-surface if signal grows.

## History

| Slug | Title | First suggested | Status |
|------|-------|-----------------|--------|
| issue-auto-triage | Issue auto-triage | 2026-05-20 | pending |
| sentry-digest | Sentry top-errors digest | 2026-06-16 | pending |
| stale-pr-janitor | Stale-PR janitor | 2026-05-20 | pending |
