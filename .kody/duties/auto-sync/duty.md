# Auto Sync

## Job

Every tick, run the local `auto-sync` executable tick:

```bash
bash .kody/executables/auto-sync/tick.sh
```

The executable is the source of truth for PR selection, behind-count checks, attempt limits, stuck labels, comments, and next-state output.

## Restrictions

- Act only on open, non-draft, mergeable PRs without `kody:no-sync`.
- Sync only when the head branch is at least five commits behind its base.
- Skip PRs with pending CI.
- Do not issue `@kody sync` more than once per six hours.
- Do not issue more than two sync attempts per head SHA.
- After two failed attempts on a head SHA, mark `kody:stuck-sync`.
- Keep state in `.kody/duties/auto-sync.state.json`.
