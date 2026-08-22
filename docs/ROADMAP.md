# ACTOS — o que é, o que está feito, o que falta

Sessão `arena/01a01e33-github-actions` · PR #1 **aberto** · sem merge.

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
- `main` — trampolim YAML (tu copias; o token Arena não escreve workflows)
- `actos/fs` — disco (órfão, ahead cresce, behind da `main` mantém-se)

## Caminhámos quanto?

Kernel + disco + CI + CDN deploy: **feito**.  
CPU no *runner* GitHub e ruleset: **faltam 2 cliques teus**.  
Não há F7 no plano original. O que resta é metal que a App **não pode** disparar (403).

```
F0 ████████  plano
F1 ████████  CAS + journal + enqueue≠CPU
F2 ████████  GitFs L3 vivo (aae4abf)
F3 ████████  L1/L2 + GC (schedule escreve /proc/stat)
F4 ██████░░  IRQ + slice no kernel; YAML na main; 0 runs do harness
F5 ███████░  export + deploy-pages success; URL a confirmar no browser
F6 ████████  ingest multi-repo
E7–E18 ████  attach, FileDb CI, /loop, tags, hydrate, read-through
```

## Já realizado (`[sucesso sem debito]`)

- Kernel Next 15 / React 19, pages `/runtime` `/objetos` `/disco` `/cdn` `/publico` `/agentes`
- CAS `sha256`, journal, FileDb no Node 20, **CI verde** (último `6fd38b3` run 32533381497)
- `actos/fs` vivo: smoke F2 → `/proc/stat` → `smoke cpu github` → GC a appendir (`aae4abf`)
- 13+ tags `actos/obj/{sha}`
- Trampolim na `main`: `ci` `agent-harness` `gc` `cdn-pages` (`262d395`)
- `actos-cdn` **2× success** (hydrate L3 → artifact → `deploy-pages`)
- Skill `/loop`: `git push && git log` → while 15s → RETURN → seguinte
- E10: era YAML sem `permissions`, não a setting

## O que falta (só metal / UI GitHub)

| Id | O quê | Quem | Bloqueio |
| --- | --- | --- | --- |
| **E9** | Actions → **agent-harness** → Run → `smoke cpu github` | tu | App `workflow_dispatch` **403** |
| **E12 live** | Abrir https://camillanapoles.github.io/github-actions/ e confirmar `index.json` (não só o README da `main`) | tu | Settings → Pages → Source **GitHub Actions** se ainda estiver `main /` |
| **E14b** | Ruleset `actos-fs-append-only` (block force-push + delete) | tu | App rulesets **403** |
| E11 | CodeQL *actions* no PR | ignorar | sem YAML no `arena/` |

Analog local do E9 **já correu**. O runner GitHub ainda não.

## Como o agente trabalha daqui para a frente

1. Commit no `arena/` · `git push && git log`
2. `npm run loop` — 15s até o CI desse SHA devolver
3. Marca AHEAD · actividade seguinte
4. Não para à espera do próximo turno teu — mas **não inventa** `workflow_dispatch`

Fim do *produto* nesta sessão: E9 + Pages a servir o CDN + E14b.  
Fim da *sessão Arena*: só quando disseres `merge` / `fim` / `fechar`.
