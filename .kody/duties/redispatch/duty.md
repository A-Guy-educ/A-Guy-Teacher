# Redispatch

## Job

Every tick, run the local `redispatch` executable tick:

```bash
bash .kody/executables/redispatch/tick.sh
```

The executable is the source of truth for stalled issue detection, dry-run logging, live-test gating, labels, comments, and next-state output.

## Restrictions

- Dry-run mode is controlled inside `.kody/executables/redispatch/tick.sh`.
- Exclude `kody:stuck`, `kody:no-redispatch`, and `kody:stalled`.
- Do not resume an issue more than once per UTC day.
- Keep state in `.kody/duties/redispatch.state.json`.
