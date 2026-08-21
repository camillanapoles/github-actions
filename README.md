# ACTOS — Actions Operating System

GitHub Actions modeladas como **sistema operacional**.

O runner é o CPU (serverless). O que ainda está a correr é o **espaço único** (`/runtime`). Quando a execução **resolve**, tudo vira **objeto** e fica num path `pattern + id`. **Regras** (chmod/LSM) decidem leitura e escrita. A UI é uma **page async** (React Server Component) que lê a **base** — resultado cacheado das Actions, não o browser a fazer polling.

O harness agentic **também é backend**: o mesmo programa corre como GitHub Action e como CLI local.

```
Action entra no runtime     →  /runtime/runs/{id}                      RAM
resolve: vira objeto        →  /objects/{kind}/{id}                    disco
cache da execução           →  /cache/{workflow}/{sha}/{id}
agente (workflow)           →  /agents/{id}/runs/{runId}/steps/{n}
depois de read/write        →  regras no path
```

Tag de sessão: **`arena-agent`**. PR: https://github.com/camillanapoles/github-actions/pull/1

- Audit: [`docs/audit.md`](docs/audit.md)
- Plano (GitHub = FS + memória + CDN): [`docs/plan-github-os.md`](docs/plan-github-os.md)
- Puter.js → camadas FS: [`docs/puter-insights.md`](docs/puter-insights.md)
- **A tua acção (CPU, sem merge):** [`docs/ACAO-HUMANA.md`](docs/ACAO-HUMANA.md)
- gh-aw / Node 20: [`docs/gh-aw.md`](docs/gh-aw.md)

---

## 1. Caso do projeto — o que resolve

**Problema.** GitHub Actions são efémeras: o job acaba, o log some na UI, o cache é uma chave opaca, o agente (se existir) vive noutro sítio (chat, notebook, Lambda). Não há um sítio único onde:

- o que está **a correr agora** (runtime) seja visível como tabela de processos
- o que **já correu** fique objeto estável, consultável por path
- uma **page async** sirva isso da base, sem o cliente ir à API da GitHub a cada refresh
- um **agente** use o mesmo workflow que a CI, e grave cada step no mesmo store

**Solução ACTOS.** Tratar Actions como OS:

| Sintoma no mundo real | ACTOS |
| --- | --- |
| “Onde está o resultado da Action de ontem?” | objeto em `/objects/execution/{id}` + cache em `/cache/{workflow}/{sha}/{id}` |
| “Ainda está a correr?” | `Kernel.ps()` — espaço único `/runtime/runs/{id}` |
| “A page precisa de `useEffect` + GitHub token” | RSC async lê SQLite; a Action é que escreve |
| “O agente é um chat à parte da CI” | o agente **é** a Action (`agent-harness.yml` + `src/cli/agent.ts`) |
| “CRUD na tabela não chega” | syscalls: `ps`, `fork`, `resolve`, `cache.get/put`, `snapshot` |
| “Quem pode ler logs/secrets?” | `RuleEngine` no path, depois de cada read/write |

**Não é** um substituto do GitHub. É a camada **objeto + runtime + cache + harness** em cima, que podes colar noutro repo.

---

## 2. Instruções de uso (este repo)

Requisitos: Node.js 22+ (usa `node:sqlite`).

```bash
git clone https://github.com/camillanapoles/github-actions.git
cd github-actions
npm install
npm run seed          # materializa a DB em data/actos.db
npm run dev           # UI em http://localhost:3000  (0.0.0.0)
```

### Páginas (async, leem a DB)

| Rota | O que mostra |
| --- | --- |
| `/` | kernel: processos, cache hits, kinds |
| `/runtime` | espaço único (`ps` / `fork`) |
| `/execucoes` | execuções cacheadas das Actions |
| `/objetos` | object store; click abre `/objetos{path}` |
| `/agentes` | harness — dispara um **goal** (backend) |
| `/regras` | ACL no path |
| `/sys` | consola de syscalls |

### CLI do agente (o mesmo que a Action)

```bash
npx tsx src/cli/agent.ts --goal "Indexar cache e persistir objetos"
npx tsx src/cli/agent.ts --drain          # CPU da fila (HTTP só enfileira)
npx tsx src/cli/agent.ts --agent cache-weaver --goal "Tecer /cache/{workflow}/{sha}/{id}"
```

Cada step grava objeto em `/agents/{id}/runs/{runId}/steps/{n}`. Se a `cacheKey` já existir, é **HIT** e não reentra no runtime.

### API HTTP

```http
GET  /api/runtime
GET  /api/executions?cached=1
GET  /api/objects?prefix=/objects
POST /api/objects          { "kind": "note", "payload": { } }
POST /api/ingest           { "repo": "acme/shop", "kind": "execution", "payload": { } }
POST /api/agents/run       { "goal": "…", "agentId": "harness" }
GET  /api/syscalls
POST /api/syscalls         { "name": "ps", "args": {} }
```

Syscalls úteis: `ps`, `ls`, `read`, `write`, `resolve`, `cache.stat`, `snapshot`, `fork`, `path.resolve`.

### Scripts npm

| Script | Função |
| --- | --- |
| `npm run dev` | Next.js em `0.0.0.0:3000` |
| `npm run seed` | (re)popula SQLite se estiveres a partir do zero |
| `npm run agent` | CLI do harness |
| `npm run session-notice` | injeta o aviso de sessão no PR (não é commit) |
| `npm run build` / `start` | produção |

Base: `data/actos.db`. Object files (disco analog): `data/objects/**`. Ambos estão no `.gitignore`.

---

## 3. Usar com **outros** projetos

ACTOS não precisa de ser a app inteira do outro repo. Há três níveis de integração, do mais leve ao mais fundo.

### Nível A — só o workflow (outro repo GitHub)

Copia `harness/github/` para `.github/workflows/` no projeto alvo.

```
projeto-alvo/
  .github/workflows/
    agent-harness.yml      ← o agente É a Action
    runtime-persist.yml    ← quando a Action acaba, vira objeto
    cache-executions.yml   ← tece o cache
    arena-session.yml      ← aviso de sessão (PRs arena/)
    ci.yml
```

No alvo:

1. `npm` (ou o runtime que já usas) tem de conseguir correr `npx tsx src/cli/agent.ts` **ou** troca o `run:` por um container/`docker run` que chame o CLI.
2. Os artifacts sobem com path `data/objects/...` — o padrão `pattern + id`.
3. A UI ACTOS (este repo, ou um deploy teu) **ingere** esses artifacts: descarregas o zip e o kernel trata cada JSON como `StoredObject`.

Mínimo para um repo que só quer “persistir o resultado da CI”:

```yaml
# no outro projeto
- name: Persist as object
  run: |
    mkdir -p data/objects/objects/execution
    node -e "
      const fs = require('fs');
      const id = process.env.GITHUB_RUN_ID;
      const obj = {
        pattern: '/objects/{kind}/{id}',
        kind: 'execution',
        id,
        path: '/objects/execution/' + id,
        payload: { sha: process.env.GITHUB_SHA, repo: process.env.GITHUB_REPOSITORY },
      };
      fs.writeFileSync('data/objects/objects/execution/' + id + '.json', JSON.stringify(obj, null, 2));
    "
- uses: actions/upload-artifact@v4
  with:
    name: objects-${{ github.run_id }}
    path: data/objects/
```

Depois, no ACTOS (este serviço), um job ou um `POST /api/objects` importa o JSON. A page `/execucoes` passa a mostrar a run **daquele** projeto, cacheada.

### Nível B — kernel como biblioteca (mesmo processo)

Noutro app Node (Next, Fastify, worker):

```ts
import { getKernel } from "actos/src/domain/kernel"; // ou copia src/domain + src/db

const k = getKernel();
k.write({ kind: "build", payload: result });          // path = /objects/build/{id}
k.resolveExecution(id);                               // runtime → objeto → cache
await k.runAgent("gerar changelog a partir das runs"); // harness
```

O que tens de levar:

```
src/domain/     kernel, path, rules, types
src/db/         client SQLite, repo, seed
src/harness/    runner do YAML interno
src/cli/        agent.ts
harness/        workflows + rules
```

A UI (`src/app`) é opcional. O contrato é o **path** e o **kernel**, não o React.

### Nível C — ACTOS como serviço (vários projetos à frente)

Sobe **um** ACTOS. Cada projeto remoto manda objetos:

```http
POST https://actos.teu.dominio/api/objects
Content-Type: application/json

{
  "kind": "execution",
  "path": "/objects/execution/98765001",
  "payload": {
    "repo": "acme/checkout",
    "workflow": "ci.yml",
    "sha": "abc123…",
    "conclusion": "success"
  }
}
```

Convenção de path para multi-repo (estende o pattern):

```
/objects/{kind}/{repo}/{id}
/cache/{repo}/{workflow}/{sha}/{id}
/runtime/runs/{repo}/{id}
```

Hoje o pattern default é `/objects/{kind}/{id}`. Para namespacing, passa `path` explícito no `write` / `POST`. As regras (`/regras`) podem negar writes fora do prefixo do repo (`matchPattern: /objects/**/acme/**`).

---

## 4. Replicar o sistema (do zero, noutro sítio)

Checklist para um clone fiel:

1. **Runtime = espaço único**  
   Tudo o que ainda corre vive em memória/`runtime_space`, path `/runtime/runs/{id}`. Não misturar com objetos persistidos.

2. **Resolve = objectify**  
   Quando o job acaba: serializar o payload, `unmount` do runtime, `write` no object store, `cache.put` com chave `actos-{workflow}-{sha}-{hash}`.

3. **Path = pattern + id**  
   Nunca gravar “na tabela solta”. Sempre derivar o path de um pattern conhecido (`src/domain/path.ts`). Depois do write, **regras**.

4. **Page async lê a DB**  
   Server Component, `dynamic = 'force-dynamic'`. A GitHub Action escreve; a page só lê cache.

5. **Agente = workflow, não o browser**  
   Goal entra por form/API → kernel → `harness/workflows/agent.yaml` → CLI. A Action `.yml` chama o mesmo CLI.

6. **CRUD + syscalls**  
   Tabelas para persistir; API de sistema (`ps`, `fork`, `resolve`, `snapshot`) por cima.

7. **Copiar YAML para `.github/workflows/`**  
   A fonte neste repo está em `harness/github/` (o token da sessão Arena não consegue criar ficheiros em `.github/workflows`). Noutro repo, com permissão `workflows`, copia:

   ```bash
   mkdir -p .github/workflows
   cp harness/github/*.yml .github/workflows/
   ```

### Mapa de ficheiros

```
src/domain/kernel.ts          kernel (syscall table)
src/domain/path.ts            pattern + id
src/domain/rules.ts           chmod analog
src/db/                       SQLite (node:sqlite)
src/app/execucoes/page.tsx    page async das runs cacheadas
src/cli/agent.ts              processo da Action
harness/workflows/agent.yaml  programa interno do agente
harness/github/*.yml          GitHub Actions (fonte)
harness/rules/arena-session.md regra de sessão (non-commit)
```

---

## 5. Analogia OS (referência rápida)

| OS | ACTOS |
| --- | --- |
| process table | `Kernel.ps()` |
| filesystem / inode | `StoredObject` em `pattern + id` |
| chmod / LSM | `RuleEngine` |
| RAM | `/runtime` — único, efémero |
| disco | `/objects`, `/cache` |
| syscall | `ps ls fork resolve cache snapshot` |
| programa | workflow YAML |
| CPU serverless | GitHub-hosted runner |

Ciclo: `queued → in_runtime → resolved → cached`.

---

## 6. Sessão Arena `[arena-agent]` — não confundas

Isto **não vive só no commit**. A UI, o comentário do PR e o summary da Action dizem o mesmo.

Se quiseres **continuar**:

1. **Não faças merge ainda.** Deixa o PR aberto.
2. O agente faz **commit e push só** para `arena/<sessao>`.
3. O PR atualiza sozinho.
4. **Fim** só se disseres claramente: `merge`, `fim`, `fechar`.

Merge **não** apaga a sessão. Apagar o ramo `arena/…` é que a perde. Ver `harness/rules/arena-session.md`.
