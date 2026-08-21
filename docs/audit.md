# Audit de arquitetura — ACTOS

Data: 2026-08-20 · tag: `arena-agent` · ramo: `arena/01a01e33-github-actions`

## Veredito

O **modelo mental está certo**. A engenharia actual é um **protótipo fiel do analog OS**, não ainda um kernel. Como arquitectura de produto/ensino, valida. Como sistema que outro repo possa montar em produção, ainda é um **simulacro com contratos bons**.

Invariante:

> Action escreve → runtime (espaço único) → resolve → objeto em `pattern+id` → regras → page async lê a DB.

O código **ilustra** o desenho; em vários pontos **não o cumpre**. O plano para o cumprir de verdade, usando o GitHub como metal, está em [`plan-github-os.md`](./plan-github-os.md).

---

## O que a engenharia acertou

1. **Um ciclo de vida, não um CRUD.** `queued → in_runtime → resolved → cached`. `resolveExecution` é o `fsync`.
2. **Path como inode.** `ObjectPath` + `PATTERNS` — identidade derivada, não “em que tabela?”.
3. **Regras depois do path.** chmod/LSM. Transform no *read path* (não corromper o disco).
4. **Agente = programa.** YAML + o mesmo CLI que a Action. UI só dispara goal.
5. **Dois discos.** SQLite = inode table. `data/objects/**.json` = blob (artifact analog).
6. **Page async.** RSC lê a base. O cliente não é fonte de verdade.

---

## Onde o analog parte

| Peça | Promessa | Código |
| --- | --- | --- |
| Runtime “RAM” | efémero | JSON numa row SQLite; seed deixa `in_runtime` eterno |
| Cache | hit se o trabalho for o mesmo | `cacheKey` inclui SHA aleatório → HIT quase morto |
| Harness | `needs`, falha, jobs | loop linear; step nunca falha; `plan()` é `includes("cache")` |
| `fork` | lineage | dois `nid()` — path não aponta para o pid |
| Kernel | syscall table fina | God object |
| GitHub Action | o agente corre no runner | YAML em `harness/github/`, **não** em `.github/workflows/` |
| Execução | uma verdade | 3 cópias (tabela + object + cache) |
| Syscall log | anel (dmesg) | append infinito |
| Agente HTTP | job serverless | `runAgent` síncrono no request |

---

## Dívida (porquê assim)

Slice vertical para **provar o caso**. Custo: fonte de verdade espalhada, sem journal. `write` grava DB + ficheiro + syscall. Crash a meio = inode e blob dessincronizados.

O agente “IA” é um **roteiro determinístico**. Honesto como harness; não é agente. LLM só depois de job queue + CAS.

A sessão Arena (banner, label) é **política de operador**, não do kernel. Separar.

---

## O que não otimizar agora

- Trocar Next.
- LLM no harness.
- Postgres.
- Microserviços Runtime vs Cache.

Próximo corte de engenharia: **journal + CAS + job assíncrono**, e o GitHub como FS — ver o plano.
