#!/usr/bin/env bash
# Instala o plugin ACTOS no repo *alvo* (cwd).
#   curl -fsSL … | bash
#   ou: bash /path/to/github-actions/plugin/actos/install.sh
set -euo pipefail
DEST="${1:-.}"
SRC="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$DEST/.actos-plugin/bin" "$DEST/.github/workflows"
cp -a "$SRC/bin/." "$DEST/.actos-plugin/bin/"
cp -a "$SRC/actos.plugin.json" "$DEST/.actos-plugin/"
chmod +x "$DEST/.actos-plugin/bin/"*.sh "$DEST/.actos-plugin/bin/"*.mjs || true
cp "$SRC/workflows/actos-cpu.yml" "$DEST/.github/workflows/actos-cpu.yml"
if [[ -f "$DEST/package.json" ]] && grep -q 'llm-hardware-calculator\|llm-infra-planner' "$DEST/package.json" 2>/dev/null; then
  cp "$SRC/recipes/llm-infra-planner.yml" "$DEST/.github/workflows/actos-llmcalc.yml"
  echo "[actos-plugin] receita llm-infra-planner copiada"
fi
echo "[actos-plugin] instalado em $DEST/.actos-plugin"
echo "  workflow: .github/workflows/actos-cpu.yml"
echo "  NÃO uses docker compose / docker build como CPU."
echo "  CPU = npm ci && npm test && npm run build  (ou npx tsx scripts/…)"
