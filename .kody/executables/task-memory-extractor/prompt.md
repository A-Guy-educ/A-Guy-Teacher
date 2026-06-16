# Task Memory Extractor

Deterministic executable. `run.sh` invokes `tick.py`, which scans task `memory-recs.json` files, promotes high-confidence recommendations, updates `.kody/memory/INDEX.md`, marks tasks extracted, and commits when not in dry-run or no-commit mode.
