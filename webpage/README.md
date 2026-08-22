# `webpage/` — páginas estáticas convertidas (Docker ➞ ACTOS)

Este diretório contém **sites estáticos gerados** a partir de projetos que antes
usavam Docker para servir o seu produto. Cada subdiretório é publicado como
**subdiretório** da GitHub Pages do hub — **sem sobreescrever** a UI raiz do ACTOS.

```
webpage/
└── llm-infra-planner/     # LLMcalc (SPA) — antes: Docker + nginx; agora: build no runner
```

## Porquê um subdiretório?

A Pages do hub publica `.actos-cdn/` (raiz = UI ACTOS em
`https://camillanapoles.github.io/github-actions/`). O export
([`src/cli/cdn-export.ts`](../src/cli/cdn-export.ts)) copia `webpage/` para
dentro de `.actos-cdn/`, logo:

- `webpage/llm-infra-planner/` → `https://camillanapoles.github.io/github-actions/llm-infra-planner/`
- a UI ACTOS continua em `/` (não é sobreescrita)

## Como é gerado

O exemplo [`examples/06-docker-to-actos`](../examples/06-docker-to-actos) documenta
a conversão. Resumo:

1. O clone de `llm-infra-planner` é buildado no runner (`npm ci && npx vite build --base ./`).
2. O `dist/` é copiado para `webpage/llm-infra-planner/`.
3. `node examples/06-docker-to-actos/run.mjs` persiste um objeto `llmcalc-page`.
4. `npm run cdn:export` (no trampolim `cdn-pages.yml`) inclui `webpage/` no `.actos-cdn`.
5. A GitHub Pages publica — **mesmo efeito do Docker**, sem daemon nem imagem.

## Conteúdo comitado

O `webpage/llm-infra-planner/` está comitado para a página existir de imediato.
O workflow `actos-llmcalc-page.yml` (em `examples/06-docker-to-actos/workflows/`)
reconstrói-o na CI e faz commit, mantendo-o atualizado.
