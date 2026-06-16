# Auto Fix CI

## Job

Every tick, run the local `auto-fix-ci` executable tick:

```bash
bash .kody/executables/auto-fix-ci/tick.sh
```

The executable is the source of truth for PR selection, attempt limits, stuck labels, comments, and next-state output.

## Restrictions

- Act only on open, non-draft PRs whose settled CI has at least one failing or timed-out check.
- Skip pending CI.
- Do not issue more than two `@kody fix-ci` comments per head SHA.
- After two failed attempts on a head SHA, mark `kody:stuck-ci`.
- Keep state in `.kody/duties/auto-fix-ci.state.json`.
