#!/usr/bin/env bash
# POST every data/objects/**.json to an ACTOS hub (Nível C).
#   ACTOS_INGEST_URL=https://example/api/ingest bash actos-ingest.sh
set -euo pipefail
URL="${ACTOS_INGEST_URL:-}"
if [[ -z "$URL" ]]; then
  echo "[actos-ingest] skip — ACTOS_INGEST_URL vazio"
  exit 0
fi
TOKEN="${ACTOS_INGEST_TOKEN:-}"
n=0
while IFS= read -r -d '' f; do
  body="$(node -e '
    const o=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
    const repo=process.env.GITHUB_REPOSITORY || o.metadata?.repo || o.payload?.repo || "local/app";
    process.stdout.write(JSON.stringify({
      repo,
      kind: o.kind,
      id: String(o.id||"").split("__").pop(),
      payload: o.payload,
    }));
  ' "$f")"
  hdr=(-H "content-type: application/json")
  if [[ -n "$TOKEN" ]]; then hdr+=(-H "authorization: Bearer $TOKEN"); fi
  curl -sS -X POST "$URL" "${hdr[@]}" -d "$body" >/dev/null
  n=$((n+1))
done < <(find data/objects -name '*.json' -print0 2>/dev/null)
echo "[actos-ingest] posted $n objects → $URL"
