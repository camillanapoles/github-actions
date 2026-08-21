# Plano original · execuções · continuidade

Sessão: `arena/01a01e33-github-actions` · tag `arena-agent` · PR **#1 ABERTO** (não merge).

Ideia original: GitHub Actions como **OS serverless**. Runner = CPU. Runtime = espaço único. Depois do resolve, tudo é **objeto** em `pattern + id`. Regras. Page async lê a projecção. O agente **é** a Action. Disco = ramo órfão `actos/fs`.

Canónico: [`plan-github-os.md`](./plan-github-os.md) · ahead vivo: [`AHEAD.md`](./AHEAD.md) · cortes: [`EVOLUCOES.md`](./EVOLUCOES.md) · audit: [`audit.md`](./audit.md).

---

## Fases (honesto)

| Fase | O quê | Estado |
| --- | --- | --- |
| **F0** | Audit + plano | **feito** |
| **F1** | CAS, journal, runtime TTL, HTTP = fila | **feito** (local) |
| **F2** | GitFs L3 `actos/fs` | **parcial** — ramo existe (14 commits) mas estava congelado; E7 attach |
| **F3** | L1/L2/GC | **parcial** — analog local; GC GitHub não avançava L3 |
| **F4** | IRQ + trampolim | **parcial** — YAML na `main`; 0 runs do harness; `checkpoint()` existe |
| **F5** | CDN público | **parcial** — `/publico` local; Pages = README |
| **F6** | multi-repo ingest | **feito** (local) |
| **E7** | attach origin + FileDb CI + `/proc/stat` | **neste commit** |
| QA | `npm test` | FileDb (como Node 20) |

---

## Execuções (ledger)

| Quem | O quê | SHA / run |
| --- | --- | --- |
| agente | kernel até recover | `bc28802` |
| tu | trampolim | `334001b` `1ced5fd` `9487a17` `972a013` |
| kernel | smoke F2 → `actos/fs` | `1f3a249`…`103eab9` (**14**, 02:50Z) |
| GitHub | `actos-gc` schedule | success **sem** mover L3 |
| GitHub | `ci` PR #1 | fail `npm test` (FileDb / Node 20) — E7 |
| GitHub | CodeQL actions no PR | fail esperado (sem YAML no arena) |
| GitHub | `agent-harness` | **0 runs** |

Ramos: `main` (5 commits, trampolim) · `arena/…` (código) · `actos/fs` (disco, 14 órfãos, 5 behind — correcto).

---

## Continuidade

1. **Não faças merge** do PR #1.  
2. **Não apagues** `arena/01a01e33-github-actions`.  
3. Eu faço commit/push **só** nesse ramo (disco `actos/fs` é append do kernel).  
4. Tu recopias o trampolim quando o YAML muda (**E8**).  
5. Fim só com **`merge` / `fim` / `fechar`**.

---

## Próximo (humano)

```bash
git checkout main && git pull
git checkout origin/arena/01a01e33-github-actions -- harness/bootstrap-main
cp harness/bootstrap-main/*.yml .github/workflows/
git add .github/workflows && git commit -m "fix: attach actos/fs before CPU/GC" && git push
git checkout arena/01a01e33-github-actions
```

Depois: Settings → Actions → **Read and write** · Actions → **agent-harness** → goal `smoke cpu github`.
