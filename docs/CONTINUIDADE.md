# Plano original · execuções · continuidade

Sessão: `arena/01a01e33-github-actions` · tag `arena-agent` · PR **#1 ABERTO** (não merge).

Ideia original: GitHub Actions como **OS serverless**. Runner = CPU. Runtime = espaço único. Depois do resolve, tudo é **objeto** em `pattern + id`. Regras. Page async lê a DB. O agente **é** a Action.

Plano canónico: [`plan-github-os.md`](./plan-github-os.md).

---

## Fases (estado)

| Fase | O quê | Estado |
| --- | --- | --- |
| **F0** | Audit + plano (GitHub = metal, analog CDN) | **feito** |
| **F1** | CAS `sha256`, journal `events`, runtime TTL, HTTP = fila | **feito** |
| **F2** | GitFs L3 `actos/fs` + `refs/actos/runtime/{pid}` (Puter LL) | **feito** · `origin/actos/fs` existe |
| **F3** | L1 edge + L2 ticket + GC promote | **feito** |
| **F4** | IRQ + trampolim YAML na `main` (CPU GitHub) | **feito** (tu copiaste o trampolim) |
| **F5** | CDN público + regras (redact/deny) · `/publico` | **feito** (Pages F5 full = opcional) |
| **F6** | `/objects/{repo}/{kind}/{id}` · `POST /api/ingest` | **feito** |
| QA | `npm test` | **22/22** |
| Ops | Node 20 + FileDb; actions v6; `permissions` no CI | **feito** |

---

## Execuções (ledger)

| Quem | O quê | SHA / run |
| --- | --- | --- |
| agente | ACTOS kernel, pages, harness | ramo `arena/…` até `092ab9c` |
| tu | trampolim Node 20 na `main` | `1ced5fd` |
| tu | `permissions: contents: read` no `ci.yml` | `9487a17` |
| tu | actions v6 + flag sqlite | `972a013` **main HEAD** |
| GitHub | `actos-gc` schedule | **success** (vários) |
| GitHub | Pages + CodeQL na `main` | **success** |
| GitHub | CodeQL *actions* no PR #1 | **fail esperado** (sem YAML no arena) |
| GitHub | `ci` no PR (antes do fix sqlite) | fail exit 9 — corrigido no arena; re-corre no próximo push/re-run |

Ramos vivos: `main` (trampolim) · `arena/01a01e33-github-actions` (código) · `actos/fs` (disco).

---

## Continuidade (não confundas)

1. **Não faças merge** do PR #1.  
2. **Não apagues** `arena/01a01e33-github-actions`.  
3. Eu faço commit/push **só** nesse ramo.  
4. Tu só tocas na `main` para **copiar** `harness/bootstrap-main/*.yml` → `.github/workflows/`.  
5. Fim só com **`merge` / `fim` / `fechar`**.

Merge **não** mata a sessão. Apagar o ramo arena é que mata.

---

## O que falta (se quiseres continuar)

- Re-run do workflow **ci** no PR #1 (o fix sqlite já está no arena + trampolim `972a013`).  
- Settings → Actions → Workflow permissions = **Read and write**.  
- CodeQL: desmarcar linguagem *GitHub Actions* no PR, ou ignorar.  
- F5 Pages a apontar a `.actos-cdn` (hoje Pages serve o README da `main`).  
- Slice 6h / `actos.slice` (F4 resto fino).  
- Secret `ACTOS_DISPATCH_TOKEN` só se quiseres dispatch de fora.

Comando local para ficares alinhado:

```bash
git checkout arena/01a01e33-github-actions && git pull
```
