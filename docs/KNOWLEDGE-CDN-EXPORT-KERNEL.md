# Knowledge — CDN export: o kernel que executa NÃO é o kernel que pensas

**Data:** 2026-08-22 · **Repo:** `camillanapoles/github-actions`
**Commits envolvidos:** `93a885a` (main), `29e2bef` (sessão, links do menu)
**Tags:** `actos-cdn` · `cdn:export` · `webpage/` · `actos/fs` · kernel-em-branch · trampolim

---

## 1. Síntoma que motivou esta investigação

A GitHub Page do Exemplo 6 (`…/github-actions/llm-infra-planner/`) **já estava
published** (200 + `<title>LLMcalc</title>` + bundle 200), mas a SPA **não renderizava a
calculadora** — só o shell. O usuário levantou a hipótese:

> "construí o kernel numa branch — pode ter a ver? Construído com workflow harness,
> comando `npm run cdn:export`"

**Resposta curta: SIM, tem a ver — e está provado por execução, não por leitura.**

## 2. Validação via código (execução real, lado a lado)

Setup: dois worktrees isolados (`origin/main` @ `93a885a` e
`origin/arena/01a01e33-github-actions` @ `3b269bd`), mesmo `node_modules`,
mesmo `ACTOS_GITFS=0`, mesmo comando:

```
npm run cdn:export   # npx tsx src/cli/cdn-export.ts
```

### 2.1 Estado estático (git ls-tree)

| Fonte | `src/cli/cdn-export.ts` | `webpage/llm-infra-planner/index.html` |
|---|---|---|
| `main` (`93a885a`) | ✅ tem **merge do webpage/** | ✅ **SIM** |
| branch antiga (`3b269bd`) | ⚠️ tem, **sem** o merge do webpage/ | ❌ **NÃO** |
| `actos/fs` (`eee71f2`) | n/a (só objectos) | ❌ **NÃO** |

### 2.2 Execução real de `cdn:export`

**Branch antiga (`3b269bd`) — kernel SEM webpage:**
```
[cdn-public] /tmp/old-cdn n= 37
... (só objects/cache) ...
# NÃO imprime "[cdn-public] webpage/ merged"
# /tmp/old-cdn/llm-infra-planner → NÃO EXISTE ❌
```

**Main (`93a885a`) — kernel COM webpage:**
```
[cdn-public] /tmp/new-cdn n= 37
...
[cdn-public] webpage/ merged → /tmp/new-cdn
# /tmp/new-cdn/llm-infra-planner/index.html → <title>LLMcalc</title> ✅
```

`diff -rq /tmp/old-cdn /tmp/new-cdn` → `Only in new: README.md, llm-infra-planner`.

**Conclusão empírica:** o mesmo comando, com um kernel de uma branch sem o merge,
**produz um CDN sem a calculadora**. O facto de a página estar live hoje deve-se
exclusivamente ao `cdn-pages.yml` fazer `checkout ref: main`.

## 3. A cadeia real (quem corre o quê)

1. **Kernel vive em branch** (`arena/01a01e33-github-actions` histórica; a sessão atual
   `arena/01a02761-github-actions`). Os **workflows de produção vivem na `main`**
   (trampolim copiado pelo humano) — a branch de kernel **não tem**
   `.github/workflows/{cdn-pages,gc}.yml`.
2. **`actos-cdn` (`cdn-pages.yml`, em `main`)**:
   `checkout ref: main` → `npm ci` → `npx tsx src/cli/fs-sync.ts --hydrate` →
   `npm run cdn:export` → `upload-pages-artifact` → `deploy-pages`.
   O `cdn-export.ts` **da main** = `publishObjects(...)` **+ `copyDir(webpage → .actos-cdn)`**.
3. **`actos-gc` (`gc.yml`, em `main`)**:
   `checkout ref: arena/01a01e33-github-actions` (**branch antiga!**) →
   `npx tsx src/cli/gc.ts --sync` → `fs-sync.ts --push` → escreve **`actos/fs`**.
4. **`actos/fs`** é só o **object store ACTOS** (`agents/*`, `objects/*`, `cache/*`,
   `proc/*`) — **não contém `webpage/`** e **não contém o kernel**.
   Alimenta a **raiz do CDN** (`/`, `/obj/…`, index “ACTOS CDN”).

## 4. Reflexão (o que isto ensina)

- **O que corre num workflow é o conteúdo da branch que o `checkout` usa, não o que
  tu construíste noutro lado.** “Kernel na branch X” só é verdade enquanto o workflow
  aponta para X **e** X está atualizada. A branch antiga (`3b269bd`) hoje tem o
  `cdn-export` **sem** o merge do `webpage/` → se o `actos-cdn` apontasse para ela,
  a página sumia.
- **`webpage/` é uma fonte de verdade separada (árvore de `main`), não é `actos/fs`.**
  O `webpage/` é o build estático da SPA (antes Docker/nginx → agora estático na Pages);
  o `actos/fs` é o disco de objectos do ACTOS. Confundi-los = diagnosticar errado.
- **`cdn:export` é idempotente mas não restaurador**: faz `rm -rf` do `.actos-cdn` e
  volta a publicar **só o que o kernel conhece** (`publishObjects` + `copyDir` se
  `webpage/` existir). Se o checkout não tiver `webpage/`, o resultado é um CDN
  funcional **sem a calculadora** — sem erro, sem warning. Silencioso.
- **O `actos-gc` aponta para uma branch de kernel antiga.** Hoje só escreve o
  `actos/fs` (não quebra a página), mas é uma **bomba-relógio**: a mesma branch
  “de kernel” é a que tem o `cdn-export` desatualizado. Se algum workflow passar a
  exportar com ela, quebra.
- **O sucesso do run (`success`) não prova que a página funciona.** O run de 03:10
  (deploy `3adb67e`) foi `success` e a página estava quebrada. A validação tem de
  ser **no artefacto/render**, não só no status do Actions.

## 5. Correções recomendadas (por ordem de risco)

1. **`gc.yml`: `ref: arena/01a01e33-github-actions` → `ref: main`** — o GC deve
   correr sempre com o kernel atual, não com uma branch congelada.
2. **Invariante no `cdn-pages.yml`** (pós-`cdn:export`):
   ```yaml
   - name: Assert calculadora presente
     run: test -f .actos-cdn/llm-infra-planner/index.html || exit 1
   ```
   Transforma a falha silenciosa em falha do run.
3. **Regra do projeto:** branch de kernel deployável **tem** de conter `webpage/` e
   `src/cli/cdn-export.ts` com o merge; validar com
   `git ls-tree -r <branch> --name-only | grep webpage/llm-infra-planner/index.html`.
4. **Checklist de deploy:** verificar o `sha` do deployment Pages (`…/deployments`,
   `environment=github-pages`) **e** o conteúdo live (render/`<title>` + bundle novo),
   não só o `gh run view` (incl. `npm run cdn:export` local com a **mesma** ref do
   workflow).

## 6. Comandos de verificação rápida (copiar/colar)

```bash
# 1) que kernel o workflow vai usar?
git show <branch>:.github/workflows/cdn-pages.yml | grep -A2 "checkout" | grep ref
# 2) essa branch tem o site?
git ls-tree -r <ref> --name-only | grep -E "webpage/llm-infra-planner/index.html"
# 3) export local com a MESMA ref
ACTOS_GITFS=0 npm run cdn:export && test -f .actos-cdn/llm-infra-planner/index.html
# 4) deploy publicado com que commit?
gh api repos/<owner>/<repo>/deployments?per_page=1\&environment=github-pages --jq '.[0].sha'
```
