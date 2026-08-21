# A tua acção — ligar o CPU no GitHub (sem merge)

O token desta sessão Arena **não tem** permissão `workflows`. Por isso **não consigo** criar `.github/workflows/` em `main`. Sem esses ficheiros na **default branch**, o GitHub **não corre** Actions. O CLI local já é o CPU; o runner remoto ainda está desligado.

Isto **não é merge**. O PR #1 fica aberto. O ramo `arena/01a01e33-github-actions` **não se apaga**.

## O que **não** faças

- Merge do [PR #1](https://github.com/camillanapoles/github-actions/pull/1)
- Apagar o ramo `arena/01a01e33-github-actions`
- Marcar “Delete branch” em lado nenhum
- Continuar noutro branch

## O que faças (uma vez, na tua máquina, com a tua conta)

Precisas de um PAT / login `gh` **teu** com `workflow` + `contents`.

```bash
git clone https://github.com/camillanapoles/github-actions.git
cd github-actions
git fetch origin

# 1. main recebe SÓ os YAML (trampolim). O código continua no arena/.
git checkout main
git pull origin main

mkdir -p .github/workflows
git checkout origin/arena/01a01e33-github-actions -- harness/bootstrap-main
cp harness/bootstrap-main/*.yml .github/workflows/

git add .github/workflows
git commit -m "chore: ACTOS CPU trampoline on default branch (no merge of arena session)"
git push origin main

# 2. volta ao ramo da sessão — o agente continua aqui
git checkout arena/01a01e33-github-actions
```

Os YAML em `main` fazem `actions/checkout` **do ramo arena**. Assim o runner usa o código da sessão **sem** misturares o VFS `actos/fs` nem fechares o PR.

### Pela UI do GitHub (se não quiseres git local)

1. Abre o repo → ramo `main`
2. Create file → `.github/workflows/agent-harness.yml`
3. Copia o conteúdo de  
   https://github.com/camillanapoles/github-actions/blob/arena/01a01e33-github-actions/harness/bootstrap-main/agent-harness.yml
4. Commit **em `main`**
5. Repete para `ci.yml` e `gc.yml` no mesmo folder (os outros podem esperar)

## Verificar

1. Repo → **Actions** — devem aparecer `agent-harness`, `ci`, `actos-gc`
2. `agent-harness` → **Run workflow** → goal: `smoke cpu github`
3. O job faz checkout de `arena/01a01e33-github-actions` e corre `src/cli/agent.ts`

Se o job falhar em `checkout` do arena, confirma que o ramo ainda existe (não apagaste).

## Depois

Volta a esta sessão e diz **continua** / **prossiga**. Eu sigo F5 (Pages/CDN público) no `arena/`.  
`merge` / `fim` / `fechar` só quando quiseres encerrar.
