# Validação do trampolim na `main`

Executado: `1ced5fd` `chore: Node 20 trampoline` em `main`. **Não foi merge.**

## O que está certo

| Check | Estado |
| --- | --- |
| `.github/workflows/agent-harness.yml` | Node 20, `NODE_NO_WARNINGS=1`, checkout do `arena/…` |
| `ci.yml` | Node 20, `npm test` |
| `gc.yml` | Node 20, `concurrency: actos-fs` |
| `actos-gc` schedule | **success** (run 32505289555) |
| Secrets | **nenhum obrigatório** para Run workflow na UI |
| Variables | **nenhuma obrigatória** |
| Rulesets | nenhum (ok por agora) |
| Ramo `arena/01a01e33-github-actions` | intacto |
| Ramo `actos/fs` | intacto (disco L3) |
| Pages | `https://camillanapoles.github.io/github-actions/` (source = `main` `/` — README, não o `.actos-cdn`) |

## O que **não** precisas (ainda)

- `GITHUB_TOKEN` extra — o job já pede `permissions: contents: write` / `actions: write`
- OpenAI / LLM keys — o harness é workflow determinístico
- `ACTOS_REPO` — só para F6 ingest namespaced
- Ruleset a bloquear `main` — opcional; **não** bloqueies o ramo `arena/` nem o apagues

## Settings que convém confirmares na UI (1 min)

Repo → **Settings → Actions → General**:

1. **Actions permissions** → Allow all actions and reusable workflows  
2. **Workflow permissions** → **Read and write permissions**  
   (senão o `gc` não faz push a `actos/fs` e o cache save pode falhar)  
3. **Allow GitHub Actions to create and approve pull requests** → desligado (não precisamos)  
4. Artifact retention → 1–7 dias (os tickets já levam `retention-days: 1`)

**Secrets** (opcional, só se quiseres disparar o CPU **de fora** do GitHub):

| Name | Para quê |
| --- | --- |
| `ACTOS_DISPATCH_TOKEN` | PAT `repo` + `workflow` para `repository_dispatch` a partir da API local |

Sem este secret, usa **Actions → agent-harness → Run workflow**.

**Rulesets** (opcional, protecção):

- `main`: require PR **ou** deixa livre — o trampolim YAML já lá está  
- **Não** applies a `arena/01a01e33-github-actions` com delete protection se fores tu a querer apagar no fim  
- `actos/fs`: bloquear **force-push** (append-only)

## Local: o teu checkout arena está atrás

```
Your branch is behind 'origin/arena/…' by 2 commits
```

```bash
git checkout arena/01a01e33-github-actions
git pull
```

## Confirmado na `main` (`9487a17`)

`ci.yml` já tem `permissions: contents: read` no workflow **e** no job `qa`. O aviso dos codebots na linha 9 fica resolvido depois deste push.

CodeQL **Analyze (actions)** no PR #1 pode falhar com *no source code seen*: o ramo `arena/` **não tem** `.github/workflows/` (o token Arena não escreve workflows). Os YAML vivem só na `main`. É esperado — não é regressão do trampolim. CodeQL em `push` à `main` (onde os YAML estão) é o scan que conta.

## Codebots: `ci.yml` sem `permissions`

Corrigido em `harness/bootstrap-main/ci.yml`:

```yaml
permissions:
  contents: read
jobs:
  qa:
    permissions:
      contents: read
```

CI só lê o repo e corre testes — least privilege. Harness/gc pedem `contents: write` + `actions: write` (L3/L1).

Volta a copiar o trampolim para `main` (sem merge):

```bash
git checkout main && git pull
git checkout origin/arena/01a01e33-github-actions -- harness/bootstrap-main
cp harness/bootstrap-main/*.yml .github/workflows/
git add .github/workflows && git commit -m "fix: explicit permissions on ci.yml" && git push
git checkout arena/01a01e33-github-actions
```

## Smoke do CPU

Actions → **agent-harness** → Run workflow → goal `smoke cpu github`.

O job faz checkout do **arena**, não do `main`. Se falhar em `contents: write`, é o ponto 2 das settings.
