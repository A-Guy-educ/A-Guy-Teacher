# Auto Resolve

## Job

Every tick, run the local `auto-resolve` executable tick:

```bash
bash .kody/executables/auto-resolve/tick.sh
```

The executable is the source of truth for PR selection, attempt limits, stuck labels, comments, and next-state output.

## Restrictions

- Act only on open, non-draft PRs whose mergeable state is `CONFLICTING`.
- Do not issue more than two `@kody resolve` comments per head SHA.
- After two failed attempts on a head SHA, mark `kody:stuck-conflict`.
- Keep state in `.kody/duties/auto-resolve.state.json`.
