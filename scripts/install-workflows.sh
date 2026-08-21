#!/usr/bin/env bash
# Corre NA TUA máquina (PAT com scope workflow). Não é merge.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git fetch origin
git checkout main
git pull origin main
mkdir -p .github/workflows
git checkout origin/arena/01a01e33-github-actions -- harness/bootstrap-main
cp harness/bootstrap-main/*.yml .github/workflows/
git add .github/workflows
git status
echo "Revisa e depois:"
echo "  git commit -m 'chore: ACTOS CPU trampoline on main (no arena merge)'"
echo "  git push origin main"
echo "  git checkout arena/01a01e33-github-actions"
