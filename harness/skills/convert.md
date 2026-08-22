# Skill `/convert` — converter um repo para o modelo ACTOS

Agente: lê isto **antes** de tocar no projecto alvo.

## O que mudamos

| Antes (típico) | Depois (ACTOS) |
| --- | --- |
| `docker compose up` / `docker build` como *como corre* | **Runner GitHub = CPU**. `npm ci` + script. Sem container. |
| Resultado some no log | Objecto em `/objects/{repo}/{kind}/{id}` |
| Cache opaco | CAS `sha256` + artifact ticket `{sha,path,runId}` |
| Agente noutro sítio | O job **é** o agente |

Docker só fica se for *artefacto de deploy* (nginx estático). **Nunca** é o CPU da ingestão / teste / cálculo.

## Protocolo

1. Inventariar: `Dockerfile`, `docker-compose*`, `.github/workflows/*`, `package.json` scripts.
2. Classificar cada comando:
   - **CPU** (test, ingest, build, refresh) → workflow `actos-cpu` / receita
   - **Serve UI** (nginx, vite preview) → local `npm run dev` / Pages; não é syscall
3. Instalar plugin:
   ```bash
   bash /path/to/github-actions/plugin/actos/install.sh /path/to/alvo
   ```
4. Trocar jobs Docker por:
   ```yaml
   - uses: actions/setup-node@v6
     with: { node-version: "20" }
   - run: npm ci
   - run: bash .actos-plugin/bin/actos-wrap.sh --kind execution -- npm test
   ```
5. Persist + (opcional) `ACTOS_INGEST_URL` → hub `camillanapoles/github-actions`.
6. Não copies o kernel Next inteiro. O plugin basta (Nível A). Nível C = ingest.

## Receita: `camillanapoles/llm-infra-planner`

Já é Node 20 + `npx tsx scripts/ingest-models.ts` / `refresh-cloud-prices.ts`.
Docker = só SPA nginx.

Conversão:

1. `install.sh` no checkout do planner → cria `.actos-plugin` + `actos-llmcalc.yml`.
2. Deixa `ingest-models.yml` / `refresh-prices.yml` **ou** substitui pelo `actos-llmcalc.yml`.
3. `npm test` / `npm run build` no runner — **proibido** `docker compose` nesses jobs.
4. Objectos: `/objects/camillanapoles--llm-infra-planner/model-ingest/{runId}`.
5. Secret opcional `ACTOS_INGEST_URL` = URL do hub `/api/ingest`.

Não abras PR no planner a partir desta sessão Arena (ramo fixo `arena/01a01e33-github-actions` **deste** repo). Entrega aqui o plugin; aplicação no planner = checkout separado / humano.

## Depois de instalar

- Actions → **actos-cpu** → Run.
- Hub: `POST /api/ingest` `{ repo, kind, payload }`.
- Skill `/loop` só neste repo ACTOS após `git push`.
