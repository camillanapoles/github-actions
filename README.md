# ACTOS — Actions Operating System

GitHub Actions como **sistema operacional**.

O runner é o CPU (serverless). O que está a correr agora é o **espaço único** (`/runtime`). Quando a execução resolve, **tudo vira objeto** e é gravado num path derivado de **pattern + id**. As **regras** (chmod/LSM) decidem leitura e escrita. A UI é uma **page async** (React Server Component) que lê a **base de dados** — o resultado cacheado das Actions, não um cliente a polling.

O harness agentic **também é backend**: o agente é uma GitHub Action (`.github/workflows/agent-harness.yml`) e o mesmo CLI (`src/cli/agent.ts`).

```
Action entra no runtime          →  /runtime/runs/{id}     (RAM)
resolve: payload vira objeto     →  /objects/{kind}/{id}   (disco)
cache da execução                →  /cache/{workflow}/{sha}/{id}
agente (workflow)                →  /agents/{id}/runs/{runId}/steps/{n}
depois de read/write             →  regras no path
```

## Page async + DB

`src/app/execucoes/page.tsx` é um Server Component:

```ts
export default async function ExecucoesPage() {
  const cached = getKernel().listCachedExecutions();
  // render — dados já materializados na SQLite
}
```

Não há `useEffect` para ir buscar runs. O kernel persiste execuções cacheadas; a page só lê.

## Backend orientado a objeto

Não é um CRUD solto em cima de tabelas. O kernel (`src/domain/kernel.ts`) trata:

| OS | ACTOS |
| --- | --- |
| process table | `Kernel.ps()` — espaço único |
| filesystem | `StoredObject` em pattern+id |
| inode path | `ObjectPath` (`src/domain/path.ts`) |
| chmod / LSM | `RuleEngine` |
| syscalls | `ps`, `ls`, `fork`, `resolve`, `cache.get/put`, `snapshot` |
| programa | workflow YAML (GitHub Action + `harness/workflows/agent.yaml`) |

CRUD existe (`objects`, `executions`, `rules`, `agents`). Por cima: **funcionalidades** — resolver execução, cachear, montar/desmontar runtime, fork, harness.

## Serverless runtime

Cada job do GitHub Actions é um processo efémero. ACTOS modela isso:

1. `in_runtime` — vive só no espaço único
2. `resolved` — objectify
3. `cached` — path estável, a page async serve da DB

Workflows (fonte em `harness/github/` — copiar para `.github/workflows/` no repo):

- `agent-harness.yml` — o agente **é** a Action
- `runtime-persist.yml` — unmount → objeto
- `cache-executions.yml` — tece o cache
- `ci.yml` — typecheck + smoke do CLI + injeção `arena-agent`
- `arena-session.yml` — retorno non-commit (comentário PR + label + summary)

## Sessão Arena `[arena-agent]` (não confundas)

Isto **não vive só no commit**. A UI, o comentário do PR e o summary da Action dizem o mesmo:

1. **Não faças merge** enquanto quiseres continuar. Deixa o PR aberto.
2. O agente faz **commit e push só** para `arena/<sessao>`.
3. O PR atualiza sozinho.
4. **Fim** só se disseres claramente: `merge`, `fim`, `fechar`.

Merge **não** apaga a sessão. Apagar o ramo `arena/…` é que a perde. Ver `harness/rules/arena-session.md`.

## Correr local

```bash
npm install
npm run dev
```

UI em `http://localhost:3000`. SQLite em `data/actos.db` (`node:sqlite`).

```bash
npm run seed
npx tsx src/cli/agent.ts --goal "Indexar cache e persistir objetos"
```

## API

- `GET /api/executions?cached=1`
- `GET /api/objects?prefix=/objects`
- `GET /api/runtime`
- `POST /api/agents/run` `{ "goal": "..." }`
