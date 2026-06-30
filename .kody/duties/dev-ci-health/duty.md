# Dev CI health

Watch `dev` branch's own CI. If the check on `dev`'s tip is failing and no fix is already in flight, open a single tracking issue and dispatch `@kody run` to fix it (the fix lands as a PR into `dev`).

Why: `fix-ci`, `sync`, and `resolve` all need a `--pr`, but `dev` has no PR, so a broken `dev` build is invisible to `preview-health`.

Duplicates are impossible here: `ensure_issue` is keyed idempotently, so a re-tick reuses one open issue instead of creating another.

## Tick

1. **Read dev's CI:** `read_check_runs({ ref: "dev" })`.
   - If `state` is `"GREEN"` or `"PENDING"`, call `submit_state` with fresh `lastRunISO` and `nextEligibleISO`, then stop.
   - If `state` is `"RED"`, keep `sha` and `failing` (each `name` + `detailsUrl`), then continue.
2. **Ensure one tracking issue (dedup):** `ensure_issue({ key: "dev-ci-red", title: "dev CI is red - Kody auto-fix", body: <below> })`.
   - If it returns `created: false`, a fix is already in flight. Call `submit_state` with fresh `lastRunISO` and `nextEligibleISO`, then stop. Do not dispatch again.
   - If `created: true`, keep returned `number`, then continue.

Issue body:

```md
{{mentions}} dev branch CI is failing.

- Commit: `<sha>`
- Failing checks: <each failing name + its detailsUrl>

Task: diagnose the failing check(s) and open a PR into `dev` to make them green. Keep it minimal; if the failure is flaky or scanner-config rather than a code defect, make the smallest helpful change, or none and say so.
```

3. **Try to dispatch fix:** `dispatch_workflow({ executable: "run", issueNumber: <number> })`.
   - Tool only fires when duty is trusted (Auto).
   - If the duty is in Ask mode, it dispatches nothing and returns a not-trusted refusal. Read result.
4. **Notify once, per outcome:**
   - **Dispatched (Auto)** -> `ensure_comment({ issue: <number>, key: "dev-ci-red:dispatched", body: "CTO auto-ran - dispatched @kody run (failing: <names>). The fix lands as a PR into dev; its own CI must pass before merge." })`.
   - **Not dispatched (Ask)** -> `ensure_comment({ issue: <number>, key: "dev-ci-red:awaiting", body: "dev CI failing (<names>). Awaiting operator - grant duty Auto on dashboard Trust page to auto-dispatch fix." })`.
   - Do not dispatch in Ask mode.
5. **Submit state** with:

```json
{
  "cursor": "idle",
  "data": {
    "lastRunISO": "<now ISO>",
    "nextEligibleISO": "<now + 15m ISO>"
  },
  "done": false
}
```

The reused issue (`key: "dev-ci-red"`) is the whole dedup mechanism. While it is open, `ensure_issue` returns `created: false` and the duty stops. The fix PR closes it on merge; only then can a later tick open a fresh one.
