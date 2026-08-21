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
- [ ] E8b humano: recopiar trampolim (`actos.slice` no `agent-harness.yml`)
- [ ] E9 humano: Actions → agent-harness → `smoke cpu github`
- [ ] E10 humano: Settings → Actions → Workflow permissions **Read and write**
- [ ] E11 CodeQL *actions* no PR (falha esperada sem YAML no arena)
- [ ] E12 Pages → `.actos-cdn` / `actos/cdn` (não `main` `/`)
- [ ] E14b ruleset anti force-push em `actos/fs`
- [ ] E16 CI do PR #1 verde neste SHA
- [ ] E17 push tags `actos/obj/*` no origin

---

## Todolist

- [ ] E8b recopiar `harness/bootstrap-main/*.yml` → `.github/workflows/` (slice)
- [ ] E9 smoke CPU GitHub (0 runs do harness até agora)
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
| *este commit* | arena | AHEAD + E13 slice + E14 CAS tag + E15 hydrate |

`actos/fs` vs `main`: ahead = commits de disco; behind = 6 (main cresceu com E8). Behind correcto.

---

## Próxima actividade

1. `npm test` + `tsc` desta entrega; push arena; tag `arena-agent`.
2. Humano (se ainda não): **E9** Run workflow `agent-harness` goal `smoke cpu github`. **E10** Read and write.
3. Agente no turno seguinte: ler CI do PR (E16); se verde → `[sucesso sem debito]`; se vermelho → subitem ERRO com o log.
4. Depois: E14b ruleset, E12 árvore `.actos-cdn` pronta a apontar.

Não merge. Não force-push `actos/fs`. Não apagar `arena/…`.
