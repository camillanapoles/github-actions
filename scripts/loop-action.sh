#!/usr/bin/env bash
# /loop — after git push && git log, poll Actions every 15s until a return.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
SHA="${1:-$(git rev-parse HEAD)}"
SHORT="${SHA:0:7}"
DEADLINE=$((SECONDS + 600))
echo "[loop] wait Actions for ${SHORT}  interval=15s  timeout=600s"

seen_any=0
while (( SECONDS < DEADLINE )); do
  json="$(gh run list --limit 30 --json databaseId,name,conclusion,status,headSha,url,event,createdAt)"
  hit="$(echo "$json" | jq --arg sha "$SHA" '[.[] | select(.headSha == $sha)]')"
  n="$(echo "$hit" | jq 'length')"
  done_n="$(echo "$hit" | jq '[.[] | select(.status == "completed")] | length')"
  pend_n="$(echo "$hit" | jq '[.[] | select(.status != "completed")] | length')"
  echo "[loop] $(date -u +%H:%M:%S) sha=${SHORT} runs=${n} done=${done_n} pending=${pend_n}"
  echo "$hit" | jq -c '.[] | {id:.databaseId,name,status,conclusion}'
  if (( n > 0 )); then seen_any=1; fi
  if (( seen_any == 1 && pend_n == 0 && done_n > 0 )); then
    echo "[loop] RETURN"
    echo "$hit"
    fail="$(echo "$hit" | jq '[.[] | select(.conclusion != "success" and .conclusion != "skipped")] | length')"
    if (( fail > 0 )); then
      echo "[loop] conclusion=fail"
      exit 1
    fi
    echo "[loop] conclusion=success"
    exit 0
  fi
  sleep 15
done
echo "[loop] TIMEOUT sha=${SHORT} seen_any=${seen_any}"
exit 2
