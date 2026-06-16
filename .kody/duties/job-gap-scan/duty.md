# Job Gap Scan

## Job

Once per day, run the local `job-gap-scan` executable tick:

```bash
python3 .kody/executables/job-gap-scan/tick.py
```

The executable writes one advisory proposal report to `.kody/reports/job-gap-scan.md` and updates `.kody/duties/job-gap-scan.state.json`.

## Restrictions

- Advisory only.
- Never write a new duty directly.
- Never re-surface a permanently rejected candidate.
- Respect the dismiss cool-off in executable logic.
