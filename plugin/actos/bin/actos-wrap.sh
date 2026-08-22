#!/usr/bin/env bash
# Run a command as CPU (not Docker). Persist stdout as an ACTOS object.
#   bash actos-wrap.sh --kind ingest -- -- npx tsx scripts/ingest-models.ts
set -euo pipefail
KIND="execution"
REPO="${ACTOS_REPO:-${GITHUB_REPOSITORY:-}}"
ID="${GITHUB_RUN_ID:-wrap_$(date +%s)}"
CMD=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --kind) KIND="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    --id) ID="$2"; shift 2 ;;
    --) shift; CMD=("$@"); break ;;
    *) CMD+=("$1"); shift ;;
  esac
done
if [[ ${#CMD[@]} -eq 0 ]]; then
  echo "usage: actos-wrap.sh --kind <kind> -- <command>" >&2
  exit 2
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$(mktemp)"
set +e
"${CMD[@]}" > >(tee "$LOG") 2>&1
STATUS=$?
set -e
PAYLOAD="$(node -e '
  const fs=require("fs");
  const log=fs.readFileSync(process.argv[1],"utf8");
  process.stdout.write(JSON.stringify({
    status: Number(process.argv[2]),
    cmd: process.argv.slice(3),
    log: log.slice(-8000),
  }));
' "$LOG" "$STATUS" "${CMD[@]}")"
node "$ROOT/bin/actos-persist.mjs" --kind "$KIND" --repo "$REPO" --id "$ID" --payload "$PAYLOAD"
rm -f "$LOG"
exit "$STATUS"
