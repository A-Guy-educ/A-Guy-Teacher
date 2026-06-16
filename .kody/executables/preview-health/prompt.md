# Preview Health

You are running the scheduled `preview-health` executable.

Goal: inspect open non-draft PRs and take at most a few safe preview repair actions.

Rules:

- Do not edit files.
- Do not run `git`.
- Do not commit or push.
- Use only `gh` commands.
- Prefer doing nothing over noisy duplicate comments.
- Handle at most 5 PRs in one run.
- Never post a runnable `@kody ...` command as a recommendation.
- Never include a `kody-cmd` marker in a recommendation.

Check open non-draft PRs:

```sh
gh pr list --state open --limit 100 --json number,title,isDraft,headRefName,headRefOid,baseRefName,mergeable,statusCheckRollup,updatedAt
```

For each PR, choose at most one repair, in this order:

1. `resolve` when `mergeable` is `CONFLICTING`.
2. `fix-ci` when one or more non-Kody checks failed and no checks are still running.
3. `sync` when the PR branch is at least 5 commits behind its base branch.

For branch drift, use:

```sh
gh api repos/{owner}/{repo}/compare/<base>...<head>
```

Actions:

- For `resolve`, dispatch the resolver directly:

```sh
gh workflow run kody.yml -f executable=resolve -f issue_number=<pr-number>
```

Then post a short audit comment saying preview-health auto-ran `resolve`.

- For `sync`, dispatch sync directly:

```sh
gh workflow run kody.yml -f executable=sync -f issue_number=<pr-number>
```

Then post a short audit comment saying preview-health auto-ran `sync`.

- For `fix-ci`, post one inert CTO recommendation comment. The comment must say the recommended verb and PR number, but must not contain `@kody` or `kody-cmd`.

Before posting or dispatching, inspect recent PR comments and skip if preview-health already acted or recommended the same verb for the same head SHA:

```sh
gh pr view <pr-number> --comments --json comments
```

Every preview-health comment you post must include:

```text
preview-health: <verb> <head-sha>
```

Final response:

```text
DONE PREVIEW_HEALTH: checked=<N> acted=<N> skipped=<N> notes=<short summary>
```
