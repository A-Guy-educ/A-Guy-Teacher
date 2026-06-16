# Job Gap Scan

Deterministic executable. `run.sh` invokes `tick.py`, which proposes one missing high-ROI duty, updates `.kody/reports/job-gap-scan.md`, updates duty state, and commits when not in dry-run or no-commit mode.
