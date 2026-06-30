#!/usr/bin/env bash
set -euo pipefail

deploy_worktree=""
goal_id="${KODY_ARG_GOAL:-}"
failure_reported=0

fail() {
  echo "FAILED: $1"
  emit_goal_failure "$1" || true
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Missing command: $1"
  fi
}

emit_goal_report() {
  local evidence="$1"
  shift
  [[ -z "$goal_id" ]] && return 0
  python3 - "$goal_id" "$evidence" "$@" <<'PY'
import json
import sys

goal_id = sys.argv[1]
evidence = sys.argv[2]
facts = {}
for pair in sys.argv[3:]:
    key, value = pair.split("=", 1)
    if value == "":
        continue
    facts[key] = int(value) if value.isdigit() else value

print("KODY_CAPABILITY_REPORT=" + json.dumps({
    "target": {"type": "goal", "id": goal_id},
    "evidence": {evidence: True},
    "facts": facts,
}, separators=(",", ":")))
print("KODY_CAPABILITY_RESULT=" + json.dumps({
    "version": 1,
    "status": "pass",
    "summary": f"{evidence} reported",
    "facts": facts,
}, separators=(",", ":")))
PY
}

emit_goal_failure() {
  local summary="$1"
  [[ -z "$goal_id" ]] && return 0
  [[ "$failure_reported" = "1" ]] && return 0
  failure_reported=1
  command -v python3 >/dev/null 2>&1 || return 0
  python3 - "$summary" <<'PY'
import json
import sys

summary = sys.argv[1]
print("KODY_CAPABILITY_RESULT=" + json.dumps({
    "version": 1,
    "status": "fail",
    "summary": summary,
    "facts": {},
}, separators=(",", ":")))
PY
}

on_error() {
  local status="$1"
  emit_goal_failure "Vercel production deploy failed with exit ${status}" || true
}

trap 'on_error "$?"' ERR

require_command git
require_command node
require_command curl

vercel_cmd=(vercel)
if ! command -v vercel >/dev/null 2>&1; then
  require_command npx
  vercel_cmd=(npx -y -p vercel@54.10.2 vercel)
fi

variable_value() {
  node -e '
    const fs = require("fs")
    const name = process.argv[1]
    try {
      const doc = JSON.parse(fs.readFileSync(".kody/variables.json", "utf8"))
      const value = doc.variables?.[name]?.value
      if (typeof value === "string") process.stdout.write(value)
    } catch {}
  ' "$1"
}

value_or_variable() {
  local env_value="$1"
  local variable_name="$2"
  local default_value="${3:-}"

  if [ -n "$env_value" ]; then
    printf '%s' "$env_value"
    return
  fi

  local variable
  variable="$(variable_value "$variable_name")"
  if [ -n "$variable" ]; then
    printf '%s' "$variable"
    return
  fi

  printf '%s' "$default_value"
}

SCOPE="$(value_or_variable "${VERCEL_SCOPE:-}" "VERCEL_SCOPE")"
DEPLOY_BRANCH="$(value_or_variable "${VERCEL_PRODUCTION_BRANCH:-}" "VERCEL_PRODUCTION_BRANCH" "${KODY_CFG_RELEASE_RELEASEBRANCH:-main}")"
VERCEL_ORG_ID="$(value_or_variable "${VERCEL_ORG_ID:-}" "VERCEL_ORG_ID")"
VERCEL_PROJECT_ID="$(value_or_variable "${VERCEL_PROJECT_ID:-}" "VERCEL_PROJECT_ID")"
PRODUCTION_URL="$(value_or_variable "${PRODUCTION_URL:-}" "PRODUCTION_URL" "${KODY_CFG_RELEASE_PRODUCTIONURL:-}")"
SMOKE_COMMAND="${KODY_CFG_RELEASE_SMOKECOMMAND:-}"
export VERCEL_ORG_ID VERCEL_PROJECT_ID

token="${VERCEL_ACCESS_TOKEN:-${VERCEL_TOKEN:-}}"
if [ -z "$token" ]; then
  fail "Kody secret VERCEL_ACCESS_TOKEN is required"
fi

if [ -z "$VERCEL_ORG_ID" ]; then
  fail "Kody secret VERCEL_ORG_ID is required"
fi

if [ -z "$VERCEL_PROJECT_ID" ]; then
  fail "Kody secret VERCEL_PROJECT_ID is required"
fi

tmp_json="$(mktemp)"
workspace_root="$(pwd)"
cleanup() {
  rm -f "$tmp_json"
  if [ -n "$deploy_worktree" ]; then
    git worktree remove --force "$deploy_worktree" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

git fetch origin "$DEPLOY_BRANCH"
deploy_worktree="$(mktemp -d)"
git worktree add --detach "$deploy_worktree" "origin/${DEPLOY_BRANCH}"
cd "$deploy_worktree"

current_branch="$DEPLOY_BRANCH"
release_version="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync("package.json","utf8")); process.stdout.write(String(data.version || ""))')"
vercel_args=(--token "$token")
if [ -n "$SCOPE" ]; then
  vercel_args=(--scope "$SCOPE" "${vercel_args[@]}")
fi

echo "Deploying ${current_branch} to Vercel production..."
if ! "${vercel_cmd[@]}" deploy --prod --yes --format=json "${vercel_args[@]}" | tee "$tmp_json"; then
  fail "Vercel production deploy command failed"
fi

deployment_url="$(
  # shellcheck disable=SC2016
  node -e '
    const fs = require("fs")
    const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
    const deployment = data.deployment && typeof data.deployment === "object" ? data.deployment : {}
    const url = data.url || deployment.url || data.inspectorUrl || deployment.inspectorUrl || ""
    if (!url) throw new Error("Vercel deploy output did not include a deployment URL")
    console.log(url.startsWith("http") ? url : `https://${url}`)
  ' "$tmp_json"
)"

curl -fsSL --max-time 30 "$deployment_url" >/dev/null || fail "Production deployment URL is not reachable: ${deployment_url}"

if [ -n "$PRODUCTION_URL" ]; then
  curl -fsSL --max-time 30 "$PRODUCTION_URL" >/dev/null || fail "Production URL is not reachable: ${PRODUCTION_URL}"
fi

smoke_status="skipped"
if [ -n "$SMOKE_COMMAND" ]; then
  smoke_status="failed"
  export PRODUCTION_URL
  if [ -n "$PRODUCTION_URL" ]; then
    export SMOKE_BASE_URLS="${SMOKE_BASE_URLS:-$PRODUCTION_URL}"
  fi
  if (cd "$workspace_root" && timeout "$(( ${KODY_CFG_RELEASE_TIMEOUTMS:-600000} / 1000 ))" bash -c "$SMOKE_COMMAND"); then
    smoke_status="passed"
  else
    fail "Production smoke command failed"
  fi
fi

emit_goal_report "productionDeployed" "version=${release_version}" "productionDeploymentUrl=${deployment_url}" "productionBranch=${current_branch}" "productionUrl=${PRODUCTION_URL}" "smoke=${smoke_status}"

cat <<RESULT
DONE
PR_SUMMARY:
- Deployed ${current_branch} (${release_version}) to Vercel production.
- Production deployment URL: ${deployment_url}.
${PRODUCTION_URL:+- Production URL: ${PRODUCTION_URL}.}
${SMOKE_COMMAND:+- Smoke command: ${smoke_status}.}
RESULT
