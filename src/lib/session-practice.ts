export const ARENA_AGENT_TAG = "arena-agent";

export const SESSION_PRACTICE = {
  tag: ARENA_AGENT_TAG,
  title: "Sessão Arena — não confundas merge com fim",
  lines: [
    "Não faças merge ainda se quiseres continuar. Deixa o PR aberto.",
    "O agente faz commit e push só para arena/<sessao>. O PR atualiza sozinho.",
    "Merge não apaga a sessão. Apagar o ramo arena/… é que a perde.",
    "Fim só quando disseres claramente: merge, fim, ou fechar.",
  ],
} as const;
