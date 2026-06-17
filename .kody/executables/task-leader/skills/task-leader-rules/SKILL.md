# Task Leader Rules

## Operator-tunable knobs

Read from `.kody/duties/task-leader/profile.json`:

- `readyPreviewCap` (default `15`) - max issues `status:ready-for-preview` before duty backs off.
- `smallChangeMaxLines` (default `200`) - total lines changed for a normal PR to be small.
- `smallChangeMaxFiles` (default `20`) - max changed files for a normal PR to be small.
- `staleReviewHours` (default `4`) - hours PR can sit without final approval before escalation.
- `blockAutoMergeLabel` (default `status:needs-review`) - linked issue label blocks auto-merge.
- `releaseAutoMergeTitlePrefix` (default `chore(release):`) - title prefix for release auto-merge lane.
- `releaseAutoMergeBranchPrefix` (default `release/v`) - branch prefix for release auto-merge lane.
- `releaseAutoMergeAllowedPaths` (default `package.json`, `pnpm-lock.yaml`, `CHANGELOG.md`) - exact changed files allowed for release auto-merge lane.
- `releasePromotionTitlePrefix` (default `chore(release): promote`) - required title prefix for production promotion lane.
- `dispatchComment` (default `@kody`) - bare token dispatches backlog issue.
- `tripwirePaths` - paths whose presence in normal PR diff disqualifies auto-merge.

Default tripwire paths:

- `db/`, `migrations/`, `prisma/`, `schema/`, `models/`
- `.github/`, `Dockerfile`, `package.json`
- `auth/`, `middleware/`

## Shared review freshness model

For every PR decision below, compute a freshness anchor before checking review,
fix, stale, approval, or merge state.

1. Latest PR head commit timestamp:

```sh
gh pr view <N> --json commits --jq '.commits[-1].committedDate'
```

2. Latest Kody PR comments/task-state events:

```sh
gh api repos/A-Guy-educ/A-Guy-Web/issues/<N>/comments --paginate \
  --jq '.[] | select(.user.login == "kodyade[bot]" or .user.login == "kodyade") | {created_at, body}'
```

3. Freshness anchor is the newest timestamp among:
   - latest PR head commit
   - latest `@kody fix`, `@kody resolve`, or `@kody sync`
   - latest `kody pushed`
   - latest task-state completion marker: `FIX_COMPLETED`, `RESOLVE_COMPLETED`, or `SYNC_COMPLETED`

Only verdicts after the freshness anchor are fresh. Verdicts before it are
stale: they must not satisfy review gates, must not block merge as current
concerns, and must not trigger another `@kody fix`. Stale verdicts should make
Step 2 request fresh review/UI-review.

For Kody comment timelines, read comments from `kodyade[bot]` / `kodyade`
containing `kody review started`, `kody ui-review started`, `## Verdict: PASS`,
`## Verdict: CONCERNS`, or `## Verdict: FAIL`.

## Step 1 - Queue cap check

Count open issues with label `status:ready-for-preview`:

```sh
gh issue list --state open --label status:ready-for-preview --json number --jq 'length'
```

If count >= `readyPreviewCap`, log "queue full, exiting" and stop. Do not run
any other step this tick.

## Step 2 - Request missing or stale reviews

For each open PR, check both review signals against the freshness anchor:

- Code review verdict: latest fresh completed Kody code review comment with
  `## Verdict: PASS` is passing. Fresh `CONCERNS`/`FAIL` belongs to Step 3.
  No fresh code-review verdict means missing/stale.
- UI review verdict: latest fresh completed Kody UI-review comment with
  `## Verdict: PASS` is passing. Fresh `CONCERNS`/`FAIL` belongs to Step 3.
  No fresh UI verdict means missing/stale.

Also read the GitHub review decision:

```sh
gh pr view <N> --json reviewDecision -q .reviewDecision
```

Treat `APPROVED` as final GitHub approval. Do not confuse Kody PASS comments
with GitHub approval; PASS comments are evidence task-leader may use in Step 4
to approve safe PRs with the separate review token.

If a Kody verdict is missing or stale, dispatch executable directly. Do not post
`@kody review` or `@kody ui-review` comments; Kody bot comments are ignored by
the dispatcher.

- If code review is missing/stale and no in-flight `review` run exists after the freshness anchor:
  `gh workflow run kody.yml -f executable=review -f issue_number=<N>`
- If UI review is missing/stale and no in-flight `ui-review` run exists after the freshness anchor:
  `gh workflow run kody.yml -f executable=ui-review -f issue_number=<N>`

Before dispatching, check PR comments and recent workflow runs to avoid duplicates:

```sh
gh pr view <N> --comments --json comments --jq '.comments[].body'
gh run list --workflow kody.yml --event workflow_dispatch --limit 50
```

## Step 3 - Request fixes for fresh PR concerns

For each open PR, check if either:

- `reviewDecision` equals `CHANGES_REQUESTED`
- PR has unresolved review threads
- latest fresh completed Kody code-review or UI-review comment says `## Verdict: CONCERNS` or `## Verdict: FAIL`

A stale `CONCERNS`/`FAIL` before the freshness anchor means review is stale; do
not request another fix for it. Step 2 should request a fresh review/UI-review.

Useful command:

```sh
gh api repos/A-Guy-educ/A-Guy-Web/issues/<N>/comments --paginate \
  --jq '.[] | select(.user.login == "kodyade[bot]" or .user.login == "kodyade") | {created_at, body}'
```

If a fresh concern exists and no `@kody fix`, `@kody resolve`, `kody pushed`, or
task completion marker was posted since that concern, post:

```sh
gh pr comment <N> --body "@kody fix"
```

## Step 4 - Auto-merge safe PRs

For each open PR, first check common merge gates:

1. All required CI checks pass: `gh pr checks <N>`.
2. PR's linked issue does not have label `blockAutoMergeLabel`.

```sh
gh pr view <N> --json closingIssuesReferences
```

For each referenced issue, check labels:

```sh
gh issue view <M> --json labels
```

3. `reviewDecision` is not `CHANGES_REQUESTED`.
4. PR has no unresolved review threads.
5. Latest fresh completed Kody code-review verdict is `PASS`.
6. Latest fresh completed Kody UI-review verdict is `PASS`.
7. No required verdict is missing or stale; Step 2 handles missing/stale verdicts.

After common gates pass, use exactly one lane below.

### Lane A - Normal Small PR

All following must be true:

1. PR's diff is small:

```sh
gh pr view <N> --json additions,deletions,changedFiles
```

Total additions + deletions <= `smallChangeMaxLines`, and changedFiles <=
`smallChangeMaxFiles`.

2. PR's changed files do not touch any path in `tripwirePaths`:

```sh
gh pr view <N> --json files --jq '.files[].path'
```

For each file, check it does not start with any tripwire path.

3. If `reviewDecision` is not `APPROVED`, approve with a separate reviewer token:

```sh
TASK_LEAD_GH_TOKEN="$(node -e 'const s = JSON.parse(process.env.ALL_SECRETS || "{}"); process.stdout.write(process.env.TASK_LEAD_REVIEW_TOKEN || s.GH_PAT || "")')"
test -n "$TASK_LEAD_GH_TOKEN"
GH_TOKEN="$TASK_LEAD_GH_TOKEN" gh pr review <N> --approve --body "Approved by task-leader: fresh Kody code and UI reviews passed, CI is green, and normal small-PR gates passed."
```

Do not print `TASK_LEAD_GH_TOKEN`. If token is missing or approval fails, do not
merge. Skip Step 6 duplicate reminders if an approval failure was already
reported after the freshness anchor; otherwise escalate the exact approval
error once.

4. After approval succeeds or `reviewDecision` is already `APPROVED`, run:

```sh
gh pr merge <N> --squash --delete-branch=false
```

### Lane B - Release Version PR

This lane exists only for PRs generated by `release` duty. It may bypass code/UI
review and small-change limits because changed files are constrained. All
following must be true:

1. PR title starts `releaseAutoMergeTitlePrefix`:

```sh
gh pr view <N> --json title --jq .title
```

2. PR head branch starts with `releaseAutoMergeBranchPrefix`:

```sh
gh pr view <N> --json headRefName --jq .headRefName
```

3. PR body contains `Tracking-Issue: #`:

```sh
gh pr view <N> --json body --jq .body
```

4. PR is not a production promotion PR. Read `.kody/variables.json`
`RELEASE_FLOW`; if `integrationBranch` differs from `productionBranch`, release
auto-merge is allowed only when PR base branch equals `integrationBranch`, never
when base branch equals `productionBranch`.
5. Every changed file exactly matches an item in `releaseAutoMergeAllowedPaths`:

```sh
gh pr view <N> --json files --jq '.files[].path'
```

If Lane B passes, run:

```sh
gh pr merge <N> --squash --delete-branch=false
```

### Lane C - Release Promotion PR

This lane exists only for final production promotion PRs created by `release`
duty. It may approve and merge because the release version PR already merged
into integration branch and this PR only promotes integration to production.
All following must be true:

1. Read `.kody/variables.json` `RELEASE_FLOW`; `integrationBranch` must differ from `productionBranch`.
2. PR title starts `releasePromotionTitlePrefix`:

```sh
gh pr view <N> --json title --jq .title
```

3. PR head branch equals `integrationBranch` and base branch equals `productionBranch`:

```sh
gh pr view <N> --json headRefName,baseRefName
```

4. PR is not draft, mergeable, and has no changes requested or unresolved review threads.
5. All required CI checks pass: `gh pr checks <N>`.
6. GitHub Release named in PR title exists. Extract `vX.Y.Z` from title and verify:

```sh
gh release view vX.Y.Z
```

If Lane C passes and `reviewDecision` is `REVIEW_REQUIRED`, approve it:

```sh
gh pr review <N> --approve --body "Approved by task-leader release promotion gate."
```

If GitHub rejects approval because Kody is PR author, retry once with separate
reviewer token `TASK_LEAD_REVIEW_TOKEN`, falling back to `ALL_SECRETS.GH_PAT`:

```sh
TASK_LEAD_GH_TOKEN="$(node -e 'const s = JSON.parse(process.env.ALL_SECRETS || "{}"); process.stdout.write(process.env.TASK_LEAD_REVIEW_TOKEN || s.GH_PAT || "")')"
test -n "$TASK_LEAD_GH_TOKEN"
GH_TOKEN="$TASK_LEAD_GH_TOKEN" gh pr review <N> --approve --body "Approved by task-leader release promotion gate."
```

Do not print `TASK_LEAD_GH_TOKEN`. If token is missing or retry fails, skip merge
and escalate the exact approval error once. Merge without deleting integration
branch:

```sh
gh pr merge <N> --merge --delete-branch=false
```

If all lanes fail, skip PR and log why.

## Step 5 - Dispatch next backlog task

Re-count `status:ready-for-preview`. If still < `readyPreviewCap`:

1. Find highest-priority open issue with no PR, label `status:verified`, without labels `status:needs-human`, `status:blocked`, or `status:ready-for-preview`:

```sh
gh issue list --state open --label status:verified --json number,title,labels --limit 100
```

2. Sort by priority label: P0 > P1 > P2 > P3, oldest first within same priority.
3. Post dispatch comment on first match:

```sh
gh issue comment <N> --body "<dispatchComment>"
```

If no matching issue exists, log "no eligible backlog task".

## Step 6 - Escalate stale PRs

For each open PR, check if it has been open longer than `staleReviewHours` and
does not have final GitHub approval/merge. Escalation is the last resort, not a
replacement for automation:

- Do not escalate a PR that Step 2, Step 3, or Step 4 acted on during this tick.
- Do not escalate while a fresh review, UI-review, fix, sync, or resolve run is in flight.
- Do not escalate when the latest review/UI verdict is missing or stale; Step 2 should dispatch first.
- Do not escalate when the latest fresh verdict is `CONCERNS` or `FAIL`; Step 3 should request fix first.
- Do not post a duplicate stale-review reminder if one already exists after the latest freshness anchor, or if one was posted in the last `staleReviewHours`.

If the only remaining blocker is human/operator approval after fresh passing
reviews and green checks, post one comment mentioning operator(s):

```sh
gh pr comment <N> --body "<@operator1, @operator2> this PR has fresh passing reviews and green checks, but still needs approval/merge."
```

Get operator list from `operators` field in `kody.config.json`.

## Final output

When invoked through standalone `task-leader` executable, final message must use
this exact format:

```text
DONE PR_SUMMARY:
- step1: queue count = <N>
- step2: reviews requested = <N>
- step3: fixes requested = <N>
- step4: approvals = <N> (list PR numbers)
- step4: merges = <N> (list PR numbers)
- step5: dispatches = <N> (list issue numbers)
- step6: escalations = <N> (list PR numbers)
```

If a step errors fatally, output:

```text
FAILED: <step name> - <error>
```

When invoked through scheduled `duty-tick`, obey duty-tick output contract
instead: call `submit_state` exactly once with `cursor: "idle"`, carried-forward
`data`, and `done: false`.
