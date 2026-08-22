#!/usr/bin/env bash
# Captura do metal depois do sleep de verificação. Não troca de branch.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git fetch origin --prune 2>/dev/null || true
echo "=== HEAD $(git branch --show-current) $(git rev-parse --short HEAD) ==="
echo "=== remotes ==="
git ls-remote origin 'refs/heads/*' 'refs/tags/actos/obj/*' 2>/dev/null | head -40
echo "=== main HEAD ==="
git log -1 --oneline origin/main 2>/dev/null || true
echo "=== actos/fs ==="
git log -3 --oneline origin/actos/fs 2>/dev/null || git ls-remote origin refs/heads/actos/fs
echo "=== runs ==="
gh run list --limit 8 --json databaseId,name,conclusion,status,headBranch,displayTitle,createdAt
echo "=== harness ==="
gh run list --workflow=agent-harness.yml --limit 5 --json databaseId,conclusion,status,displayTitle,event,createdAt 2>/dev/null || true
echo "=== ci arena ==="
gh run list --workflow=ci.yml --branch arena/01a01e33-github-actions --limit 4 --json databaseId,conclusion,status,headSha,createdAt 2>/dev/null || true
