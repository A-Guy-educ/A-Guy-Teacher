# Preview health

> Standing preview-health triage, executed by the **CTO** persona
> (`staff: cto`). Every 15 minutes, read the open pull requests, detect
> which ones need a mechanical repair, and — per the operator's trust
> ledger — either recommend the repair or (once that verb has graduated)
> dispatch it. Cadence is enforced by the engine via `every: 15m`; no
> prose cadence guard needed.

## Job

Each tick, look at every open PR, pick at most one repair per PR (by the
priority order below), and either recommend it or — if its verb has
graduated in the trust ledger — dispatch it. The CTO persona defines only
*who* runs this; all authority, scope limits, and comment formats below
belong to **this job**.

## Tick procedure — REQUIRED (fully scripted)

This tick is **fully scripted**. The script
[preview-health-tick.py](.kody/scripts/preview-health-tick.py) is the
**single source of truth** for which PRs are candidates, which repair each
needs, what comments to post, and the next state.

Prose-driven iteration silently dropped the dedup ledger here: across a
heavy multi-PR tick the model intermittently failed to emit the closing
`kody-job-next-state` block, so state never persisted and every
recommendation re-fired. The script removes that failure mode.

You **MUST**:

1. Run exactly: `bash .kody/scripts/preview-health-tick.sh`
2. Emit the script's stdout **verbatim** — the markdown summary table and
   the `kody-job-next-state` fenced block at the end. Do not summarise,
   reorder, or add commentary.

You **MUST NOT**:

- Call `gh pr list`, `gh issue list`, or `gh api` yourself.
- Decide repairs, post comments, or mutate state outside the script.
- Use any prior knowledge of PR numbers. The script's output is your only
  data source for this tick.

Everything below documents *what the script does* — it is reference, not a
second set of instructions to execute by hand.

## Authority — auto resolve and trust ledger

This job auto-runs `resolve` for merge conflicts. `fix-ci` and `sync` remain
governed by the operator's trust ledger (the `kody:cto-decisions` issue):

- `resolve` is policy-auto because conflicts block PR progress and the repair
  executable owns the merge-conflict workflow.
- `fix-ci` or `sync` marked `"auto"` has **graduated** — dispatch it on
  this tick.
- `"ask"`, missing, no ledger, parse failure, any doubt → **not graduated**
  for `fix-ci` / `sync`: recommend and wait.
- `fix-ci` and `sync` graduate independently. A single Reject on a verb
  resets only that verb to `"ask"`.

## Scope (hard limits)

- only actions this job may ever take are `resolve`, `fix-ci`, and `sync`
  for a specific PR.
- `resolve` auto-runs for conflicts; `fix-ci` and `sync` auto-run only
  when the trust ledger marks that verb `"auto"`.
- No `merge`, `approve`, `execute`, `qa-review`, `close`, `revert`,
  `abort`, assign, label — entirely out scope here.
- Never edit, create, delete any file in working tree. Never `git commit`,
  `git push`, open PR. Only write paths are workflow dispatch and PR comments.

### Enumerate

One list call — never `gh` once per PR:

```
gh pr list --state open --limit 100 \
  --json number,title,headRefName,headRefOid,baseRefName,isDraft,mergeable,statusCheckRollup,updatedAt
```

Skip draft PRs (`isDraft: true`) — they aren't ready for repair.

### Read the trust ledger (do this first, every tick)

```
gh issue list --state open --label kody:cto-decisions --limit 5 \
  --json number,body
```

Take the lowest-numbered match, find the fenced ```json block between
`<!-- kody-cto-decisions:start -->` and `<!-- kody-cto-decisions:end -->`,
and read `staff.cto.<verb>.mode` for each of `fix-ci`, `sync`, `resolve`.
Interpret `mode` exactly as the **Authority — the trust ledger** section
above dictates (auto → may self-dispatch; anything else → recommend).

### Detect the repair (priority order — first match wins, one per PR)

For each open non-draft PR, evaluate in this exact order, stop at first hit:

1. **Conflicts → `resolve`.** `mergeable === "CONFLICTING"`.
2. **CI failed → `fix-ci`.** `statusCheckRollup` contains any check with
   `conclusion` of `FAILURE`, `TIMED_OUT`, or `ACTION_REQUIRED` (treat
   `STARTUP_FAILURE` the same). Ignore still-running checks
   (`status: IN_PROGRESS`/`QUEUED`).
3. **Stale branch → `sync`.** Only if neither of the above. Measure drift:

   ```
   gh api repos/{owner}/{repo}/compare/{baseRefName}...{headRefName} --jq .behind_by
   ```

   `> 10` → `sync`. `<= 10` → leave alone (small drift is normal).

No hit on any of the three → leave the PR alone this tick. `{owner}/{repo}`
is the current repo. Run the `compare` call **only** for PRs that passed
checks 1 and 2 (not conflicting, CI green).

### Act on the repair

Let `<verb>` be the detected primitive and `<n>` the PR number.

- **`resolve`** → dispatch it via workflow dispatch. Stage → `resolve-auto`.
- **`fix-ci` / `sync` not graduated** → post one inert recommendation comment
  on PR `<n>` (use recommendation format below). Stage →
  `<verb>-recommended`.
- **`fix-ci` / `sync` graduated** → dispatch it via workflow dispatch. Stage →
  `<verb>-auto`.

Still honour the dedup ledger: never auto-run the same repair on the same PR
twice for the same fingerprint.

## Comment formats

**Operator handle.** The engine substitutes `{{mentions}}` (the duty's
`mentions:` frontmatter) on the recommendation's first line. Use the literal
token `{{mentions}}` below — never hardcode a handle or read it from config;
future operators only change the duty's `mentions:` list in the dashboard.

**Recommendation** (verb not graduated). One terse, machine-greppable comment.
MUST mention the operator on the first line when an operator handle is configured.
MUST NOT include a runnable `@kody ...` command or `kody-cmd` marker in the PR
comment; GitHub issue-comment events treat those as dispatch input. The dashboard
or operator can still choose the recommended action explicitly.

```
{{mentions}} 🧭 **CTO recommendation** — `<verb>`
<one or two sentences: what's wrong with PR #<n>.>
Recommended action: `<verb>` for PR #<n>.

_Confirm in the dashboard inbox or run the action manually. The CTO will not act on its own._
```

**Auto-run** (`resolve`, or graduated `fix-ci` / `sync`). Dispatch via
`workflow_dispatch`, then post a separate, silent audit-trail comment. It
**MUST NOT `@`-mention the operator** — auto mode means the duty acts without
interrupting them, and any operator mention routes straight into an inbox push,
defeating the point. Leave the mention out so the comment is a quiet record
only:

```
🧭 **CTO auto-ran** — `<verb>`

Ran `<verb>` on PR #<n> via workflow dispatch (<one-line reason>).
Policy: preview-health auto-runs `resolve` for merge conflicts, or the trust
ledger graduated `<verb>`.
```

This is a silent record, not a notification and not an ask — do not
@-mention, do not wait. `<verb>` is always one of `fix-ci`, `sync`,
`resolve`; the `kody-cmd` / dispatch line is a single line starting with
`@kody`.

## Allowed Commands

- `gh pr list --state open --limit 100 --json number,title,headRefName,headRefOid,baseRefName,isDraft,mergeable,statusCheckRollup,updatedAt`
  — the single enumeration call.
- `gh api repos/{owner}/{repo}/compare/{base}...{head} --jq .behind_by`
  — only for non-conflicting, CI-green PRs, to measure staleness for `sync`.
- `gh issue list --state open --label kody:cto-decisions --limit 5 --json number,body`
  — read the trust ledger once per tick.
- `gh pr comment <n> --body "..."` — the only write path: a recommendation
  comment, or (only when that verb is graduated) the `@kody <verb> --pr
  <n>` dispatch + its notify-only follow-up.

## Restrictions

The **Scope (hard limits)** section above applies in full. In addition,
per-tick:

- One comment per PR per tick, and only when the repair is **new**
  (fingerprint changed — see State). Re-posting every 15 minutes is the
  primary failure mode; the dedup ledger prevents it.
- Never call `gh` once per PR in a loop — one `pr list` drives the tick;
  the per-PR `compare` runs only for the healthy subset.

## State

`cursor`: always `"idle"` — phases are per-PR, not global.

`data`:

- `prs` (object) — keyed by PR number. Each value:
  - `fp` (string) — fingerprint = `"<verb>|<headRefOid>"`. The dedup key:
    only post a new comment when `fp` changes. Keyed on the branch head SHA,
    **not** `updatedAt` — our own `@kody <verb>` comment bumps `updatedAt`,
    which would make every acted-on PR re-fire next tick and starve the cap.
    The head SHA only moves when the branch actually changes (including a
    successful sync), which is exactly when the repair should re-evaluate.
  - `stage` (string) — one of: `fix-ci-recommended`, `sync-recommended`,
    `resolve-recommended`, `fix-ci-auto`, `sync-auto`, `resolve-auto`,
    `dismissed`.
  - `lastActAt` (ISO string) — when the last comment was posted.
    Diagnostic only.
- Prune entries for PRs no longer in the open list so `data` does not grow
  unbounded.

(Engine-managed fields like `lastFiredAt` live under `data` automatically;
do not write or rely on them from the prompt.)

`done`: always `false` — preview-health triage is evergreen.

## Tick output (MANDATORY)

End every tick with the fenced block below. **This is how the dedup
ledger persists** — without it, `data.prs` evaporates between ticks and
every recommendation re-fires on the next wake. Carry forward the prior
tick's `data.prs` entries, mutate the ones you acted on this tick, and
prune entries for PRs no longer in the open list.

```kody-job-next-state
{
  "cursor": "idle",
  "data": {
    "prs": {
      "<pr-number>": {
        "fp": "<verb>|<headRefOid>",
        "stage": "<verb>-recommended|<verb>-auto|dismissed",
        "lastActAt": "<iso>"
      }
    }
  },
  "done": false
}
```
