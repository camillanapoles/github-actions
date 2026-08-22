# Validação do trampolim na `main`

HEAD `main` validado: `262d395` `feat: actos-cdn pages trampoline`. **Não foi merge do arena.**

## O que está certo (2026-08-22)

| Check | Estado |
| --- | --- |
| `.github/workflows/agent-harness.yml` | Node 20, attach `actos/fs`, slice, push L3 |
| `ci.yml` | `permissions: contents: read`, FileDb, `npm test` |
| `gc.yml` | `--sync`, attach L3, concurrency `actos-fs` |
| `cdn-pages.yml` | hydrate + export + `deploy-pages` |
| `actos-gc` schedule | **success** (append `/proc/stat`) |
| `agent-harness` | **success** run 32542510967 |
| `actos-cdn` | **success** (vários, último após o harness) |
| Pages | `build_type: workflow` · https://camillanapoles.github.io/github-actions/ |
| Ruleset | `anti force-push em actos/fs` (#21177682) |
| Secrets / vars | nenhum obrigatório |
| Ramo `arena/…` | intacto |
| Ramo `actos/fs` | intacto, append-only |

## CodeQL no PR

*Analyze (actions)* no PR #1 pode falhar: o `arena/` **não tem** `.github/workflows/`. Esperado. O scan que conta é o da `main`.

## Smoke

Actions → **agent-harness** → Run → já correu com sucesso.
