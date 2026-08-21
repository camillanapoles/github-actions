# AHEAD TODO — protocolo do agente + ledger

**Injecção permanente.** Todo o turno neste repo começa e acaba aqui.
Plano canónico: [`plan-github-os.md`](./plan-github-os.md).

## Instrução ao agente (sempre)

1. Lê **este ficheiro** antes de escrever código.
2. Trabalha **só** em `arena/01a01e33-github-actions`. Disco = append `actos/fs`. Nunca `main` (salvo o humano copiar trampolim).
3. Cada item fechado **sem residual** marca **`[sucesso sem debito]`**.
4. Se falhar / ficar parcial / 403 / CI vermelho: **não** marques sucesso. Abre **subitem** na todolist:
   `- [ ] ERRO <id>: <síntese> → fazer: <acção>`
5. Cada commit `[arena-agent]` **actualiza** este ficheiro:
   - linha nova no **ledger** (SHA + o quê)
   - checklist
   - **próxima actividade** (1 bloco, executável)
6. Não merges PR #1 até o humano dizer `merge` / `fim` / `fechar` / `encerrar`.
7. Ahead do `actos/fs` **tem de crescer** (append). Behind da `main` **mantém-se**.
8. **Actividade → sleep → captura → continuidade** (não pares à espera do próximo turno):
   1. Escreve a actividade humana no bloco *Próxima actividade* e na resposta.
   2. `sleep` de verificação (≥ 90s; se o metal estiver a correr job, espera o run).
   3. **Captura:** `git fetch` + `gh run list` + `ls-remote` + compare `main`/`actos/fs`.
   4. Lê o resultado. Sucesso → `[sucesso sem debito]`. Erro → subitem ERRO. **Continua** o que ainda for teu.
   5. Não encerres o turno só porque enviaste um comando ao humano.

Marcador canónico de fecho: ``[sucesso sem debito]``.

---

## Checklist

- [x] F0 plano + audit — `[sucesso sem debito]`
- [x] F1 CAS + journal + enqueue≠CPU — `[sucesso sem debito]`
- [x] E7 attach `actos/fs` + FileDb CI + `/proc/stat` (`4776383`, disco `cfc7c49`) — `[sucesso sem debito]`
- [x] E8 humano copiou trampolim → `main` `38e6393` — `[sucesso sem debito]`
- [x] Protocolo AHEAD + injecção no plano — `[sucesso sem debito]`
- [x] E13 kernel: `sliced` + IRQ `event_type=actos.slice` + `--slice` — `[sucesso sem debito]`
- [x] E14 `tagCas` idempotente (testes isolados) — `[sucesso sem debito]`
- [x] E15 `hydrateFromL3` (testes isolados) — `[sucesso sem debito]`
- [x] E8b trampolim `actos.slice` → `main` `8a231b3` — `[sucesso sem debito]`
- [ ] E9 humano: Actions → agent-harness → `smoke cpu github`
- [ ] E10 humano: Settings → Actions → Workflow permissions **Read and write**
- [ ] E11 CodeQL *actions* no PR (falha esperada sem YAML no arena)
- [ ] E12 Pages → `.actos-cdn` / `actos/cdn` (não `main` `/`)
- [ ] E14b ruleset anti force-push em `actos/fs`
- [ ] E16 CI do PR #1 verde neste SHA
- [ ] E17 push tags `actos/obj/*` no origin

---

## Todolist

- [ ] E9 smoke CPU GitHub (0 runs do harness até agora)
  - [ ] ERRO E9-0: `gh run list --workflow=agent-harness.yml` vazio. Fazer: Run workflow **ou** o agente tenta `gh workflow run`.
- [ ] E10 write permission (senão E9 push L3 = 403)
- [ ] E12 Pages L4
- [ ] E16 confirmar `ci` no PR
  - [ ] ERRO CI-pre-E7: `npm test` exit 1 no Node 20 (FileDb `status='queued'`). Mitigado em E7 + trampolim `38e6393`. **Validar no próximo run.**
  - [ ] ERRO CodeQL-actions: *no source code seen* no PR. Sem YAML no arena. Não é regressão.
- [ ] E14b ruleset
  - [ ] ERRO E14b: `gh api .../rulesets` → 403 *Resource not accessible by integration*. Fazer: humano cria ruleset `actos-fs-append-only` (block force-push + deletion em `actos/fs`).
- [ ] E17 tags no origin depois do CPU

---

## Ledger (cada commit)

| SHA | Ramo | O quê |
| --- | --- | --- |
| `c7dc241` | main | Initial commit |
| `334001b` `1ced5fd` `9487a17` `972a013` `38e6393` | main | trampolim YAML (humano) |
| `1f3a249`…`103eab9` | actos/fs | F2 smoke (14) |
| `cfc7c49` | actos/fs | `/proc/stat` (15º) |
| `4776383` | arena | E7 attach + FileDb |
| `5acc6bd` | arena | AHEAD + E13 slice + E14 CAS tag + E15 hydrate |
| `0c7060e` | arena | AHEAD ledger SHA |
| `8a231b3` | main | feat: actos.slice on agent-harness (humano E8b) |
| *este commit* | arena | injecção sleep→captura→continua + E8b marcado |

`actos/fs` vs `main`: ahead cresce; behind cresce quando a `main` ganha trampolim. Behind correcto.

---

## Próxima actividade

E8b já está na `main` (`8a231b3`). Falta o CPU e as settings.

1. **E10** Repo → Settings → Actions → General → Workflow permissions = **Read and write** → Save.
2. **E9** Actions → **agent-harness** → Run workflow → goal `smoke cpu github`.
3. **E14b** Settings → Rules → New: nome `actos-fs-append-only`, target branch `actos/fs`, Block force pushes + Restrict deletions.
4. Agente neste turno: depois desta mensagem, `sleep` → `scripts/verify-metal.sh` → marca E9/E16 se o metal tiver corrido.

Não merge. Não force-push `actos/fs`. Não apagar `arena/…`.
