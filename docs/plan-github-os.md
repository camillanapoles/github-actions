# Plano: GitHub como OS serverless (FS + memória + CDN)

ACTOS deixa de *imitar* um OS em SQLite local e passa a **montar o GitHub como o metal**.

O runner é CPU. Não há RAM persistente entre jobs — isso não é um bug do GitHub, é a definição de serverless. A engenharia é **hierarquia de memória + identidade por conteúdo + eventos**, exactamente como um CDN.

GitHub Agentic Workflows já nomeia a mesma cisão: **Cache Memory** (Actions cache, 7d) vs **Repo Memory** (branches, ilimitado). Nós tornamos isso num **sistema de ficheiros com path `pattern+id`**, um `/proc`, um journal e um CDN.

Referências: [cache-memory (gh-aw)](https://github.github.com/gh-aw/reference/cache-memory/), [docs de cache](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching), [changelog 10GB+](https://github.blog/changelog/2025-11-20-github-actions-cache-size-can-now-exceed-10-gb-per-repository/).

---

## 1. Analogia CDN → nova usabilidade

Um CDN não “tem RAM”. Tem **camadas com TTL e identidade**.

| CDN | ACTOS no GitHub | Papel |
| --- | --- | --- |
| Origin (S3/CAS) | git objects + orphan `actos/fs` | verdade, content-addressed |
| Origin shield | cache da *default branch* | o único L1 que todos os PRs podem ler |
| Edge PoP | `actions/cache` no runner | RAM quente, 7d LRU, ~10 GB/repo |
| Cache-Control / ETag | chave = hash do conteúdo | HIT só se o trabalho for o mesmo |
| `stale-while-revalidate` | `restore-keys` (prefixo sem run_id) | serve velho, recompila |
| Purge | `gh cache delete` + apagar tag | GC |
| URL imutável | `refs/tags/actos/obj/{sha}` + Pages | CDN público |
| Revalidate | miss no hash → job | CPU serverless |
| Access log | `git log` + Actions logs + Checks | dmesg / register |

**Usabilidade nova:** não “corre a CI e descarrega o artifact”.  
Pedes um **path** (`/cache/{workflow}/{sha}/{id}`). O sistema:

1. procura L1 (Actions cache) — edge
2. senão L2 (artifact do run) — PoP
3. senão L3 (blob git no `actos/fs`) — origin
4. senão L4 (Pages, se público) — CDN
5. miss total → `repository_dispatch` = IRQ → o runner *é* o compute

Isto é **serverless para OS**: o processo não vive; o **objecto** vive. Exactamente o invariante `in_runtime → resolved → cached`.

---

## 2. Hierarquia de memória (localizar com estratégia)

```
CPU     GitHub-hosted runner          timeout 6h; sem estado ao sair
L0      workspace do job              /tmp + GITHUB_WORKSPACE      efémero
L1      Actions cache                 7d, LRU, 10GB default*       RAM quente
L2      Artifacts                     1–90d, quota de storage      tmpfs / swap
L3      git refs + orphan branch      ilimitado no repo            disco
L4      GitHub Pages / raw URLs       CDN                          edge público
L5      Releases (opcional)           imutável, binários grandes   cold archive

* 10GB grátis; acima é billing. Eviction LRU. Cache de PR NÃO vaza para main.
```

### Onde cada coisa mora (não misturar)

| Dado | Camada | Porquê |
| --- | --- | --- |
| Processo vivo (`/runtime/runs/{id}`) | **ref leve** `refs/actos/runtime/{pid}` → commit mínimo | 41 bytes; force-push; delete = unmount. Não é branch com tree enorme. |
| Objecto resolvido | **tree** em orphan `actos/fs` no path do pattern | disco, versionado, `git log` = journal do inode |
| CAS (payload bytes) | git blob; tag `actos/obj/{sha256}` | imutável; partilhável; CDN |
| Working set da sessão | L1 cache key `actos-l1-{hash}` | 7d; se esfriar, promove-se a L3 *antes* da eviction |
| Ticket entre jobs do *mesmo* workflow | L2 artifact (pointer: sha, não o blob outra vez) | artifacts são caros; guardar SHA, não duplicar |
| Índice `/proc` | `actos/fs/proc/stat.json` + Checks API | `ps`; register |
| Evento | `repository_dispatch` / `workflow_run` / `push` em `actos/fs` | IRQ |
| Código do kernel (Next, CLI) | ramos `arena/…` e `main` | **nunca** misturar com `actos/fs` |

Sub-branches: `arena/<sessao>` = código. `actos/fs` = VFS. `actos/cdn` ou `gh-pages` = árvore pública. Tags = snapshots imutáveis. Não são “mais branches de feature”.

---

## 3. Limitações do GitHub → alternativa *dentro* do workspace

Não saímos do GitHub. Cada limite tem um primitive que já existe.

| Limitação | Efeito | Alternativa no repo |
| --- | --- | --- |
| Runner sem RAM entre jobs | espaço único morre no `unmount` real | ref `refs/actos/runtime/{pid}` + checkpoint commit; o processo *é* a ref |
| Job ≤ 6h | agente longo morre | fatiar: commit checkpoint → `repository_dispatch` slice N+1 (continuação = IRQ) |
| Cache 7d + LRU 10GB | L1 desaparece | **promote-before-evict**: job `gc` semanal copia hashes quentes para `actos/fs` |
| Cache **isolado por branch**; PR grava em `refs/pull/…/merge` e não serve o main | HIT mentiroso entre PRs | L1 só como atalho; **origem** é `actos/fs` na default branch. PRs *leem* origin shield (main). Writes de objectos só via `workflow_run` na default, ou push directo a `actos/fs` com `concurrency` |
| Artifact quota (GB-hours, 90d default) | storage explode | artifact = **ponteiro** (json `{sha, path}`); blob no git CAS. `retention-days: 1` no L2 |
| `GITHUB_TOKEN` não cria `.github/workflows` (esta sessão) | Action “não existe” no GitHub | fonte em `harness/github/`; um humano / PAT com `workflows` copia **uma vez** para `main`. Daí para a frente o CPU existe |
| Token não deve escrever código em `main` | risco | `contents: write` **só** em `actos/fs` e `refs/actos/*`. Concurrency group `actos-fs` = mutex do VFS |
| 200 cache uploads/min | throttle | batch: um save L1 por job, chave = merkle da tree tocada |
| Sem shared memory entre jobs | | L2 artifact intra-workflow; L1 se cross-workflow *na mesma branch* |
| `workflow_dispatch` só activo se o YAML está na **default branch** | harness morto em feature branch | YAML mínimo em `main`; o programa (CLI + `harness/workflows/agent.yaml`) vem do checkout do SHA pedido |
| Force-push em orphan perde história se mal usado | | **não** force-push `actos/fs`. Só append. Force só em `refs/actos/runtime/*` (RAM) |
| Pages é público | | `actos/cdn` só com objectos já passados pelas regras `transform` (redact). Privado = raw via API autenticada |

---

## 4. Event-driven, logger, register

### IRQ (não polling)

```
push arena/*            → ci (código)
workflow_dispatch goal  → agent-harness (CPU)
repository_dispatch
  actos.syscall         → kernel no runner
  actos.slice           → continuação após checkpoint
workflow_run completed  → runtime-persist (resolve → L3)
push actos/fs           → index + Pages (CDN revalidate)
schedule 17 * * * *     → gc: L1→L3 promote, apagar runtime refs órfãs
delete refs/actos/runtime/{pid}  → unmount
```

A page async **não** chama a API da GitHub em loop. Lê L3 (clone shallow de `actos/fs`) ou a projecção SQLite local. O GitHub emite o evento; nós materializamos.

### Logger = journal

- `git log actos/fs -- objects/...` = histórico do inode (quem, quando, sha)
- Actions log do run = stdout do processo (efémero, 90d)
- Checks annotations = dmesg daquele pid
- Tag anotada `actos/obj/{sha}` = manifesto (path, kind, regra)

Uma linha de journal local (SQLite `events`) **espelha** o commit em `actos/fs`. Replay = `git log`. A SQLite deixa de ser origem.

### Register = `/proc`

- Checks API: `ps` (in_progress / success / failure)
- `actos/fs/proc/stat.json`: contagens, last_gc, L1 size
- `concurrency: actos-fs` no workflow = spinlock do disco
- Label `arena-agent` + tag git = sessão do operador (não misturar com o kernel)

---

## 5. Contrato de path (não muda)

O utilizador e os outros projectos continuam a ver:

```
/runtime/runs/{id}
/objects/{kind}/{id}                 → mais tarde /objects/{repo}/{kind}/{id}
/cache/{workflow}/{sha}/{id}
/agents/{id}/runs/{runId}/steps/{n}
```

Por baixo:

```
actos/fs/objects/{kind}/{id}.json     blob + tree
refs/actos/runtime/{id}               → commit { path, startedAt }
refs/tags/actos/obj/{sha256}          imutável
cache key actos-l1-{sha256}           L1
```

`resolve` = unmount da ref runtime + `git commit` no path + tag CAS + (opcional) save L1.

Cache **content-addressed**: `sha256(workflow || inputs canónicos || tree sha)`. Sem SHA aleatório.

---

## 6. Como construir (fases)

Não abrir LLM, Postgres, nem microserviços. Cortar o analog até ser verdade no GitHub.

### F0 — papel (este commit)

Audit + este plano. PR aberto. Sem merge.

### F1 — CAS + journal *local* — **feito** (`[arena-agent]` neste ramo)

- `cacheKey = sha256(actos/v1 || workflow || goal || extras)` — `src/domain/cas.ts`. Sem SHA aleatório.
- Tabela `events` append-only; `resolveExecution` em `tx()`.
- Runtime = `Map` in-memory + TTL 30min + reap. Seed já não monta processos eternos.
- `POST /api/agents/run` e o form **só enfileiram**. CPU = `npx tsx src/cli/agent.ts --drain` / `--goal` / botão drain (Action analog local).

Entrega: HIT real no mesmo goal; page async inalterada.

### F2 — Git como L3 (o FS) — **parcial** (ramo existe; vivo só após E7)

Ver [`EVOLUCOES.md`](./EVOLUCOES.md): 14 ahead / 5 behind é facto. Ahead tem de **crescer**. Behind tem de **manter-se**.

### F2 (código) — Git como L3

Inspiração Puter: LL provider separado do inode. Ver [`puter-insights.md`](./puter-insights.md).

- `src/domain/gitfs.ts` — **não** faz checkout (a sessão Arena não sai de `arena/…`). `commit-tree` + `update-ref refs/heads/actos/fs`.
- Cada `Kernel.write` materializa o path no tree; `mount` cria `refs/actos/runtime/{pid}`; `unmount` apaga a ref.
- CLI `npx tsx src/cli/fs-sync.ts --init|--push`. UI `/disco`.
- SQLite = FSEntry (projecção). git = storage UID/SHA.

Entrega: o disco **é** um ramo git. Push para origin quando o remoto aceitar `actos/fs`.

### F3 — L1/L2 como CDN edge — **feito** neste ramo

- Local analog: `src/domain/cdn.ts` (`.actos-l1/{sha}`, tickets em `data/tickets/`).
- `actions/cache` key `actos-l1-{hashFiles}-{ref}`; `restore-keys: actos-l1-`. **Não grava L1 em pull_request.**
- Artifact = ticket `{sha, path, runId}`, `retention-days: 1` (nunca o blob).
- `harness/github/gc.yml` — promote-before-evict, `concurrency: actos-fs`.
- UI `/cdn`, CLI `npx tsx src/cli/gc.ts --promote|--ticket|--stat`.

Entrega: lookup L1 → SQLite/L3; L1 nunca é origem.

### F4 — CPU event-driven (agent as job) — **parcial neste ramo**

- `src/domain/irq.ts` — IRQ persistente (`data/irq.jsonl`).
- `enqueueAgent` emite `repository_dispatch` payload `{ event_type: "agent.run", client_payload }`.
- `GET/POST /api/irq`. CPU continua `drain` / Action.
- Testes de validação/sucesso: `npm test`.

Ainda falta copiar YAML para `.github/workflows/` na default branch (token sem `workflows`).

- YAML em `.github/workflows/` (cópia única para `main`).
- `POST /api/agents/run` → `repository_dispatch` `actos.syscall`.
- Slice: se o job aproxima timeout, checkpoint L3 + dispatch `actos.slice`.
- `workflow_run` → persist (já esboçado em `runtime-persist.yml`).

Entrega: o request HTTP não é o processo. O runner é.

### F5 — CDN público + regras — **feito** (árvore local; Pages é acção humana)

- `src/domain/public-cdn.ts` — deny some, redact secrets, skip `/runtime` `/sys` `/agents`.
- URLs: imutável `obj/{sha}.json` + estável `{path}.json`. Purge = reexport.
- CLI `npm run cdn:export`, UI `/publico`, `GET /api/publico`.
- GitHub Pages na `main` continua a ser a tua acção (igual aos workflows) — ver `docs/ACAO-HUMANA.md`.

### F6 — multi-repo (Nível C) — **feito** neste ramo

- `PATTERNS.objectNs` = `/objects/{repo}/{kind}/{id}` (`repoSlug("acme/shop")` → `acme--shop`).
- `POST /api/ingest` `{ repo, kind, payload }`.
- Node **20** nos YAML + `NODE_NO_WARNINGS=1` (gh-aw / Actions JS). Kernel: `node:sqlite` se existir, senão `FileDb`.
- Ver [`docs/gh-aw.md`](./gh-aw.md).

---

## 7. O que *não* fazer

- Usar `main` como VFS (polui o código, rebenta o cache de CI).
- Force-push `actos/fs`.
- Meter o blob inteiro em artifact “porque é fácil”.
- Confiar no cache de PR como verdade.
- Banner Arena dentro do kernel.
- Esperar que L1 seja disco. É edge. 7 dias, LRU, isolamento de branch.

---

## 8. Semelhança que importa

| Sistema | Lição para ACTOS |
| --- | --- |
| CDN (Cloudflare/Fastly) | identidade = hash; edge ≠ origin; purge explícito |
| git / Nix / IPFS | CAS; o path é nome, o sha é o objecto |
| Plan 9 /proc | runtime é ficheiro; unmount é unlink da ref |
| Lambda + S3 + CloudFront | CPU sem memória; S3 origin; CloudFront L1 |
| gh-aw Cache vs Repo Memory | GitHub já admite as duas memórias — nós damos-lhes **path + regras + journal** |

A usabilidade que criamos: **GitHub deixa de ser CI e passa a ser um computador serverless cujo disco é o repositório, cuja RAM é o cache, cujo CDN são Pages/tags, e cujo syscall é um workflow event-driven.**

---

## 9. AHEAD — protocolo (injeção permanente)

Fonte viva: [`AHEAD.md`](./AHEAD.md). O agente **não** fecha um turno sem actualizar esse ficheiro.

| Evento | Acção obrigatória |
| --- | --- |
| Item feito, sem residual | marcar **`[sucesso sem debito]`** no checklist |
| Erro / parcial / 403 / CI fail | subitem na todolist: `ERRO <id>: … → fazer: …` |
| Cada commit `[arena-agent]` | ledger + checklist + bloco **próxima actividade** |
| `actos/fs` | ahead cresce (append); behind da `main` mantém-se |
