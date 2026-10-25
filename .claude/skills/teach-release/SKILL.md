---
name: teach-release
description: Cut and ship a Teacher release end-to-end. Prepares a release PR into dev (version bump + CHANGELOG), promotes dev → main, runs vercel --prod, tags, and verifies the new version is live at teacher.aguy.co.il. Use when the user says "release teacher", "cut a teacher release", "ship a teacher version", or asks to promote teacher dev to prod.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Teacher Release Skill

Sibling of `web-release`, `admin-release` and `dash-release` — same pipeline shape, different targets. Forked from [`../../../../A-Guy-Dash/.claude/skills/dash-release/SKILL.md`](../../../../A-Guy-Dash/.claude/skills/dash-release/SKILL.md) because Teacher has the same shape as Dash: no DB, no auth code, no Docker, Vercel only.

**Finish line:** a new semver tag lands on `main`, `vercel --prod` completes, and [teacher.aguy.co.il](https://teacher.aguy.co.il) responds with the new deployment. Only Vercel serves Teacher — no Render, no Docker step.

**Cross-repo context lives in [`../../../../CLAUDE_SHARED.md`](../../../../CLAUDE_SHARED.md).** Read it before running for the first time — Vercel auto-deploy is OFF and the alias/scope gotchas will bite you.

**Trust boundary:** Teacher has NO database access, NO auth code, NO secrets. All data comes from A-Guy-Web APIs with the session cookie forwarded. If a code change under review touches MongoDB, `PAYLOAD_SECRET`, `DATABASE_URL`, or JWT verification, that's a violation of [`AGENTS.md`](../../../AGENTS.md) — halt and surface to the user before releasing.

**Shell commands:** per `AGENTS.md`, prefix shell commands with `rtk` where it is installed.

---

## Preconditions

Run all of these before starting. If any fails, stop and surface the error to the user.

```bash
# 1. Right repo, right dir
test -f kody.config.json || { echo "Not in A-Guy-Teacher root"; exit 1; }
grep -q '"name": "a-guy-teacher"' package.json || { echo "package.json doesn't look like the Teacher repo"; exit 1; }

# 2. Correct GitHub identity (default account has no repo access)
gh auth switch --user aguyshayb

# 3. Vercel CLI is logged in to the aguy team scope, and this checkout is linked
vercel whoami   # expect "aguyshayb-6573"
test -f .vercel/project.json || echo "Not linked — run 'vercel link --scope aguy' and pick the Teacher project (confirm the project name with the user first)"

# 4. Working tree clean (no untracked release artifacts)
git status --porcelain

# 5. Trust boundary intact — no forbidden imports crept in
grep -rE "from ['\"]mongodb['\"]|require\(['\"]mongodb['\"]\)|PAYLOAD_SECRET|DATABASE_URL|verifyJWT|jsonwebtoken|payload/dist" src/ && { echo "Trust boundary violation — Teacher must not touch DB/auth"; exit 1; } || true
```

---

## Stage 0 — Pre-flight review

**Always run this before Stage 1.** Report findings to the user and wait for a go/no-go decision before proceeding.

### 0a. Collect the commit set

Teacher's `main` still carries A-Guy-Web's history from before the split, including Web's own `chore: release v0.33.1` commits. Those are NOT Teacher releases. Only look for release commits after the split boundary (`refactor: Replace Web clone with thin Teacher boundary (#17)`, `c08daab41`).

```bash
git fetch origin dev main
SPLIT_SHA=$(git log origin/main --grep="Replace Web clone with thin Teacher boundary" --format="%H" -n 1)
LAST_RELEASE_SHA=$(git log "${SPLIT_SHA}..origin/main" --grep="^chore: release v" --format="%H" -n 1)
# First Teacher release — no release commit since the split. Walk from the split.
if [ -z "$LAST_RELEASE_SHA" ]; then
  LAST_RELEASE_SHA="$SPLIT_SHA"
  echo "First Teacher release — walking history from the split commit."
fi
COMMITS=$(git log --format="%H %s" "${LAST_RELEASE_SHA}..origin/dev")
FILES_CHANGED=$(git diff --name-only "${LAST_RELEASE_SHA}..origin/dev")
```

### 0b. Classify commits (with compound-prefix unwrap)

Kody's convention prefixes everything with `chore:` even when the underlying change is `feat`/`fix` (e.g., `chore: feat(dashboard): ...`). Unwrap before classifying:

```javascript
// pseudocode — Claude applies this per commit subject
function classify(subject) {
  const unwrapped = subject.replace(
    /^chore(\([^)]*\))?:\s+(?=(feat|fix|perf|refactor|docs|build|test|style|ci|chore)[!(:])/,
    '',
  )
  const m = unwrapped.match(
    /^(feat|fix|perf|refactor|docs|build|test|style|ci|chore)(\([^)]*\))?(!)?:/,
  )
  if (!m) return 'unknown' // ← surface these, don't silently drop
  const [, type, , breaking] = m
  if (breaking) return 'major'
  if (type === 'feat') return 'minor'
  if (['fix', 'perf', 'refactor', 'docs', 'build'].includes(type)) return 'patch'
  return 'none' // chore/test/style/ci
}
```

Also scan commit **bodies** for `BREAKING CHANGE:` — footer-declared breaks override subject classification to `major`.

### 0c. Findings to report

Print a compact markdown review to the user covering:

1. **Version proposal** — `CURRENT → NEXT` and which commits drove the highest bump.
   - **First-release note:** if `package.json` is `0.1.0` and this is the first Teacher release, propose `0.2.0` (minor) unless the commit set contains only `chore:`/`ci:`/`test:` (then `0.1.1`).
2. **Unknown-classification commits** — subjects that didn't match any prefix. `Merge pull request #NNN from ...` merges usually fall here; flag anything else so it doesn't drop from the CHANGELOG.
3. **Breaking-change candidates** — any `feat!:`, `fix!:`, or `BREAKING CHANGE:` mention.
4. **Sensitive-path touches** — grep `FILES_CHANGED` for any of:
   - `src/server/aguy-api.ts` (the Web-API client — a bug here breaks every page and logout)
   - `src/config/runtime-origins.ts` (origin resolution — a bug here can point QA at prod or loop back to Teacher)
   - `next.config.ts` (Teacher must not proxy to Web — flag any rewrite that comes back)
   - `src/types/**` (Zod contracts — see `0d`)
   - `src/app/api/**/route.ts` (proxy routes — health, logout, and any Teacher-owned API)
   - `src/middleware.ts` (if it exists)
   - `.env.example` or any `*.env*` file
   - `AGENTS.md` (repo contract — changes here need explicit user sign-off)
   - `package.json` dependencies (not the version line)

   For each match, name the file + the PR/commit.
5. **Env-var deltas** — grep for new `process.env.<VAR>` reads not on `main`. Vercel snapshots env vars at deploy-creation, so new variables must be added to the Vercel project dashboard **before** Stage 4. Teacher's current env surface: `AGUY_WEB_URL` (alias `AGUY_WEB_ORIGIN`), `AGUY_API_URL`, `TEACHER_PUBLIC_URL`.
6. **Trust-boundary violations** — re-run the preconditions grep against `FILES_CHANGED`. Halt on any hit.
7. **Open PRs targeting `dev` or `main`** — `gh pr list --base dev --state open` and `--base main`. A promotion PR conflicts if someone else has an open `dev → main` PR. Kody's release pilot can also open its own `release/v*` PRs — if one is open, ask the user whether to close it before opening ours, so two release PRs don't race.
8. **CI health of `dev` HEAD** — `gh run list --branch dev --limit 5 --json name,conclusion,headSha`. Releasing on top of a red or in-flight run ships broken.
9. **Version drift** — compare `package.json` version, the latest post-split `chore: release v` commit on `main`, and `git tag --sort=-v:refname | head -1`. Note any mismatch.
10. **Dependency changes** — `git diff LAST_RELEASE_SHA..origin/dev -- package.json pnpm-lock.yaml`. Special attention to `@a-guy/ui` and `@a-guy/api-client` bumps — those come from `A-Guy-Shared` and are the coupling point with the platform.

### 0d. Upstream contract drift (Teacher-specific)

Teacher's Zod schemas under [`src/types/`](../../../src/types/) mirror response contracts owned by A-Guy-Web. If a required field is added here before Web emits it, `parse` rejects every response and the page errors.

```bash
SCHEMA_CHANGED=$(git diff "${LAST_RELEASE_SHA}..origin/dev" -- src/types/ | grep -c "^+")

if [ "$SCHEMA_CHANGED" -gt 0 ]; then
  echo "⚠ Zod/type schema changed. Verify Web is emitting the new/changed field:"
  echo "  1. Find new field names and the endpoint each schema parses"
  echo "  2. Grep ../A-Guy-Web/src/ for the producer of that endpoint"
  echo "  3. Confirm Web's producer is deployed to prod (not just merged), or"
  echo "     that the schema field is .optional()/.default(...)"
fi
```

Report which fields changed, whether Web appears to emit them, and whether they're optional. **Halt if a required field was added without evidence Web ships it in production.**

### 0e. Decision gate

Print the review as a compact markdown summary and **wait for explicit confirmation** before running Stage 1. Do NOT auto-proceed even if every check is green.

---

## Stage 1 — `release-prepare`

### 1a. Sync `dev`

```bash
git fetch origin dev
git checkout dev
git pull origin dev
```

### 1b. Determine the next version

Reuse the classifier from Stage 0b. Highest-priority bump wins. If every commit classifies as `none`, still ship a patch.

```bash
NEXT=<computed>
node -e "const fs=require('fs');const p=require('./package.json');p.version='$NEXT';fs.writeFileSync('./package.json', JSON.stringify(p,null,2)+'\n');"
```

### 1c. Update the CHANGELOG

Teacher's `CHANGELOG.md` already exists with an `## [Unreleased]` section that Kody appends to per PR. Turn it into the release section:

- Rename `## [Unreleased]` to `## vX.Y.Z — YYYY-MM-DD` (em-dash, ISO date), and add a fresh empty `## [Unreleased]` above it.
- Group the entries under `### Features`, `### Bug Fixes`, `### Performance`, `### Refactor`, `### Docs`. Skip empty sections. Keep the PR links and authors.
- Add any classified commits from Stage 0 that Kody didn't list.
- If only `chore:`/`ci:`/`test:` commits, write `_Maintenance-only release._`.

### 1d. Open the release PR

```bash
BRANCH="release/v${NEXT}"
git checkout -b "$BRANCH"
git add package.json CHANGELOG.md
git commit -m "chore: release v${NEXT}" -m "Bumps package.json to ${NEXT} and updates CHANGELOG."
git push -u origin "$BRANCH"

gh pr create \
  --base dev \
  --head "$BRANCH" \
  --title "chore: release v${NEXT}" \
  --body "$(cat <<EOF
Release PR opened by the teach-release skill.

## v${NEXT} — $(date +%Y-%m-%d)

<paste the CHANGELOG section here>

The skill will merge this into \`dev\`, then open a promotion PR into \`main\`, then run \`vercel --prod\`.
EOF
)"
```

Capture the PR number as `RELEASE_PR`.

---

## Stage 2 — `release-merge`

```bash
gh pr checks "$RELEASE_PR" --watch --interval 15
gh pr merge "$RELEASE_PR" --squash --delete-branch
```

If CI fails, invoke `@kody fix-ci` on the PR and re-watch — do not merge with red checks.

---

## Stage 3 — `release-promote`

```bash
git fetch origin dev main
git checkout dev
git pull origin dev

gh pr create \
  --base main \
  --head dev \
  --title "promote: dev -> main (v${NEXT})" \
  --body "$(cat <<EOF
Release promotion PR opened by the teach-release skill — promotes \`dev\` to \`main\` for release **v${NEXT}**.

<!-- kody-changelog-start -->
## What's changing in v${NEXT}

<paste the CHANGELOG section again>
<!-- kody-changelog-end -->

Merge this PR to promote v${NEXT} to \`main\`.
EOF
)"
```

Capture as `PROMOTE_PR`. Wait for checks and merge with a **merge commit** (not squash — this preserves the promotion boundary that Stage 0a walks back to):

```bash
gh pr checks "$PROMOTE_PR" --watch --interval 15
gh pr merge "$PROMOTE_PR" --merge
```

Teacher has no `vercel-deploy.yml` workflow — merging to `main` does NOT trigger a deploy. Stage 4 is what ships.

---

## Stage 4 — `vercel-production-deploy`

### 4a. Ensure the local checkout is at the tip of `main`

```bash
git checkout main
git pull origin main
```

### 4b. Run `vercel --prod`

```bash
vercel --prod --yes
```

`vercel --prod --yes` builds AND aliases in one step. **Do NOT** run `vercel alias` after this. **NEVER** alias a preview build to `teacher.aguy.co.il`.

Production needs no Teacher env vars — `runtime-origins.ts` falls back to the canonical `aguy.co.il` origins. Preview/QA deployments throw at build time if `AGUY_WEB_URL`, `AGUY_API_URL` and `TEACHER_PUBLIC_URL` are missing; that's intended.

Confirm the alias landed:

```bash
vercel inspect <deploy-url> --scope aguy   # should show teacher.aguy.co.il in the aliases list
```

---

## Stage 5 — Tag & GitHub release

Teacher has no tags yet. The first run creates the first one:

```bash
git tag -a "v${NEXT}" -m "Release v${NEXT}"
git push origin "v${NEXT}"

gh release create "v${NEXT}" \
  --title "v${NEXT}" \
  --notes "$(sed -n "/^## v${NEXT} /,/^## /p" CHANGELOG.md | sed '$d')" \
  --target main
```

---

## Stage 6 — Verify on production

Both steps are required — "merged to main + `vercel --prod` returned" is not "shipped."

### 6a. Smoke

```bash
# Teacher-owned health route — must be served by Teacher, not proxied
curl -sS https://teacher.aguy.co.il/api/health

# / without a cookie should redirect to Web's login (Next redirect() → 307)
curl -sI https://teacher.aguy.co.il/ | grep -iE "^(HTTP|location)"

# /api/logout should return 405 for GET (POST-only)
curl -sI https://teacher.aguy.co.il/api/logout | head -1

# Teacher proxies nothing to Web, so an unknown route is Teacher's own 404
curl -sI https://teacher.aguy.co.il/login | head -1
```

Expected outcomes:

- `/api/health` → 200 with `"service":"A-Guy Teacher"` and `"status":"ok"`
- `/` → 307 (or 302) with `location: https://www.aguy.co.il/login?returnTo=https%3A%2F%2Fteacher.aguy.co.il%2F`
- `/api/logout` → 405
- `/login` → 404 (a 200 means a Web pass-through came back)

Anything else (500, 502, 504, a redirect loop back to `teacher.`) is a fail.

### 6b. Deploy identity

```bash
curl -sSI https://teacher.aguy.co.il/api/health | grep -i "x-vercel-id"
```

If it matches an older prod deploy, the alias didn't repoint — re-run Stage 4b.

---

## Stage 7 — Close the loop

If a Kody goal issue is open, comment on it and close it:

```bash
GOAL_ISSUE=$(gh issue list --search "teach-release-$(date +%Y-%m-%d) in:body" --state open --json number --jq '.[0].number')

if [ -n "$GOAL_ISSUE" ]; then
  gh issue comment "$GOAL_ISSUE" --body "✅ v${NEXT} shipped: promotion PR #${PROMOTE_PR} merged, \`vercel --prod\` succeeded, smoke passed against teacher.aguy.co.il."
  gh issue close "$GOAL_ISSUE" --reason completed
fi
```

Update the auto-memory's last-known-shipped-version note so the next session sees the fresh baseline.

---

## Failure handling

| Stage fails at                      | Action                                                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Preconditions                       | Surface the exact command that failed, do not proceed                                                                        |
| Stage 0 trust boundary              | Halt. AGENTS.md violation needs explicit user override                                                                       |
| Stage 0 upstream contract drift     | Halt. Coordinate with a Web release, or make the new schema field optional                                                   |
| Stage 1 / Stage 3 CI                | Comment `@kody fix-ci` on the PR, re-watch, then merge                                                                       |
| Stage 4 `vercel --prod` build error | Read the build log, fix on `dev`, re-promote, re-deploy — do NOT alias a broken build                                        |
| Stage 6 smoke fails                 | Roll back via `vercel rollback` (find the prior prod deploy with `vercel ls --prod --scope aguy`) and open a bug issue       |
| Stage 6 x-vercel-id mismatch        | Re-run `vercel --prod --yes` from `main`, or `vercel alias <deploy-url> teacher.aguy.co.il --scope aguy` and re-verify       |

---

## Non-negotiables

- **Never alias a preview build to `teacher.aguy.co.il`.**
- **Never skip Stage 0 or Stage 6.**
- **Never squash-merge the promotion PR.**
- **Never bump `package.json` on `dev` without opening a release PR.**
- **Never push or PR directly to `main`.** The `promote: dev -> main` PR in Stage 3 is the ONLY thing that ever targets `main`.
- **Never add DB/auth/secrets to Teacher.**
- **Stage files by name** — never `git add -A`.

---

## Keeping this in sync

Pipeline logic (Stages 0–7) is meant to stay identical across `web-release`, `admin-release`, `dash-release` and this skill. Teacher's differences from Dash:

- **Release baseline** — `main` carries pre-split Web release commits; Stage 0a only counts release commits after the split (#17).
- **CHANGELOG** — already exists with a Kody-maintained `[Unreleased]` section; Stage 1c promotes it instead of creating a file.
- **Smoke** — adds `/api/health` and a check that nothing is proxied to Web.
- **Sensitive paths** — adds `next.config.ts` (the rewrite) and `runtime-origins.ts`.

When a sibling skill improves, port the change here.
