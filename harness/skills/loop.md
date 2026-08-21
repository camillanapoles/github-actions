# Skill `/loop`

Trigger permanente. Depois de **emitir** trabalho ao GitHub, **não pares**.

```
git push origin arena/01a01e33-github-actions && git log -1 --oneline
        ↓
while (cada 15s):
    gh run list  — filtrar headSha == HEAD
    se status=completed → RETURN (sucesso ou falha)
    se timeout 10 min → ERRO loop-timeout
        ↓
ler conclusão → AHEAD ([sucesso sem debito] | subitem ERRO)
        ↓
actividade seguinte
```

Implementação: `scripts/loop-action.sh [sha]`.

Regras:

- Intervalo **15 segundos**. Sem sleep longo cego.
- Um SHA, todos os runs desse SHA. Sai quando **não há** `in_progress`/`queued` **e** há pelo menos um `completed` — ou quando o `ci` desse SHA concluiu.
- Falha do workflow ≠ parar o turno: abre ERRO e segue o próximo item do AHEAD.
- Depois do RETURN, a actividade seguinte é a primeira caixa por marcar no checklist.

Não uses `/loop` para esperar o humano. Usa para esperar **Actions**.
