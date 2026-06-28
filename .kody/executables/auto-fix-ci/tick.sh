#!/usr/bin/env bash
# Deterministic executable-local tick for auto-fix-ci.

set -euo pipefail

STATE_FILE=".kody/duties/auto-fix-ci.state.json"
NOW_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DRY_RUN="${KODY_DRY_RUN:-0}"

if [ -f "$STATE_FILE" ]; then
  PRIOR=$(jq -c '.data.perPr // {}' "$STATE_FILE")
else
  PRIOR='{}'
fi

PRS=$(gh pr list --state open --limit 200 \
  --json number,isDraft,headRefOid,statusCheckRollup,labels)

CANDIDATES=$(echo "$PRS" | jq -c '[.[] | select(
  .isDraft == false and
  ([.statusCheckRollup // [] | .[] | select(.status == "IN_PROGRESS" or .status == "QUEUED")] | length == 0) and
  ([.statusCheckRollup // [] | .[] | select(.conclusion == "FAILURE" or .conclusion == "TIMED_OUT")] | length > 0)
)]')

NEW_PERPR='{}'
ACTIONS_TAKEN=()
COUNT=$(echo "$CANDIDATES" | jq 'length')

echo "[auto-fix-ci] now=$NOW_ISO open_non_draft_failing=$COUNT dry_run=$DRY_RUN"
echo
echo "| pr | head[:8] | prior | action | reason |"
echo "|---|---|---|---|---|"

for ((i = 0; i < COUNT; i++)); do
  row=$(echo "$CANDIDATES" | jq -c ".[$i]")
  pr=$(echo "$row" | jq -r '.number')
  head=$(echo "$row" | jq -r '.headRefOid')
  prior_entry=$(echo "$PRIOR" | jq -c --arg k "$pr" '.[$k] // null')
  prior_summary="none"

  if [ "$prior_entry" != "null" ]; then
    p_sha=$(echo "$prior_entry" | jq -r '.lastSha // ""')
    p_att=$(echo "$prior_entry" | jq -r '.attempts // 0')
    p_stk=$(echo "$prior_entry" | jq -r '.stuck // false')
    prior_summary="sha=${p_sha:0:8} att=$p_att stuck=$p_stk"
  fi

  if [ "$prior_entry" = "null" ] || [ "$(echo "$prior_entry" | jq -r '.lastSha')" != "$head" ]; then
    effective=$(jq -nc --arg s "$head" '{lastSha:$s, attempts:0, stuck:false}')
  else
    effective="$prior_entry"
  fi

  stuck=$(echo "$effective" | jq -r '.stuck')
  if [ "$stuck" = "true" ]; then
    echo "| #$pr | ${head:0:8} | $prior_summary | skip | already stuck |"
    NEW_PERPR=$(echo "$NEW_PERPR" | jq -c --arg k "$pr" --argjson v "$effective" '. + {($k):$v}')
    continue
  fi

  attempts=$(echo "$effective" | jq -r '.attempts')
  if [ "$attempts" -ge 2 ]; then
    if [ "$DRY_RUN" != "1" ]; then
      gh pr comment "$pr" --body "kody fix-ci stuck - needs human" >/dev/null
      gh pr edit "$pr" --add-label "kody:stuck-ci" >/dev/null || true
    fi
    new_entry=$(echo "$effective" | jq -c '. + {stuck:true}')
    NEW_PERPR=$(echo "$NEW_PERPR" | jq -c --arg k "$pr" --argjson v "$new_entry" '. + {($k):$v}')
    ACTIONS_TAKEN+=("marked stuck #$pr")
    echo "| #$pr | ${head:0:8} | $prior_summary | mark-stuck | attempts=$attempts >= 2 |"
    continue
  fi

  if [ "$DRY_RUN" != "1" ]; then
    gh pr comment "$pr" --body '@kody fix-ci' >/dev/null
  fi
  new_entry=$(echo "$effective" | jq -c --arg s "$head" \
    '{lastSha:$s, attempts:((.attempts // 0)+1), stuck:false}')
  NEW_PERPR=$(echo "$NEW_PERPR" | jq -c --arg k "$pr" --argjson v "$new_entry" '. + {($k):$v}')
  ACTIONS_TAKEN+=("posted @kody fix-ci on #$pr")
  echo "| #$pr | ${head:0:8} | $prior_summary | fix-ci | failing CI, attempts=$((attempts + 1)) |"
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
  "cursor": "auto-fix-ci-$NOW_ISO",
  "data": {
    "perPr": $NEW_PERPR
  },
  "done": false
}
\`\`\`
EOF
