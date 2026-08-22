# Converter outro projecto para o modelo ACTOS

Como **utilizar** o que produzimos. Sem copiar o Next inteiro. Sem Docker como CPU.

Plugin: [`plugin/actos/`](../plugin/actos/).  
Skill do agente: [`harness/skills/convert.md`](../harness/skills/convert.md).

## Ideia em 4 linhas

1. O **runner** é o CPU (igual ao `agent-harness`).
2. O comando do projecto (`npm test`, `npx tsx scripts/foo.ts`) corre **nu** no job.
3. O resultado vira **objecto** `pattern+id` (`actos-persist`).
4. Opcional: o hub ACTOS (`POST /api/ingest`) indexa esse objecto.

`docker compose` / `docker build` deixam de ser “como se executa”.  
Podem ficar só para *servir* um estático em casa — não na Action.

## Instalar o plugin no alvo

```bash
git clone https://github.com/camillanapoles/github-actions.git actos-src
cd /path/to/outro-repo
bash /path/to/actos-src/plugin/actos/install.sh .
git add .actos-plugin .github/workflows/actos-cpu.yml
git commit -m "chore: ACTOS CPU plugin (runner, not docker)"
```

Secrets opcionais no alvo:

| Secret | Função |
| --- | --- |
| `ACTOS_INGEST_URL` | `https://<hub>/api/ingest` |
| `ACTOS_INGEST_TOKEN` | se o hub exigir auth |

## Níveis

| Nível | O que levas | Quando |
| --- | --- | --- |
| **A — plugin** | `.actos-plugin` + `actos-cpu.yml` | 95% dos repos |
| **B — kernel** | `src/domain` + `src/db` | precisas de `ps`/`resolve` no processo |
| **C — hub** | um ACTOS a correr + ingest | vários repos, uma UI |

## Caso: [llm-infra-planner](https://github.com/camillanapoles/llm-infra-planner)

O que ele é: calculadora LLM **no browser**. Jobs `ingest-models` e `refresh-prices` **já são** `npx tsx` no `ubuntu-latest`. O `Dockerfile` só empacota nginx+SPA.

O que mudar:

| Hoje | ACTOS |
| --- | --- |
| `docker compose up` para “correr o produto” | local: `npm run dev` (vite). CI: `npm run build` no runner |
| ingest/prices criam PR com YAML | iguais, **mais** `actos-wrap` → objecto + artifact |
| resultado só no PR/data yml | também `/objects/camillanapoles--llm-infra-planner/model-ingest/{id}` |

Receita pronta: `plugin/actos/recipes/llm-infra-planner.yml` → `.github/workflows/actos-llmcalc.yml`.

```bash
cd llm-infra-planner
bash ../github-actions/plugin/actos/install.sh .
# commit no planner (outra sessão / tua conta)
```

Actions → **actos-llmcalc** → `job=test` | `ingest` | `prices` | `build`.

## Contrato do objecto

```json
{
  "kind": "execution",
  "path": "/objects/acme--shop/execution/98765",
  "pattern": "/objects/{repo}/{kind}/{id}",
  "payload": { "status": 0, "sha": "…", "log": "…" }
}
```

Hub:

```http
POST /api/ingest
{ "repo": "acme/shop", "kind": "execution", "id": "98765", "payload": { } }
```

## O que *não* fazer

- `docker build` dentro do job ACTOS “porque era assim”.
- Copiar `src/app` Next para um Vite app.
- Force-push `actos/fs` do hub.
- Tratar L1 cache como disco.
