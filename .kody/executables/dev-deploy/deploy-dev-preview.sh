#!/usr/bin/env bash
set -euo pipefail

ALLOW_NON_DEV_DEPLOY="${ALLOW_NON_DEV_DEPLOY:-0}"
ORIGINAL_BRANCH=""

fail() {
  echo "FAILED: $1"
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Missing required command: $1"
  fi
}

require_command git
require_command node
require_command vercel

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

ALIAS_HOST="$(value_or_variable "${DEV_PREVIEW_ALIAS:-}" "DEV_PREVIEW_ALIAS" "a-guy-dev-aguy.vercel.app")"
TARGET="$(value_or_variable "${VERCEL_TARGET:-}" "VERCEL_TARGET" "preview")"
SCOPE="$(value_or_variable "${VERCEL_SCOPE:-}" "VERCEL_SCOPE" "aguy")"
REQUIRED_BRANCH="$(value_or_variable "${DEV_PREVIEW_BRANCH:-}" "DEV_PREVIEW_BRANCH" "main")"
VERCEL_ORG_ID="$(value_or_variable "${VERCEL_ORG_ID:-}" "VERCEL_ORG_ID")"
VERCEL_PROJECT_ID="$(value_or_variable "${VERCEL_PROJECT_ID:-}" "VERCEL_PROJECT_ID")"
export VERCEL_ORG_ID VERCEL_PROJECT_ID

if [ -z "${VERCEL_ACCESS_TOKEN:-${VERCEL_TOKEN:-}}" ]; then
  fail "VERCEL_ACCESS_TOKEN is required"
fi

if [ -z "${VERCEL_ORG_ID:-}" ]; then
  fail "VERCEL_ORG_ID is required"
fi

if [ -z "${VERCEL_PROJECT_ID:-}" ]; then
  fail "VERCEL_PROJECT_ID is required"
fi

current_branch="$(git branch --show-current)"
ORIGINAL_BRANCH="$current_branch"

if [ "$ALLOW_NON_DEV_DEPLOY" != "1" ]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    fail "Working tree has tracked changes. Commit or stash before switching to '${REQUIRED_BRANCH}'."
  fi

  git fetch origin "$REQUIRED_BRANCH"

  if [ "$current_branch" != "$REQUIRED_BRANCH" ]; then
    echo "Switching from ${current_branch} to ${REQUIRED_BRANCH}..."
    git checkout "$REQUIRED_BRANCH"
  fi

  git pull --ff-only origin "$REQUIRED_BRANCH"
  current_branch="$(git branch --show-current)"
fi

vercel_args=(--scope "$SCOPE")
token="${VERCEL_ACCESS_TOKEN:-${VERCEL_TOKEN:-}}"
if [ -n "$token" ]; then
  vercel_args+=(--token "$token")
fi

tmp_json="$(mktemp)"
cleanup() {
  rm -f "$tmp_json"
  if [ "$ALLOW_NON_DEV_DEPLOY" != "1" ] && [ -n "$ORIGINAL_BRANCH" ] && [ "$ORIGINAL_BRANCH" != "$(git branch --show-current)" ]; then
    git checkout "$ORIGINAL_BRANCH" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "Deploying ${current_branch} to Vercel ${TARGET}..."
vercel deploy --target="$TARGET" --yes --format=json "${vercel_args[@]}" | tee "$tmp_json"

deployment_url="$(
  # shellcheck disable=SC2016
  node -e '
    const fs = require("fs")
    const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
    const deployment = data.deployment && typeof data.deployment === "object" ? data.deployment : {}
    const url = data.url || deployment.url || data.inspectorUrl || deployment.inspectorUrl || ""
    if (!url) {
      throw new Error("Vercel deploy output did not include a deployment URL")
    }
    console.log(url.startsWith("http") ? url : `https://${url}`)
  ' "$tmp_json"
)"

echo "Assigning ${ALIAS_HOST} -> ${deployment_url}"
vercel alias set "$deployment_url" "$ALIAS_HOST" "${vercel_args[@]}"

cat <<RESULT
DONE
PR_SUMMARY:
- Deployed ${current_branch} to ${deployment_url}.
- Assigned https://${ALIAS_HOST} to the new deployment.
RESULT
