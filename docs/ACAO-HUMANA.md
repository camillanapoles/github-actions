# A tua acção — estado

O token Arena **não escreve** `.github/workflows/`. Tu copiaste o trampolim para a `main`. **Já está feito.**

Isto **não é merge**. O PR #1 fica aberto até `merge` / `fim` / `fechar`.

## Validado (não voltar a copiar à toa)

| Item | Evidência |
| --- | --- |
| Trampolim na `main` | `ci.yml` `agent-harness.yml` `gc.yml` `cdn-pages.yml` (`262d395`) |
| **E9** CPU | `agent-harness` dispatch **success** [32542510967](https://github.com/camillanapoles/github-actions/actions/runs/32542510967) |
| **E10** permissions | YAML `permissions` + setting Read and write |
| **E12** Pages | `build_type: workflow` · https://camillanapoles.github.io/github-actions/ |
| **E14b** ruleset | `anti force-push em actos/fs` active — sem force-push / delete |

Se o YAML do trampolim **mudar** outra vez no `arena/`:

```bash
git checkout main && git pull
git checkout origin/arena/01a01e33-github-actions -- harness/bootstrap-main
cp harness/bootstrap-main/*.yml .github/workflows/
git add .github/workflows && git commit -m "chore: refresh ACTOS trampoline" && git push
git checkout arena/01a01e33-github-actions
```

## O que **não** faças

- Merge do [PR #1](https://github.com/camillanapoles/github-actions/pull/1) sem dizer `merge` / `fim`
- Apagar `arena/01a01e33-github-actions`
- Force-push `actos/fs`
- Usar `main` como VFS
