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
9. **Skill `/loop`** ([`harness/skills/loop.md`](../harness/skills/loop.md)):
   depois de `git push && git log`, corre `scripts/loop-action.sh` —
   **while a cada 15s** até o workflow desse SHA devolver. RETURN → marca AHEAD → **actividade seguinte**. Não pares.

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
- [x] E9 `agent-harness` dispatch success `32542510967` — `[sucesso sem debito]`
- [x] E10 permissions — YAML + setting — `[sucesso sem debito]`
- [ ] E11 CodeQL *actions* no PR (esperado; sem YAML no arena)
- [x] E12b trampolim `cdn-pages.yml` → `main` `262d395` — `[sucesso sem debito]`
- [x] E12 Pages `build_type=workflow` + `actos-cdn` success — `[sucesso sem debito]`
- [x] E14b ruleset `anti force-push em actos/fs` #21177682 — `[sucesso sem debito]`
- [x] E16 CI `d9a9ede` / `0442cac` / `b8f7e3b` verde — `[sucesso sem debito]`
- [x] E17 tags `actos/obj/*` no origin (13) — `[sucesso sem debito]`
- [x] CPU local `smoke cpu github` → L3 `62ad489` — `[sucesso sem debito]`
- [x] Skill `/loop` CI `b8f7e3b` 15s → success `32532886761` — `[sucesso sem debito]`
- [x] E18 `read()` projecta L3 no ENOENT; `drain` retoma `sliced` — `[sucesso sem debito]`
- [x] E12 deploy `actos-cdn` 2× success (`32534221522`, `32537827431`) — `[sucesso sem debito]`
- [x] GC schedule append `/proc/stat` → `aae4abf` — `[sucesso sem debito]`

---

## Todolist

- [x] E9 · E12 · E14b — validados 2026-08-22
- [ ] E11 CodeQL *actions* no PR: **esperado**, não é débito do OS
- [x] Plugin + skill `/convert` + receita `llm-infra-planner` — `[sucesso sem debito]`
- [x] Pages é CDN (34 obj, `index.json`, não README) — `[sucesso sem debito]`
- [ ] ERRO E12-href: links do index.html iam a `github.io/obj/…` (404). Fix href `./obj/{sha}` nesta entrega — precisa re-run `actos-cdn`
- [ ] Sessão: merge só com `merge` / `fim` / `fechar`

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
| `d9a9ede` | arena | injecção sleep→captura→continua + E8b |
| `0442cac` | arena | captura CI verde; E9 dispatch 403 |
| `b8f7e3b` | arena | skill /loop + cdn-pages.yml |
| `62ad489` | actos/fs | smoke cpu github + /proc/stat (disco vivo) |
| `b9adf38` | arena | /loop RETURN; E17 tags; L3 avançou |
| `262d395` | main | feat: actos-cdn pages trampoline (humano E12b) |
| `6fd38b3` | arena | E10 fechado; E18 read-through + drain sliced |
| `aae4abf` | actos/fs | GC `/proc/stat` (disco a crescer sozinho) |
| `35e1b79` | arena | ROADMAP inicial |
| `32542510967` | Actions | E9 agent-harness success |
| `#21177682` | ruleset | E14b anti force-push `actos/fs` |
| `3a0cac7` | arena | docs alinhados ao metal |
| *este commit* | arena | plugin ACTOS + skill convert + receita planner |

`actos/fs` vs `main`: ahead cresce; behind cresce quando a `main` ganha trampolim. Behind correcto.

---

## Próxima actividade

E9/E12/E14b fechados. Plugin + skill `/convert` nesta entrega.

Agente: `git push && git log` → `npm run loop`.

Aplicar no planner: noutro checkout (não neste ramo Arena).

Não merge. Não force-push `actos/fs`. Não apagar `arena/…`.
