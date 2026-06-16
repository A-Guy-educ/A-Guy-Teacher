#!/usr/bin/env bash
# Deterministic executable-local tick for auto-sync.

set -euo pipefail

STATE_FILE=".kody/duties/auto-sync.state.json"
NOW_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
NOW_EPOCH=$(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$NOW_ISO" +%s 2>/dev/null || date -u -d "$NOW_ISO" +%s)
DRY_RUN="${KODY_DRY_RUN:-0}"
OWNER_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

if [ -f "$STATE_FILE" ]; then
  PRIOR=$(jq -c '.data.perPr // {}' "$STATE_FILE")
else
  PRIOR='{}'
fi

PRS=$(gh pr list \
  --state open --limit 200 \
  --json number,isDraft,headRefOid,baseRefName,mergeable,labels,statusCheckRollup)

CANDIDATES=$(echo "$PRS" | jq -c '[.[] | select(
  .isDraft == false and
  .mergeable == "MERGEABLE" and
  ([.labels // [] | .[] | select(.name == "kody:no-sync")] | length == 0)
)]')

NEW_PERPR='{}'
ACTIONS_TAKEN=()
COUNT=$(echo "$CANDIDATES" | jq 'length')

echo "[auto-sync] now=$NOW_ISO open_non_draft_mergeable=$COUNT dry_run=$DRY_RUN"
echo
echo "| pr | head[:8] | behind | ci | prior | action | reason |"
echo "|---|---|---:|---|---|---|---|"

for ((i = 0; i < COUNT; i++)); do
  row=$(echo "$CANDIDATES" | jq -c ".[$i]")
  pr=$(echo "$row" | jq -r '.number')
  head=$(echo "$row" | jq -r '.headRefOid')
  base=$(echo "$row" | jq -r '.baseRefName')
  behind=$(gh api "repos/$OWNER_REPO/compare/$base...$head" --jq '.behind_by')
  ci_in_progress=$(echo "$row" | jq -r '
    [.statusCheckRollup // [] | .[] |
      select(.status == "IN_PROGRESS" or .status == "QUEUED")] | length > 0
  ')
  prior_entry=$(echo "$PRIOR" | jq -c --arg k "$pr" '.[$k] // null')
  prior_summary="none"

  if [ "$prior_entry" != "null" ]; then
    p_sha=$(echo "$prior_entry" | jq -r '.lastSha // ""')
    p_att=$(echo "$prior_entry" | jq -r '.attempts // 0')
    p_stk=$(echo "$prior_entry" | jq -r '.stuck // false')
    p_at=$(echo "$prior_entry" | jq -r '.lastActionAt // "null"')
    prior_summary="sha=${p_sha:0:8} att=$p_att stuck=$p_stk at=$p_at"
  fi

  effective="$prior_entry"
  if [ "$effective" = "null" ] || [ "$(echo "$effective" | jq -r '.lastSha')" != "$head" ]; then
    effective=$(jq -nc --arg s "$head" '{lastSha:$s, attempts:0, stuck:false, lastActionAt:null}')
  fi

  action="skip"
  reason=""
  next_entry=""

  if [ "$behind" -lt 5 ]; then
    reason="behind=$behind < 5"
  elif [ "$ci_in_progress" = "true" ]; then
    reason="ci in progress"
    next_entry="$effective"
  elif [ "$(echo "$effective" | jq -r '.stuck')" = "true" ]; then
    reason="already stuck"
    next_entry="$effective"
  else
    last_action=$(echo "$effective" | jq -r '.lastActionAt // empty')
    within_window="false"
    if [ -n "$last_action" ]; then
      last_epoch=$(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$last_action" +%s 2>/dev/null || date -u -d "$last_action" +%s)
      if [ $((NOW_EPOCH - last_epoch)) -lt 21600 ]; then
        within_window="true"
      fi
    fi

    if [ "$within_window" = "true" ]; then
      reason="last action within 6h"
      next_entry="$effective"
    else
      attempts=$(echo "$effective" | jq -r '.attempts // 0')
      if [ "$attempts" -ge 2 ]; then
        action="mark-stuck"
        reason="attempts=$attempts >= 2"
        next_entry=$(echo "$effective" | jq -c --arg now "$NOW_ISO" '. + {stuck:true, lastActionAt:$now}')
      else
        action="sync"
        reason="behind=$behind, attempts=$((attempts + 1))"
        next_entry=$(echo "$effective" | jq -c --arg s "$head" --arg now "$NOW_ISO" \
          '{lastSha:$s, attempts:((.attempts // 0)+1), stuck:false, lastActionAt:$now}')
      fi
    fi
  fi

  if [ -n "$next_entry" ]; then
    NEW_PERPR=$(echo "$NEW_PERPR" | jq -c --arg k "$pr" --argjson v "$next_entry" '. + {($k):$v}')
  fi

  echo "| #$pr | ${head:0:8} | $behind | $ci_in_progress | $prior_summary | $action | $reason |"

  if [ "$action" = "mark-stuck" ]; then
    if [ "$DRY_RUN" != "1" ]; then
      gh pr comment "$pr" --body "kody sync stuck - needs human" >/dev/null
      gh pr edit "$pr" --add-label "kody:stuck-sync" >/dev/null || true
    fi
    ACTIONS_TAKEN+=("marked stuck #$pr")
  elif [ "$action" = "sync" ]; then
    if [ "$DRY_RUN" != "1" ]; then
      gh pr comment "$pr" --body '@kody sync' >/dev/null
    fi
    ACTIONS_TAKEN+=("posted @kody sync on #$pr")
  fi
done

echo
echo "actions taken: ${#ACTIONS_TAKEN[@]}"
if [ "${#ACTIONS_TAKEN[@]}" -gt 0 ]; then
  for a in "${ACTIONS_TAKEN[@]}"; do
    echo " - $a"
  done
fi

cat <<EOF
\`\`\`kody-job-next-state
{
  "cursor": "auto-sync-$NOW_ISO",
  "data": {
    "perPr": $NEW_PERPR
  },
  "done": false
}
\`\`\`
EOF
