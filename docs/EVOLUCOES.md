# Evoluções — depois do facto 14/5

Data: 2026-08-22 · ramo `arena/01a01e33-github-actions` · PR #1 aberto.

**Estado actual:** F0–F6 + E7–E18 + E9/E12/E14b **validados no metal**.  
Pendências: só CodeQL *actions* no PR (esperado) e o merge da sessão. Ver [`ROADMAP.md`](./ROADMAP.md).

O texto abaixo é o **journal da auditoria de 21 ago** (disco congelado em 14/5). Não é o estado de hoje.

## O facto (git é determinista)

```
main (5):     c7dc241 → 334001b → 1ced5fd → 9487a17 → 972a013
actos/fs (14): 1f3a249 (órfão) → … → 103eab9
merge-base:   nenhum
compare:      14 ahead, 5 behind
```

Isto **não é divergência de feature**. São duas histórias sem ancestral.

| Número | Significado | Está certo? |
| --- | --- | --- |
| **14 ahead** | 14 commits de disco que a `main` não tem | Sim como *contagem*. Não como *verdade actual*. |
| **5 behind** | `actos/fs` não contém o trampolim nem o README | **Obrigatório.** Se deixar de estar behind, o VFS comeu código. |

`actos/fs` **deve** continuar ahead (append) e **deve** continuar behind (nunca merge). Ahead a *congelar* em 14 é o erro.

## Auditoria (o que o plano prometia vs o que o git tem)

| Promessa | Evidência | Veredicto |
| --- | --- | --- |
| L3 = `actos/fs` origin | 13 JSON, todos `2026-08-21T02:50:26Z`, goal `F2 gitfs smoke` | **snapshot morto**, não origin vivo |
| `/proc/stat.json` | ausente no tree | falha |
| `refs/actos/runtime/*` | `git ls-remote` vazio | falha |
| tags `actos/obj/{sha}` | só `arena-agent` | falha |
| GC promote-before-evict | 6× `actos-gc` **success**; HEAD L3 **ainda** `103eab9` | success mentiroso |
| CPU `agent-harness` | **0 runs** | CPU GitHub nunca correu um goal |
| L1 Actions cache | só cache npm | sem edge ACTOS |
| `ensure()` no runner | checkout do `arena/` **sem** `actos/fs` → órfão novo → push non-ff | **causa raiz** |
| trampolim `agent-harness` | sem `git fetch actos/fs`, sem push L3 | CPU não grava disco |
| `continue-on-error: true` no push | step verde com exit 1 | esconde o recusar |
| `gc` só promove L1 > 5d | L1 fresco = `promoted: 0` | disco não avança |
| `ls()` via worktree `.actos-fs` | worktree vazio após clone | `/disco` mente “tree vazia” |
| lookup | L1 → SQLite, **nunca** git | L3 não é lido |
| FileDb (Node 20) | `status = 'queued'` literal ignorado | CI `npm test` exit 1 |
| CodeQL Analyze (actions) no PR | sem YAML no `arena/` | fail esperado |
| Pages | `main` `/` = README | não é CDN |
| F0–F6 “feito” no ledger | analog local sim; metal GitHub não | **overclaim** |

## Plano original (inalterado)

GitHub = metal. Runner = CPU. Runtime = espaço único. Resolve → objecto `pattern+id`. Regras no read. Page async lê projecção. Agente **é** a Action.

Hierarquia: L0 workspace · L1 cache 7d · L2 ticket · **L3 `actos/fs`** · L4 Pages · L5 release.

Ramos: `main` trampolim · `arena/…` código · `actos/fs` disco. **Não misturar.**

## O que já está feito (honesto)

- Kernel + UI + CLI no `arena/` (F0–F6 *locais*).
- CAS `sha256`, journal `events`, enqueue ≠ CPU, FileDb fallback.
- Trampolim na `main` (tu): `1ced5fd` `9487a17` `972a013`.
- `actos/fs` criado (F2 smoke) — 14 commits, 13 ficheiros.
- `npm test` local 22/22 (Node 22 + sqlite). **CI Node 20 falhava.**

## Evoluções (esta entrega = E7)

| Id | Evolução | Estado |
| --- | --- | --- |
| **E7** | `gitfs.attach()` ao origin; `ls`/`read` via `ls-tree`/`show`; recusar non-ff; `/proc/stat`; lookup L3-git; GC `--sync`; trampolim fetch+push **sem** continue-on-error; FileDb filtra literais; testes isolados | **neste commit** |
| **E8** | trampolim na `main` | **`[sucesso sem debito]`** `38e6393` |
| **E9** | `agent-harness` no runner | `[sucesso sem debito]` run 32542510967 |
| **E10** | YAML `permissions` + setting | `[sucesso sem debito]` |
| **E11** | CodeQL actions no PR | esperado / não é débito |
| **E12** | Pages Actions + `actos-cdn` | `[sucesso sem debito]` `build_type=workflow` |
| **E13** | slice YAML + `status=sliced` + `--slice` | `[sucesso sem debito]` |
| **E14** | tags `actos/obj/{sha}` | `[sucesso sem debito]` |
| **E14b** | ruleset anti force-push | `[sucesso sem debito]` #21177682 |
| **E15** | hydrate `ls-tree` → SQLite | `[sucesso sem debito]` |

## O que *não* fazer

- Merge `actos/fs` → `main` (apaga o código).
- Merge PR #1 até tu dizeres `merge` / `fim` / `fechar`.
- Force-push `actos/fs`.
- Apagar `arena/01a01e33-github-actions`.
- Tratar “14 ahead” como saúde — é só aritmética de órfão.
