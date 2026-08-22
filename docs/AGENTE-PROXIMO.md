# Instrução — próximo agente (este repo `github-actions`)

Lê isto **antes** de escrever código.

## Ramo

- Código e exemplos: **`main`** (esta sessão fez merge do PR #1).
- Disco: `actos/fs` — só append via kernel / plugin. **Proibido checkout para editar.**
- Se abrires sessão Arena nova: cria `arena/<id>` a partir de `main`. **Não apagues** `arena/01a01e33-github-actions`.

## Missão 1 — 5 projectos-exemplo de uso

Pasta: `examples/` (já há esqueleto + README). Completa **cinco** casos distintos até `npm test` e um `actos-persist` passarem em cada um:

| Id | Pasta | Uso | CPU (sem Docker) |
| --- | --- | --- | --- |
| 1 | `examples/01-hello-cpu` | script único | `node index.mjs` + persist `kind=hello` |
| 2 | `examples/02-test-suite` | testes | `node --test` + persist `kind=test` |
| 3 | `examples/03-data-ingest` | job de dados (tipo planner) | `node ingest.mjs` + persist `kind=model-ingest` |
| 4 | `examples/04-static-build` | site estático | `node build.mjs` escreve `dist/` + persist `kind=build` |
| 5 | `examples/05-hub-ingest` | Nível C | monta JSON `POST /api/ingest` `{repo,kind,id,payload}` |

Regras:

- **Proibido** `docker compose` / `docker build` como CPU.
- Objecto em `data/objects/objects/{repo}/{kind}/{id}.json` via `plugin/actos/bin/actos-persist.mjs`.
- Cada pasta: `README.md` (5 linhas: o quê, comando, path do objecto).
- Não cries repos GitHub novos a menos que o humano peça. São *exemplos neste repo*.

## Missão 2 — testes neste mesmo projecto

Ficheiros sob `src/**/*.test.ts` ou `examples/**/*.test.mjs`, corridos por `npm test` **ou** um script `npm run test:examples`.

Cobrir no mínimo:

1. `actos-persist` escreve path namespaced (`repoSlug`).
2. `publishObjects` + `cdnBase()` com `GITHUB_REPOSITORY` (já existe — não partas).
3. Cada exemplo 01–05: comando CPU exit 0 e JSON do objecto válido (`kind`, `path`, `payload`).
4. `POST /api/ingest` shape (podes testar o kernel `ingest()` sem HTTP).

Depois de `npm test` verde: `git push` e `npm run loop` se estiveres neste repo com Actions.

## Missão 3 — validar docs

Checklist. Se alguma falhar, **corrige a doc** (não “explica na resposta e deixa a doc mentir”):

- [ ] `docs/HOWTO.md` diz **qual ramo** clonar (`main`)
- [ ] README aponta HOWTO + CONVERTER + examples na 1ª página
- [ ] CONVERTER não manda copiar o Next
- [ ] Ninguém manda `git checkout actos/fs` para trabalhar
- [ ] Plugin `install.sh` funciona a partir de `main`
- [ ] Exemplos 01–05 têm README com o comando exacto

## O que *não* fazer

- Merge/force-push `actos/fs`
- Apagar `arena/01a01e33-github-actions`
- Docker como CPU
- Abrir PR no `llm-infra-planner` sem o humano pedir
