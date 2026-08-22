# 06 — Docker ➞ ACTOS (converter o `llm-infra-planner`)

Caso de uso real: o [`llm-infra-planner`](https://github.com/camillanapoles/llm-infra-planner)
(LLMcalc) é uma **SPA 100% client-side** (Vite + React). Hoje é servida por um
**Docker + nginx**. Aqui mostramos o equivalente **GITOS**: o runner do GitHub
Actions é o CPU, o build corre **nu** no job, e o resultado é publicado como
**GitHub Page estática** — sem daemon, sem imagem, sem `docker build`.

> O efeito é **idêntico ao do Docker**: um site estático que serve a calculadora
> LLMcalc. A diferença é *como* é produzido e *onde* vive.

## Antes — Docker (o que havia)

```dockerfile
# Dockerfile — stage 1 constrói, stage 2 serve com nginx
FROM node:20-alpine AS builder
RUN npm ci && npm run build          # => dist/
FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
```

```bash
docker compose up --build            # container nginx a servir :3000
```

Problemas: daemon local, imagem + `npm ci` em cada build, resultado some com o
container, e a CI precisa de Docker.

## Depois — ACTOS (GITOS)

O **runner** é o CPU. O mesmo `npm run build` corre no `ubuntu-latest`; o
`dist/` vira uma **GitHub Page** em `webpage/llm-infra-planner/` e é publicado
como subdiretório da Pages do hub — **sem sobreescrever** a UI raiz.

```bash
# 1) correr localmente (igual na CI) — CPU = node, nunca docker
node examples/06-docker-to-actos/run.mjs

# 2) ou disparar o workflow convertido (ref: workflows/actos-llmcalc-page.yml)
#    on: workflow_dispatch | schedule — build no runner + publica webpage/
```

Mapeamento Docker ➞ ACTOS:

| Passo | Docker | ACTOS (GITOS) |
| --- | --- | --- |
| correr o build | `docker compose build` (node:20 alpine) | `setup-node` + `npm ci && npx vite build` no runner |
| servir o site | container nginx (:80 → :3000) | **GitHub Pages** em `/llm-infra-planner/` |
| guardar o resultado | volume eféméro do container | objeto `/objects/.../llmcalc-page/{id}` + artefacto |
| agendar | cron do host | `on: schedule` no YAML |
| histórico | log que some | objetos consultáveis + page async do hub |

## O que fica no repo

```
examples/06-docker-to-actos/
├── README.md                      # este ficheiro (antes/depois)
├── run.mjs                        # CPU local: build → webpage/ + persist objecto
├── llm-infra-planner/             # diretório CLONADO do projeto-alvo (sem .git)
│   ├── src/ scripts/ data/ public/
│   ├── Dockerfile  docker-compose.yaml  nginx.conf   # o "antes"
│   └── package.json  vite.config.ts  index.html
└── workflows/actos-llmcalc-page.yml   # o "depois" (copiar p/ .github/workflows)

webpage/llm-infra-planner/         # site estático gerado (o "mesmo efeito do Docker")
```

## Comando exato (CPU)

```bash
node examples/06-docker-to-actos/run.mjs
# → cria webpage/llm-infra-planner/ (se já não existir um build real)
# → persiste data/objects/objects/camillanapoles--github-actions/llmcalc-page/<id>.json
```

## Porque não sobrescreve

A Pages do hub publica `.actos-cdn/` (raiz = UI ACTOS). O `cdn-export` copia
`webpage/` para dentro de `.actos-cdn/`, logo a calculadora fica em
`/llm-infra-planner/` — subdiretório, não na raiz. Ver
[`src/cli/cdn-export.ts`](../../src/cli/cdn-export.ts).

> Nota de routing: a SPA usa `base: './'`, portanto os assets resolvem bem sob
> qualquer prefixo de Pages. Deep-links por `BrowserRouter` podem dar 404 no
> refresh (limitação da GitHub Pages, não do ACTOS) — o `index.html` também é
> copiado para `404.html` como fallback best-effort.
