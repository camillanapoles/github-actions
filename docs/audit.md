# Audit de arquitectura — ACTOS

Data: 2026-08-22 · tag: `arena-agent` · ramo: `arena/01a01e33-github-actions`

**Addendum:** F0–F6 + E9/E12/E14b validados no metal. Este audit descreve o corte de 21 ago; o estado vivo está em [`ROADMAP.md`](./ROADMAP.md).

## Veredito

O **modelo mental está certo**. A engenharia local ilustra o analog. No metal GitHub, até E7, o disco **não era origem viva**: `actos/fs` ficou 14/5 e congelado no smoke F2.

Invariante:

> Action escreve → runtime (espaço único) → resolve → objeto em `pattern+id` → regras → page async lê a projecção. L3 = `refs/heads/actos/fs`.

## Facto git (não é opinião)

`main` tem 5 commits. `actos/fs` tem 14 órfãos. Sem merge-base. Compare = 14 ahead, 5 behind.  
Ahead **deve crescer** (append). Behind **deve manter-se** (nunca misturar código). Ahead parado = kernel a escrever noutro sítio.

## O que a engenharia acertou

1. Ciclo `queued → in_runtime → resolved → cached`. `resolveExecution` é o fsync local.
2. Path como inode (`pattern+id`).
3. Regras no read path.
4. Agente = CLI = o que a Action corre.
5. CAS `sha256` (F1). Sem SHA aleatório.
6. HTTP enqueue / CLI execute (F1/F4).
7. FileDb quando não há `node:sqlite` (Node 20).

## Onde o analog partia (corrigido em E7 ou ainda aberto)

| Peça | Promessa | Antes de E7 | Agora |
| --- | --- | --- | --- |
| `actos/fs` | origin vivo | smoke 02:50, 13 files | attach+`/proc/stat`+push honesto |
| `ensure()` | um só órfão | mintava outro no runner | fetch origin primeiro |
| `ls` | tree do ramo | worktree `.actos-fs` | `ls-tree` |
| lookup | L1→L2→L3→L4 | L1 + SQLite | + `L3-git` |
| GC | promote L1→L3 | 5d + push mascarado | `--sync` + push falha alto |
| FileDb | Node 20 = CI | `status='queued'` ignorado | literais filtrados; testes forçam FileDb |
| CPU GitHub | agent-harness | 0 runs | precisa E8/E9 (humano) |
| Pages | L4 | README da `main` | E12 humano |
| tags CAS | `actos/obj/{sha}` | inexistentes | E14 |
| hydrate | SQLite = projecção | SQLite ainda é fonte da UI | E15 |

## Dívida que fica

- Sem YAML na `arena/` (App sem `workflows`) → CodeQL actions no PR falha.
- Sem `ACTOS_DISPATCH_TOKEN` o HTTP local não dispara o runner.
- Job 6h slice: `checkpoint()` existe; o trampolim ainda não escuta `actos.slice`.
- Kernel continua god object. Não é o corte agora.

## O que não optimizar

- Trocar Next. LLM no harness. Postgres. Microserviços.
