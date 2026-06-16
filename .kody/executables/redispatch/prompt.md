# Redispatch

Deterministic executable. `run.sh` invokes `tick.py`, which scans open issues for stale running Kody state, records dry-run actions or posts resume/stuck comments when live, and emits the next duty state block.
