# ACTOS — o que é, o que está feito, o que falta

Sessão `arena/01a01e33-github-actions` · PR #1 **aberto** · sem merge.
Plano original: [`plan-github-os.md`](./plan-github-os.md).

## O que estamos a criar

Um **sistema operativo serverless em cima do GitHub**.

Não é “mais uma CI”. É um computador cujo metal já existe:

| Peça de OS | No GitHub | No ACTOS |
| --- | --- | --- |
| CPU | runner (job ≤ 6h) | `agent-harness` / `npx tsx src/cli/agent.ts` |
| RAM | Actions cache 7d LRU | L1 `.actos-l1` |
| Swap / ticket | Artifacts (ponteiro) | L2 `{sha, path, runId}` |
| Disco | ramo órfão `actos/fs` | L3 GitFs, append-only |
| CDN | Pages + tags | L4 `.actos-cdn` + `actos/obj/{sha}` |
| `/proc` | Checks + refs runtime | `refs/actos/runtime/{pid}` + `/proc/stat` |
| Syscall | `workflow_dispatch` / `repository_dispatch` | IRQ `agent.run` / `actos.slice` |
| Path | — | `pattern + id` (`/objects/{kind}/{id}`) |

Invariante: **HTTP só enfileira. O processo é o runner. Depois do resolve, tudo é objecto.**

Três ramos, três papéis (não misturar):

- `arena/01a01e33-github-actions` — código do kernel (esta sessão)
- `main` — trampolim YAML
- `actos/fs` — disco (órfão; ahead cresce; behind da `main` mantém-se)

## Caminhámos quanto?

O plano F0–F6 + evoluções E7–E18 **no metal está fechado**.

```
F0 ████████  plano
F1 ████████  CAS + journal + enqueue≠CPU
F2 ████████  GitFs L3 vivo (`548f964`+)
F3 ████████  L1/L2 + GC schedule (append /proc/stat)
F4 ████████  IRQ + slice + agent-harness no runner (run 32542510967)
F5 ████████  actos-cdn deploy-pages · Pages build_type=workflow
F6 ████████  ingest multi-repo
E7–E18 ████  attach, FileDb CI, /loop, tags, hydrate, read-through
E9  E12  E14b ████  validados 2026-08-22
```

## Validado no metal (2026-08-22)

| Id | Evidência |
| --- | --- |
| **E9** | `agent-harness` `workflow_dispatch` **success** [32542510967](https://github.com/camillanapoles/github-actions/actions/runs/32542510967) |
| **E12** | `actos-cdn` 3× success; Pages `build_type: workflow` · https://camillanapoles.github.io/github-actions/ |
| **E14b** | ruleset `anti force-push em actos/fs` **active** (#21177682) — `deletion` + `non_fast_forward` em `actos/fs**` |
| **E10** | YAML `permissions` + setting Read and write |
| CI | verde em cadeia até `35e1b79` / `6fd38b3` |

## Pendências reais (não são débito do OS)

| Item | Natureza |
| --- | --- |
| CodeQL *Analyze (actions)* no PR #1 | **esperado**: o `arena/` não tem `.github/workflows/` (token Arena sem `workflows`). Scan que conta = push à `main`. |
| PR #1 aberto | política de sessão. Fecha só com `merge` / `fim` / `fechar`. |
| L5 Releases | opcional no plano; não pedido. |

Não há F7 no plano original. O produto descrito em F0–F6 está no metal.

**Converter outros repos:** [`docs/CONVERTER.md`](./CONVERTER.md) · plugin [`plugin/actos/`](../plugin/actos/) · skill [`harness/skills/convert.md`](../harness/skills/convert.md). Caso: `camillanapoles/llm-infra-planner` (Docker só serve SPA; CPU = `npx tsx` no runner).

## Como o agente trabalha

1. Commit no `arena/` · `git push && git log`
2. `npm run loop` — 15s até o CI desse SHA devolver
3. Marca AHEAD · actividade seguinte
