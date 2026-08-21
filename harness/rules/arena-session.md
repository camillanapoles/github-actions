# Regra arena-session `[arena-agent]`

Para agentes web (Arena e similares) e para quem não vive em git.

Isto **não é um commit**. É a prática da sessão. Merge **não** apaga a sessão;
apagar o ramo `arena/…` ou trabalhar noutro branch é que a perde.

## Se quiseres continuar a iterar

1. **Não faças merge ainda.** Deixa o PR aberto.
2. O agente faz **commit e `push` só** para `arena/<sessao>`.
3. O PR atualiza sozinho a cada push.
4. Merge **só** quando o trabalho estiver fechado para ti.

## Quando é que a sessão finda

Só quando disseres de forma **clara**: `merge`, `fim`, `fechar`, `encerrar`.

Até lá o fluxo automático é: commit + push no ramo `arena/…` + label/tag `arena-agent`.

## Não confundas

| Ação | O que acontece |
| --- | --- |
| Merge do PR | O código vai para `main`. A sessão **continua no ramo arena** |
| Apagar o ramo `arena/…` | A sessão Arena **perde o tracking** — não faças isto |
| Continuar noutro branch | Trabalho **não** fica associado à sessão |
| Dizer “continua” / novo pedido | Agente segue no mesmo `arena/<sessao>` |

Tag de rastreio: **`arena-agent`** (commits, PR, label).

## AHEAD (obrigatório em todo o turno)

Ler e actualizar [`docs/AHEAD.md`](../../docs/AHEAD.md).

- Sucesso sem residual → **`[sucesso sem debito]`**
- Erro → subitem na todolist (`ERRO … → fazer: …`)
- Cada commit → ledger (SHA) + checklist + próxima actividade
