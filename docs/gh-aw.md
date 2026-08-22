# Alinhamento com GitHub Agentic Workflows (gh-aw)

[gh-aw](https://github.github.com/gh-aw/reference/cache-memory/) já separa duas memórias. ACTOS dá-lhes **path + regras + journal**.

| gh-aw | ACTOS | GitHub primitive |
| --- | --- | --- |
| **cache-memory** (7d, 10GB, branch-scoped) | L1 `.actos-l1` / `actions/cache` `actos-l1-*` | edge, nunca origem |
| **repo-memory** (branch ilimitado) | L3 `actos/fs` | disco / origin |
| `allowed-extensions: [json]` | public-cdn só `.json` | sanitização pré-agente |
| não guardar secrets no cache | `strip-secrets` + deny `/sys` | regras no read path |
| MemoryOps: session vs metrics vs archive | IRQ fila · journal `events` · `actos/fs` | lifecycles distintos |
| engine Node 20 (Actions JS) | `node-version: "20"` + `NODE_NO_WARNINGS=1` | sem `ExperimentalWarning` do sqlite 22 |
| fallback sem `node:sqlite` | `FileDb` (JSON) | runner 20 corre o CLI |

Node 20 **não tem** `node:sqlite` (isso é 22+ experimental — o warning que viste). O kernel tenta sqlite e cai no `FileDb`.
