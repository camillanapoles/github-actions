# Exemplos de uso ACTOS

Cinco projectos **mínimos** neste repo. CPU = `node`, nunca Docker.

Instalar persist:

```bash
# a partir da raiz do github-actions
node plugin/actos/bin/actos-persist.mjs --help || true
```

| # | Pasta | Uso |
| --- | --- | --- |
| 1 | [01-hello-cpu](./01-hello-cpu) | um script |
| 2 | [02-test-suite](./02-test-suite) | suite de testes |
| 3 | [03-data-ingest](./03-data-ingest) | job de dados |
| 4 | [04-static-build](./04-static-build) | build estático |
| 5 | [05-hub-ingest](./05-hub-ingest) | payload do hub |

O próximo agente **completa** o que estiver TODO — ver [`docs/AGENTE-PROXIMO.md`](../docs/AGENTE-PROXIMO.md).
