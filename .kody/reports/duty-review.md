# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

Cycle 17 — 1 healthy, 10 warn, 14 broken of 25 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | cto | 15m | broken | kody-job-next-state block present but state file never created (0 commits to state path, 404) |
| architecture-audit | ceo | 7d | broken | script never implemented (404); body references deprecated .kody/jobs/ path; no kody-job-next-state block in procedure |
| ceo-performance-review | ceo | 7d | broken | kody-job-next-state block never emitted by procedure; state never created |
| cleanup-branches | platform | 7d | healthy | passes every check |
| clear-empty-goals | ceo | 7d | broken | 0-step body; no kody-job-next-state block; state never created |
| coverage-floor | ceo | 1d | broken | script absent (404); cadence formula inconsistency (every: 1d vs +20h); no kody-job-next-state block in procedure; disabled=true so idle by design |
| dead-code-sweep | platform | 7d | broken | script never implemented; state at legacy .kody/jobs/ path |
| dependency-bump | platform | 7d | broken | script absent; body references deprecated .kody/jobs/ path |
| design-review | design | 7d | broken | cadence guard (6d) contradicts every: 7d; no kody-job-next-state block |
| dev-ci-health | platform | 15m | broken | kody-job-next-state present but missing lastRunISO/nextEligibleISO fields |
| docs-code | design | 7d | broken | no kody-job-next-state block; state never created |
| docs-readme | design | 7d | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |
| flaky-test-quarantine | qa | 7d | warn | no kody-job-next-state block; disabled=true so idle by design |
| health-check | platform | 1h | warn | no kody-job-next-state block; state never created |
| job-gap-scan | ceo | 7d | broken | state at legacy .kody/jobs/ path; script writes to old location; two non-identical state files |
| pr-health-triage | platform | 15m | warn | no kody-job-next-state block; state never created |
| publish-release | platform | 7d | warn | no kody-job-next-state block; disabled=true so idle by design |
| qa-sweep | qa | 7d | broken | lastRunISO frozen at 2026-05-23; body updated 2026-05-28 but state not |
| qa-verify | qa | 7d | broken | state.json never created; 0 commits to state file ever |
| qa | qa | 7d | broken | lastRunISO frozen 2026-05-23; lastFiredAt and nextEligibleISO stale 10+ days |
| redispatch | cto | 15m | warn | no kody-job-next-state block; state never created |
| security-audit | platform | 7d | warn | no kody-job-next-state block; disabled=true so idle by design |
| system-audit | coo | 6h | warn | no kody-job-next-state block; state never created |
| task-memory-extractor | ceo | 7d | warn | no kody-job-next-state block; state never created |
| type-debt | platform | 7d | warn | no kody-job-next-state block; state never created; disabled=true so idle by design |

